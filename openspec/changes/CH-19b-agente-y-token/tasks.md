# Tasks: CH-19b — Agent Model and Agent Token

From `design.md` and `specs/**`. No task edits `docs/01-decisiones.md` (DEC-121 is registered). Strict TDD: RED then GREEN. Test: `npm test`; types: `npx tsc --noEmit`. Live-PG tests skip when PG is absent. One session per task. Main-spec composition, verify and archive belong to the orchestrator.

**Commit steps deferred to orchestrator**: the checkpoint tasks (1.9, 2.7, 3.6) are not committed by apply.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~638 total: 1a ~210, 1b ~314, 2 ~114 |
| 400-line budget risk | Medium (per PR: Low) |
| Chained PRs recommended | Yes |
| Suggested split | PR 1a -> PR 1b -> PR 2, each stacked on the previous |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

No `size:exception` (user chose chained PRs on 2026-10-03). Hard limit: 400 changed lines per PR.

**Line-count checkpoint (end of each unit):** run `git diff --stat` PLUS `git status --porcelain` for untracked files, and count lines of each `??` file (for example `(Get-Content <file>).Count`). Plain `git diff --stat` omits new files. If additions plus deletions exceed 400, STOP and report to the orchestrator.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1a | Schema, migration, isolation, lookup, token module | PR 1 (base: main) | `npm test -- src/aislamiento.test.ts src/agente-token.test.ts` | Live PG: migration applied, L2 lookup | Revert PR, then run migration-header SQL |
| 1b | `/agentes` routes and wiring | PR 2 (base: PR 1 branch) | `npm test -- src/agentes-rutas.test.ts` | Live PG: two tenants over `app.inject` | Revert PR; no schema change |
| 2 | `agenteId` on `POST /conexiones` | PR 3 (base: PR 2 branch) | `npm test -- src/agentes-rutas.test.ts` | Live PG: C1-C5 over `registerConexionRoutes` | Revert PR; no schema change |

## Unit 1a: Schema, Isolation, Lookup, Token (~210)

- [x] 1.1 FIRST. RED L2 in `src/aislamiento.test.ts` (own tenants, cleanup): lookup with no context returns exactly `{id, tenantId, tenantActivo}`; unknown and revoked hashes give `null`; deactivated tenant gives `tenantActivo: false`; tenant B's context still resolves A's hash to A; `findMany` still rejects. Needs 1.2 first so the client compiles.
- [x] 1.2 `prisma/schema.prisma`: add `Agente`, `Tenant.agente`, `Conexion.agenteId` and `agente`, both `onDelete: Restrict`. Run `prisma migrate dev --create-only`, add the rollback header to `prisma/migrations/20261003000000_agente/migration.sql`, apply it, regenerate the client.
- [x] 1.3 GREEN L2 in `src/aislamiento-prisma.ts`: `agente.buscarPorTokenHash(tokenHash)` in the same `$extends`, `findUnique` on the closed-over raw client, filter `revocadoEn: null`, map to the three keys. STOP-AND-FALLBACK: if L2 fails on the chained client, keep the signature and switch the body to a tagged-template `$queryRaw` (`JOIN "Tenant"`, `"revocadoEn" IS NULL`) per DEC-121. Do not reopen DEC-121 and do not interpolate SQL.
- [x] 1.4 RED then GREEN L0, L1 in `src/aislamiento.test.ts`: the pin list adds `Agente`; outside any context `agente.findMany`, `create`, `updateMany` reject with `ErrorSinTenantActivo`. GREEN: add `Agente` to `MODELOS_AISLADOS`, update the module docs.
- [x] 1.5 RED then GREEN DB scenarios in `src/aislamiento.test.ts` (raw client): second `Agente` per tenant, duplicate `tokenHash`, and deleting a `Conexion`-bound `Agente` are all rejected.
- [x] 1.6 RED K1 `src/agente-token.test.ts`: token matches `^zda_[A-Za-z0-9_-]{43}$`; two calls differ; hash is 64 hex and deterministic.
- [x] 1.7 GREEN `src/agente-token.ts`: `generarTokenAgente()` and `hashTokenAgente(t)` (SHA-256 hex).
- [x] 1.8 Checkpoint: `npm test` green, `npx tsc --noEmit` clean; `Grep` confirms `tokenHash` appears only in the lookup.
- [x] 1.9 Line-count checkpoint (method above): at most 400. Commit deferred to orchestrator.

## Unit 1b: Routes and Wiring (~314, stacked on 1a)

- [x] 2.1 RED R1, R2, R3 in new `src/agentes-rutas.test.ts` (tenants A and B, marker assertions, cleanup in FK order Conexion, Agente, Tenant): create gives 201, `no-store`, four-key projection, stored hash equals `sha256(token)`; repeat gives 409 `agente-existente` with the hash unchanged; body `{tenantId}` gives 400 `['/tenantId']`.
- [x] 2.2 GREEN `src/agentes-rutas.ts` `registerAgenteRoutes(app, prisma)`: `POST /agentes` with schema (`additionalProperties: false`, `propertyNames: { enum: [] }`, fallback `false`), scoped `findFirst`, create with `conTenantInyectado`, `P2002` gives 409.
- [x] 2.3 RED R7 then GREEN re-issue: revoked agent keeps `id` and `creadoEn`, new token; old token looks up `null`, new resolves to A; guarded `updateMany` (`revocadoEn: { not: null }`), count 0 gives 409; response 200 with `no-store`.
- [x] 2.4 RED R4, R5, R6, R8 then GREEN `GET /agentes` (ordered `creadoEn`, `id`) and `POST /agentes/:id/revocar` (scoped `findUnique`, 404, 409 `agente-revocado`, guarded `updateMany`, read-back). B's list is empty; B revoking A's id gives 404; revoked hash looks up `null`; each token resolves only to its own tenant. Responses omit token, hash and `tenantId`.
- [x] 2.5 GREEN wire `registerAgenteRoutes` in `src/server.ts`; the exemption list in `contexto-tenant.ts` stays unchanged.
- [x] 2.6 Checkpoint: `npm test` green, `npx tsc --noEmit` clean; no token or hash in any log or error path.
- [x] 2.7 Line-count checkpoint (method above): at most 400. Commit deferred to orchestrator. Apply measured 419 (over); the author decided on 2026-10-03 to move the no-PostgreSQL suite (`src/agentes-rutas-sin-db.test.ts`, ~75 lines) to unit 2. Unit 1b is now 357 lines (server.ts 4 + agentes-rutas.ts 149 + agentes-rutas.test.ts 204); full suite 721/721, tsc 0.

## Unit 2: `agenteId` on `POST /conexiones` (~114, stacked on 1b)

- [ ] 3.1 RED C1-C5 in `src/agentes-rutas.test.ts` (with `registerConexionRoutes`): own agent gives 201 and stored `agenteId`; B's agent gives 404 `agente-no-encontrado` and no marker row; unknown id gives 404; own revoked agent gives 201; no `agenteId` gives 201 and `null`; `''` gives 400.
- [ ] 3.2 GREEN `src/conexiones.ts`: add `agenteId?` to the body interface, `propertyNames` enum and `properties` (`minLength: 1`); scoped `prisma.agente.findUnique` with no `revocadoEn` filter before the create; write `agenteId: body.agenteId ?? null`.
- [ ] 3.3 GREEN `ConexionPublica` in `src/conexiones.ts` gains `agenteId: true`.
- [ ] 3.4 Checkpoint: full `npm test` green (existing connection suites unchanged), `npx tsc --noEmit` clean.
- [ ] 3.5 Line-count checkpoint (method above): at most 400.
- [ ] 3.6 Final: no `.env` or `package.json` diff. Commit deferred to orchestrator, which then runs verify and archive.

## Traceability

- Model, indexes, RESTRICT, rollback header -> 1.2, 1.5
- Isolation pin, fail-closed, single audited lookup, deactivated tenant -> 1.1, 1.3, 1.4
- Token format, hash only -> 1.6, 1.7, 2.1
- Emit, re-issue, list, revoke, projection -> 2.1-2.4
- Optional `agenteId`, scoped check, revoked bindable -> 3.1-3.3
