# Design: CH-07 — Credential Encryption and Query Limits

## Technical Approach

One new crypto module (`node:crypto`, AES-256-GCM, DEC-16) plus one new credential-bearing read accessor. The master key is validated at boot inside `loadConfig()` — already the single required-env chokepoint, already called at `src/server.ts:14` before `listen`, so fail-closed (DEC-17) needs no new boot hook. The row cap becomes configuration (DEC-19) and reports its own verdict alongside, never inside, `paginacion` (DEC-18). No schema change, no migration.

## Architecture Decisions

### Decision: explicit encipher/decipher at call sites, behind one accessor — not a Prisma extension

| Option | Tradeoff |
|---|---|
| Prisma extension (DEC-13 precedent) | **Rejected.** CH-06's extension rewrites *arguments* before `query(args)`; transparent encryption must also rewrite *results*. Result-rewriting is the direction that collides with `ConexionPublica`: today "no response can echo the credential" is guaranteed structurally — the column is never fetched. A result-decipher extension makes plaintext appear wherever `credencial` is selected, downgrading a compile-time absence to a runtime hope. It also cannot be fail-closed like `aplicarAlcance()`, since it must tolerate rows where the column was not selected. |
| Explicit calls, three sites | **Chosen.** Encryption covers one column on a closed set of paths, unlike tenant injection which must cover every route ever added. |

Single-point property is preserved without the extension: `src/conexion-destino.ts` exports `destinoDeConexion(prisma, id)`, the **only** place in the codebase that writes `credencial: true`, returning a `DestinoPostgres` whose `password` is already deciphered. Both read paths call it; a grep for `credencial: true` yielding one hit is a reviewable invariant.

### Decision: the cap reuses the existing `LIMIT`+1 probe row

`limiteEfectivo = min(limite, config.maxFilasPorConsulta)`; bind `LIMIT limiteEfectivo + 1`. The probe row still answers "is there more" (`hayMas`, unchanged CH-04 meaning); the clamp answers "did we cut you". No second ceiling layer, no `count(*)`, one query. Rejected: a separate ceiling above page size — two mechanisms computing overlapping truths from the same row set.

### Decision: cap cut, timeout and pagination are distinguished by envelope shape, all at HTTP 200

| Situation | Shape |
|---|---|
| ordinary pagination | `resultado:'ok'`, `corte:null`, `paginacion.hayMas:true` |
| cap cut | `resultado:'ok'`, `corte:'tope-de-filas'` |
| timeout | `resultado:'fallo'`, `fase:'ejecucion'`, `categoria:'tiempo-agotado'` |

200 for all three keeps CH-04's rule: a completed attempt is 200 whatever its verdict; 4xx stays for failures of the *request*. `corte` is a new top-level field on `EjecucionExitosa`, deliberately outside `Paginacion` — putting it there is what DEC-18 forbids. `paginacion.topeFilas` reports the configured ceiling so the console can name the number.

The static `maximum: 200` in `ejecucionSchema` is **removed**: a schema literal cannot express a runtime-configured ceiling, and it would 400 before the clamp could ever fire. `minimum: 1`, `default: 50` stay.

### Decision: an undecipherable credential is `409 credencial-ilegible`

DEC-20 leaves pre-CH-07 plaintext rows in place. `descifrarCredencial` throws `ErrorCredencialIlegible`; both routes map it to `409 { error: 'credencial-ilegible' }`. The row fails legibly instead of being dialled as a password. Rejected: a legacy-plaintext tolerance window (it would mean never being sure a stored value is ciphertext).

**DEC-20 removes the proposal's slice-2 rollback hazard.** With no backfill-encipher migration, no forward migration produces ciphertext, so reverting the code strands nothing. No reverse migration and no tolerance window are designed.

## Data Flow

    POST /conexiones ──→ cifrarCredencial() ──→ prisma.create ──→ ConexionPublica (no credencial)

    POST /conexiones/:id/prueba ─┐
                                 ├─→ destinoDeConexion() ─→ descifrarCredencial() ─→ pg
    POST /consultas/ejecutar ────┘                                    (in memory only)

The key Buffer lives in module scope inside `cripto-credencial.ts`, never on `AppConfig`, never returned, never logged (Rule 7).

## File Changes

| File | Action | Description |
|---|---|---|
| `src/cripto-credencial.ts` | Create | `cifrarCredencial`/`descifrarCredencial`, `v1:iv:tag:ciphertext` base64, 12-byte random IV, `ErrorCredencialIlegible`, private cached key |
| `src/conexion-destino.ts` | Create | `destinoDeConexion()` — the only `credencial: true` read |
| `src/config.ts` | Modify | validate `CREDENTIAL_MASTER_KEY` (base64 → exactly 32 bytes) fail-closed; add `maxFilasPorConsulta`; generalize the positive-integer helper |
| `src/conexiones.ts` | Modify | encipher on create; probe path via `destinoDeConexion`; 409 mapping |
| `src/consultas.ts` | Modify | drop `maximum: 200`; use `destinoDeConexion`; pass cap; 409 mapping |
| `src/consulta-ejecucion.ts` | Modify | `topeFilas` in `PeticionEjecucion`, `limiteEfectivo`, `corte` on `EjecucionExitosa` |
| `src/consola.ts` | Modify | cap sentence in `estado` (not the failure banner — that separation *is* DEC-18 in the UI); `credencial-ilegible` entry |
| `.env.example` | Modify | `CREDENTIAL_MASTER_KEY` placeholder, `MAX_FILAS_CONSULTA=200` |
| `*.test.ts` | Modify | existing suites updated for ciphertext and cap |
| `prisma/schema.prisma` | None | no column, no migration (DEC-19, DEC-16) |

## Interfaces / Contracts

```ts
export type CorteEjecucion = 'tope-de-filas';
export interface EjecucionExitosa {
  resultado: 'ok'; fase: 'ejecucion';
  columnas: string[]; filas: unknown[][];
  corte: CorteEjecucion | null;          // new — outside Paginacion by design
  paginacion: Paginacion & { topeFilas: number };
  duracionMs: number;
}
export function destinoDeConexion(
  prisma: PrismaAislado, id: string,
): Promise<(DestinoPostgres & { id: string }) | null>;  // throws ErrorCredencialIlegible
```

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | round-trip; distinct IV per call; tampered tag/ciphertext/version rejected; malformed envelope rejected | `cripto-credencial.test.ts`, no DB |
| Unit | boot refusal on absent / short / non-base64 key; cap parsing | `config` tests |
| Unit | `limiteEfectivo` clamp, `corte`, `hayMas` independence | `consulta-ejecucion.test.ts` |
| Integration | stored value is an envelope, never plaintext; no response/log carries key or plaintext; 409 on a plaintext legacy row | `inject()` per `fastify-best-practices` |
| E2E | register → test → execute → capped page | console smoke |

## Threat Matrix

N/A — no routing topology change, shell command, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. Rule 7 (no key/plaintext in response, error or log) and Rule 4 (limits bound as parameters, `LIMIT $1`) are carried as test rows above.

## Migration / Rollout

No migration. Pre-CH-07 rows are re-registered (DEC-20); they answer 409 until then.

## Chained-PR Slice Plan (`auto-chain`)

| # | Scope | Depends | Rollback |
|---|---|---|---|
| 1 | `cripto-credencial.ts` + key validation in `config.ts` + `.env.example` + unit tests. No call site wired. | — | delete module, revert config |
| 2 | `conexion-destino.ts`, encipher on create, both read paths, 409 mapping, tests | 1 | clean — no migration produced ciphertext (DEC-20) |
| 3 | `maxFilasPorConsulta`, `limiteEfectivo`/`corte`, schema `maximum` removal, tests | — (chained after 2 for a linear stack; rebasable ahead of 1–2 if they stall) | restoring defaults reproduces 200-row / 15 000 ms behavior |
| 4 | Console cap sentence + `credencial-ilegible` entry + smoke | 2, 3 | clean |

PR #1 targets the feature branch; #2–#4 each target the previous slice's branch.

## Open Questions

- [ ] `409` vs `422` for `credencial-ilegible` — `409` chosen (the row exists but conflicts with the current key regime); reversible in slice 2 if the spec prefers `422`.
