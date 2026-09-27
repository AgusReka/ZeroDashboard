# Proposal: CH-09 — Tenant Schema Mapping

## Source

- `docs/02-mapa-de-changes.md`, R1, CH-09; `docs/mapa-historias.md` **M2** (R1). M3/M4 are CH-10.
- `docs/01-decisiones.md`: **DEC-30, DEC-31, DEC-32, DEC-33** (firm, user, 2026-09-23 — not reopened). Precedents: DEC-10, DEC-13, DEC-15, DEC-21.
- Exploration: `openspec/changes/CH-09-tenant-schema-mapping/explore.md`.

## Intent

CH-16b proved the canonical views by hand, as superuser SQL files outside the system. ZeroDashboard records no mapping today, so CH-10 has nothing to validate, CH-12 nothing to compose, and CH-15/CH-16 cannot measure the adaptation cost through the system. CH-09 makes the mapping a registered, tenant-isolated record per `Conexion` and canonical entity.

## Scope

### In Scope

- One new Prisma model + one additive migration: `tenantId`, `conexionId` (FK), canonical entity name, operator SQL text, timestamps; unique on (connection, entity) (DEC-32).
- Model added to `MODELOS_AISLADOS` (DEC-13, DEC-33).
- Three routes (DEC-10 shape): register one entity definition for a connection, list a connection's definitions, read one.
- Entity name validated only as one of the five `CONTRATO_CANONICO` names; no field/column checks (DEC-32).
- The connection is resolved through the scoped `Conexion` delegate first: another tenant's connection is `404`, never a write.
- `node:test` + `app.inject()` tests; T2 two-tenant sweep extended to the new routes.

### Out of Scope

- **Zero-row preview** (optional under DEC-31) — excluded; see Approach.
- `WITH` composition; any change to `POST /consultas/ejecutar` or `src/consulta-ejecucion.ts` (CH-12, DEC-31).
- Column/type validation and inapplicable automations (CH-10, M3/M4).
- Delete; versioning (B4, CH-25).
- Console UI — needs its own decision (DEC-12 precedent; CH-08 stayed API-only).
- Parameters (CH-11); any DDL against a replica; any engine change (rule 6).

## Capabilities

### New Capabilities

- `tenant-schema-mapping`: registering, listing and reading operator-authored view SQL per connection and canonical entity, keyed by the contract's entity names, tenant-isolated.

### Modified Capabilities

- `domain-data-model`: "No Premature Modeling" pins the model list to exactly `Tenant`, `Conexion`, `ConsultaGuardada` and forbids `Mapeo`; the delta admits the mapping model and adds its requirement. Destructive-delta warning applies at archive.
- `tenant-isolation`: the scoped-model requirement and the T2 sweep enumerate only `Conexion`/`ConsultaGuardada`; extended to the new model.
- `canonical-contract`: unchanged (DEC-21).

## Approach

- **Pure persistence.** CH-09 never opens a connection to a tenant replica. Stored SQL is inert text, so rule 4 holds trivially: nothing is composed or executed.
- **Preview excluded.** M2 asks only to register. The operator can already run a definition's `SELECT` against the same connection through the existing console, with zero new code. A preview returning `fields` is exactly CH-10's M3 probe and would drift into contract validation. Executing unvalidated definitions could surface personal columns (rule 5) before CH-10 exists.
- **Tenant from context** (DEC-15), injected by the extension; `additionalProperties:false`, so a body `tenantId` is rejected (rule 2).
- Follows `register<X>Routes(app, prisma)`, JSON Schema + `camposInvalidos()` → `400 solicitud-invalida`.

Open for `sdd-design`: model/route naming, registration-time SQL check (textual only — executing the SQL at registration would reintroduce the excluded preview and needs its own DEC), list payload and body-size bound.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `prisma/schema.prisma` + `prisma/migrations/` | Modified/New | New model; back-relations on `Tenant`/`Conexion` (no column change) |
| `src/aislamiento-prisma.ts` | Modified | One entry in `MODELOS_AISLADOS` |
| `src/<mapping-module>.ts` (+ `.test.ts`) | New | Routes + tests |
| `src/server.ts` | Modified | One registration line |
| `src/aislamiento.test.ts` | Modified | T2 sweep covers new routes |
| `src/contrato.ts`, `src/consultas.ts`, `src/consulta-ejecucion.ts` | None | Byte-identical |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Re-registering an entity replaces the previous definition in place (DEC-34, user 2026-09-23); no history, no delete | Low | Decided: DEC-34. History stays with B4/CH-25 |
| A registration-time SQL check needs the replica reachable (D-2 open) and reintroduces the excluded preview | Med | Same: a DEC if chosen; a purely textual check (`sanearSql` non-empty) is a design detail |
| Extension injects `tenantId` on the row, but the FK accepts any `Conexion` id | Med | Scoped `Conexion` lookup before create; T2 sweep asserts it |
| Registered SQL may project personal columns (rule 5) | Low | Never executed in CH-09; CH-10 validates, CH-12 composes |
| Over the 400-line budget | Med | See Review Workload |

## Rollback Plan

Revert the commit and apply a migration dropping the new table (Prisma emits no down migration). The migration is additive: no existing column is altered, `MODELOS_AISLADOS` returns to two entries. Registered rows are lost, but no consumer exists yet (CH-10/CH-12 unbuilt) and CH-16b's SQL files remain the source to re-register.

## Review Workload

Rough estimate: schema + migration ~35, route module ~160, tests ~220, isolation sweep ~50, wiring ~5 → **~470 lines; 400-line budget risk: Medium.** Natural slices: (1) model + migration + `MODELOS_AISLADOS` + isolation test; (2) routes + tests. Strategy `auto-chain`; `sdd-tasks` owns the binding forecast.

## Success Criteria

- [ ] Registering a definition for a contract entity on the active tenant's connection returns `201`, with `tenantId` from context.
- [ ] An entity outside the five names (e.g. `cliente`) returns `400 solicitud-invalida`.
- [ ] Another tenant's connection id returns `404` and writes no row; list/read of another tenant's rows behave as nonexistent (T2).
- [ ] A body carrying `tenantId` or an unknown property returns `400`.
- [ ] Listing a connection returns exactly its registered entities.
- [ ] No code path added by CH-09 opens a `pg` connection; `src/consulta-ejecucion.ts`, `src/consultas.ts`, `src/contrato.ts` are byte-identical.
- [ ] The migration is additive only.
