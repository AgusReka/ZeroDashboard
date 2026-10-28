# Proposal: CH-38 — Templates screen in the console

**Status**: ready for spec and design. Inputs: exploration.md, DEC-182 (edit (b)), DEC-191, DEC-190, DEC-177, DEC-173, DEC-164, DEC-160, DEC-159, DEC-79, DEC-71, DEC-68, DEC-62. Stories D4, D5.

## Intent
P1 creates, tests and saves a template from the console instead of calling the API by hand, and corrects a template without changing what runs in another tenant: a template with active automations is not edited, it is duplicated (DEC-182 (b), DEC-191).

## Scope

### In Scope
- **In-use rule.** A template is in use when at least one `Automatizacion` with `activo = true` points to it, in any tenant (DEC-191).
  - `PUT /plantillas/:id` answers 409 `{error: 'plantilla-en-uso'}` on a template in use. The count and the update run in one transaction.
  - `GET /plantillas/:id` returns `enUso` (boolean). The `GET /plantillas` summary does not change.
- **Cross-tenant count.** One function, `usosDePlantilla(id) → number`, built in `src/app/rutas.ts` from the unscoped client and injected into the template routes. It is the only unscoped read of `Automatizacion` and returns a number, never rows or tenant ids.
- **Test before saving.** New `POST /plantillas/prueba`:
  - Body: the template body of `POST /plantillas` plus `{conexionId, valores}`.
  - Requires `X-Tenant-Id` (not exempt, like `/plantillas/:id/prueba`).
  - Runs `rechazoDePlantilla` and the same gates as the stored-template test (own-tenant connection, approved views (DEC-71), readable credential).
  - Audited with `origen: 'plantilla-prueba'` and `plantillaId: null` (DEC-159, DEC-160).
  - Persists nothing.
- **Console screen C-03** (`src/consola/consola.ts`):
  - **Header.** Primary action «Nueva plantilla».
  - **Drawer.** Shows the client title and description, and «Editar» or «Duplicar y editar» depending on `enUso`.
  - **One pop-up (DEC-173) for create, edit and duplicate.** Fields: name, SQL, parameter declaration, entities (closed list), automation tag, format, freshness tolerance, client title and description. A test block runs against a connection of the active tenant.
  - **Save gate.** «Guardar» is enabled only after a passing test whose fingerprint (SQL, parameter declaration, entities, connection) matches the form. Changing only the name, texts or tolerance keeps it enabled.
  - **Duplicate.** «Duplicar y editar» opens the pop-up with the original's fields, `titulo` and `descripcion` empty and «(copia)» appended to the name. Nothing is written until saving.
  - **Refusals.** A 409 `plantilla-en-uso` on save is shown in the pop-up and offers to duplicate.
- **Parameter editor.** The query pop-up's parameter editor becomes reusable by both pop-ups, with no behavior change in Consultas.
- **Docs.**
  - `docs/guia/05-plantillas.md`: the screen, the in-use rule, the new test route; the "Límites" line that says the console does not create or edit templates is removed.
  - `guidelines/consola.md` C-03 entry, in both copies of the design skill.

### Out of Scope
- The message text fields (CH-39), which will later be added to this same pop-up.
- Deleting or retiring a template from the catalog (DEC-68), and versions (DEC-182 (c)).
- Reactivating an automation (DEC-79): DEC-191 depends on its absence.
- Any engine, closed-list or condition change (DEC-63, DEC-65, DEC-67, DEC-64, DEC-84).
- The client panel: unchanged; a copy without texts simply does not appear under «disponibles» (DEC-190).

## Capabilities

### Modified Capabilities
- `automation-templates`: `PUT` refusal on a template in use; `enUso` in the full projection; the unsaved-template test route; the route signature (delegate plus the count port).
- `tenant-isolation`: the single unscoped read of `Automatizacion` for the in-use count, number only.
- `execution-audit`: a `plantilla-prueba` row may carry `plantillaId: null`.
- `query-console`: the Plantillas screen stops being read-only (create, edit, duplicate, test before saving); the Consultas parameter editor is shared.

## Approach
- **Routes.** `registerPlantillaRoutes(app, plantillas, usosDePlantilla)`. The in-use check runs after validation, so the rejection suite keeps working with its throwing `Proxy`. `PUT` wraps count and update in `$transaction` on the unscoped client, or takes a transaction-aware port. The design picks one.
- **Test route.** `POST /plantillas/prueba` lives next to `/plantillas/:id/prueba` in `plantilla-prueba.ts` and shares its gates and execution path; only the template source changes (body instead of row). Fastify matches the static `/plantillas/prueba` before `/:id`, so the two routes cannot shadow each other.
- **Console.**
  - Reuses `crearDialogo`, `avisarEnDialogo` and the `#conexion-dialogo` markup pattern.
  - The save gate follows `huellaActual` and `guardadoHabilitado` of the query pop-up.
  - New dynamic nodes use bridge classes, never `zd-*` in the script (G3').
  - Every new id is registered in `IDS` and `IDS_OCULTOS`.
- **Parameter editor.** It is extracted from the Consultas globals into a small factory taking its container and change callback; Consultas tests stay unchanged as the regression net.

## Affected Areas
- `src/app/rutas.ts`, `src/app/rutas.test.ts`
- `src/plantillas/plantillas-rutas.ts`, `src/plantillas/plantillas-rutas.test.ts`
- `src/plantillas/plantilla-prueba.ts` and its test
- `src/aislamiento/contexto-tenant.ts` (only if the new route needs a listed rule), plus an isolation test for the count
- `src/consola/consola.ts`, `src/consola/consola.test.ts`
- `docs/guia/05-plantillas.md`, `.claude/skills/zerodashboard-design/guidelines/consola.md` and its `.agents/` copy
- The four specs above (at archive)

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| The unscoped count widens tenant isolation | Medium | One function, number only, injected (not a client); an isolation test with two tenants; the spec forbids returning rows or ids |
| An automation is created between count and update | Low | Same transaction; residual window accepted in DEC-191 |
| Extracting the parameter editor changes Consultas behavior | Medium | Consultas tests unchanged as the regression net; the factory keeps the same DOM and callbacks |
| G3', `IDS` and fake-DOM guards make the console tests large | High | Bridge classes, static markup for `zd-*`; budgeted in the size |
| The demo seed puts the `stock-fisico` template in use | Certain | Expected: the demo shows «Duplicar y editar»; noted in the guide |
| Creating a template needs an active tenant with a connection and approved views | Certain | Accepted in DEC-191; the pop-up states why «Guardar» is disabled |
| Size ~830 lines, over the 400 budget | Certain | Single PR with `size:exception`, chosen by the user (exploration decision 5(b)) |
| Branch base: code needs CH-37 (#211) and docs need DEC-191 (#213), both unmerged | Medium | Branch `ch38/pantalla-plantillas` from `ch37/textos-cliente`; the PR cites #213 as a documentation dependency |
