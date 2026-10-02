# Apply Progress: CH-18 — At-Most-Once Notification and Per-Tenant Failure Isolation (X6, X8)

**Mode**: Strict TDD (requested by tasks.md and the orchestrator; `openspec/config.yaml` still says `strict_tdd: false` from the pre-code init)
**Delivery**: single PR, `size:exception` accepted (`exception-ok`); one commit per work unit
**Progress**: 26/27 tasks complete (units 1, 2 and 3 done; only 3.5, verify and archive, remains)

## Completed

- [x] 1.1 RED tenant-level throw: other tenant runs, closed-field log line
- [x] 1.2 RED failed tenant's window is not recovered (DEC-95)
- [x] 1.3 RED listing contexts `[A, B]`, own `tenantId` per row, serial tick
- [x] 1.4 GREEN per-tenant try/catch in `ejecutarTick`
- [x] 1.5 Spike test in `src/db-probe.test.ts` (child process, forwarder, two scenarios)
- [x] 1.6 Spike run on unchanged `src/db-probe.ts`: crash proven in both scenarios
- [x] 1.7 GREEN listener `cliente.on('error', () => {})` in `iniciarConexion`
- [x] 1.8 Checkpoint: full suite green, type check clean, unit 1 committed
- [x] 2.1 RED pure table: `cierreConNotificacion` never yields `enviando` or `incierta` (runtime table plus a compile-time assertion)
- [x] 2.2 GREEN `EstadoNotificacion` gains `enviando`/`incierta`; `MarcaNotificacion`; `CierreNotificado.notificacion` excludes both
- [x] 2.3 RED row reads `en-curso`/`enviando` inside `enviar`, closes `enviada`
- [x] 2.4 RED marker writes: 0 for zero rows, no recipient, no notifier, failed query, gate refusal; 1 for the one send
- [x] 2.5 RED marker write throws: no send, `fallo`/`notificacion`/`error-interno`/`fallo-envio`, name-only log
- [x] 2.6 RED crash mid-send: `en-curso`/`enviando`, then the next sweep gives `fallo`/`interrumpida`/`incierta`, one send
- [x] 2.7 RED sweep table (`enviando` -> `incierta`, null stays null, closed rows untouched, log `inciertas`); CH-17a 1.2 updated to per-call pairs
- [x] 2.8 At-most-once guards: retried dial, overlap with a stuck `enviando` row, `detener()` during a send, timeout
- [x] 2.9 GREEN marker write in `notificar(…, id)` after `componerCorreo`, before `enviar`
- [x] 2.10 GREEN two-step sweep (`incierta` first), `cerradas` is the sum, log adds `inciertas`
- [x] 2.11 CH-14 5.7 adjusted: `notificacion` is `'enviando'` inside `enviar` (intended by DEC-108; call out in the PR)
- [x] 2.12 RED console labels, timeout copy, raw tokens absent, no backtick in the served page
- [x] 2.13 GREEN `ETIQUETAS_NOTIFICACION` and `MENSAJES['notificacion:tiempo-agotado']` with its comment
- [x] 2.14 Checkpoint: full suite green, type check clean, no `prisma/` diff, unit 2 committed
- [x] 3.1 `src/planificador.ts`: header comment and `correrVencidas` doc no longer name CH-18 as pending; they state the per-tenant catch (DEC-109), the serial tick (DEC-110) and the marker (DEC-107, DEC-108)
- [x] 3.2 Bitácora `docs/bitacora/CH-18-notificaciones-duplicadas-y-aislamiento.md`: what was built, spike evidence (6/6 crash, 3/3 survive per scenario), decisions, frictions, verification, pending work
- [x] 3.3 Same bitácora, limits table (rule 6) with DEC refs: no content/cooldown dedupe and no notification table (DEC-107, DEC-108), serial tick (DEC-110), `PrismaPg` pool outside the listener (DEC-111), lost tenant window (DEC-95, DEC-109), `enviando`/`incierta`/timeout semantics (DEC-108), non-atomic sweep pair (DEC-102), DEC-96 race window (DEC-75, DEC-99, DEC-111)
- [x] 3.4 Final checkpoint: full suite green, type check clean, unit 3 committed

## Pending

- 3.5 `sdd-verify`, then `sdd-archive` (not part of apply)

## Spike Evidence (DEC-111, for the unit 3 bitácora)

Environment: Node v24.19.0, `pg` 8.23.0, PostgreSQL 16 (test container on port 5434), Windows 11. The child runs `node --import tsx --input-type=module --eval <fixed script>`; the `tsx` CLI fallback was not needed (the `.ts` module resolved through a `file:` URL passed in the environment).

| Scenario | Unchanged `db-probe.ts` | With the listener |
|---|---|---|
| (a) every forwarder socket destroyed while the client is idle after login | Crash, 6/6 runs: exit 1, `Unhandled 'error' event`, `Error: Connection terminated unexpectedly`, `Emitted 'error' event on Client instance` | Survives, 3/3 runs plus the full suite: exit 0, `SOBREVIVIO` |
| (b) every forwarder socket destroyed 200 ms into `SELECT pg_sleep(5)`, rejection handled | Crash, 6/6 runs: same `Unhandled 'error' event` on the `Client` instance, exit 1 (the process dies before the handled rejection is printed) | Survives, 3/3 runs plus the full suite: exit 0, `CONSULTA rechazada`, `SOBREVIVIO` |

Outcome: the crash is proven and deterministic, so the listener was added and both scenarios are kept as regression tests. The error is never read (rule 5). The Prisma `PrismaPg` pool is outside the scope of this listener (bitácora limit, unit 3).

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | `src/planificador.test.ts` | Integration (live PG) | 671/671 full suite | Written; failed with `Error: base caida secreta` (tick rejected) | Passed after 1.4 | 1.1 (first tenant fails within one tick) + 1.2 (fail then heal across ticks) | None needed |
| 1.2 | `src/planificador.test.ts` | Integration (live PG) | 671/671 | Written; failed with `Error: base caida secreta` | Passed after 1.4 | B's single row proves the 09:00 fire was due in the lost window | None needed |
| 1.3 | `src/planificador.test.ts` | Integration (live PG) | 671/671 | Written; passed on current code (the tick was already serial): a guard test for DEC-110, not a failing RED | Passed | Held vs released first listing | None needed |
| 1.4 | (production) `src/planificador.ts` | — | 33/33 planner file before | — | 36/36 planner file | — | None needed |
| 1.5-1.7 | `src/db-probe.test.ts` | Integration (child process, live PG) | 671/671 | Written; failed on unchanged code, both scenarios, exit 1 (6/6 runs) | Passed with the listener (3/3 runs) | Idle (a) and in-flight query (b) | None needed |
| 2.1-2.2 | `src/automatizaciones.test.ts` | Unit (pure) | 105/105 across the three unit-2 files | `tsc --noEmit` failed: TS2305 `MarcaNotificacion` not exported, TS2322 on the compile-time assertion. The runtime table passed (the body was already correct) | `tsc` exit 0; 44/44 file | 18 outcomes x 2 closes (ok and failed query) | None needed |
| 2.3 | `src/planificador.test.ts` | Integration (live PG) | 105/105 | Failed: row read `notificacion: null` during the send | Passed after 2.9 | 2.6 (crash) and CH-14 5.7 read the same marker | None needed |
| 2.4 | `src/planificador.test.ts` | Integration (live PG) | 105/105 | Failed: `marcas` was `[]`, expected the sending row's id | Passed after 2.9 | 5 no-send paths x 2 ticks (with and without a notifier) vs the one send | None needed |
| 2.5 | `src/planificador.test.ts` | Integration (live PG) | 105/105 | Failed: marker never attempted (0 vs 1) | Passed after 2.9 | Throwing marker vs 2.3 working marker | None needed |
| 2.6 | `src/planificador.test.ts` | Integration (live PG) | 105/105 | Failed: row read `notificacion: null` while the send hung | Passed after 2.9 + 2.10 | Pending send then a second planner's sweep | None needed |
| 2.7 | `src/planificador.test.ts` | Integration (live PG) | 105/105 | Failed: `enviando` row swept to null; CH-17a 1.2 failed with one call per tenant | Passed after 2.10 | Marked vs unmarked vs closed rows; failing vs healthy tenant | None needed |
| 2.8 | `src/planificador.test.ts` | Integration (live PG) | 105/105 | Four guard tests, passed on unchanged code (at-most-once already held); they keep holding with the marker | Passed | Retry, overlap, `detener()`, timeout | None needed |
| 2.11 | `src/planificador.test.ts` (CH-14 5.7) | Integration (live PG) | 105/105 | Failed: `null` vs `'enviando'` | Passed after 2.9 | — | None needed |
| 2.12-2.13 | `src/consola.test.ts` | Behavioural (served script over a fake DOM) | 26/26 file | Failed: `'—'` vs `'Envío en curso'` | Passed; 27/27 file | 5 send categories, `enviando`, `incierta`, raw tokens, backtick | None needed |

### Test Summary

- Tests written: 16 (unit 1: 3 planner, 2 spike; unit 2: 1 pure, 9 planner, 1 console)
- Existing tests adjusted: 2 (CH-14 5.7, CH-17a 1.2), as design.md states
- Tests passing: 687/687 (baseline 671 + 16)
- Layers: unit 1, integration 14 (live PostgreSQL; the spike in a child process), behavioural console 1
- Approval tests: none. Guards over existing behavior: 1.3 and the four 2.8 tests

## Work Unit Evidence (unit 1)

| Evidence | Value |
|---|---|
| Focused test command and exact result | `TEST_DB_PORT=5434 npx tsx --test src/planificador.test.ts` → 36 tests, 36 pass, 0 fail. `TEST_DB_PORT=5434 npx tsx --test --test-name-pattern "socket destroyed" src/db-probe.test.ts` → 2 pass, 0 fail |
| Runtime harness command/scenario and exact result | Live PG: tenant A's listing throws, tenant B still runs `ok`/`enviada` with one send (test 1.1). Child process destroys the forwarder sockets after login: exit 0 with the listener, exit 1 without it |
| Full verification | `npx tsc --noEmit` → exit 0, no output. `TEST_DB_PORT=5434 npm test` → tests 676, pass 676, fail 0, skipped 0 |
| Rollback boundary | Revert the unit 1 commit: `src/planificador.ts` (tick catch), `src/db-probe.ts` (listener), `src/planificador.test.ts`, `src/db-probe.test.ts` |

## Work Unit Evidence (unit 2)

| Evidence | Value |
|---|---|
| Focused test command and exact result | `TEST_DB_PORT=5434 npx tsx --test src/planificador.test.ts` → 45 tests, 45 pass, 0 fail. `npx tsx --test src/automatizaciones.test.ts` → 44 pass, 0 fail. `npx tsx --test src/consola.test.ts` → 27 pass, 0 fail |
| Runtime harness command/scenario and exact result | Live PG (test 2.6): a notifier that never resolves leaves the row `en-curso`/`enviando`; a second planner's `barrerInterrumpidas()` closes it `fallo`/`interrumpida`/`incierta` with the other outcome columns null and no second send |
| Full verification | `npx tsc --noEmit` → exit 0, no output. `TEST_DB_PORT=5434 npm test` → tests 687, pass 687, fail 0, skipped 0 |
| Rollback boundary | Revert the unit 2 commit: `src/planificador.ts` (marker, two-step sweep), `src/automatizaciones.ts` (types), `src/consola.ts` (labels, timeout copy) and their tests. No migration; `prisma/` unchanged |

## Work Unit Evidence (unit 3)

| Evidence | Value |
|---|---|
| Focused test command and exact result | `TEST_DB_PORT=5434 npm test` → tests 687, suites 98, pass 687, fail 0, cancelled 0, skipped 0 (comments and docs only, so the full suite is the focused check) |
| Runtime harness command/scenario and exact result | N/A: comments and documentation only; no runtime boundary changes |
| Full verification | `npx tsc --noEmit` → exit 0, no output. `TEST_DB_PORT=5434 npm test` → 687/687 |
| Rollback boundary | Revert the unit 3 commit: comment edits in `src/planificador.ts` and `prisma/schema.prisma`, the bitácora file, and the `tasks.md`/`apply-progress.md` updates |

## Deviations and Notes

- Commit message follows the orchestrator's wording (`feat(ch18): aislamiento de errores por tenant en el tick (X8, DEC-109)`, plus the listener), not the `fix(ch18): …` wording in task 1.8.
- `clienteDeBarrido` also gained `antesDeListar` (a hold on a tenant's listing) for the serial-tick test 1.3; `fallaListadoEn` is read on every listing so test 1.2 can heal the tenant between ticks.
- Unit 1 is about 290 changed lines against a forecast of 110-150; most of it is test code (the spike harness alone is about 125 lines). Covered by the accepted `size:exception`.
- The live test database is the `zd-ch09-testdb` container on port 5434; port 5432 on this machine belongs to an unrelated project's PostgreSQL, so `npm test` needs `TEST_DB_PORT=5434`.
- Unit 2 commit message follows the orchestrator's wording (`feat(ch18): marca de envio y resultado incierta en notificaciones (X6, DEC-107, DEC-108)`), not the wording in task 2.14.
- `clienteDeBarrido` records the written `notificacion` on each `updateMany` call (so CH-17a 1.2 can tell the `incierta` call from the generic one) and, with `fallaMarca`, makes the marker write throw; every marker write is recorded in `marcas`.
- The task numbering in tasks.md (2.1 pure table ... 2.8 at-most-once) differs from the numbering in design.md's testing table; the test names follow tasks.md.
- The four 2.8 tests passed before the GREEN step: the code already sent at most once. They are guards that the marker does not break that.
- Two existing tests changed on purpose (DEC-108), to call out in the PR: CH-14 5.7 now expects `'enviando'` inside `enviar`; CH-17a 1.2 now expects two sweep writes per tenant, the `incierta` one first.
- Unit 2 is about 490 changed lines in total (about 440 in `src/`, most of it test code), against a forecast of 280-340. Covered by the accepted `size:exception`.
- Real commit sizes: unit 1 358+/13-, unit 2 503+/46- (both include `tasks.md` and `apply-progress.md`).
- Unit 3 edits the `Ejecucion` header comment in `prisma/schema.prisma` to document `enviando` and `incierta` (requested by the orchestrator). It is a comment only: no model, column or migration change. Task 3.4's wording "no `prisma/` change" is read as "no schema change"; `git diff --stat` does show the comment lines.
- Unit 3 commit message follows the orchestrator's wording (`docs(ch18): bitacora y limpieza de comentarios pendientes`), not the wording in task 3.4.
- CH-17b did not touch `docs/02-mapa-de-changes.md` or the README progress line, so unit 3 does not either; the DEC cross-references live in the bitácora. `docs/01-decisiones.md` and `openspec/specs/**` were not edited.
