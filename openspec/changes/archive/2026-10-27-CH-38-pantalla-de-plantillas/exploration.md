# Exploration: CH-38 — Templates screen in the console

Status: **decided** (2026-10-27): 1(b), 2(a), 3(a), 4(b), 5(b), chosen by the user; 1–4 registered as DEC-191 (branch `v2/dec-191`), 5 is delivery only. Store: openspec. Stories D4, D5. Decision: DEC-182, edit option (b): "while any automation uses it, it is not edited: it is duplicated. The console offers «Duplicar y editar», and the copy has no automations." Depends on CH-37 (PR #211, unmerged). Marked ⚠ in the v2 map (likely over 400 lines). No research phase.

The v2 docs are still in unmerged PRs: DEC-182 on `v2/dec-182-183` (#203), D4/D5 on `v2/historias` (#205), the CH-38 row on `v2/mapa` (#207). The map row says: "uses the routes that already exist (`POST` and `PUT /plantillas`, `/prueba`). `PUT` on a template in use must be blocked."

## What exists (verified)

| Piece | State |
|---|---|
| Model | `Plantilla` (`prisma/schema.prisma:162-174`): `id, nombre, sql, parametros, entidades, automatizacion, formato, toleranciaFrescuraMinutos, titulo?, descripcion?`. No timestamp, no "in use" column. `Automatizacion.plantillaId` is a RESTRICT FK (`:192-208`). |
| Template routes | `src/plantillas/plantillas-rutas.ts`: `POST /plantillas` (`:228`), `GET /plantillas` (`:244`, summary without `sql`/texts), `GET /plantillas/:id` (`:261`), `PUT /plantillas/:id` (`:278`, full replace, no "in use" check). No `DELETE` (DEC-68). Strict body schema (`:66-113`); `rechazoDePlantilla` (`:167-202`): AJV → texts (≤80/≤200 + glossary) → `sanearSql` → `problemasDePlantilla`. |
| Wiring | `registerPlantillaRoutes(app, prisma.plantilla)` (`src/app/rutas.ts:77`) gets only the delegate; pinned by `firmaSoloDelegado` (`plantillas-rutas.test.ts:44-47`). The four catalog routes are exempt from `X-Tenant-Id` (`src/aislamiento/contexto-tenant.ts:124-129`). |
| "In use" | Not computed anywhere. `Automatizacion` is in `MODELOS_AISLADOS`: any `prisma.automatizacion.*` call without a tenant context throws, and `PUT` has none. The only per-template count is the tenant-scoped `groupBy` in `src/panel/panel-automatizaciones.ts:292`. |
| Automation lifecycle | Never deleted. Deactivation sets `activo=false` and nothing writes `activo: true` back (DEC-79, `automatizaciones-rutas.ts:339`); the panel's pause is the same flag. |
| Test route | `POST /plantillas/:id/prueba` (`src/plantillas/plantilla-prueba.ts:145`) loads the **stored** template by id (`:157`): body `{conexionId, valores, limite, desplazamiento}`, needs `X-Tenant-Id`, gates on approved views (409 `vista-canonica-no-aprobada`), audits with `origen:'plantilla-prueba'` and `plantillaId` (`:129-135`). `RegistroEjecucion.plantillaId` is nullable. **An unsaved template cannot be tested today.** |
| Console screen C-03 | `src/consola/consola.ts:468-502` (markup, "read-only"), script `:4591-4760`. Table Nombre / Automatización / Formato / Tolera with «Ver»; side drawer with the CH-35 «Probar en el tenant activo» block (DEC-177). No primary action, no `titulo`/`descripcion`, no "in use". |
| Pop-up infrastructure | `crearDialogo` (`:1203-1232`), `avisarEnDialogo` (`:1241`), `#conexion-dialogo` (`:343-370`, "Guardar y probar", `campos` → «Revisá estos campos»). The query pop-up gates saving on a test of the same fingerprint (`huellaActual` `:3450`, `guardadoHabilitado` `:3455`) and has a parameter editor (`agregarFilaParametro` `:1520`, `declaracionActual` `:1585`) bound to the Consultas module globals. |
| Console guards | `consola.test.ts`: `IDS` (`:149`), `IDS_OCULTOS` (`:392`), select list (`:662`), G3' (`:615-628`: only three `zd-*` tokens allowed in the script text). Template tests at `:3889-4130`. |
| Design | `guidelines/consola.md:80-83` describes C-03 as read-only; one primary action per screen, in the header (`:42-60`); dialogs `.zd-dialog*` (`:183`). DEC-173: create/edit go in a pop-up, detail stays in the side panel. No precedent for «Duplicar y editar». |
| Guide | `docs/guia/05-plantillas.md` "Límites": "La consola no crea, edita ni borra plantillas". Becomes false. |
| Panel (CH-37) | `proyectarDisponibles` (`panel-automatizaciones.ts:205-238`) dedups by trimmed lower-cased `titulo`; among equal titles the lowest `id` wins, and an active template hides every template with its title. |

### Specs affected

- `automation-templates`: `PUT` rules (new refusal on a template in use), test route (if decision 3 adds one), `GET /plantillas/:id` shape (if it reports "in use").
- `console-*` spec for C-03 (read-only today).
- `client-panel-automations`: only if decision 4 changes how a copy is offered.

### Tests that pin it

- `plantillas-rutas.test.ts`: signature pin `:44-47`, the throwing `Proxy` for rejections `:61-83`, PUT 4.1 `:385-452`.
- `catalogo-inicial.test.ts:253` (L2) PUTs a seeded id and expects 200: breaks only if that test database has automations on it.
- `src/semillas/semilla-demo.ts:315` creates an active automation on `ID_STOCK_FISICO`: in the demo, the seeded template becomes "in use".
- `contexto-tenant.test.ts:257` (exemption list) and `src/app/rutas.test.ts` (route guard) if a route is added.
- `consola.test.ts`: `IDS`, `IDS_OCULTOS`, select list, G3', `:3889-4130`.

## Shape that fits

- **Backend.** `PUT /plantillas/:id` answers 409 `{error:'plantilla-en-uso'}` when the template is in use (decision 1), computed by a narrow cross-tenant count (decision 2). `GET /plantillas/:id` adds `enUso: boolean` so the console can choose between «Editar» and «Duplicar y editar».
- **Console.** C-03 gets the header primary action «Nueva plantilla». The drawer shows the client texts and, depending on `enUso`, «Editar» or «Duplicar y editar». One pop-up (DEC-173) serves create, edit and duplicate: name, SQL, parameter declaration, entities (checkboxes from the closed list), automation slug, format, tolerance, client title and description; then test against a connection of the active tenant and save.
- **Unchanged.** `componerSentencia`, the closed lists (DEC-63/65/67), the WHERE condition plus "no rows, no send" (DEC-64/84), no delete (DEC-68), no SQL-of-the-tenant mode.
- **Out of scope.** Message text fields (CH-39, loaded later on this same screen), retiring a template from the catalog, versions (DEC-182 (c) rejected).

## Decisions (chosen by the user on 2026-10-27: 1(b), 2(a), 3(a), 4(b), 5(b))

1. **What "in use" means.** (a) Any automation row, active or not: the FK is RESTRICT and rows are never deleted, so a template once used stays frozen for good. (b) Only active automations: a deactivated one never runs again (DEC-79 has no reactivation), so a template whose users were all deactivated can be edited in place; but its history then points to a template that says something else (the audit keeps the composed SQL, DEC-160). *Recommended: (a): it is the literal reading of DEC-182, does not depend on DEC-79 staying true, and the count is the FK.*
2. **How the route counts across tenants.** `PUT` and `GET /plantillas/:id` have no tenant context and `Automatizacion` is tenant-scoped. (a) Inject a single function `usosDePlantilla(id) → número` built in `rutas.ts` from the unscoped base client, returning only a count (no tenant data); the delegate-only signature pin becomes "delegate + this port". (b) Read `_count.automatizaciones` through the `plantilla` delegate: works today because nested relation reads are not scoped, but relies on a known limit of the isolation extension. *Recommended: (a): the cross-tenant read is explicit, testable and returns nothing but a number. It touches tenant isolation, so it is the architectural part of DEC-191.*
3. **Testing before saving.** The test route only knows saved templates. (a) New `POST /plantillas/prueba` that takes the full template body plus `{conexionId, valores}`, needs `X-Tenant-Id`, runs `rechazoDePlantilla` + the same gates, audits `origen:'plantilla-prueba'` with `plantillaId: null`; saving in the pop-up is enabled only after a passing test whose fingerprint (sql, parametros, entidades, connection) matches the current form, like the query pop-up. (b) Same route, but the test is optional: save is always enabled. (c) No new route: save first, then test with the existing route; a broken template exists in the catalog (and can be picked in «alta») until fixed, and fixing it is blocked as soon as anyone uses it. *Recommended: (a): it is what D4 asks ("prueba contra una conexión antes de guardar") and reuses an existing pattern. Changing only the texts or the tolerance does not reset the gate.*
4. **What «Duplicar y editar» copies.** The panel dedups by title and the lowest `id` wins. (a) Everything, with `nombre` suffixed «(copia)»: if the title stays the same, the client keeps seeing one card and for most tenants it still turns on the **original** (lower id is not guaranteed either way: ids are uuids). (b) Everything except `titulo`/`descripcion`, which start empty: the copy stays out of the panel until P1 writes its own title, which then must differ to be a separate card. (c) Everything, and the pop-up warns when the title equals another template's. *Recommended: (b): it makes the client-facing consequence explicit instead of leaving it to uuid order. Retiring the original from the panel is out of scope (no delete, DEC-68), as DEC-182 already resigned.*
5. **Delivery.** Rough size: in-use check + 409 + `enUso` ~60, test route ~80, console markup + script ~350 (parameter editor has to be made reusable, it is bound to the Consultas globals), tests ~300, docs/guide/design guideline ~40 → **~830 changed lines**. The session chose Single PR. (a) Two changes: CH-38a backend (in-use rule, `enUso`, test route, guide) ~330, then CH-38b console screen ~500 (still over; tests are most of it). (b) One PR with `size:exception`, as CH-37 did. (c) Three slices: CH-38a backend, CH-38b create/edit pop-up, CH-38c «Duplicar y editar» + drawer. *Recommended: (a): the backend half is independently reviewable and testable via API; CH-38b likely still needs `size:exception` because of the console guard tests.*

## Risks

- With 1(b), "in use" means at least one automation with `activo = true`; the rule depends on DEC-79 (no reactivation).
- With 5(b), one PR with `size:exception` (~830 lines), as CH-37.
- Cross-tenant read for the count (decision 2) is the first explicit unscoped read of `Automatizacion`; it must return a number only and be covered by an isolation test.
- Race: an automation created between the in-use check and the `UPDATE`. Doing the count and the update in one transaction narrows it; the residual window is accepted or closed with a row lock (design detail).
- The demo seed makes the seeded `stock-fisico` template "in use": the demo script must show «Duplicar y editar», not «Editar».
- Making the parameter editor reusable touches the Consultas pop-up (CH-32a/CH-25 behavior); its tests must stay green unchanged.
- G3' forbids new `zd-*` tokens in the script: new dynamic nodes need bridge classes or static markup.
- CH-37 (#211) and the v2 docs chain (#199–#210) are unmerged; CH-38 branches from `ch37/textos-cliente`.
