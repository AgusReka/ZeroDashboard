# Apply Progress: CH-19b — Agent Model and Agent Token

**Store**: openspec. **Delivery**: auto-chain, stacked-to-main, no `size:exception`.
**Mode**: RED before GREEN, as `tasks.md` requires (`openspec/config.yaml` has `strict_tdd: false`).

## Cumulative State

| Unit | Tasks | State |
|------|-------|-------|
| 1a — Schema, isolation, lookup, token | 1.1-1.9 | Done (this batch) |
| 1b — `/agentes` routes and wiring | 2.1-2.7 | Done. 2.7 first measured 419. The author moved the no-PostgreSQL suite to unit 2, which brought 1b to 357 (batch 2) |
| 2 — `agenteId` on `POST /conexiones` | 3.1-3.6 | Done, 172 lines (batch 3) |

No earlier apply-progress existed. This is the first batch.

## Unit 1a: Files Changed

| File | Action | What was done |
|------|--------|---------------|
| `prisma/schema.prisma` | Modified | `Agente` model (`tenantId` and `tokenHash` unique, `onDelete: Restrict`), `Tenant.agente`, `Conexion.agenteId` and `Conexion.agente` (`onDelete: Restrict`) |
| `prisma/migrations/20261003000000_agente/migration.sql` | Created | Generated with `migrate dev --create-only`, folder renamed to the design's timestamp, with a hand-written rollback header |
| `src/aislamiento-prisma.ts` | Modified | `Agente` added to `MODELOS_AISLADOS`. `model.agente.buscarPorTokenHash` added in the same `$extends`, running `findUnique` on the closed-over raw client. Module docs updated |
| `src/aislamiento.test.ts` | Modified | L0 pin list, L1 closed-port cases, L2 live lookup suite, and 1.5 database scenarios |
| `src/agente-token.ts` | Created | `generarTokenAgente()` and `hashTokenAgente(t)` |
| `src/agente-token.test.ts` | Created | K1 |

## TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| 1.1 / 1.3 L2 | Written first. 4 tests cancelled: `TypeError: Cannot read properties of undefined (reading 'create')` because `db.agente` did not exist yet | After 1.2 and 1.3, the 3 lookup cases passed. The `findMany` case stayed red until 1.4 | None needed |
| 1.2 Schema | N/A (schema) | `migrate deploy` applied `20261003000000_agente`. `prisma generate` succeeded. `migrate status` reports up to date | — |
| 1.4 L0, L1 | L1 failed: `Received "PrismaClientKnownRequestError"` (the query reached the closed port instead of failing closed). L0 was edited after the client was regenerated, and the old pin list would fail without that edit | `Agente` added to `MODELOS_AISLADOS`. 6 of 6 L0, L1 and L2 tests passed. L2 still passes with `Agente` scoped, which proves the raw-client closure bypasses `$allOperations` | Module docs updated |
| 1.5 Database scenarios | The constraints already existed from 1.2, so a mutation check stood in for RED. Dropping `Agente_tokenHash_key` failed the test (`Missing expected rejection`). Dropping `Conexion_agenteId_fkey` failed it the same way. Both were restored, and `prisma migrate diff` reports `No difference detected` | 1 of 1 passed | — |
| 1.6 / 1.7 K1 | `ERR_MODULE_NOT_FOUND` for `./agente-token.js` | 3 of 3 passed | — |

**L2 outcome**: the typed lookup works on the extended client. The `$queryRaw` fallback from DEC-121 (c) was not needed and was not applied.

## Work Unit Evidence (1a)

| Evidence | Value |
|---|---|
| Focused test command and result | `TEST_DB_PORT=5434 npx tsx --test src/aislamiento.test.ts src/agente-token.test.ts`. The subsets ran during the cycle (6 of 6, 1 of 1, 3 of 3 passed). The full suite is below |
| Runtime harness | Live PostgreSQL 16 in container `zd-ch09-testdb` on `localhost:5434`. The migration was applied with `npx prisma migrate deploy`, with `DATABASE_URL` pointed at 5434. The L2 lookup and the 1.5 constraints ran against it |
| Full suite | `TEST_DB_PORT=5434 npm test`: exit 0, 711 tests, 711 pass, 0 fail, 0 cancelled. One suite-level environmental skip: the Mailpit live-delivery suite (no Mailpit on 8026). It was skipped in the baseline too |
| Typecheck | `npx tsc --noEmit`: exit 0 |
| `tokenHash` grep (non-generated `src/`) | Production code: only `src/aislamiento-prisma.ts`, in the lookup. Other hits: one doc comment in `src/agente-token.ts`, and fixtures in `src/aislamiento.test.ts` |
| Rollback boundary | Revert this unit's files, then run the SQL in the migration header (drop `Conexion_agenteId_fkey`, drop `Conexion.agenteId`, drop `Agente`). There are no consumers yet |

## Line-Count Checkpoint (1.9)

`git diff --stat`: 3 files, 176 insertions and 1 deletion. Untracked files: `src/agente-token.ts` 23, `src/agente-token.test.ts` 27, `migration.sql` 37. **Total 264, within the 400 limit.** This excludes `docs/verificacion-tesis-2026-10-01.md`, which was already untracked and is not part of this change, and the SDD artifacts.

## Deviations and Notes

- The design estimated about 210 lines for 1a. The actual count is 264, mostly from the L2 and 1.5 tests.
- The migration was applied with `prisma migrate deploy` (the repo's `npm run migrate`) after `migrate dev --create-only`, so the hand-written header was in the file before it was applied.
- Baseline (before any edit): 694 pass. The live automation-routes suite (8 tests) skipped there because its 1-second reachability probe ran while the test DB was still starting. In the current run all 8 ran and passed.
- An empty file named `causa` appeared at the repo root during this session (13:22:06). No command in this session redirected output to it. It was deleted. `200` at the root predates this session and was left untouched.
- No architecture decision was taken. DEC-121 was not reopened.

## Unit 1b: Files Changed (batch 2, branch `ch19b/rutas-agentes`)

| File | Action | What was done |
|------|--------|---------------|
| `src/agentes-rutas.ts` | Created | `registerAgenteRoutes(app, prisma)`, the `AgentePublico` projection, `POST /agentes` (201 create, 200 re-issue in place, 409 `agente-existente`, `P2002` gives 409), `GET /agentes`, `POST /agentes/:id/revocar` (404 `agente-no-encontrado`, 409 `agente-revocado`, guarded `updateMany` and read-back). `Cache-Control: no-store` on both token responses |
| `src/agentes-rutas.test.ts` | Created | A suite with no PostgreSQL (all three routes exist and need `x-tenant-id`, R3 body rejection on a client that throws on any read), and a live suite (R1, R2, R4, R5, R6, R7, a concurrent re-issue, R8 with a concurrent create) |
| `src/server.ts` | Modified | Imports and calls `registerAgenteRoutes(app, prisma)` after the automation routes. `contexto-tenant.ts` was not changed |

## TDD Cycle Evidence (1b)

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| 2.1 / 2.2 R1-R3 | The file failed to load: `./agentes-rutas.js` did not exist | R1, R2 and R3 passed. The route-existence test stayed red until 2.4 (`GET /agentes` not registered) | None |
| 2.3 R7 | The re-issue test got `409` instead of `200`. The concurrent re-issue got `[409, 409]` instead of `[200, 409]`. Before the revoke route existed, the precondition revoked the row through the raw client | Guarded `updateMany` and read-back. Both R7 tests passed | In 2.4, the precondition was changed to revoke through the route |
| 2.4 R4-R6, R8 | R4 and R5: `Route ... not found` (404). R6: the lookup still resolved because nothing had revoked the agent. R7 and R8 failed in cascade | `GET /agentes` and `POST /agentes/:id/revocar`. 10 of 10 passed | None |
| 2.5 Wiring | N/A (one registration line) | `npx tsc --noEmit` exit 0. The real `src/server.ts` was booted in the smoke run below | — |

## Work Unit Evidence (1b)

| Evidence | Value |
|---|---|
| Focused test command and result | `TEST_DB_PORT=5434 npx tsx --test src/agentes-rutas.test.ts`: 10 tests, 10 pass, 0 fail. It was run 3 more times to check the two concurrency tests for flakiness: 10 of 10 each time |
| Runtime harness | `src/server.ts` booted with `npx tsx` on port 3917, against the test database on 5434. Results: `POST /tenants` gave 201. `POST /agentes` gave 201 with `cache-control: no-store`, the keys `creadoEn,id,revocadoEn,tokenEmitidoEn`, and a token starting `zda_`. A repeat gave 409 `agente-existente`. A body `{"tenantId":"x"}` gave 400 `["/tenantId"]`. `GET /agentes` gave 200. `GET /agentes` without the header gave 400 `tenant-no-indicado`. Revoke gave 200. Re-issue gave 200 with `no-store`. The server log has 0 lines containing `zda_` and does not contain the issued token. The smoke `Agente` and `Tenant` rows were deleted afterwards |
| Full suite | `TEST_DB_PORT=5434 npm test`: exit 0. `ℹ tests 721`, `ℹ pass 721`, `ℹ fail 0`, `ℹ cancelled 0`, `ℹ skipped 0`. That is 711 from 1a plus 10. No scheduler-tick failures in this run |
| Typecheck | `npx tsc --noEmit`: exit 0 |
| `tokenHash` in non-test `src/` | The lookup (`aislamiento-prisma.ts`), the create and the re-issue `updateMany` (`agentes-rutas.ts`), and doc comments. Neither route module logs anything |
| Rollback boundary | Revert `src/agentes-rutas.ts`, `src/agentes-rutas.test.ts` and the 4 lines in `src/server.ts`. No schema change |

## Deviations and Notes (1b)

- **`propertyNames: false`**, not `{ enum: [] }`. AJV 8.20 refuses the empty enum when the schema compiles (`data/propertyNames/enum must NOT have fewer than 1 items`). This is the fallback the design names. `camposInvalidos` still reports `['/tenantId']`.
- **A bodyless `POST /agentes` is `400 solicitud-invalida` `['/']`.** The design's `type: 'object'` body schema needs a JSON object, so the operator sends `{}`. This was probed directly and is documented in the schema comment. Allowing an absent body would be a spec-level choice, so it was not made here.
- `Cache-Control: no-store` is set only on the two responses that carry a token (201 and 200), as the design states.
- No architecture decision was taken. `contexto-tenant.ts` and its exemption list are unchanged.
- No stray root files (`2.6`, `causa`) were created in this batch. `200` and `prisma;C` at the root predate this session and were left untouched.

## Line-Count Checkpoint (2.7): STOPPED

`git diff --stat -- src`: `src/server.ts`, 4 insertions. Untracked: `src/agentes-rutas.ts` 149 lines, `src/agentes-rutas.test.ts` 266 lines. **Total 419. That is over the 400 limit, so apply stopped here as instructed.** SDD artifacts are excluded, as in 1a. Nothing was compressed or deleted to get under the limit.

- The design estimated about 314 lines. The overrun comes from two things. One is tests beyond the design's R1-R8 rows: the no-PostgreSQL suite (route existence and header, plus R3 on a throwing client, about 60 lines with the shared helper) and the concurrent re-issue and create checks that exercise the design's race decisions. The other is route doc comments in the existing modules' style.
- Separately, commit `5b70212` (`docs(design): prompt para Claude Design...`, 109 lines) landed on `ch19b/rutas-agentes` during this session. It was not made by apply. Against the 1a branch, PR 1b's diff would therefore show about 528 lines unless that commit is moved off this branch.
- Options for the orchestrator: accept `size:exception` for 1b (19 lines over), or move part of the test file (for example, the no-PostgreSQL suite) into unit 2's PR.

**Resolution (recorded in `tasks.md` 2.7):** on 2026-10-03 the author moved the no-PostgreSQL suite to `src/agentes-rutas-sin-db.test.ts`, which belongs to unit 2. Unit 1b is now 357 lines, and the full suite passed 721/721 with tsc at 0.

## Unit 2: Files Changed (batch 3, branch `ch19b/agenteid-en-conexiones`)

| File | Action | What was done |
|------|--------|---------------|
| `src/conexiones.ts` | Modified | `agenteId?: string` added to `RegistroConexionBody`, to the `propertyNames` enum, and to `properties` (`minLength: 1`), so both lists stay in step. A scoped `prisma.agente.findUnique({ where: { id }, select: { id: true } })` runs before the create, with no `revocadoEn` filter. `null` gives 404 `agente-no-encontrado`. The create writes `agenteId: body.agenteId ?? null`. `ConexionPublica` gains `agenteId: true` |
| `src/agentes-rutas.test.ts` | Modified | `registerConexionRoutes` is now registered on the same app. The fixture `CREDENTIAL_MASTER_KEY` is set (same literal as the connection suites, `??=`). Added C1, C2/C3 (one test, same 404 body for another tenant's id and an unknown one), C4 and C5. The header comment now covers both units |
| `src/agentes-rutas-sin-db.test.ts` | Untracked (moved from 1b by the author) | Kept unchanged. It counts toward this unit |

## TDD Cycle Evidence (2)

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| 3.1 C1-C5 | `TEST_DB_PORT=5434 npx tsx --test src/agentes-rutas.test.ts`: 12 tests, 8 pass, 4 fail. C1 and C4 got 400 instead of 201 (`agenteId` was an unknown key). C2/C3 got 400 instead of 404. C5 got `agenteId` `undefined` instead of `null` (missing from the projection) | — | — |
| 3.2 / 3.3 | — | Schema, scoped check, create field and projection. Focused run on both agent files: 14 tests, 14 pass, 0 fail | None needed |

## Work Unit Evidence (2)

| Evidence | Value |
|---|---|
| Focused test command and result | `TEST_DB_PORT=5434 npx tsx --test src/agentes-rutas.test.ts src/agentes-rutas-sin-db.test.ts`: exit 0. `ℹ tests 14`, `ℹ pass 14`, `ℹ fail 0` |
| Runtime harness | Live PostgreSQL 16 (`zd-ch09-testdb`, port 5434). C1-C5 send requests through `registrarContextoTenant`, `registerConexionRoutes` and the extended client, using `app.inject` with two tenants. Rows are checked on the raw client by marker name, across all tenants, so a row written under the wrong tenant would also be caught |
| Full suite | `TEST_DB_PORT=5434 npm test`: exit 0. `ℹ tests 725`, `ℹ suites 106`, `ℹ pass 725`, `ℹ fail 0`, `ℹ cancelled 0`, `ℹ skipped 0`. That is 721 plus 4. The existing connection suites pass without changes |
| Typecheck | `npx tsc --noEmit`: exit 0 |
| `.env` / `package.json` | `git diff --stat -- .env package.json package-lock.json`: empty |
| Rollback boundary | Revert `src/conexiones.ts` and `src/agentes-rutas.test.ts`, and drop `src/agentes-rutas-sin-db.test.ts`. No schema change: the `Conexion.agenteId` column comes from unit 1a |

## Line-Count Checkpoint (3.5)

`git diff --numstat -- src`: `src/agentes-rutas.test.ts` 69 additions and 3 deletions, `src/conexiones.ts` 26 additions. Untracked: `src/agentes-rutas-sin-db.test.ts` 74 lines. **Total 172, within the 400 limit.** SDD artifacts are excluded, as before. Also excluded are `docs/design/` and `docs/verificacion-tesis-2026-10-01.md`: both are untracked and are not part of this change.

## Deviations and Notes (2)

- None from the design. The check is `findUnique` on the scoped client, as specified, and the error code is the one the revoke route already uses.
- C2 and C3 share one test, because the spec requires the same answer for both cases. The test asserts an identical body for each.
- An empty file named `r.statusCode` appeared at the repo root at 13:44:10, during this batch. No command in this batch redirected output to that name. The name matches the test-code fragment `(r) => r.statusCode` in `agentes-rutas.test.ts`, which suggests an outside process reads code text as a shell redirect. That fits the earlier `2.6` and `causa` files. It was deleted. `200` and `prisma;C` predate this session and were left untouched.
- No architecture decision was taken. DEC-121 (c), option (a), is what was implemented.

## Next

All tasks (1.1-3.6) are done. The orchestrator commits unit 2 on `ch19b/agenteid-en-conexiones` and then runs sdd-verify.
