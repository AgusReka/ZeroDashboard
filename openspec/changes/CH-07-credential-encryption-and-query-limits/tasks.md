# Tasks: CH-07 — Credential Encryption and Query Limits

Derived from `design.md`. Verification tasks map to scenarios in `specs/credential-encryption`,
`specs/connection-registration`, `specs/query-execution`, `specs/query-console`.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~850–1000 total (per-slice: ~260 / ~230 / ~180 / ~130) |
| 400-line budget risk | High (whole change), Low (each slice on its own) |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

**Branch-targeting note (reconciles design.md with the cached `stacked-to-main` choice):** design.md's slice
plan describes `feature-branch-chain` framing ("PR #1 targets the feature branch; #2–#4 each target the
previous slice's branch; only the tracker merges to main"). The session cached `stacked-to-main` instead. The
four slices — content, order, boundaries — are unchanged; only branch targeting changes: PR #1 targets `main`
directly, PR #2 targets PR #1's branch, PR #3 targets PR #2's branch, PR #4 targets PR #3's branch, and each
may merge to `main` in sequence as it is approved — there is no tracker PR and no single gate the others wait
on. This matches CH-03 through CH-06's confirmed `stacked-to-main` convention.

Threat Matrix is `N/A` per design.md (no routing topology, shell/subprocess, VCS/PR automation, or
executable-classification surface). Rule 7 (no key/plaintext in response, error, or log) and Rule 4 (limits
bound as driver parameters, never spliced into SQL) are carried as explicit test/verification tasks below
instead of threat-matrix rows.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Crypto module + master-key boot validation + unit tests. No call site wired. | PR 1 (base: `main`) | `npm test -- src/cripto-credencial.test.ts src/config.test.ts` | N/A — pure unit, no DB, no call site wired yet | Delete `src/cripto-credencial.ts` and `src/cripto-credencial.test.ts`; revert `src/config.ts`, `src/config.test.ts`, `.env.example` |
| 2 | `conexion-destino.ts` wiring, encipher on create, both read paths, `409 credencial-ilegible` | PR 2 (base: PR 1 branch) | `npm test -- src/conexion-destino.test.ts src/conexiones.test.ts src/consultas.test.ts` | Manual against local PostgreSQL: register → `prueba` → `ejecutar` | Revert `src/conexion-destino.ts(.test.ts)` and the call-site diffs in `src/conexiones.ts`/`src/consultas.ts` — clean, no migration produced ciphertext (DEC-20) |
| 3 | `maxFilasPorConsulta`, `limiteEfectivo`/`corte`, `maximum: 200` schema removal | PR 3 (base: PR 2 branch) | `npm test -- src/consulta-ejecucion.test.ts src/consultas.test.ts src/config.test.ts` | Manual: execute a statement whose result exceeds the configured cap, observe `corte` | Restore `MAX_FILAS_CONSULTA` default and revert `src/consulta-ejecucion.ts`/`src/consultas.ts` — reproduces today's 200-row/15000ms behavior |
| 4 | Console cap sentence, `credencial-ilegible` entry, smoke | PR 4 (base: PR 3 branch) | `npm test -- src/consola.test.ts` (or existing smoke script) | Manual console flow: register → test → execute a capped query → observe distinct message | Revert `src/consola.ts` and the smoke addition; no persisted state affected |

## 1. Crypto Module, Master-Key Validation & Env (PR 1 → `main`)

- [x] 1.1 RED: create `src/cripto-credencial.test.ts` — round-trip decrypts to the original plaintext; the same plaintext enciphered twice yields two different envelopes (fresh IV); a tampered tag, tampered ciphertext, and a malformed/unversioned envelope all throw `ErrorCredencialIlegible` (spec `credential-encryption`: "Versioned Authenticated Envelope Format" scenarios)
- [x] 1.2 Create `src/cripto-credencial.ts`: `cifrarCredencial`/`descifrarCredencial` using `node:crypto` AES-256-GCM, random 12-byte IV per call, `v1:iv:tag:ciphertext` base64 envelope, `ErrorCredencialIlegible` export, master key cached in module scope only — never exported, never logged (satisfies 1.1; Rule 7)
- [x] 1.3 RED: create `src/config.test.ts` — `loadConfig()` throws when `CREDENTIAL_MASTER_KEY` is unset, when it is not valid base64, and when it decodes to fewer than 32 bytes; succeeds with a valid 32-byte base64 key (spec `credential-encryption`: "Fail-Closed Master Key Validation at Boot" both scenarios)
- [x] 1.4 Modify `src/config.ts`: validate `CREDENTIAL_MASTER_KEY` (base64-decode, require exactly 32 bytes) inside `loadConfig()`, throwing before `src/server.ts:14`'s existing call reaches `listen`; generalize `presupuestoOpcionalMs` into a reusable positive-integer-from-env helper for Phase 3 reuse (satisfies 1.3)
- [x] 1.5 Modify `.env.example`: add a `CREDENTIAL_MASTER_KEY` placeholder line (no real key value committed)
- [x] 1.6 Verify Rule 7 by inspection: no line in `src/cripto-credencial.ts` or `src/config.ts` logs, throws, or returns the key or a plaintext value (spec `credential-encryption`: "Master Key and Deciphered Credential Never Exposed")
- [x] 1.7 Checkpoint: `npm test -- src/cripto-credencial.test.ts src/config.test.ts` green; no call site references `cripto-credencial.ts` yet

## 2. Encipher/Decipher Wiring & 409 Mapping (PR 2 → base PR 1)

- [x] 2.1 RED: extend `src/conexiones.test.ts` — registering a connection persists a `credencial` value matching the `v1:...` envelope shape, and the submitted plaintext never appears in the stored row (spec `connection-registration`: "Registering a valid connection")
- [x] 2.2 Create `src/conexion-destino.ts`: export `destinoDeConexion(prisma, id)` as the sole `credencial: true` read in the codebase; deciphers via `descifrarCredencial`, returns `(DestinoPostgres & { id: string }) | null`, throws `ErrorCredencialIlegible` on an undecipherable envelope (spec `credential-encryption`: "Deciphered Only in Memory at a Use Site"; design interface)
- [x] 2.3 Create `src/conexion-destino.test.ts`: RED then GREEN for `destinoDeConexion` — deciphers a valid envelope, returns `null` for an unknown id, throws `ErrorCredencialIlegible` for a legacy plaintext/corrupted row (spec `connection-registration`: "A database dump never yields a readable credential")
- [x] 2.4 Modify `src/conexiones.ts` create route: call `cifrarCredencial(body.credencial)` before `prisma.conexion.create` (satisfies 2.1)
- [x] 2.5 Modify `src/conexiones.ts` `/conexiones/:id/prueba`: replace the direct `findUnique({ select: { ..., credencial: true } })` block with `destinoDeConexion(prisma, request.params.id)`; map a thrown `ErrorCredencialIlegible` to `409 { error: 'credencial-ilegible' }` (design DEC-20 resolution)
- [x] 2.6 Modify `src/consultas.ts` `/consultas/ejecutar`: replace its direct `findUnique({ select: { ..., credencial: true } })` block with `destinoDeConexion(prisma, body.conexionId)`; map `ErrorCredencialIlegible` to `409` the same way
- [x] 2.7 Update `src/conexiones.test.ts` and `src/consultas.test.ts` fixtures to seed enciphered credentials directly (no route round-trip needed for setup); add a case asserting a legacy plaintext row returns `409 credencial-ilegible` on both `prueba` and `ejecutar`, with no plaintext/deciphered value in the response body or logged output (spec `connection-registration`: "Credential Value Never Exposed" scenarios)
- [x] 2.8 Grep-verify the single-point invariant: `credencial: true` appears in exactly one file, `src/conexion-destino.ts` (design architecture decision)
- [x] 2.9 Checkpoint: `npm test -- src/conexion-destino.test.ts src/conexiones.test.ts src/consultas.test.ts` green

## 3. Configurable Row Cap & Cutoff Verdict (PR 3 → base PR 2)

- [ ] 3.1 RED: extend `src/config.test.ts` — `maxFilasPorConsulta` parses `MAX_FILAS_CONSULTA` via the Phase-1 generalized helper, defaults to `200` when unset, rejects a non-positive-integer value (spec `query-execution`: "Row cap is configurable without a source change")
- [ ] 3.2 Modify `src/config.ts`: add `maxFilasPorConsulta` to `AppConfig`, default `200` (satisfies 3.1); modify `.env.example` adding `MAX_FILAS_CONSULTA=200`
- [ ] 3.3 RED: extend `src/consulta-ejecucion.test.ts` — `limiteEfectivo = min(limite, topeFilas)`; a result at or under the cap reports `corte: null` with unchanged `hayMas`/pagination behavior; a result exceeding the cap reports `corte: 'tope-de-filas'` and never sets `hayMas` to signal it (spec `query-execution`: both new scenarios)
- [ ] 3.4 Modify `src/consulta-ejecucion.ts`: add `topeFilas` to `PeticionEjecucion`; compute `limiteEfectivo`; bind `LIMIT limiteEfectivo + 1` as a driver parameter (never spliced into SQL text — Rule 4); add `CorteEjecucion` type and `corte: CorteEjecucion | null` to `EjecucionExitosa`, outside `Paginacion`; add `topeFilas` to the returned `paginacion` (satisfies 3.3; design interfaces)
- [ ] 3.5 Modify `src/consultas.ts`: remove `maximum: 200` from `ejecucionSchema` (`minimum: 1`, `default: 50` stay); pass `config.maxFilasPorConsulta` as `topeFilas` into the `ejecutarConsulta` call
- [ ] 3.6 Update `src/consultas.test.ts`: assert the schema now accepts `limite` values above 200; assert a capped response includes `corte: 'tope-de-filas'` and `paginacion.topeFilas`, and an uncapped response includes `corte: null`
- [ ] 3.7 Checkpoint: `npm test -- src/consulta-ejecucion.test.ts src/consultas.test.ts src/config.test.ts` green

## 4. Console Surface & Smoke (PR 4 → base PR 3)

- [ ] 4.1 Modify `src/consola.ts` `estado` rendering (near line 275's `hayMas` text): when `cuerpo.corte === 'tope-de-filas'`, render a legible "capped at the configured limit" sentence, visually and textually distinct from the existing "Hay más resultados." text, and do not enable the "load more" control for that response (spec `query-console`: both scenarios)
- [ ] 4.2 Modify `src/consola.ts`: add a `credencial-ilegible` entry to the console's error-message mapping table used for failed responses
- [ ] 4.3 Extend the existing smoke coverage (`scripts/smoke.sh` or console `inject()` suite) to cover register → test → execute → capped-page, asserting the distinct cap message appears (design Testing Strategy, E2E row)
- [ ] 4.4 Full-suite checkpoint: `npm test` green across all four slices together end to end

## Key Success-Criteria Traceability

- No-plaintext-at-rest and boot-refusal criteria → Phase 1 (1.1–1.4) and Phase 2 (2.1, 2.7)
- End-to-end connect/test/execute after the change → Phase 2 (2.9) and Phase 4 (4.3)
- Configurable timeout/row cap with legible cutoff → Phase 3 (3.1–3.6) and Phase 4 (4.1)
- No key/credential exposure in any surface → Phase 1 (1.6), Phase 2 (2.7), Phase 4 (4.2)
