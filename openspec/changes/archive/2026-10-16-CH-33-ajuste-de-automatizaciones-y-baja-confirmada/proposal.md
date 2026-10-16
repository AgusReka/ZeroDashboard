# Proposal: CH-33 — Adjusting an automation from the console, and a typed confirmation for a tenant's baja

**Status**: ready for spec and design. Inputs: exploration.md (D1 and D2 resolved 2026-10-14), DEC-174 (with its CH-33 precision), DEC-175, DEC-79, DEC-82, DEC-138, DEC-14, DEC-15, DEC-173, the audit of 2026-10-13 (§3.4, §4.5, F3), the design guide (`lenguaje.md`: a destructive confirmation repeats action and object).

## Intent
- The operator corrects an automation without losing its id and its run history, as the client already can from the panel (audit §4.5).
- Deactivating a tenant, which cannot be undone, requires typing its name, and the API refuses it without the name (audit §3.4).

## Scope

### In Scope
- **`PUT /automatizaciones/:id/ajustes`** (scoped by `X-Tenant-Id`). Body: any non-empty subset of `valores`, `cron`, `destinatario`; `destinatario: null` clears it (D2 a). Validation with the alta's functions (D1 a): `cronValido`, `destinatarioDe` + `direccionValida`, and `prepararSentencia` over the sent `valores` against the stored template. `valores` replaces the stored map as a whole (the form always sends every declared parameter), so a key the template no longer declares cannot linger. `plantillaId`, `conexionId`, `activo` and `tenantId` are refused by the schema. Unknown or foreign id `404 automatizacion-no-encontrada`; deactivated `409 automatizacion-desactivada`. Response: `AutomatizacionCompleta`, `proximaEjecucion`, `zonaHoraria`.
- **Console «Ajustar»** on each active automation: a pop-up (DEC-173) prefilled from `GET /automatizaciones/:id`, with template and connection as read-only text, one field per declared parameter, frequency / hour / cron, and recipient. «Guardar ajustes» sends only what changed. Copy that says the automation or its recipient cannot be edited is rewritten.
- **`POST /tenants/:id/baja` requires `{ nombre }`.** Schema refusal when absent or with extra keys (`400 solicitud-invalida`); `404` and `409 tenant-desactivado` as today, checked first; a name that is not exactly the stored one answers `409 confirmacion-no-coincide` and writes nothing.
- **Console baja pop-up** replacing the inline confirmation: names the tenant, says it cannot be undone, one text field; «Dar de baja {nombre}» stays disabled until the field equals the name exactly. «Cancelar» and Escape close without sending.
- Every caller of the baja updated: tests, console, `scripts/smoke.sh`. The adjust route joins the isolation sweep.
- `docs/02-mapa-de-changes.md` gains the CH-33 row.

### Out of Scope
- Changing an automation's template or connection, reactivating it, deleting it.
- The client panel's adjust route and form (unchanged).
- Template → saved query (audit §3.2) and the CH-30e screens: still open in F3.
- Focus trap, focus return and backdrop click (not in DEC-173).
- The audit's visual pass at 360/1280 px (standing user preference: not added).

## Capabilities

### Modified Capabilities
- `automation-scheduling`: Automation Lifecycle Is Create, List, Get, Deactivate — No Edit or Delete (DEC-78, DEC-79) becomes Create, List, Get, Adjust, Deactivate.
- `tenant-management`: Logical Deactivation Fully Freezes a Tenant (DEC-14) requires the typed name.
- `query-console`: Console Displays Automations and Supports Creating One (DEC-78), Console Supports Deactivating an Automation (DEC-79) (adds «Ajustar»), Tenants Screen (baja pop-up), Create and Edit Forms Open in a Pop-up (DEC-173) (adds the adjust pop-up and the baja confirmation).

## Approach
Back end: the route lives in `src/automatizaciones-rutas.ts` next to the alta and reuses its pure checks; a pure `resolverAjusteOperador` (body + stored row + template → columns to write or field errors) keeps the rules unit-testable without a database, as `resolverAjustes` does for the panel. The baja gains a strict body schema like every other route here (`propertyNames` + `additionalProperties: false`). Front end: the same pop-up factory (`crearDialogo`), markup ids guarded in `IDS`, API text written with `textContent`, no `zd-*` class from the script (G3'); the parameter inputs reuse the wizard's builder.

## Affected Areas
- `src/automatizaciones-rutas.ts`, `src/automatizaciones-rutas.test.ts`, `src/aislamiento.test.ts`
- `src/tenants.ts`, `src/tenants.test.ts`, `src/contexto-tenant.test.ts`, `scripts/smoke.sh`
- `src/consola.ts`, `src/consola.test.ts`
- `openspec/specs/{automation-scheduling,tenant-management,query-console}/spec.md` (at archive), `docs/02-mapa-de-changes.md`

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| The baja contract change breaks a caller nobody listed | Low | All callers found by search (exploration); `smoke.sh` included |
| An unlisted body key is stripped by `removeAdditional` instead of refused | Medium | `propertyNames` on both schemas, with a test per refused key |
| Over the 400-line budget | High | Decided at the tasks gate (single-PR strategy: split or `size:exception`) |
| The template's declaration changed since the alta (DEC-68), so the stored `valores` no longer fit | Low | The form is built from the current declaration and sends the whole map; `prepararSentencia` names any field that still fails |
