# Proposal: CH-20 — Query execution audit (A5)

**Status**: ready for spec and design. Inputs: exploration.md, DEC-159 to DEC-163, `docs/02-mapa-de-changes.md` (CH-20). Depends on CH-29 (merged): every console request carries its operator.

## Intent
- Answer A5 for the console: what was executed, when, against which tenant and by whom, in a queryable record that cannot be deleted from the interface.
- Recording never changes an execution's answer (DEC-162).

## Scope

### In Scope
- A tenant-scoped table `RegistroEjecucion` with no foreign keys: tenant and operator id and name copied at write time; origin, connection, saved query (id, version, name) or template, the full statement (DEC-160), verdict (`resultado`, `fase`, `categoria`, `codigo`), row count and duration. Never parameter values nor rows.
- A database trigger that refuses `UPDATE`, `DELETE` and `TRUNCATE` on the table (DEC-162).
- One `registrarEjecucion` called by the four audited console paths after the engine answers: `POST /consultas/ejecutar`, `POST /plantillas/:id/prueba`, `POST /conexiones/:id/validacion-mapeo`, `POST /conexiones/:id/prueba` (DEC-159). A failed write logs an `error` and the execution answers as before.
- `POST /consultas/ejecutar` accepts optional `consultaGuardadaId` and `version`; the record names the saved query only when the text sent is exactly that version's (DEC-161). The console sends them for a loaded, unedited query.
- `GET /auditoria`: newest first, filters by date range and result, capped by `LIMITE_LISTADO` with `truncado`. No write or delete route (DEC-163).
- A two-tenant proof on the listing.

### Out of Scope
- The C-12 screen (CH-30, DEC-163).
- Scheduled runs: they stay in `Ejecucion` (DEC-159).
- Pruning or exporting the record (DEC-162).
- Pre-dial rejections (400, 404, 409 before the engine runs): nothing is executed, nothing is recorded.

## Capabilities

### New Capabilities
- `execution-audit`: the record, its write path, its immutability and its listing.

### Modified Capabilities
- `query-execution`: `POST /consultas/ejecutar` takes the optional saved query reference.
- `query-console`: the console sends the loaded saved query's id and version when the editor still holds its text.

## Approach
A pure module builds the record from what the route already holds (the engine's verdict, the operator, the connection) so the four routes add one call each. The write uses the scoped client inside the request's tenant context, `conTenantInyectado` for the tenant id, and its own `try/catch`: an audit failure is logged and swallowed. The trigger is created in the migration that creates the table. The saved query check reads the current row or the history entry for that version through the scoped client and compares the stored statement byte for byte.

## Affected Areas
- `prisma/schema.prisma`, a new migration (table, index, trigger), regenerated client; `src/aislamiento-prisma.ts` (`RegistroEjecucion` scoped)
- `src/auditoria.ts` (new) and tests; `src/rutas.ts` (registration of the listing)
- `src/consultas.ts`, `src/plantilla-prueba.ts`, `src/validacion-mapeo-rutas.ts`, `src/conexiones.ts`
- `src/consola.ts` and `src/consola.test.ts`
- `docs/01-decisiones.md` (DEC-159 to DEC-163, done)

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| A tenant reads another tenant's audit | Low | Scoped model; two-tenant test on `GET /auditoria` |
| An audit failure breaks a query | Low | Separate `try/catch`, logged as `error`; a test forces the write to fail and the execution still answers 200 |
| The record claims a saved query that did not run | Low | Byte-for-byte check against the stored version; mismatch is "ad hoc" |
| A literal with personal data stored in the statement | Medium | Accepted in DEC-160; only the operator reads it |
| The trigger blocks test cleanup | Medium | No foreign keys; suites filter by their own tenant ids and never delete audit rows |
| Volume in development | Medium | Index on `(tenantId, creadoEn)`; capped listing |

## Review Workload Forecast
- PR1: schema, migration with the trigger, isolation registration, pure module, `GET /auditoria`, tests: ~400 lines
- PR2: recording in the four routes, failure isolation, tests: ~350 lines
- PR3: saved query id and version (route check and console), tests: ~250 lines
Total ~1000 lines; **400-line budget risk: High; Chained PRs recommended: Yes; Decision needed before apply: Yes** (the session strategy is `single-pr`).
