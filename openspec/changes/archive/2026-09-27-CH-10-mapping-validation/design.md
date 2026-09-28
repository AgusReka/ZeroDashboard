# Design: CH-10 — Mapping Validation

## Technical Approach

This change adds explicit, persisted, structural validation (DEC-40, DEC-42). `POST /conexiones/:id/validacion-mapeo` dials the tenant once. Inside one READ ONLY transaction, after the DEC-08 check, it runs one `LIMIT 0` probe per mapped entity. It compares each probe's `fields` (name, `dataTypeID`) with the typed contract (DEC-39, DEC-43) and writes status, diagnostic and timestamp onto each `VistaCanonica` row (DEC-44). `GET` on the same path builds the report from persisted rows and `CONTRATO_CANONICO`: all five entities plus per-automation applicability. It opens no `pg` connection. A PUT re-registration resets the three columns in the same `update` (DEC-41).

## Architecture Decisions (implementation-level, within DEC-39..44)

| Topic | Choice | Rejected | Rationale |
|---|---|---|---|
| Granularity, route | Per connection: `POST` and `GET /conexiones/:id/validacion-mapeo`, key `validacionMapeo` | Per-entity action; `.../vistas-canonicas/validacion` | One dial and one DEC-08 check cover up to 5 probes. Applicability needs every entity anyway. A static segment in the `:entidad` slot could collide with a future entity name |
| Reuse of `correrTransaccion` | Generalize it into a module-private `enSesionSoloLectura(destino, presupuestos, cuerpo)`: connect race, backstop, `BEGIN READ ONLY`, `set_config`, DEC-08, `ROLLBACK`, close. `ejecutarConsulta` passes today's pagination body. A new exported `sondearEstructura` passes the probe body | Export `correrTransaccion`; `ejecutarConsulta({limite:0})` (binds `LIMIT 1`); copy the machinery | The READ ONLY and DEC-08 path stays inside `consulta-ejecucion.ts`, so no caller can run a body outside it. Existing tests pin unchanged execution behavior |
| Per-entity isolation | One transaction; each probe runs between `SAVEPOINT sondeo` and `ROLLBACK TO SAVEPOINT sondeo` (fixed literals, `values: []`) | One transaction or one dial per entity | An error in one entity's SQL (`42P01`, `0A000`) must not abort the others. Savepoints are allowed in READ ONLY |
| Probe text | `SELECT * FROM (<sanearSql(sql)>) AS _validacion LIMIT 0`, `values: []`; only `fields` is read | Bound `LIMIT $1` | There is no runtime value to bind (rule 4). The query returns zero rows by construction (rule 5) |
| Budgets | `statement_timeout = queryTimeoutMs` per statement; connect uses `connectionTestTimeoutMs`; backstop `queryTimeoutMs × (n+1) + 2000` | New setting | DEC-19 and DEC-42 add no new budget |
| Session failure | `conexion`, `permisos` or backstop returns `200 {resultado:'fallo', fase, categoria, codigo, duracionMs}`. **Nothing is persisted**; prior state is kept | Mark rows `invalida` | A failed dial is a fact about the connection, not the mapping, so a network blip must not change a verdict. `validadaEn` then only records validations that actually ran (G1) |
| Entity failure | A probe error sets `invalida` with `sondeo:{categoria,codigo}` from `classifyExecutionError` | — | This is a fact about the mapping, so it is persisted |
| Stale-write guard | `updateMany({where:{id, sql: sqlSondeado}})`, sets `actualizadaEn` explicitly to the value read. Count 0 reports `no-validado` | Plain `update` | Without it, a PUT that races the probe would receive the old SQL's verdict (the DEC-41 failure) |
| Re-PUT | Every PUT resets the state, even with identical SQL | Compare texts | This follows the proposal literally and needs no text comparison |
| No mapped entities | Return the report without dialing | Dial anyway | There is nothing to probe |
| CH-09 projections | Unchanged; the state is read only through the report | Add columns to list and read-one | One read surface; the CH-09 key-pinning tests stay as they are |
| Modules | `src/validacion-mapeo.ts` (pure: OID table, diagnosis, report) and `src/validacion-mapeo-rutas.ts` | One module | Mirrors `contrato.ts` / `contrato-rutas.ts`; the pure half is unit-tested without a database |

**OID → category** (`pg.types.builtins`): identificador = INT2/4/8, UUID, TEXT, VARCHAR, BPCHAR · numero = INT2/4/8, NUMERIC, FLOAT4/8 · texto = TEXT, VARCHAR, BPCHAR · booleano = BOOL · fecha = DATE, TIMESTAMP, TIMESTAMPTZ. The server already reports a domain as its base type, so domains need no handling. Arrays, `money`, `json`, enums and any other OID are not accepted. Their diagnostic carries the OID and a hint to cast in the view (`::text`). (DEC-45.)

**Diagnosis.** Each contract field gets one verdict, in contract order:

- `ok`
- `ausente`: fails only when the field is `obligatorio`.
- `tipo-incorrecto`: fails for any contract column that is present, whatever its obligatoriedad.
- `alias-sin-comillas`: the field is absent, but some column equals `nombre.toLowerCase()`. That column is attributed to the field, not listed as extra.
- `duplicada`

Any column left over goes to `columnasSobrantes` (DEC-43). The entity is `valida` only when the probe succeeded, no field verdict fails and there are no extra columns.

**Applicability** is a pure function of the rows and the contract. An automation depends on an entity when any of its fields lists that automation (DEC-22).

| Condition | Automations affected | Status |
|---|---|---|
| Optional entity not mapped | Every dependent automation | `inaplicable` |
| Required entity not mapped | Every dependent automation | `bloqueada` |
| Failed probe or extra columns | Every dependent automation | `bloqueada` |
| Failing field | Only the automations in that field's `automatizaciones` | `bloqueada` |
| Mapped entity still `no-validado` | Every dependent automation | `pendiente` |

When several conditions apply, the status follows the precedence `inaplicable > bloqueada > pendiente > aplicable`. Every reason is always listed.

## Data Flow

    Operator ─POST /conexiones/:id/validacion-mapeo (x-tenant-id)─▶ Routes
    Routes ─destinoDeConexion(id) [+tenantId]─▶ null → 404 | ilegible → 409
    Routes ─vistaCanonica.findMany({conexionId})─▶ rows (none → report, no dial)
    Routes ─sondearEstructura(destino, rows)─▶ consulta-ejecucion ─▶ Tenant PG
        connect race → BEGIN READ ONLY → set_config → DEC-08 (block → fallo permisos)
        per entity: SAVEPOINT → probe LIMIT 0 → fields | classify + ROLLBACK TO SAVEPOINT
        ROLLBACK → close
    Routes ◀─ fallo (conexion|permisos|backstop) → 200 fallo, nothing written
    Routes: diagnosticar() → updateMany({id, sql}) [AND tenantId] → informe() → 200 ok
    GET same path: ownership check (select id) → findMany → informe() — no pg

## Interfaces / Contracts

```ts
export type TipoSemantico = 'texto' | 'numero' | 'booleano' | 'fecha' | 'identificador';
// CampoCanonico gains `readonly tipo: TipoSemantico`; GET /contrato projects it verbatim.
export type EstadoValidacion = 'no-validado' | 'valida' | 'invalida';
export interface DiagnosticoValidacion {
  version: 1;
  sondeo: { resultado: 'ok' } | { resultado: 'fallo'; categoria: CategoriaEjecucion; codigo: string | null };
  campos: { campo: string; tipoEsperado: TipoSemantico; columna: string | null;
            veredicto: 'ok' | 'ausente' | 'tipo-incorrecto' | 'alias-sin-comillas' | 'duplicada';
            oid: number | null; tipoPostgres: string | null;
            tipoObservado: TipoSemantico | null;          // spec: "expecting X, observing Y"
            pista: { accion: 'castear-en-la-vista'; sugerencia: string } | null }[];  // DEC-45
  columnasSobrantes: { columna: string; oid: number }[];
}
// Report: entidades[5] {entidad, obligatoriedad, estado: EstadoValidacion|'no-mapeada', validadaEn, diagnostico}
//         automatizaciones[3] {automatizacion, estado, motivos: {entidad, campo|null, motivo}[]}
```

**POST body schema.** The validate action takes no input. The route declares an explicit body schema, following the `registroVistaCanonicaSchema` precedent in `src/vistas-canonicas.ts`: an optional empty object with `additionalProperties: false` and `propertyNames` rejecting `tenantId`. A body carrying `tenantId` (or any other property) is rejected with `400 solicitud-invalida`; a missing body is accepted.

Proposed field types: `id`, `pedidoId`, `productoId` and `insumoId` are identificador. `nombre`, `estado`, `moneda`, `sku`, `codigo` and `unidadMedida` are texto. `stockDisponible`, `total`, `cantidad`, `precioUnitario` and `cantidadPorUnidad` are numero. `activo` is booleano, `fechaCreacion` is fecha, and `pedido.numero` is identificador (DEC-39, clarified).

## File Changes

| File | Action | Description |
|---|---|---|
| `src/contrato.ts` (+ test) | Modify | `TipoSemantico`, `tipo` per field |
| `src/consulta-ejecucion.ts` | Modify | Private session helper; `sondearEstructura` |
| `src/validacion-mapeo.ts` (+ test) | Create | OID table, diagnosis, report |
| `src/validacion-mapeo-rutas.ts` (+ test) | Create | POST (empty body schema), GET, stale-write guard |
| `src/vistas-canonicas.ts` | Modify | `reemplazar` resets the three columns (`Prisma.DbNull`) |
| `prisma/schema.prisma`, `prisma/migrations/20260926000000_validacion_mapeo/` | Modify / Create | Three columns |
| `src/server.ts`, `src/aislamiento.test.ts`, `src/vistas-canonicas.test.ts` | Modify | Route wiring, T2 sweep, reset test |

## Testing Strategy

The suites use `node:test` and `app.inject()`. Integration suites run against a live PostgreSQL and skip when it is unreachable, with role fixtures as in `consultas.test.ts`.

| Layer | What | Approach |
|---|---|---|
| Unit | OID rows; each verdict; alias; extra columns. Applicability: unmapped `insumo` → `stock-producible` inaplicable; unmapped `producto` → all three bloqueada; wrong-typed `sku` blocks `stock-fisico` and `reporte-diario` only; `no-validado` → pendiente | `validacion-mapeo.test.ts` |
| Unit | Every field has a valid `tipo`; the four identifiers are identificador; `/contrato` projects `tipo` | `contrato*.test.ts` |
| Integration | Valid view; missing, wrong-type, extra and alias columns; `42P01` on one entity while another is `valida`; `1/(id-id)` over populated rows is `valida` (proves zero rows); a data-modifying CTE gives `no-es-lectura` and the table is unchanged; superuser → `permisos` with rows unchanged; closed port → `conexion` with rows unchanged; GET still returns 200 with the host unreachable; stale guard writes nothing | `validacion-mapeo-rutas.test.ts` |
| Integration | PUT after validation gives `no-validado` with a null diagnostic | `vistas-canonicas.test.ts` |
| Regression | Execution behavior unchanged | `consulta-ejecucion.test.ts` and `consultas.test.ts` pass unedited |
| T2 | POST and GET return 404 in both directions, with an owner control (superuser fixture → `200 fase permisos`). A's POST on B's connection leaves B's columns unchanged | `aislamiento.test.ts` |

## Threat Matrix

| Boundary | Case | Response | RED test |
|---|---|---|---|
| Foreign `conexionId` | A validates or reads B's connection | Scoped `destinoDeConexion` / ownership check first | T2 sweep and effect check |
| Stored SQL | Write disguised as read, multiple statements | READ ONLY + extended protocol + DEC-08 | CTE case |
| Data exposure | Rows or personal columns read | `LIMIT 0`, `fields` only, DEC-43 | `1/(id-id)`, extra columns |
| Shell / VCS / PR / file classification | — | N/A: none in this change | — |

## Migration / Rollout

Additive: `estadoValidacion TEXT NOT NULL DEFAULT 'no-validado'`, `diagnosticoValidacion JSONB`, `validadaEn TIMESTAMP(3)`. Existing rows are backfilled as never validated. Rollback drops the three columns.

## Open Questions

All resolved by the user on 2026-09-26 and registered in `docs/01-decisiones.md`:

- [x] **OQ-1 → DEC-39 clarified: `pedido.numero` is `identificador`.** Original question: the type of `pedido.numero`. DEC-39 lists identificador only for the id fields. Options: (a) identificador (recommended: a human-facing identifier, `int` or alphanumeric depending on the platform), (b) texto, (c) numero. Register it in `docs/01-decisiones.md` before apply.
- [x] **OQ-2 → DEC-45: (a), not accepted with a cast hint.** Original question: enums and non-builtin OIDs. (a) Not accepted, with a cast hint (recommended: the classification stays deterministic and a cast is a one-token fix). (b) Classify them by `pg_type.typcategory` with one extra catalog query. Medusa's `order.status` is an enum.
- [x] **OQ-3 → DEC-46: precedence `inaplicable > bloqueada` confirmed; every reason is listed.**
- [ ] Verify in apply: Prisma 7 accepts an explicit `actualizadaEn` on a `@updatedAt` field and supports `Prisma.DbNull`.
