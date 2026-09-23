## Exploration: CH-09 — Tenant schema mapping (M2)

> Mirror of Engram `sdd/CH-09-tenant-schema-mapping/explore` (obs #107). Written by the orchestrator because the explore agent had no file-write tool.

### Current State

DEC-30 (firm) already decided the mapping model: canonical views per tenant are REGISTERED (operator-authored SQL), never GENERATED from a column map. What DEC-30 explicitly left open is WHERE those registered views live and HOW they are applied at query time — this exploration's core question, to be closed as DEC-31 before `sdd-propose`.

CH-16b already proved the *shape* of the views by hand: `openspec/changes/CH-16b-vistas-canonicas/sql/03_vistas_foodstore.sql` and `06_vistas_medusa.sql` are real `CREATE OR REPLACE VIEW` DDL for `v_producto`, `v_insumo`, `v_receta_componente`, installed by a **superuser** (`postgres`) against real replica containers, while the app's own read-only role (`lector_zerodashboard`) was verified to lack `CREATE` on the schema. `04_consulta_canonica.sql` is the one automation query, written once against the view names, unchanged across three schemas.

The execution engine (`src/consulta-ejecucion.ts`) enforces read-only in two structural layers (DEC-08/DEC-09), already shipped:
- `correrTransaccion()` opens `BEGIN TRANSACTION READ ONLY`, sets `statement_timeout` via `set_config(...,$1,true)`, then runs `verificarPermisosRol()` — a catalog-only probe (`has_table_privilege`, `has_schema_privilege`) that **actively blocks execution** if the connected role holds `INSERT/UPDATE/DELETE/TRUNCATE` on any table or `CREATE` on any non-system schema (`categoriaBloqueo`: `rol-superusuario` | `rol-con-escritura-en-tabla` | `rol-con-create-en-esquema`).
- The operator's SQL text is never parsed; it is wrapped as `SELECT * FROM (<sql>) AS _consulta_usuario LIMIT $1 OFFSET $2`, submitted through the extended protocol so Postgres itself rejects multi-statement text, and only `$1`/`$2` are bound as driver parameters. This is the project's own precedent for "static SQL template + driver-bound values".
- Row cap (DEC-19) and cutoff verdict (DEC-18) derive from the same single `LIMIT`; timeout is a server-side `statement_timeout` plus an app-side backstop timer.

Tenant isolation (DEC-13/DEC-15) is a Prisma Client Extension (`src/aislamiento-prisma.ts`) that injects `tenantId` into every operation on a closed allowlist (`MODELOS_AISLADOS = {Conexion, ConsultaGuardada}`) via `AsyncLocalStorage` (`src/contexto-tenant.ts`), fail-closed. `src/consulta-ejecucion.ts` is outside this boundary — it dials the tenant's own Postgres via `pg`. DEC-13 says any tenant-scoped table added later inherits the mechanism by being added to `MODELOS_AISLADOS`.

The canonical contract (`src/contrato.ts`, DEC-21) is a static TS module enumerating `producto`, `pedido`, `item_pedido`, `insumo`, `receta_componente`. Its top comment states naming is fixed "because CH-09's mapeo will key off these exact strings" — a signal (not a formal DEC) that the mapping record should key on these entity names verbatim.

### Affected Areas

- `prisma/schema.prisma` — new tenant-scoped model for the registered mapping; one migration.
- `src/aislamiento-prisma.ts` — add the new model to `MODELOS_AISLADOS` (DEC-13).
- New module (e.g. `src/mapeo-vistas.ts`) — persistence + routes to register/list/get per-entity view SQL; entity name validated as one of `CONTRATO_CANONICO`'s five names (structural only — contract validation is CH-10).
- A composition helper — only if Option B is selected and CH-09 builds it now rather than in CH-12.
- New capability spec `specs/<capability>/spec.md`; `canonical-contract` stays unchanged (DEC-21).
- `docs/01-decisiones.md` — DEC-31 before `sdd-propose`.

### Core open question: where registered views live, and how they are applied

| | (A) Real `VIEW` objects in the tenant's replica | (A-sub) Client/DBA creates them out-of-band; ZeroDashboard only records/verifies | (B) Stored in ZeroDashboard's own DB, composed as `WITH ...` CTEs per query | (C) FDW: foreign tables + real views inside ZeroDashboard's own DB |
|---|---|---|---|---|
| DDL against tenant replica | Required, with the same stored credential | Required, with a credential ZeroDashboard never stores | None | None (DDL only in ZeroDashboard's own DB) |
| Conflict with rule 3 / DEC-08 | Direct: a `CREATE`-capable stored credential trips `rol-con-create-en-esquema` and the app refuses to execute anything through it, as shipped | Rule 3's letter holds, but someone must hold DDL access to a "read-only replica" | None | None on the tenant side |
| Hard technical ceiling | On a true physical/streaming replica (hot standby) no role can run DDL at all. Undecided whether the client's replica is one | Same as (A) | N/A | N/A |
| New validation machinery | Catalog introspection for CH-10 | Same | None — composed text goes through the same `ejecutarConsulta`/`correrTransaccion` pipeline (READ ONLY tx, DEC-08 check, pagination wrap) | Server/foreign-table layer per tenant |
| Rule 4 | N/A | N/A | Composes trusted operator-authored fragments, not runtime values; same pattern as the shipped `LIMIT $1 OFFSET $2` wrapper | N/A |
| Timeouts / row cap (CH-07) | Unaffected | Unaffected | Unaffected | Unaffected |
| `04_consulta_canonica.sql` unchanged | Yes | Yes | Yes — only a `WITH` preamble is added | Yes |
| Tenant isolation | Mapping record needs `tenantId` scoping | Same | Same | Same + tenant-safe naming of FDW servers |
| CH-10 (M3/M4) | Catalog introspection | Same | Zero-row probe (`LIMIT 0`) through the existing pipeline exposes `fields` | Catalog introspection |
| CH-15/CH-16 measurement | Install step is off-system; must be self-reported | Same, done by a third party | Registration is an API call, trivially timestamped | Like (B) plus an unmeasured FDW provisioning step |
| D-2 (open) | Channel must also support elevated DDL sessions | Same | Independent | Needs persistent server-to-server connections |
| Credential surface | Stored credential needs `CREATE` — undermines DEC-16/17 | Elevated credential outside the system, unaudited | None new | New `USER MAPPING` credential per tenant |

### Approaches

1. **(A)** — self-defeating under the current engine; DDL impossible on a true replica; puts a `CREATE`-capable credential in ZeroDashboard's DB.
2. **(A-sub)** — Effort Medium. Keeps the stored credential read-only; but needs elevated access to the replica by someone, blocked on a true streaming replica, invisible to CH-15, and a technical burden for a PYME client.
3. **(B)** — Effort Low–Medium. No DDL near tenant data; no new enforcement; observable for CH-15; independent of D-2; no new credential. Cons: `WITH` stitching must handle operator queries that open their own `WITH`; CTE names become reserved identifiers.
4. **(C)** — Effort High. Persistent server-to-server connection, duplicated credential surface, new provisioning machinery, dependency on D-2.

### Recommendation

(B). Recommendation only — the choice is an architecture decision for the user, registered as DEC-31 before `sdd-propose`.

### Other unregistered decisions CH-09 needs

1. **Granularity**: one SQL blob per tenant vs one definition per canonical entity. Per-entity makes CH-10's "which entities are mapped / which automations are inapplicable" a direct existence check; a blob needs parsing.
2. **Association target**: `Tenant` vs `Conexion`. The schema allows several `Conexion` per tenant; view SQL is specific to one source schema, which argues for `Conexion`, but no single-platform-per-tenant assumption is written down.
3. **Canonical entity names as fixed key** (matching `CONTRATO_CANONICO` verbatim) — anticipated by a code comment, not a DEC.
4. **Versioning** — out of scope (B4/R3).
5. **Composition now vs later**: build the `WITH` composition primitive in CH-09, or only persistence + registration (plus an optional zero-row preview), leaving composition to CH-12. Wiring composition into `POST /consultas/ejecutar` by default is undesirable: that route runs ad hoc SQL against the tenant's native schema.

### Minimal scope for M2

- Persist operator-authored SQL, one registration per (tenant-or-connection × canonical entity).
- Add the model to `MODELOS_AISLADOS`.
- Create + list + get (CH-05 / DEC-10 precedent).
- Validate only that the entity is one of the five contract names.
- Do not wire composition into `/consultas/ejecutar`'s default path; no parameters (CH-11), no plantillas (CH-12); do not expand the engine (rule 6).

### Risks

- Proceeding without DEC-31 violates AGENTS.md.
- (A)/(A-sub) are blocked by the shipped DEC-08 check in plain form.
- Whether the client's "réplica de solo lectura" is a true physical replica is undecided; it determines whether (A)/(A-sub) are possible at all.
- `WITH` stitching collisions — implementation risk for `sdd-design`.

### Ready for Proposal

No — DEC-31 and the listed decisions must be resolved by the user first.
