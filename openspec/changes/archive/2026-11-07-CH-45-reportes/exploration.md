# Exploration: CH-45 — Reports: model, global catalog and console screen

Status: **decided** (2026-11-05): 1(a), 2(a), 3(a), the recommended options, chosen by the user; registered as DEC-198. No research phase, chosen by the user. Store: openspec. Story R1h. Depends on CH-36, merged. CH-46 depends on this change.

DEC-183 constraints that bind this change (`docs/01-decisiones.md:3430`):
- A global catalog written by P1 against the canonical `v_*` views. A tenant runs a report through its mapping.
- A report has a name, text for the client, a query with declared parameters, the entities it uses and one visualization type from a closed list in code: number, table, bars or line. The type fixes which columns it expects.
- The only parameter is a period, declared by P1 as a date parameter and validated against the declaration.
- Live execution with no stored rows (DEC-93), a fixed row cap in code, and the panel receives only the declared columns (rule 5).

R1h (`docs/mapa-historias.md:158`): "Query against `v_*` with declared parameters and one visualization type from a closed list. Works for every mapped tenant without rewriting."

Out of scope: the per-tenant dashboard (CH-46), the Chart.js copy (CH-47) and the panel screen with live execution (CH-48). The console test shows the result as a table.

## What exists (verified)

| Piece | State |
|---|---|
| Catalog model | `Plantilla` (`prisma/schema.prisma:166-180`) is global, with no `tenantId`, JSON `parametros` and `entidades`, and values checked in code. Nothing named report or visualization exists in `src/`, `prisma/` or `openspec/specs/`. |
| Global routes | `PLANTILLAS_EXENTAS` lists exact routes exempt from `x-tenant-id` (`src/aislamiento/contexto-tenant.ts:127-132`). The catalog routes receive only their delegate. `Plantilla` is absent from `MODELOS_AISLADOS`. |
| Test routes | `src/plantillas/plantilla-prueba.ts` is not exempt and takes the scoped client. `POST /plantillas/prueba` tests an unsaved template. `probarContraConexion` and `ejecutarPrueba` (`:106,183`) are private. |
| Run pipeline | `evaluarVistas` then `componerSentencia` (`src/plantillas/plantillas.ts:118,153`, exported), `prepararSentencia`, `destinoDeConexion`, `ejecutarConsulta`, and `registrarEjecucion`. |
| Save checks | `problemasDePlantilla` (`plantillas.ts:173`) covers the declaration, hand-written `$n`, undeclared markers and unused names. |
| SQL limits | There is no parser (DEC-09), so nothing statically enforces "only `v_*`". Read-only comes from the transaction and the role. An undeclared view fails at run time with 42P01 (`plantilla-prueba.test.ts:694`). The composition does not stop P1 from naming a real table of the replica; this is inferred from the code and is the same limit templates have. |
| Parameters | `TIPOS_PARAMETRO` includes `fecha`; its value must match the ISO regex (`src/ejecucion/parametros.ts:239,380`). Every declared parameter is required (DEC-50). There is no relative date (DEC-50, cited at `docs/01-decisiones.md:2288`). |
| Row cap | `topeFilas` is per call and defaults to `maxFilasPorConsulta`, 200 by default (`src/ejecucion/consulta-ejecucion.ts:89`, `src/compartido/config.ts:42`). A result ended by the cap reports `corte` (`consulta-ejecucion.ts:101`). |
| Result | `columnas: string[]`, `filas: unknown[][]` (`consulta-ejecucion.ts:95-96`). Column names come from the SQL, so they can be technical. |
| Test-columns precedent | `exigirColumnas` (`src/plantillas/plantillas-rutas.ts:175,212`): since CH-39, saving checks message placeholders against the columns of the preceding test. A global row has no connection, so the server cannot run the check itself. |
| Audit | `OrigenEjecucion` is a TypeScript union (`src/auditoria/auditoria.ts:24-29`) over a free TEXT column. A new origin needs no migration (CH-42 precedent). `RegistroEjecucion` has a nullable `plantillaId` and no foreign keys (`prisma/schema.prisma:393-415`). |
| Client text | `terminosProhibidosEn` (`src/compartido/glosario-panel.ts:21`) and `textoCliente` already check text for P2. |
| Lifecycle precedent | A template is replaced in place and never deleted (DEC-68). One with active automations cannot be edited (DEC-191). |
| Console | `src/consola/consola.ts` is one document of 6367 lines. A screen touches the nav (`:237-253`), a `pantalla-*` section, `PANTALLAS` (`:6202`), a script block, and the test lists. Guards: `IDS`, `IDS_OCULTOS`, G3' (only three `zd-*` tokens in the script), `PANTALLAS` and `sinPeligros` (`consola.test.ts:150,455,678,3907,7776`). The templates screen is about 800 lines. |

### Specs affected

- New capability: `report-catalog`.
- `query-console`, `execution-audit`, `tenant-isolation`, `domain-data-model`.
- Docs: the console and screen guidelines of the design skill, in both copies; `docs/guia/` if the console guide lists its screens.

## Shape that fits

- **Module.** `src/reportes/` mirrors the split of `src/plantillas/`: pure rules, global catalog routes, and tenant-scoped test routes. It imports the exported functions rather than sharing a table or a generic "catalog" abstraction with templates, because the fields, the lifecycle and the consumers differ.
- **Shared run step.** The private gate and run sequence of `plantilla-prueba.ts` moves to one exported function that receives the audit origin. CH-48 needs the same sequence, and copying it would leave the DEC-71 gate in two places. This touches a tested file, so its existing tests must stay unchanged.
- **Model.** A global `Reporte` with `id`, `nombre`, `titulo`, `descripcion`, `sql`, `entidades`, `visualizacion`, `columnas` and the period declaration. Values are checked in code, following `Plantilla`.
- **Routes.** `GET /reportes`, `POST /reportes`, `GET /reportes/:id` and `PUT /reportes/:id` as exact exempt rows, plus `POST /reportes/prueba` and `POST /reportes/:id/prueba` under the tenant.
- **Console.** A `Reportes` screen under `Global`, beside `Plantillas`: list, read-only drawer, create and edit dialog, and a test block that selects a connection and a period. No new `zd-*` token enters the script.

### Defaults proposed for DEC-198, following precedent

These do not go to a separate question. They are recorded in the decision and the user can overrule them.

- **Lifecycle.** Replace in place, no delete (DEC-68). The rule for a report already on a dashboard is decided in CH-46, where that relation first exists.
- **Audit.** Origin `reporte-prueba` and a nullable `RegistroEjecucion.reporteId`, the counterpart of `plantillaId`. An additive column; the immutability triggers only act on update and delete.
- **Save and test.** The body carries the columns of the preceding test, as in CH-39. Each run checks the result again, since a report can break for one tenant only, and a missing column is an error state (DEC-184).

## Decisions (chosen by the user on 2026-11-05: 1(a), 2(a), 3(a); registered as DEC-198)

1. **Period declaration.** (a) One date parameter, named by P1, plus the list of day counts P1 allows, such as 7, 30 and 90. The server turns the chosen count into the date in the DEC-77 zone, and P2 never sends a date. The first count is the default. A report may also declare no period. (b) The same, with a closed list of counts in code. (c) Two parameters, `desde` and `hasta`, chosen as dates. *Recommended: (a). It matches "the periods P1 declared" (R4h), and the value stays validated, never SQL. (b) is smaller but stops a monthly report from offering 365. (c) amounts to a free filter, which DEC-183 excludes.*
2. **Expected columns.** (a) P1 maps each role of the type to a result column and gives it a title for the client: `valor` for number, `etiqueta` and `valor` for bars and line, and an ordered list for table. (b) Fixed aliases in the SQL (`AS etiqueta`, `AS valor`), and a declared list only for table. *Recommended: (a). R3h forbids technical terms, so column names need a client title anyway, and one rule covers the four types and rule 5. (b) needs no mapping UI, but it gives P2 no axis or column titles and leaves table as a special case.*
3. **Row cap.** (a) A constant per type in code: number 1, bars 20, table 50, line 100. The console and the panel show the cut using `corte`. (b) One cap for all types, the existing 200. *Recommended: (a). A bar chart with 200 bars is unreadable and a number only uses one row. The cost is a table to maintain, and a report with daily data over more than 100 days gets cut.*

## Risks

- **Size.** About 2500 to 3000 lines with tests and specs, judging by CH-38 (+973 in code alone) and CH-42 (+1352). The map marks this change ⚠, and the session strategy is a single PR, so a `size:exception` must be recorded before apply. The natural cut, if the user prefers, is backend and console.
- **Raw tables.** A report can read a replica table outside `v_*`, as a template can. P1 is trusted, and the panel only receives mapped columns. To be documented as a limit.
- **Console file.** `consola.ts` grows by about 800 lines, with no split planned in this change.

### For later changes, not this one

- **CH-46.** A tenant can have several connections (`Conexion` has no unique `tenantId`, and `evaluarVistas` works per connection), so the dashboard must decide which one runs each report.
- **CH-48.** `RegistroEjecucion.operadorId` is required and `registrarEjecucion` reads `request.operador`. A panel run has no operator, so its audit needs its own decision.

## Ready for proposal

Yes: DEC-198 is registered in `docs/01-decisiones.md`. No research phase: DEC-183 and DEC-184 settle the external choices, and CH-47 owns the library.
