# Exploration — CH-57 Threshold and minimum rows, told apart

## Problem (from `docs/02-mapa-de-changes.md`, candidate noted 2026-11-03)
In the console's automation create form and adjustment, the threshold (`umbral`) and the minimum rows (DEC-186) get confused: the parameter showed its raw name with no explanation.

## Current state
Most of the candidate is already solved by the UX review (commit `ac2a52a`, screen C-13). Verified in code:

- **Built-in templates are labeled.** `PARAMETROS_PLANTILLA` (`src/consola/consola.ts:3664`) maps `stock-fisico.umbral` to «Stock mínimo por producto» and `stock-producible.umbral` to «Unidades armables mínimas por producto». Each has help text that points to «Mínimo de filas para avisar». The alta form and the adjust pop-up both use it, through `construirValores` and `llenarAjuste`.
- **The minimum has a full help text in the alta markup** (`consola.ts:1529`): «… Es cuántos productos tienen que cumplir la condición, no el valor de la condición: con 3, solo avisa cuando hay 3 o más productos.»

Gaps that remain:
1. **A channel change drops the explanation.** `aplicarCanalAlta` (`consola.ts:3452`) overwrites `auto-minimo-ayuda` with `AYUDA_MINIMO_CORREO` or `AYUDA_MINIMO_TELEGRAM` (`:3438-3439`). Those keep only the first sentence. The markup text and the constants disagree, and after any channel change the contrast with the threshold is gone.
2. **The adjust pop-up's minimum has no help.** `aj-minimo` (`consola.ts:1601-1602`) has no help element.
3. **Templates written from the console show the raw name.** Any template outside the map falls back to `{ etiqueta: nombre, ayuda: '' }`. The video script includes «Plantilla nueva escrita desde la consola», so its parameter would read `umbral` in the alta form.
4. **Spec drift.** In `query-console`, «Per-Parameter Input Rendering» still says the input is "labeled with its `nombre`". No requirement covers the C-13 labels or the minimum's help.

Related facts:
- **Declaration:** a parameter declaration is exactly `{nombre, tipo}` (`src/ejecucion/parametros.ts:239-243`), stored in the JSON column `Plantilla.parametros`. The AJV schema in `plantillas-rutas.ts:61-90` uses `additionalProperties: false`, and the write keeps only those two keys (`:271`).
- **Panel:** it finds the threshold by `nombre === 'umbral' && tipo === 'numero'` (`panel-ajustes.ts:87-90`) and hard-codes «Cantidad mínima» with its help (`panel.ts:554`).
- **Other parameter names:** templates may declare any number of parameters with any name, so a fixed text for `umbral` alone does not cover them.

## Options

| | (a) Optional `descripcion` in the declaration | (b) Front-only |
|---|---|---|
| What | `{nombre, tipo, etiqueta?, ayuda?}` written in the CH-56 editor; the alta and adjust forms use it, and the built-in map stays as the fallback for the seeds (or the seeds carry the texts) | Fix gaps 1, 2 and 4: one help text for the minimum on both forms and both channels; the raw name stays for console-written templates |
| Touches | AJV schema, `DeclaracionParametro`, `validarDeclaracion`, write projection, editor rows, alta and adjust forms, seeds, `query-parameters` and `automation-templates` specs, plus a DEC (it extends the DEC-48/55 declaration shape) | `consola.ts` (markup, two constants, `aplicarCanalAlta`, adjust markup), `consola.test.ts`, `query-console` delta |
| No migration | Yes: JSON column, optional keys | — |
| Fixes gap 3 | Yes | No |
| Size | ~250–350 lines with tests; fits one PR | ~60–100 lines |
| Risk | Medium: API shape change, and the duplicate rules (DEC-191) must say whether a copy keeps these texts | Low |

## Recommendation
(a). It is the only option that fixes gap 3, and gap 3 is on the video path, where a template is written live and then used in the alta form. It also includes everything in (b). The 400-line budget holds.

## Open product questions
1. (a) or (b).
2. If (a): does «Duplicar y editar» keep the parameter texts? These are operator-facing, unlike the client texts that DEC-191 clears, so keeping them looks right.
3. If (a): does the panel keep its hard-coded «Cantidad mínima»? Recommended: yes. The parameter texts are for P1 only, and the panel stays out of scope.
