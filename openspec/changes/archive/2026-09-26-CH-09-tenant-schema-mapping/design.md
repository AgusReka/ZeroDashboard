# Design: CH-09 — Tenant Schema Mapping

## Technical Approach

Pure persistence (DEC-31). One new tenant-scoped model `VistaCanonica` (one operator-authored view definition per `Conexion` × canonical entity, DEC-32/DEC-33), one additive migration, one `MODELOS_AISLADOS` entry, and a route module `src/vistas-canonicas.ts` exposing `registerVistaCanonicaRoutes(app, prisma)`. Registration is an idempotent replace keyed on the unique pair (`conexionId`, `entidad`) (DEC-34), built only from operations the isolation extension already allows. Nothing is parsed, composed or executed; no `pg` connection is opened. `src/contrato.ts`, `src/consultas.ts`, `src/consulta-ejecucion.ts` stay byte-identical (`contrato.ts` and `sanearSql` are only imported).

## Architecture Decisions

| Decision | Choice | Rejected | Rationale |
|---|---|---|---|
| Naming | Model `VistaCanonica`, module `src/vistas-canonicas.ts`, routes `/conexiones/:id/vistas-canonicas[/:entidad]`, keys `vistaCanonica` / `vistasCanonicas` | `MapeoVista`, `/conexiones/:id/mapeo` | Repo convention is one name across model/route/module/key (`ConsultaGuardada` ↔ `/consultas-guardadas`). A row *is* one canonical view (DEC-30 wording); "mapeo" is the set per connection |
| Replace verb | `PUT /conexiones/:id/vistas-canonicas/:entidad`, body `{ sql }`; `201` first time, `200` on replace | `POST` with `entidad` in body | The resource is addressed by its natural key (DEC-32); PUT's idempotent-replace semantics are DEC-34 literally. Entity validation moves to a params `enum`, still `400 solicitud-invalida` |
| Upsert under isolation | Scoped `findFirst({conexionId, entidad})` → `update({where:{id}})` or `create`; on `P2002` from `create`, re-run find→update **once**, else rethrow (`500`) | (a) add `upsert` to `aplicarAlcance`; (b) interactive `$transaction` find+write | (a) edits the closed map DEC-13's design resolution #2 names as refused — a mechanism change, not a route detail. (b) under READ COMMITTED a transaction does not stop two concurrent first inserts; the unique constraint is the real arbiter either way. All four ops are already allowlisted (`findFirst` AND-wrapped, `update` unique-selector, `create` injected). Final state is last-writer-wins, which is DEC-34 |
| Cross-tenant `conexionId` | Scoped `prisma.conexion.findUnique({where:{id}, select:{id:true}})` before any read/write → `404 conexion-no-encontrada`; T2 effect-level test | Composite FK `(conexionId, tenantId)` → `Conexion(id, tenantId)` | DEC-13 chose app-level structural isolation; a composite FK needs a new unique on `Conexion` and introduces DB-level tenancy constraints as a second mechanism class. Rejected by the user in DEC-35 (2026-09-23). Not `destinoDeConexion`: it selects and deciphers `credencial` (CH-07 single-read invariant) |
| `entidad` storage | `TEXT`, validated in app against `CONTRATO_CANONICO.map(e => e.nombre)` | Prisma enum / `CHECK` | DEC-21: the contract lives in code; a DB enum duplicates it and needs a migration per contract edit |
| SQL bounds | `minLength: 1` + `sanearSql(sql) !== ''` (predicate only); stored verbatim; no `maxLength` (Fastify 1 MiB `bodyLimit`) | Parse/keyword checks; execute/`LIMIT 0` probe; a `maxLength` | DEC-09: no SQL parser. Executing at registration is the excluded preview and needs a DEC. No `maxLength` matches `consultas-guardadas.ts`/`conexiones.ts` |
| List payload | Summary without `sql`, `orderBy: {entidad:'asc'}`, no `truncado` | Include `sql`; cap + `truncado` | Unique × 5-name enum bounds the list at 5 rows structurally; `sql` stays on read-one, as `ConsultaGuardadaResumen` does |

## Data Flow

    PUT /conexiones/:id/vistas-canonicas/:entidad  (x-tenant-id)
      onRequest hooks ── tenant resolved into ALS (DEC-15)
      schema: params.entidad ∈ contract, body {sql} propertyNames ──✗──▶ 400 solicitud-invalida
      sanearSql(sql) === '' ─────────────────────────────────────────▶ 400 campos ['/sql']
      conexion.findUnique(id)  [+tenantId] ── null ──────────────────▶ 404 conexion-no-encontrada
      vistaCanonica.findFirst(conexionId, entidad) [AND tenantId]
        ├─ found ─▶ update({where:{id}+tenantId, data:{sql}}) ──────▶ 200 { vistaCanonica }
        └─ null  ─▶ create({conexionId, entidad, sql}+tenantId) ────▶ 201 { vistaCanonica }
                      └─ P2002 (concurrent first write) ─▶ findFirst → update once ─▶ 200

    GET  .../vistas-canonicas          → conexion 404 | 200 { vistasCanonicas: Resumen[] }
    GET  .../vistas-canonicas/:entidad → 400 | conexion 404 | 404 vista-canonica-no-encontrada | 200

## File Changes

| File | Action | Description |
|---|---|---|
| `prisma/schema.prisma` | Modify | `VistaCanonica` model; back-relations `Tenant.vistasCanonicas`, `Conexion.vistasCanonicas` (no column change) |
| `prisma/migrations/<ts>_vista_canonica/migration.sql` | Create | `CREATE TABLE`, `@@index([tenantId])`, `@@unique([conexionId, entidad])`, two FKs `RESTRICT`; header comment "additive" as in `tenant_activo` |
| `src/aislamiento-prisma.ts` | Modify | `'VistaCanonica'` in `MODELOS_AISLADOS`; map untouched |
| `src/vistas-canonicas.ts` | Create | Projections, schemas, three routes |
| `src/vistas-canonicas.test.ts` | Create | Route integration + concurrency |
| `src/server.ts` | Modify | Import + `registerVistaCanonicaRoutes(app, prisma);` after `registerConsultaGuardadaRoutes` |
| `src/aislamiento.test.ts` | Modify | Fixture, sweep rows, cleanup order |

## Interfaces / Contracts

```prisma
model VistaCanonica {
  id            String   @id @default(uuid())
  tenantId      String
  tenant        Tenant   @relation(fields: [tenantId], references: [id])
  conexionId    String
  conexion      Conexion @relation(fields: [conexionId], references: [id])
  entidad       String
  sql           String
  creadaEn      DateTime @default(now())
  actualizadaEn DateTime @updatedAt
  @@unique([conexionId, entidad])
  @@index([tenantId])
}
```

Body schema: `{ type:'object', additionalProperties:false, propertyNames:{enum:['sql']}, required:['sql'], properties:{ sql:{type:'string',minLength:1} } }`. Params schema: `properties:{ entidad:{ enum: ENTIDADES_CANONICAS } }, required:['entidad']`; `attachValidation: true` + `camposInvalidos()` on PUT and GET-one. Projections: `VistaCanonicaResumen = { id, entidad, creadaEn, actualizadaEn }`; `VistaCanonicaCompleta = Resumen + sql`. No `tenantId`/`conexionId` in responses. `create` uses `conTenantInyectado({ conexionId, entidad, sql })`.

## Testing Strategy

`node:test` + `app.inject()` against live PostgreSQL, skipped when unreachable (existing preflight).

| Layer | What | Approach |
|---|---|---|
| Integration | `201` first PUT; DB row `tenantId` = header tenant; `200` replace keeps `id`, new `sql`, `actualizadaEn` advances, one row per pair | `vistas-canonicas.test.ts` |
| Integration | `cliente` → `400 ['/entidad']`; body `tenantId`/unknown key → `400`; blank/`';'` sql → `['/sql']`; unknown conexion → `404`, zero rows | same |
| Integration | Two concurrent first PUTs → both 2xx, exactly one row | `Promise.all` |
| Integration | List = exactly registered entities of *that* connection; read-one `200`/`404 vista-canonica-no-encontrada` | same |
| Static | Module never references `destinoDeConexion`, `probeConnection`, `ejecutarConsulta`, `credencial` | source-text assertion |
| T2 | Sweep rows for PUT/GET-list/GET-one → `404 conexion-no-encontrada` both ways + owner controls; PUT against B leaves B's `sql` unchanged and writes nothing for A; `3.4`/`3.5`/`3.6` extended; `upsert` still throws | `aislamiento.test.ts`; cleanup deletes `vistaCanonica` before `conexion` |

## Threat Matrix

| Boundary | Case | Applicability | Response | RED test |
|---|---|---|---|---|
| Tenant via body | `tenantId` in body | Applicable | `propertyNames` | 3.5 extended |
| Foreign `conexionId` | A writes/reads on B's connection | Applicable | Scoped lookup first | T2 sweep + effect check |
| Path param | `entidad` outside contract, traversal-like | Applicable | Params `enum` | `400 ['/entidad']` |
| Stored SQL | Injection / personal columns | Applicable | Inert text, never executed in CH-09 | Static no-execution assertion |
| Shell / VCS / PR / file classification | — | N/A: none in this change | — | — |

## Migration / Rollout

Additive: new table only; `Conexion`/`Tenant` columns untouched. Generate with `prisma migrate dev --create-only`, review SQL. Rollback: revert + drop-table migration (proposal).

## Open Questions

- [ ] None blocking. `sdd-spec` must align with `PUT` + params-validated `entidad` and the `domain-data-model` delta listing `VistaCanonica`.
