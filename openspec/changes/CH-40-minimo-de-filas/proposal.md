# Proposal: CH-40 — Minimum rows per automation

**Status**: ready for spec and design. Inputs: exploration.md, DEC-186 (b), DEC-193 (exploration decisions 1–2), DEC-174, DEC-84, DEC-83, DEC-19. Story X9.

## Intent
P1 decides that an automation notifies only when the result reaches a minimum number of rows («avisar si hay al menos 5 productos bajo stock»), a condition the SQL cannot express without changing the rows that reach the message (DEC-186). Below the minimum the run is still recorded, as skipped by the minimum, so P1 can tell "nothing to report" from "not enough to report". With the default of 1, every automation behaves exactly as today (DEC-84).

## Scope

### In Scope
- **Model.** `Automatizacion.minimoFilas`, an integer, not null, default 1. One migration; the default fills existing rows, so there is no backfill.
- **Validation.** An integer with `1 ≤ minimoFilas ≤ maxFilasPorConsulta` (the engine's configured row cap, DEC-19). Out of range or not an integer gives `400` with `campos: ['/minimoFilas']`. Checked with the other pure checks, before any read.
- **Create** (`POST /automatizaciones`). Optional `minimoFilas`; absent means 1. `AutomatizacionCompleta` returns it, so create and get show it. The list summary does not change.
- **Operator adjust** (`PUT /automatizaciones/:id/ajustes`, CH-33, DEC-174). Accepts `minimoFilas` with the same rule and writes it to the same row, keeping the run history (DEC-193, 1(a), as a precision of DEC-186).
- **Decision** (`decidirNotificacion`). New precedence row right after zero rows and before the missing recipient: a successful run with `0 < filas < minimoFilas` and no cut by the row cap ends `omitida-bajo-minimo`. A result cut by the cap (`paginacion.hayMas`) counts as reaching the minimum (DEC-193, 2(a)).
- **Outcome.** `omitida-bajo-minimo` joins the closed `notificacion` set and the skip subset. No migration: the column is TEXT typed in code, as in CH-18. The runs listing exposes it like any other value.
- **Scheduler.** `planificador.ts` selects `minimoFilas` and passes it to the decision.
- **Console** (`src/consola/consola.ts`):
  - Create form: a number field «Mínimo de filas para avisar», default 1, `min=1`. The server's 400 names the field.
  - Adjust form: the same field, filled from the saved automation, in the dirty check and the diff.
  - Run label: «No enviada: menos filas que el mínimo».
  - The email schematic of the create form says when the email goes out.
- **Docs.**
  - `docs/guia/06-automatizaciones.md`: the minimum, its default, and the new outcome.
  - The automations entry in `guidelines/consola.md`, in both copies of the design skill.
  - DEC-193 in `docs/01-decisiones.md`, on a `v2/dec-193` branch from `master`.
  - The CH-37 to CH-39 rows of `docs/02-mapa-de-changes.md` get their PR numbers (#211, #214, #215 and #216), and CH-40 gets its own at close.

### Out of Scope
- The panel adjust (P-04, `panel-ajustes.ts`): DEC-186 keeps it out until a story asks for it.
- Conditions on aggregated values, column comparisons, or combinations (DEC-186 (d)).
- A minimum declared on the template (DEC-186 (c)).
- The message preview (CH-42): it will read `minimoFilas` later to say whether the notice would go out.
- Any change to the renderer, the subject, the row cap, the zero-row rule, templates, or `RegistroEjecucion`.

## Delivery (exploration decision 3(a))
One SDD change, one PR, branch `ch40/minimo-filas` from `master`. Estimate ~415 changed lines. If the tasks forecast stays above 400, the tasks phase stops and asks for `size:exception` before apply.

## Capabilities

### Modified Capabilities
- `automation-scheduling`:
  - `Automatizacion` gains `minimoFilas` (default, range, create).
  - The run pipeline applies the minimum after query success and before notifying.
- `email-notification`: the outcome precedence gains the `omitida-bajo-minimo` row, with the cap rule.
- `execution-log`: the permitted `notificacion` set and the runs listing include `omitida-bajo-minimo`.
- `query-console`:
  - The create form and the in-place adjust carry the minimum.
  - The runs view labels the new outcome.

## Approach
- **Decision.** `decidirNotificacion(r, destinatario, configurado, minimoFilas)` stays pure. The new check is `r.filas.length < minimoFilas && !r.paginacion.hayMas`, evaluated after the zero-row check, so `minimoFilas = 1` can never reach it.
- **Validation.** One pure helper, e.g. `minimoFilasValido(valor, tope)`, shared by create and adjust. The schemas list `minimoFilas` in `properties` and `propertyNames`. Whether AJV may coerce `"5"` is settled in design (the DEC-60 precedent avoided coercion for `valores`).
- **Types.** `EstadoNotificacion` and `OmisionNotificacion` gain the value; `cierreConNotificacion` already writes any string omission, so it does not change.
- **Console.** It follows the CH-33 and CH-38 patterns: new ids in `IDS`, no `zd-*` tokens in the script (G3'), and the exact request-body tests updated.

## Affected Areas
- `prisma/schema.prisma`, new migration under `prisma/migrations/`
- `src/automatizaciones/automatizaciones.ts`, `automatizaciones-rutas.ts`, `planificador.ts` and their tests
- `src/consola/consola.ts`, `src/consola/consola.test.ts`
- `docs/guia/06-automatizaciones.md`, `.claude/skills/zerodashboard-design/guidelines/consola.md` and its `.agents/` copy, `docs/02-mapa-de-changes.md`
- The four specs above (at archive)

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| The migration default and the decision default drift apart | Low | One constant for the default in code; a scheduler test with an automation created before the column |
| A lowered `MAX_FILAS_CONSULTA` silences an automation | Low | DEC-193 2(a): a cut result counts as reaching the minimum; a unit test with `hayMas` |
| AJV coerces a string into the integer | Medium | Design decides; tests with `"5"`, `5.5`, `0` and above the cap |
| The adjust route is in the T2 isolation sweep | Medium | The two-tenant adjust test includes the new key |
| Console guards (`IDS`, G3', exact bodies) | High | Follow CH-33's adjust patterns; budgeted in the estimate |
| The PR brushes the 400 budget | Medium | The tasks forecast decides; stop for `size:exception` if needed |
