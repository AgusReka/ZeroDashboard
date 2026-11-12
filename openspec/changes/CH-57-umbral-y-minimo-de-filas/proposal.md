# Proposal: CH-57 — Threshold and minimum rows, told apart

Inputs: exploration.md, DEC-209 (registered before this proposal), user answers of 2026-11-12: option (a), a copy keeps the parameter texts, the panel does not change.

## Intent
In the automation create form and the adjust pop-up, an operator must be able to tell the template's parameter (the value of the condition, e.g. the threshold) from «Mínimo de filas para avisar» (how many rows must meet it). Built-in templates already get a label from a fixed map (C-13). A template written from the console still shows its raw parameter name, and the minimum's help loses its explanation after a channel change.

## Scope

### In Scope
1. **Declaration texts (templates only).** Each entry of a template's `parametros` accepts an optional `etiqueta` (≤ 60 chars) and `ayuda` (≤ 240 chars), trimmed; blank means absent; too long answers `400` naming the field. Stored in the existing JSON column; no migration.
2. **API.** `POST /plantillas`, `PUT /plantillas/:id` and `POST /plantillas/prueba` accept the two keys. Writes keep them, and `GET /plantillas/:id` returns them. The shared `DeclaracionParametro` and `validarDeclaracion` do not change.
3. **Editor.** Each parameter row of the template editor (CH-56, section 2 «Datos») gets «Rótulo para el operador» and «Ayuda» inputs. They count as unsaved changes, but they are not part of the test fingerprint. The query editor does not get them.
4. **Alta and adjust labels.** Label and help come from the declaration's own text first, then from the fixed console map (`PARAMETROS_PLANTILLA`), then from the parameter name.
5. **Duplicate.** «Duplicar y editar» keeps the parameter texts.
6. **Minimum's help.** The alta form and the adjust pop-up show the full help for both channels, including the sentence that tells it apart from the condition's value. The adjust pop-up gets the help element it lacks (`aj-minimo-ayuda`).

### Out of Scope
- The client panel: «Cantidad mínima» and its help stay hard-coded (P-06, DEC-205).
- Saved queries and reports: their declarations keep `{nombre, tipo}`.
- Writing the texts into already-seeded rows (DEC-125). The fixed map keeps covering them.
- Editing the texts of a template in use without duplicating it (DEC-191).

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `automation-templates`: the parameter entries accept optional operator texts.
- `query-console`: the template editor rows, the parameter labels in the alta and adjust forms, and the minimum's help.

## Approach
- **Server.** Widen the template route's AJV item schema to `{nombre, tipo, etiqueta?, ayuda?}` with `maxLength`. Normalize in `datosDePlantilla`: trim, and drop a blank text. The shared validation keeps checking `nombre` and `tipo`.
- **Console.** `crearEditorParametros` gets a `conTextos` option, used only by the template editor. Its `declaracion()` keeps returning `{nombre, tipo}`, so the fingerprint does not change. A new `declaracionConTextos()` feeds the save body and the unsaved-changes snapshot. `descripcionDeParametro` reads the declaration first. The minimum's help constants carry the full text, and `aplicarCanalAjuste` sets `aj-minimo-ayuda`.

## Rules Check
- **Rule 2 (isolation):** templates are a global catalog, and no tenant data is involved.
- **Rule 6 (engine):** no change to composition or execution. The texts never reach SQL.
- **Architecture decision registered first:** DEC-209.

## Rollback
Revert the PR. Rows saved with texts keep two extra JSON keys, and the old code ignores them on read. Its write path drops them on the next `PUT`.

## Affected Areas
- `src/plantillas/plantillas-rutas.ts` (schema, body type, `datosDePlantilla`) and `plantillas-rutas.test.ts`.
- `src/consola/consola.ts` (editor rows, `descripcionDeParametro`, body and snapshot, duplicate, the minimum's help, adjust markup) and `consola.test.ts` (`IDS`, labels, help).
- `openspec/changes/CH-57-…/specs/` deltas.

## Risks
- **Duplicate test helpers.** `IDS` registration and the fake DOM in `consola.test.ts` must know the new ids and classes. Mitigation: per-row inputs use classes, not ids, and the guard G3' forbids `zd-*` classes inside the script.
- **The `removeAdditional` trap.** Under Fastify's `removeAdditional`, a key missing from the schema is stripped silently. Mitigation: list both keys in `properties` and test the round trip.

## Success Criteria
- A template created from the console with `umbral` labeled «Stock mínimo» shows that label and its help in the alta form and in the adjust pop-up.
- Changing only a label keeps the last passing test valid. Changing `nombre` or `tipo` does not.
- After switching the alta channel to Telegram and back, the minimum's help still explains that it is not the value of the condition.
- `npm run test:db`, `tsc` and the smoke are green.
