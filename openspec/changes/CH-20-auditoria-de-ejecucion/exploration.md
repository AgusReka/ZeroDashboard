# Exploration: CH-20 — Query execution audit (A5)

Status: **decided** (2026-10-11). Store: openspec. The owner's decisions are registered as DEC-159 to DEC-163 in `docs/01-decisiones.md`: (1) every console path that dials a tenant, the scheduler stays in `Ejecucion`; (2) the full statement, never values or rows; (3) saved query id and version, verified against the text; (4) no route edits or deletes, a database trigger refuses `UPDATE`/`DELETE`, a failed write never breaks the execution; (5) API only, the C-12 screen in CH-30.

## Why

- **A5** (P1, R2): "auditoría de qué se ejecutó, cuándo, contra qué tenant y por quién". Acceptance: "registro consultable, no borrable desde la interfaz".
- CH-29 made "por quién" possible: every console request carries `request.operador = { id, nombre }`.
- Today nothing records what the console executes against a client's database. Only failures leave a `warn` line in the process log, which is not queryable and is lost with the container.

## What exists (verified)

| Path | Route | Runs SQL through | Persists today | Operator |
|---|---|---|---|---|
| Ad hoc console query (also how a saved query is run) | `POST /consultas/ejecutar` (`src/consultas.ts`) | `ejecutarConsulta` | nothing; `warn` on failure | yes |
| Template test | `POST /plantillas/:id/prueba` (`src/plantilla-prueba.ts`) | `ejecutarConsulta`, on the composed SQL | nothing; `warn` on failure | yes |
| Mapping validation | `POST /conexiones/:id/validacion-mapeo` (`src/validacion-mapeo-rutas.ts`) | `sondearEstructura` (one `LIMIT 0` per entity) | the verdict on `VistaCanonica`, overwritten in place | yes |
| Connection probe | `POST /conexiones/:id/prueba` (`src/conexiones.ts`) | `SELECT 1` in `db-probe.ts` | nothing | yes |
| Scheduler | none (`src/planificador.ts`) | `ejecutarConsulta` | one `Ejecucion` row per run (metadata, no SQL) | none: it is the system |

- Every SQL execution against a tenant's replica goes through `src/consulta-ejecucion.ts`, which never throws and returns a sanitized verdict: `resultado` (`ok` / `fallo`), `fase` (`conexion`, `permisos`, `ejecucion`), `categoria` (`no-es-lectura` for the read-only rejection, `tiempo-agotado`, …), `codigo`, `duracionMs`, and rows on success.
- Bound parameter values never reach the SQL text (`$n` placeholders). The **SQL text** is operator-written and can carry inline literals (an email in a `WHERE`), and stored view SQL can too.
- The console does not tell the server which saved query it is running: the editor posts plain SQL, so "ad hoc" and "saved" are indistinguishable today.
- `Ejecucion` requires an automation (`automatizacionId`), has no SQL, no connection and no operator (DEC-109 notes the same limit).
- DEC-93 and rule 5: persist metadata, never row content.
- Design skill, screen **C-12** (`guidelines/consola.md`, PENDIENTE): `fecha_hora`, `tenant`, `conexion`, `consulta` (name or "ad hoc"), `sql_resumen` (mono, truncated), `filas`, `duracion`, `resultado` (OK / rechazada / timeout), `operador`; read-only, filters by date and result.

## Decisions that are not mine to take

1. **What is audited.** (a) Only the ad hoc console query (`/consultas/ejecutar`). (b) Every console path that dials a tenant: ad hoc query, template test, mapping validation, connection probe. (c) (b) plus the scheduler's runs, with "Sistema" as the operator.
2. **How much SQL is kept.** (a) The full text. (b) A truncated summary (as C-12 shows). (c) Only a hash plus the saved query's name. Inline literals in the text are the minimization risk (rule 5).
3. **Saved query identity.** Whether the console sends the loaded saved query's id (and version, CH-25) so the record can say which one ran, or every console run is recorded as "ad hoc".
4. **Immutability and retention.** "No borrable desde la interfaz": (a) no delete route and nothing else; (b) also a database guard (a trigger or a role without `DELETE`/`UPDATE` on the table); and whether rows are kept forever or pruned after a period.
5. **Scope of this change for the screen.** The C-12 screen now, or only the API now with the screen in CH-30.

## Risks

- **Minimization.** Storing SQL text can store personal data typed as literals; the choice in 2 is the mitigation.
- **Coupling.** Recording must never change an execution's answer: if the audit write fails, the query result still returns (or the opposite, fail-closed — part of decision 4).
- **Isolation.** The audit table is tenant data: scoped by the extension, a two-tenant proof on the reading route.
- **Volume.** Ad hoc queries during development can be many; an index by tenant and date and a capped listing are needed.

## Proposed shape once decided (not final)

- A scoped table `RegistroEjecucion` (tenant, operator id and name copied at write time, path, connection, saved query, SQL as decided, rows, duration, verdict).
- A single `registrarEjecucion` called by each audited route after the engine answers, with the operator from the request.
- `GET /auditoria` with date and result filters, capped like every listing; no write or delete route.
- Size: ~400–600 production and test lines; two or three chained PRs.

## Next

Decisions registered (DEC-159 to DEC-163). Next: propose, spec, design, tasks.
