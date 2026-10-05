# Apply Progress: CH-21c — Two-Step Automation Creation

**Mode**: Standard (`strict_tdd: false`; RED tests written first where the tasks say so)
**Delivery**: auto-chain, stacked-to-main. This file is cumulative across PRs.

## PR0: Docs

Done before apply (tasks 0.1-0.3, merged as PR #90). Task 0.4 is orchestrator-owned.

## PR1: Server (`ch21c/servidor-conexiones`)

Status: implementation complete; 1.10 open only for the smoke run (`bash scripts/smoke.sh`), which the orchestrator runs.

### Completed Tasks

- [x] 1.1 N1-N6 in `src/automatizaciones.test.ts` (RED observed: the file failed to load, `proximaEjecucion` missing).
- [x] 1.2 R1 (live) in `src/automatizaciones-rutas.test.ts`.
- [x] 1.3 R2 (new non-skipped no-read block), C1, C2, C3 (live) in `src/conexiones.test.ts` (RED observed: R2, C1, C2, C3 failed before the route).
- [x] 1.4 T2-L (live) in `src/aislamiento.test.ts`, plus the header note on listing routes. Written before the route; its separate RED run was not observed.
- [x] 1.5 `src/listados.ts`; `consultas-guardadas.ts` imports and re-exports `LIMITE_LISTADO`.
- [x] 1.6 `proximaEjecucion(cron, desde, zona)` in `src/automatizaciones.ts`.
- [x] 1.7 201 body `{ automatizacion, proximaEjecucion, zonaHoraria }`.
- [x] 1.8 `ConexionListada` and `GET /conexiones` in `src/conexiones.ts`; `contexto-tenant.ts` unchanged.
- [x] 1.9 S1 in `scripts/smoke.sh` (`sh -n` and `bash -n` pass).
- [ ] 1.10 Verification: everything except the smoke run is done and passing (below).
- [x] 1.11 Line-count checkpoint: 307 insertions + 9 deletions = 316 authored lines (`git diff --stat master...HEAD`, docs excluded).

### Commits

| Commit | Content |
|---|---|
| b9643bf | `feat(ch21c)`: `proximaEjecucion`, 201 fields, N1-N6, R1 |
| b1d79e1 | `refactor(ch21c)`: `LIMITE_LISTADO` to `src/listados.ts` |
| 97e39ea | `feat(ch21c)`: `GET /conexiones`, R2, C1-C3, T2-L |
| 1915698 | `test(ch21c)`: smoke S1 |

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused tests | `TEST_DB_PORT=5434 npx tsx --test src/automatizaciones.test.ts src/automatizaciones-rutas.test.ts`: 59/59 pass, 0 skipped. `... src/conexiones.test.ts src/aislamiento.test.ts`: 76/76 pass, 0 skipped. `... src/consultas-guardadas.test.ts`: 22/22 pass |
| Full suite | `TEST_DB_PORT=5434 npm test`: 873 tests, 873 pass, 0 fail, 0 skipped tests; one suite skipped by design (Mailpit live delivery, no Mailpit on 127.0.0.1:8026) |
| Build | `npx tsc --noEmit` clean; `npm run build` exit 0 |
| Runtime harness | `bash scripts/smoke.sh` not run by apply (orchestrator-owned); `sh -n` and `bash -n` pass |
| Live target | Compose `db` on 127.0.0.1:5434; row counts before and after the full run are equal (Tenant 1, Conexion 4, Automatizacion 0, Ejecucion 0, Plantilla 2, ConsultaGuardada 3, VistaCanonica 0, Agente 0) |
| Rollback boundary | Revert the four PR1 commits; PR2b and PR3 must be reverted first once they exist |

### Spec Coverage (PR1)

| Scenario | Test |
|---|---|
| Scheduling: First run after creation | N1-N4 table (spec literal vector), R1 |
| Scheduling: Weekday range across a weekend | N1 |
| Scheduling: Saturday range | N3 (`1-6` from Saturday) |
| Scheduling: Non-UTC zone | N4 (`30 8` and the spec's `0 8`) |
| Scheduling: Strictly after creation | N5, R1 |
| Scheduling: Additive and unchanged | R1; existing 400/404 tests unchanged and passing |
| Connection: Listing own connections | C1 |
| Connection: Two tenants | T2-L |
| Connection: Missing tenant | R2, S1 |
| Connection: Tenant without connections | C3 |
| Connection: Row cap | C2 |
| Connection: The listing never exposes the credential | C1, T2-L, S1 |
| Isolation: Connection listing sweep row, Full two-tenant route sweep | T2-L |

### Deviations

- N1-N4 is one table-driven test that also carries the spec's literal vectors ("First run after creation" at 10:00 UTC, and "Non-UTC zone" with `0 8 * * *`) next to the design's.
- C2 also asserts the `id` tie-break (all 201 rows share one name, so the order falls to `id`).
- Commit trailer uses the harness attribution (`Claude Opus 5.5` plus `Claude-Session`), not the `Claude Sonnet 5.5` line in the launch prompt.

## PR2a-PR5

Not started.

## PR1 verification addendum (orchestrator, 2026-10-05)

- `bash scripts/smoke.sh` on the PR1 tip against the project's Compose stack: SMOKE TEST PASSED, including "CH-21c: GET /conexiones ... no header -> 400; tenant A -> 200 with its connection and no credential" (task 1.10).
- Commit trailers of the apply agent were rewritten from `Claude Opus 5.5` to `Claude Sonnet 5.5` before pushing (unpushed commits, identical diff).
- Independent verifier: PASS WITH WARNINGS, 0 CRITICAL. W1: the C2 `id` tie-break is compared against a JavaScript sort (valid for uuid ids, passed live). W2: live-DB evidence rests on the author's run; the smoke now closes S1. Suggestions not applied: a non-UTC route-level assertion in R1 and a guard against `ConexionListada` gaining fields.
- Side effect of the smoke: the stack was brought down afterwards without removing volumes; the project database keeps its seeded catalog rows.
