# Proposal: CH-56 — Template and report editor as a sectioned page

**Status**: approved by the user on 2026-11-11, with two conditions:
- implement it in two parts, first Plantillas (**CH-56a**) and then Reportes (**CH-56b**);
- keep both consistent, reusing the shared components.

**Decision.** Moving the editors to a page contradicted DEC-173. The user chose to amend it, in **DEC-208**.

**Inputs:**
- `exploration.md` and EXPLORE 2026-11-11;
- `guidelines/admin.md` F1–F8, K3–K5, N4, P5 and §13;
- DEC-173, DEC-182, DEC-191, DEC-183, DEC-198 and DEC-208.

**Priority: medium, the last of the series.** Depends on CH-53, for the sub-route mechanism and the workbench pieces.

**Correction after the spec phase.** Several items of the original proposal already exist (spec "Template Pop-Up…" and "Report Pop-Up…"):
- the save gate with its reason line, including «changed since the last test» (F4);
- the line saying a template copy starts without client texts (K4, flagged);
- `enUso` in `GET /plantillas/:id` and `GET /reportes/:id`;
- the in-use refusal with «Duplicar y editar».

This change keeps all of them and changes only the container and the layout.

## Intent
Templates and reports are written in long pop-ups: SQL, parameters, client texts, the message or the visualization, and a test, all in one modal. There, errors fall out of sight. This change turns both editors into subviews of their screens, with numbered sections in the order the task is thought through, and a sticky footer that keeps the save gate visible. Both editors share one skeleton (K3).

## Scope

Item tags:
- **[visual]**: presentation only.
- **[navegación]**: order, titles and routes.
- **[comportamiento front]**: new client-side behaviour.
- **[backend]**: none.

### In Scope

**1. P5 / DEC-208 · From pop-up to subview.** [navegación]
- **Addresses:**
  - Plantillas: `#plantillas/nueva`, `#plantillas/{id}` and `#plantillas/{id}/duplicar`;
  - Reportes: `#reportes/nuevo`, `#reportes/{id}` and `#reportes/{id}/duplicar`.
- **Breadcrumbs:** «Plantillas › {nombre}», «Plantillas › Nueva plantilla», «Plantillas › Copia de {nombre}», and the same for Reportes.
- **Ids:** the pop-ups' nodes move into the subview, and their ids are not renamed.
- **Leaving with unsaved changes:** the same guard as CH-53.
- **After a successful save:** back to the list, with the side panel showing the saved record, as today.

**2. F1 · Numbered sections (K3).** [visual]

| # | Plantillas (56a) | Reportes (56b) |
|---|---|---|
| 1 Qué es | name, automation tag, format, freshness tolerance, client title and description | name, client title and description |
| 2 Datos | entities, SQL, parameter declaration | entities, SQL, period |
| 3 Salida | message header and line per row | visualization and columns by role |
| 4 Prueba | connection, parameter values, «Probar», result | connection, period days, «Probar», result |

- Each section has a title and a one-line purpose (M1). For example: «Una plantilla es una automatización reutilizable: una consulta sobre las vistas canónicas, parámetros que completa cada automatización y el mensaje que se envía.»
- There are no tabs.

**3. F4 / F7 · Sticky footer.** [visual]
- **Contents:** «Cancelar», the reason line and «Guardar plantilla» / «Guardar reporte», fixed at the bottom of the subview.
- **Before a passing test:** «Probar» (section 4) is the primary action. The footer's «Guardar» is disabled, with the existing reason.
- **After a passing test:** «Guardar» is primary, and the reason line reads «Última prueba: OK · {hora} · {n} filas».
- **Invalidation:** the existing rule decides it. The line only reports it.

**4. F5 / K5 · Restrictions said up front.** [visual]
- **Template copy:** the existing line «the copy will not appear in the client panel until it has its own title and description» moves to a neutral banner at the top, with the original's name and «la original tiene automatizaciones activas».
- **Report copy:** the same banner says «la original está en un tablero de cliente».
- **When the copy was opened:** the banner shows only when the copy was opened from an in-use original (`enUso: true`).

**5. N4 · Header line.** [visual]
- «Prueba sobre: {tenant}», from CH-50.
- Without a tenant, the existing rule applies: the test block says to choose one, and «Guardar» stays disabled.

### Out of Scope
- Unifying the duplicate behaviour (K4): templates clear the client texts and reports keep them. It is an open product question, flagged and not changed.
- Changing in-use rules (DEC-191), the test gate, the fingerprint or any endpoint.
- Card descriptions for templates other than the two existing ones (DEC-128).
- The side panels («Ver»), which stay as they are.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `query-console`:
  - the pop-up rule gains the template and report editors in DEC-208's exception;
  - the template editor and its message texts, and the report editor, are rewritten as sectioned subviews with the same fields, gate and answers.

`automation-templates` and `report-catalog` specify the API and need no delta.

## Approach
- Reuse CH-53's sub-route parser, leave guard and status-line pieces.
- One server-rendered section skeleton per editor and one footer pattern, shared by both.
- 56a moves Plantillas. 56b moves Reportes onto the same skeleton.

## Rules Check
- **Rule 1.** Templates and reports are still written only in the console.
- **Rule 4.** Parameters go through the driver, unchanged.
- **Rule 6.** No new engine capacity.
- **Rules 2, 3, 5 and 7.** Untouched.

## Rollback
Front-end only. Each slice reverts on its own, restoring its pop-up. DEC-208 is then marked superseded for that editor.

## Affected Areas
- `src/consola/consola.ts`:
  - Plantillas: markup L691–830 and script L5784–6450;
  - Reportes: markup L832–970 and script L6451–7170;
  - `mostrarPantalla` sub-routes.
- `src/consola/consola.test.ts`: the template and report cases (CH-38, CH-39, CH-45, CH-46).
- `openspec/specs/query-console`.

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Largest test surface of the series | Certain | Keep ids; only open and close steps change |
| Size | Certain | Two slices, as the user asked: 56a ~400, 56b ~380 |
| The sticky footer covers content at small heights | Low | The subview gets bottom padding equal to the footer's height |

## Success Criteria
- [ ] Creating, editing or duplicating a template or report navigates to a subview with a breadcrumb, with no pop-up.
- [ ] Both editors show the same four numbered sections, and only section 3 differs.
- [ ] The footer stays visible and states why «Guardar» is disabled, or when the last test passed.
- [ ] A copy of an in-use original shows the restriction banner at the top.
- [ ] Every existing field, gate, answer and request stays the same.
- [ ] `npm test`, the typecheck and the smoke script pass after each slice.
