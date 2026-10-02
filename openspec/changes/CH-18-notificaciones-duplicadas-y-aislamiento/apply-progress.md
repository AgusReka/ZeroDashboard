# Apply Progress: CH-18 — At-Most-Once Notification and Per-Tenant Failure Isolation (X6, X8)

**Mode**: Strict TDD (requested by tasks.md and the orchestrator; `openspec/config.yaml` still says `strict_tdd: false` from the pre-code init)
**Delivery**: single PR, `size:exception` accepted (`exception-ok`); one commit per work unit
**Progress**: 8/23 tasks complete (unit 1 done; units 2 and 3 pending)

## Completed

- [x] 1.1 RED tenant-level throw: other tenant runs, closed-field log line
- [x] 1.2 RED failed tenant's window is not recovered (DEC-95)
- [x] 1.3 RED listing contexts `[A, B]`, own `tenantId` per row, serial tick
- [x] 1.4 GREEN per-tenant try/catch in `ejecutarTick`
- [x] 1.5 Spike test in `src/db-probe.test.ts` (child process, forwarder, two scenarios)
- [x] 1.6 Spike run on unchanged `src/db-probe.ts`: crash proven in both scenarios
- [x] 1.7 GREEN listener `cliente.on('error', () => {})` in `iniciarConexion`
- [x] 1.8 Checkpoint: full suite green, type check clean, unit 1 committed

## Pending

- Unit 2: tasks 2.1-2.14
- Unit 3: tasks 3.1-3.5

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

### Test Summary

- Tests written: 5 (3 planner, 2 spike)
- Tests passing: 676/676 (baseline 671 + 5)
- Layers: integration 5 (live PostgreSQL; the spike in a child process)
- Approval tests: none (1.3 is a guard over existing serial behavior)

## Work Unit Evidence (unit 1)

| Evidence | Value |
|---|---|
| Focused test command and exact result | `TEST_DB_PORT=5434 npx tsx --test src/planificador.test.ts` → 36 tests, 36 pass, 0 fail. `TEST_DB_PORT=5434 npx tsx --test --test-name-pattern "socket destroyed" src/db-probe.test.ts` → 2 pass, 0 fail |
| Runtime harness command/scenario and exact result | Live PG: tenant A's listing throws, tenant B still runs `ok`/`enviada` with one send (test 1.1). Child process destroys the forwarder sockets after login: exit 0 with the listener, exit 1 without it |
| Full verification | `npx tsc --noEmit` → exit 0, no output. `TEST_DB_PORT=5434 npm test` → tests 676, pass 676, fail 0, skipped 0 |
| Rollback boundary | Revert the unit 1 commit: `src/planificador.ts` (tick catch), `src/db-probe.ts` (listener), `src/planificador.test.ts`, `src/db-probe.test.ts` |

## Deviations and Notes

- Commit message follows the orchestrator's wording (`feat(ch18): aislamiento de errores por tenant en el tick (X8, DEC-109)`, plus the listener), not the `fix(ch18): …` wording in task 1.8.
- `clienteDeBarrido` also gained `antesDeListar` (a hold on a tenant's listing) for the serial-tick test 1.3; `fallaListadoEn` is read on every listing so test 1.2 can heal the tenant between ticks.
- Unit 1 is about 290 changed lines against a forecast of 110-150; most of it is test code (the spike harness alone is about 125 lines). Covered by the accepted `size:exception`.
- The live test database is the `zd-ch09-testdb` container on port 5434; port 5432 on this machine belongs to an unrelated project's PostgreSQL, so `npm test` needs `TEST_DB_PORT=5434`.
