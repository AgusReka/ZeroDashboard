# Tasks: CH-19a — Connection Channel Seam and Protocol Types (C1, slice 1)

From `design.md` and `specs/**` (`agent-channel`, `query-execution` delta). DEC-112..DEC-120 are already registered (no task edits `docs/01-decisiones.md`). Strict TDD: RED then GREEN. Test command: `npm test`; type check: `npx tsc --noEmit`. Live-PG tests skip when PG is absent. Main-spec composition is done by `sdd-archive`, not by apply.

**Commit steps deferred to orchestrator**: Tasks 1.4, 2.7, 3.4, and 4.5 (the checkpoint commits) are not created by apply; `sdd-archive` marks them complete and defers their creation to the orchestrator's delivery process.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~358 (design table; range 330-400) |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR, one link of the CH-19 chain; fallback split below |
| Delivery strategy | single-pr |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

The estimate is under 400, so no `size:exception` is needed now. About 200 lines are test code (`src/db-probe-canal.test.ts`).

**Budget checkpoint (task 4.4):** run `git diff --stat` after the spike. If additions plus deletions exceed 400, STOP and do not request `size:exception`. Fallback: split into PR A (units 1-3: types, seam, threading, spike C1-C5 and Q1) and PR B (unit 4: D1-D2, Q2-Q4), stacked on A. Then ask the user for the chain strategy before continuing.

**STOP CONDITION:** if C2 or Q1 fails (the stream seam is refuted), stop all work. Do not patch around it. Return DEC-112 to the user. Tasks after 2.6 do not run.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Protocol types, P1-P2 | PR 1, commit 1 | `npm test -- src/agente-protocolo.test.ts` | N/A: types only | Delete `src/agente-protocolo.ts` and its test |
| 2 | Seam in `iniciarConexion` and the spike gate (C1-C5, Q1) | Commit 2 | `npm test -- src/db-probe-canal.test.ts` | Live PG via the fake duplex relay | Revert `src/db-probe.ts` and `src/db-probe-canal.test.ts` |
| 3 | `camposDeDestino` and caller threading (H1) | Commit 3 | `npm test -- src/conexion-destino.test.ts` | N/A: pure function; existing suites prove direct mode | Revert the five caller files and the helper |
| 4 | Dropped channel and read-only guarantees (D1-D2, Q2-Q4) | Commit 4 | `npm test -- src/db-probe-canal.test.ts` | Live PG: fake destroyed mid-session; `ch19a_escritor` role | Revert additions to the spike test |

## Unit 1: Protocol Types (P1, P2)

- [x] 1.1 RED `src/agente-protocolo.test.ts`: P1 `Object.keys(await import(...))` is `[]`; type-level check that `AperturaSesion` has no key starting with `tenant`
- [x] 1.2 RED same file: P2 an exhaustive `satisfies readonly CodigoErrorAgente[]` array of the seven codes; each gets a category other than `error-desconocido` from `classifyConnectionError` (`src/db-probe.ts` (read-only))
- [x] 1.3 GREEN `src/agente-protocolo.ts`: types only, zero imports: `TipoCanal`, `AperturaSesion {tipo, sesionId, host, puerto}`, `Latido {tipo}`, `MensajeControl`, `CodigoErrorAgente` (seven Node codes)
- [x] 1.4 Checkpoint: `npx tsc --noEmit` clean; commit "feat(ch19a): tipos del protocolo del agente" (commit deferred: the orchestrator instructed apply not to commit)

## Unit 2: Seam and Spike Gate (C1-C5, Q1)

- [x] 2.1 Create `src/db-probe-canal.test.ts` scaffolding: fake `CanalDuplex` per the design contract (fresh duplex per call, no-op `setNoDelay`, `connect` starts the relay to live PG, async `'connect'`, `destroy` emits `'error'` then `'close'`, far-side close calls `destroy()`, `_final` calls `push(null)`); silent variant; `ch19a_pruebas` fixture with `ch19a_lector` and `ch19a_escritor`
- [x] 2.2 RED C1: without `canal`, `cliente.connection.stream` is a `net.Socket` and the factory is never called
- [x] 2.3 RED C2: with `canal`, the stream is the fake instance, the factory is called once, `cliente.ssl === false` while `PGSSLMODE=require` (restored afterwards), and `SELECT 1` succeeds
- [x] 2.4 GREEN `src/db-probe.ts`: export `CanalDuplex` and `AbrirCanal`; add `canal?` to `DestinoPostgres`; one branch at `iniciarConexion` (`:105-112`): absent keeps the same `new pg.Client(config)` literal, present uses `{ ...config, stream: destino.canal, ssl: false }`; no logging or buffering
- [x] 2.5 RED then GREEN C3-C5 in the spike test: C3 silent fake with `probeConnection` and `ejecutarConsulta` (`connectTimeoutMs: 400`) gives `tiempo-agotado`, `codigo: null`, under 2500 ms; C4 fake destroyed before `'connect'` with `{code:'ECONNREFUSED'}` gives `host-inalcanzable`; C5 silent fake, `await cerrarCliente(cliente, true)` raced against 2500 ms resolves. Fix the fake, not the engine, if a case fails
- [x] 2.6 RED then GREEN Q1: `ch19a_lector` over the fake gets 2 of 3 rows with `hayMas`. GATE: if C2 or Q1 fails, STOP and return DEC-112 to the user
- [x] 2.7 Checkpoint: `npm test` green, `npx tsc --noEmit` clean; commit "feat(ch19a): canal inyectable en iniciarConexion" (commit deferred: the orchestrator instructed apply not to commit)

## Unit 3: Threading (H1)

- [x] 3.1 RED `src/conexion-destino.test.ts` (no PG): H1 `camposDeDestino` keeps the same `canal` reference and drops `id`; without a channel `canal` is `undefined`; `destinoDeConexion` returns `canal === undefined`
- [x] 3.2 GREEN `src/conexion-destino.ts`: `camposDeDestino(destino)` returns `{host, port, database, user, password, canal: destino.canal}`, never branching on `canal`
- [x] 3.3 GREEN spread the helper in place of the five-field copy and update the import: `src/conexiones.ts:226`, `src/consultas.ts:116`, `src/plantilla-prueba.ts:103`, `src/planificador.ts:256`; `src/validacion-mapeo-rutas.ts` and `src/consulta-ejecucion.ts` stay unchanged (inherited field)
- [x] 3.4 Checkpoint: existing suites unchanged and green (direct mode), `npx tsc --noEmit` clean; `Grep` confirms no production code sets `canal`; commit "feat(ch19a): canal pasa por los llamadores" (commit deferred: the orchestrator instructed apply not to commit)

## Unit 4: Dropped Channel and Read-Only Guarantees (D1-D2, Q2-Q4)

- [x] 4.1 RED then GREEN D1: idle after login, destroy the channel; the process keeps running, the next query rejects, and the close returns
- [x] 4.2 RED then GREEN D2: destroy 300 ms into `SELECT pg_sleep(2)`; result is `fallo`, `fase: 'ejecucion'`, `codigo: null`, and the password is absent from the result
- [x] 4.3 RED then GREEN Q2-Q4: `ch19a_escritor` gets `rol-con-escritura-en-tabla`; a DELETE CTE gives `no-es-lectura` and the admin row count is unchanged; `SELECT 1; SELECT 2` gives `error-sintaxis`
- [x] 4.4 Budget checkpoint: `git diff --stat` (additions plus deletions) must be at most 400; otherwise apply the fallback split from the forecast. **Apply result: 547 changed lines (size:exception accepted by author 2026-10-02); resolved.**
- [x] 4.5 Final checkpoint: `npm test` green (baseline plus new tests), `npx tsc --noEmit` clean, no `prisma/`, `package.json` or env-example diff; commit step deferred to orchestrator. (Verified in verify-report.)
- [x] 4.6 Run `sdd-verify`, then `sdd-archive`. Archive proceeding per launch instructions.

## Traceability

- Protocol catalog, no tenant, closed codes -> 1.1-1.3 (P1, P2)
- Optional channel, absent unchanged, present supplies stream, ssl off -> 2.2-2.4 (C1, C2)
- Bounded failure modes -> 2.5, 4.1-4.2 (C3-C5, D1, D2)
- Threading without inspection, no production channel -> 3.1-3.4 (H1)
- Execution guarantees over a channel -> 2.6, 4.3 (Q1-Q4)
