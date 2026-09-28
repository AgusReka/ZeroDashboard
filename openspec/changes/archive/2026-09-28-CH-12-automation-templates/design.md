# Design: CH-12 — Automation Templates (D1)

## Technical Approach

A global `Plantilla` table (DEC-61, DEC-73) sits outside `MODELOS_AISLADOS`. Its catalog routes are exempt from `x-tenant-id` by exact method and route pattern. The test route is not exempt. A pure module, `src/plantillas.ts`, owns three things: the save-time checks (reused from CH-11), the DEC-71 view gate, and `componerSentencia`, which builds `WITH v_<entidad> AS (...) SELECT * FROM (<template>) AS _plantilla` from stored operator SQL only. The composed text then goes through `prepararSentencia`. That makes the branded `SentenciaPreparada` the only input `ejecutarConsulta` accepts, the same as in CH-11. No new execution path, budget or parser is added.

## Architecture Decisions (implementation-level, within DEC-01..73)

| Topic | Choice | Rejected | Rationale |
|---|---|---|---|
| Isolation | `Plantilla` absent from `MODELOS_AISLADOS`; the extension passes it through | A pseudo-tenant, or special-casing it in `aplicarAlcance` | DEC-61. The pass-through is already how `Tenant` works, so no new mechanism is needed |
| Catalog capability | `registerPlantillaRoutes(app, plantillas: PrismaAislado['plantilla'])` takes the delegate only | Passing the full client | DEC-24's safety argument is structural: an exempt handler cannot reach a scoped model. Even if one did, the extension throws `ErrorSinTenantActivo` (500) |
| Exemption | Exact rows in `esExenta`: `GET`/`POST /plantillas` and `GET`/`PUT /plantillas/:id` | A prefix match like `/tenants/` | A prefix match would exempt `/plantillas/:id/prueba`. Anything unlisted stays scoped (fail-closed) |
| Test route | `POST /plantillas/:id/prueba`, in its own file, taking the full `PrismaAislado` | A sub-route of the catalog registrar | It requires a tenant (DEC-62). Keeping it in a separate file makes the capability boundary visible to grep |
| `automatizacion`, `formato` | `TEXT`, validated in the app as an AJV `enum` (`Object.values(AUTOMATIZACIONES)`, `['correo-html']`) | A Postgres enum or `CHECK` | Same precedent as `VistaCanonica.entidad`: the values live in code (DEC-21, DEC-67), so a DB enum would be a second source of truth |
| Composition shape | Views become CTEs; the template is nested as a subquery | Splicing into the template's own `WITH` | Outer CTEs are visible inside the subquery, so no text parsing is needed (DEC-09, DEC-31) |
| CTE order and alias | Contract order. The alias is `'v_' + CONTRATO_CANONICO[i].nombre`, never the stored string | The stored order or stored text | Deterministic output. Stored JSON can never inject text into an identifier |
| Piece sanitizing | `componerSentencia` applies `sanearSql` exactly once to each stored piece, and wraps each body in newlines | Sanitizing in the route | The CH-10 probe does the same (`sanearSql(sql)`). The newlines make a trailing `-- comment` safe |
| Stored JSON on read | `parametros` is re-checked by `prepararSentencia`; `entidades` is re-checked against the contract, and a name outside it throws (500) | Trusting the column | DEC-73 puts validation in the app, and corruption fails closed |
| List | `take: LIMITE_LISTADO + 1` plus `truncado`; the summary leaves out `sql`, `parametros` and `entidades` | An uncapped list | There is no delete (DEC-68), so the table only grows. Same pattern as `ConsultaGuardada` |

## Validation Gate (DEC-71) and Staleness

A view passes only when its row has `estadoValidacion === 'valida'`. The gate reuses CH-10 semantics as they stand:
- Every `PUT` of a view's SQL resets it to `no-validado` in the same write (DEC-41).
- The validate action's stale-write guard (`updateMany where {id, sql}`) keeps a verdict from landing on SQL it did not probe.

So `valida` always refers to the row's current `sql`. The gate reads `sql` and `estadoValidacion` in a single scoped `findMany`, which means the SQL it composes is exactly the SQL the verdict covers. Two changes still go undetected: drift in the tenant's source schema and edits to the contract. Both remain DEC-40 accepted limits. When they happen, execution returns `200 fallo`.

Failing states use the CH-10 vocabulary: `no-mapeada` (no row), `no-validado` and `invalida`. Every failing entity is listed, in contract order. A validated view cannot contain a hand-written `$n`, because the probe sent it with `values: []` and would have failed. It also cannot contain a normal-state `:name`, which is a syntax error. The one exception is the documented `arr[lo:hi]` limit from CH-11.

## Rule 4 Compliance

The composed text is built from four sources:
1. `Plantilla.sql` and `VistaCanonica.sql`: stored SQL written by the operator. DEC-31 establishes that prepending it is not a runtime value.
2. Fixed literals.
3. Aliases taken from the closed contract.
4. `$k` tokens inserted by `reescribirMarcadores`.

Request `valores` travel only in `SentenciaPreparada.valores`, and pagination binds at `$(n+1)`/`$(n+2)` (DEC-53). Because the whole composed text goes through the scanner, a `$n` or undeclared marker anywhere in it is rejected (DEC-59/57). Execution stays inside `BEGIN READ ONLY` plus the DEC-08 check (rule 3). A data-modifying CTE inside a nested subquery is refused with `0A000` → `no-es-lectura`.

## Data Flow — Test Route

```
Client            hooks              plantilla-prueba.ts               own DB              tenant PG
  │ POST /plantillas/:id/prueba (x-tenant-id)
  ├──────────────▶ resolve tenant (400/404/409)
  │               └────────────────▶ AJV {conexionId, valores, limite, desplazamiento}
  │                                  plantilla.findUnique ───────────▶ 404 plantilla-no-encontrada
  │                                  conexion.findUnique [+tenantId] ─▶ 404 conexion-no-encontrada
  │                                  vistaCanonica.findMany [+tenantId]
  │                                  evaluarVistas ──▶ 409 vista-canonica-no-aprobada {entidades}
  │                                  componerSentencia → prepararSentencia ──▶ 400 {campos, problemas}
  │                                  destinoDeConexion ──▶ 409 credencial-ilegible
  │                                  ejecutarConsulta(sentencia) ────────────────────────▶ READ ONLY
  ◀──────────────────────────────── 200 ok | 200 fallo (the CH-04 verdict shape)
```

Nothing is dialed before every 4xx check has passed. The catalog flow is AJV → `sanearSql` (a blank statement returns `400 /sql`) → `validarDeclaracion` + `analizarSentencia` (`400 {campos, problemas}`) → `create` (201), `update` (200; `P2025` → 404), or `findUnique`/`findMany`.

## Interfaces / Contracts

```ts
// src/plantillas.ts — pure: no Fastify, no Prisma, no pg
export const FORMATOS = ['correo-html'] as const;                        // DEC-65
export const VALORES_AUTOMATIZACION = Object.values(AUTOMATIZACIONES);    // DEC-67
export interface FilaVista { entidad: string; sql: string; estadoValidacion: string }
export interface VistaAComponer { entidad: string; sql: string }
export type EstadoNoAprobado = 'no-mapeada' | 'no-validado' | 'invalida';
export type Compuerta =
  | { ok: true; vistas: VistaAComponer[] }                                // contract order
  | { ok: false; entidades: { entidad: string; estado: EstadoNoAprobado }[] };
export function evaluarVistas(entidades: unknown, filas: readonly FilaVista[]): Compuerta;
export function componerSentencia(sqlPlantilla: string, vistas: readonly VistaAComponer[]): string;
export function problemasDePlantilla(sql: string, parametros: unknown): ProblemaParametro[];
```

Body schemas are strict, using `propertyNames` as CH-05 established. The create and replace body is:
- `nombre`: string, `minLength` 1.
- `sql`: string, `minLength` 1.
- `parametros`: default `[]`. Items use the CH-11 shape.
- `entidades`: array with `minItems` 1 and `uniqueItems`. Items are an `enum` of `ENTIDADES_CANONICAS`.
- `automatizacion`: enum.
- `formato`: enum.
- `toleranciaFrescuraMinutos`: integer, `minimum` 0 (spec: non-negative).

The test route body is `{conexionId, valores = {}, limite = 50, desplazamiento = 0}`. It has no `parametros`, because the stored template is the third declaration source.

## File Changes

| File | Action | Description |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `model Plantilla`: no `tenantId`, no relations, `Json` `parametros` (default `[]`) and `entidades` |
| `prisma/migrations/20260927100000_plantilla/migration.sql` | Create | `CREATE TABLE "Plantilla"`; additive |
| `src/contexto-tenant.ts` (+ test) | Modify | Add four exact exemption rows and update the doc comment |
| `src/plantillas.ts` (+ test) | Create | Constants, save checks, gate, composition |
| `src/plantillas-rutas.ts` (+ test) | Create | Catalog routes: create, list, get, replace |
| `src/plantilla-prueba.ts` (+ test) | Create | Test route |
| `src/contrato.ts` | Modify | Doc comment only: DEC-22 is closed by DEC-67 |
| `src/server.ts` | Modify | Register both routes after `registrarContextoTenant` |
| `src/aislamiento.test.ts` | Modify | `Plantilla` passes through without a context, and T2 covers the test route |

## Testing Strategy (strict TDD, `npm test`, `node:test` + `inject()`)

| Layer | What | Approach |
|---|---|---|
| Unit | `componerSentencia`: exact text, contract order, a template with its own `WITH`, a trailing `-- c`, identity of each piece after `sanearSql`. `evaluarVistas`: each state, multiple failures, a stored name outside the contract throws. `problemasDePlantilla`: DEC-56/57/59 | `plantillas.test.ts` |
| Routing | The exemption matrix below; the registrar signature pin | `contexto-tenant.test.ts`, `plantillas-rutas.test.ts` |
| Integration (live PG, skipped when unreachable) | Create/get/replace round-trip with no header; `truncado`; each `400`; a replace of an unknown id → 404 | `plantillas-rutas.test.ts` |
| Integration | Rows returned over composed views; `O'Brien`/`; DROP` values come back as data; each gate state → 409; a foreign `conexionId` → 404; a closed-port connection still gets its 4xx (proof that nothing was dialed); an undeclared `v_x` → `200 fallo 42P01` | `plantilla-prueba.test.ts` |

## Threat Matrix

The generic rows (documentation paths, git selection, commit, push, PR commands) are N/A: this change has no shell, subprocess, VCS or PR automation. The routing and SQL rows are applicable:

| Case | Expected | RED test |
|---|---|---|
| `POST /plantillas/:id/prueba` without the header | `400 tenant-no-indicado` | Routing |
| `DELETE`/`PATCH /plantillas/:id`, `/plantillas-falsas` | Not exempt → 400 | Routing |
| An exempt handler reaching a scoped model | Impossible by type; 500 at runtime | Signature pin |
| Tenant B composing tenant A's views | 404, nothing read | T2 |
| A request value reaching the SQL text | Only `$k` appears in the text | Unit + integration |
| Stored `entidades` corrupted into `x) ; DROP` | Throws; the alias always comes from the contract | Unit |

## Migration / Rollout

The migration is additive: one table, with no FK and no index beyond the PK. Rollback is `DROP TABLE "Plantilla"`. Existing routes are untouched.

Size forecast: about 1,300–1,500 lines including tests. `400-line budget risk: High`. The work splits into five PRs, stacked in a chain whose first PR is based on `ch11/8-verify-archivo`:
1. Schema, migration, exemption and pass-through tests (~220 lines).
2. The pure `plantillas.ts` module (~330).
3. Create, list and get (~380).
4. Replace, plus the `contrato.ts` comment (~200).
5. The test route (~390). If it goes over budget, split it into 5a (gate and 4xx) and 5b (execution and rule-4 tests).

## Resolved Alignment Notes

- "Undeclared entity → 4xx" means an entity outside the contract, rejected with `400` at save. A template that references a `v_x` it did not declare returns `200 fallo error-sintaxis 42P01` under the existing verdict contract; the spec has a scenario for it.
- `entidades` `minItems: 1`, `toleranciaFrescuraMinutos` `minimum: 0`, `formato` required with no default — aligned with the spec.
- Error codes `plantilla-no-encontrada` (404) and `vista-canonica-no-aprobada` (409) are implementation details within the spec's 404/4xx language.
