# Tasks: CH-57 — Threshold and minimum rows, told apart

Inputs: proposal.md, specs/automation-templates/spec.md, specs/query-console/spec.md, design.md, DEC-209.

**Delivery.** single-pr (session preflight, 2026-11-12). DEC-209 was registered before any code.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~330: route ~45, route tests ~90, console ~75, console tests ~120 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | — |
| Delivery strategy | single-pr |
| Chain strategy | — |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: —
400-line budget risk: Low

## 1. Route
- [x] 1.1 Item schema: add `etiqueta: {}` and `ayuda: {}` to the template `parametros` items. Widen `RegistroPlantillaBody.parametros`.
- [x] 1.2 `LARGO_MAXIMO_TEXTO_PARAMETRO` and `rechazoDeTextosDeParametros`: refuse a non-string text, or one over 60/240 after trimming, naming `/parametros/{i}/etiqueta|ayuda`, inside the existing `solicitud-invalida` answer.
- [x] 1.3 `datosDePlantilla`: keep trimmed non-blank texts and drop blank ones.
- [x] 1.4 Tests in `plantillas-rutas.test.ts`:
  - create and read round trip;
  - a blank text is absent;
  - 61/241 characters refused with the field;
  - a non-string text refused;
  - an unknown key refused;
  - `PUT` keeps the texts;
  - `POST /plantillas/prueba` accepts them.

## 2. Console
- [x] 2.1 `crearEditorParametros(…, conTextos)`: two optional inputs per row, labeled «Rótulo para el operador» and «Ayuda», with maxlength 60/240; `declaracionConTextos()`. Only `editorPlantilla` uses it.
- [x] 2.2 `cuerpoPlantilla` and `instantaneaDeFormularioPlantilla` use `declaracionConTextos()`. `huellaPlantilla` is unchanged.
- [x] 2.3 `llenarFormularioPlantilla` fills the texts in every mode, the copy included.
- [x] 2.4 `descripcionDeParametro`: declaration first, then the fixed map, then the name.
- [x] 2.5 Minimum's help:
  - full texts in `AYUDA_MINIMO_CORREO` and `AYUDA_MINIMO_TELEGRAM`, with the markup equal to the email one;
  - add `aj-minimo-ayuda` and `aria-describedby`;
  - `aplicarCanalAjuste` sets it.
- [x] 2.6 Tests in `consola.test.ts`:
  - `IDS` includes `aj-minimo-ayuda`;
  - the editor rows have the two inputs and the query editor's rows do not;
  - a text-only change keeps «Guardar plantilla» enabled and marks unsaved changes;
  - the save body carries the texts;
  - the copy keeps the texts;
  - label precedence (declaration, then map, then name);
  - the minimum's help keeps «no el valor de la condición» after Telegram and back;
  - the adjust help on Telegram.

  Update the existing channel-help assertions (`:2117`, `:2123`) to the full texts.

## Verify
- [x] v.1 `npx tsx --test src/consola/consola.test.ts`, `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db`, `npx tsc -p tsconfig.json --noEmit` and `scripts/smoke.sh` pass.
- [x] v.2 Every spec scenario of both deltas maps to a test.
- [x] v.3 `guidelines/admin.md` and `guidelines/lenguaje.md`: labels and help in voseo, with feedback next to the control and no new `zd-*` classes in the script.
