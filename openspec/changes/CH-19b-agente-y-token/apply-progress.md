# Apply Progress: CH-19b — Agent Model and Agent Token

**Store**: openspec. **Delivery**: auto-chain, stacked-to-main, no `size:exception`.
**Mode**: RED before GREEN, as `tasks.md` requires (`openspec/config.yaml` has `strict_tdd: false`).

## Cumulative State

| Unit | Tasks | State |
|------|-------|-------|
| 1a — Schema, isolation, lookup, token | 1.1-1.9 | Done (this batch) |
| 1b — `/agentes` routes and wiring | 2.1-2.7 | Pending |
| 2 — `agenteId` on `POST /conexiones` | 3.1-3.6 | Pending |

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

## Next

Unit 1b (tasks 2.1-2.7), stacked on the 1a branch.
