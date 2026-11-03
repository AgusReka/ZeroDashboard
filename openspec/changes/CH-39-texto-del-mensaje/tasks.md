# Tasks: CH-39 — Message text: header and per-row line

Inputs: proposal.md, specs/automation-templates/spec.md, specs/email-notification/spec.md, specs/execution-log/spec.md, specs/initial-template-catalog/spec.md, specs/query-console/spec.md, design.md.

Delivery: single-pr per slice, two stacked PRs (exploration decision 6(b)).
- **CH-39a** (sections 1–5): branch `ch39a/texto-mensaje` from `ch38/pantalla-plantillas` (PR #214, open).
- **CH-39b** (section 6): branch `ch39b/texto-mensaje-consola` from CH-39a.

DEC-192 goes on `v2/dec-192` from `v2/dec-191` (PR #213).

## 1. Model (CH-39a)
- [x] 1.1 `prisma/schema.prisma`:
  - `Plantilla.encabezadoMensaje String?` and `Plantilla.lineaMensaje String?`, with doc comment.
  - `Ejecucion.mensajeRespaldo Json?`, with a comment saying it holds names only.
  - Migration `20261028000000_mensaje_plantilla` with the rollback in its header (design §1).
- [x] 1.2 `src/plantillas/plantillas.ts`: both texts in `PlantillaCompleta`; `PlantillaResumen` unchanged.
- [x] 1.3 `src/plantillas/catalogo-inicial.ts`: both entries declare `encabezadoMensaje: null` and `lineaMensaje: null`, with type checks in `rechazoDeEntrada`. Update `catalogo-inicial.test.ts` U1/U2.

## 2. Placeholder module (CH-39a)
- [x] 2.1 `src/plantillas/marcadores-mensaje.ts`: `marcadoresDe`, `textoSinMarcadores`, `faltantesEn`, `sustituir` (design §2), pure and with no imports.
- [x] 2.2 `src/plantillas/marcadores-mensaje.test.ts`:
  - Order and dedup.
  - `{}`, `{{a}}`, `{a` and `a}` behave as specified.
  - Case-sensitive names, and names with spaces kept.
  - `sustituir` applies `literal` and `valorDe` separately.

## 3. Template routes and test route (CH-39a)
- [x] 3.1 `src/plantillas/plantillas-rutas.ts`:
  - Schema keys `encabezadoMensaje`, `lineaMensaje`, `columnasPrueba` (`maxItems` 200).
  - `rechazoDeMensaje` with steps 1–6 in spec order, called after `rechazoDeTextos`.
  - The `exigirColumnas` option of `rechazoDePlantilla`.
  - `marcadores` in the 400 body.
  - `datosDePlantilla` maps the texts and never `columnasPrueba` (design §3).
- [x] 3.2 `src/plantillas/plantilla-prueba.ts`: `{exigirColumnas: false}` on `POST /plantillas/prueba`; the key-count comment (design §4).
- [x] 3.3 `src/plantillas/plantillas-rutas.test.ts`:
  - Every scenario of "Optional Message Texts…".
  - DB: `columnasPrueba` is not stored or echoed, a `PUT` without the texts clears them, and `GET /:id` carries both.
  - The CH-37 client-text refusals still win when both fail.
- [x] 3.4 `src/plantillas/plantilla-prueba.test.ts`:
  - Texts without `columnasPrueba` give `200` with `columnas`.
  - An unpaired text gives `400` and the connection is never dialed.
  - Update the `PLANTILLA_VALIDA` fixture if needed.

## 4. Renderer, scheduler and listing (CH-39a)
- [x] 4.1 `src/automatizaciones/correo.ts`:
  - Optional `mensaje` in `EntradaCorreo`.
  - The line body for HTML and text via `sustituir`.
  - Exported `respaldoDe`.
  - Return type unchanged (design §5.1).
- [x] 4.2 `src/automatizaciones/correo.test.ts`, the email-notification scenarios:
  - Lines per row.
  - Null value.
  - Escape once (`A<B & C`).
  - CR/LF in a value.
  - Truncation notice with lines.
  - Identical output without texts.
  - Fallback with `respaldoDe` equal to `["stock"]`.
  - A duplicated column name takes the first column.
- [x] 4.3 `src/automatizaciones/planificador.ts`:
  - Both texts in `PlantillaACorrer` and the select.
  - `notificar` returns `{salida, respaldo}`.
  - `correr` writes `mensajeRespaldo` in the close update only when it is set (design §5.2).
- [x] 4.4 `src/automatizaciones/planificador.test.ts` (DB): a fallback run gives `enviada` plus `["stock"]`; a text run gives null; a send failure after a fallback gives `fallo-envio` plus the names.
- [x] 4.5 `src/automatizaciones/automatizaciones-rutas.ts`:
  - `mensajeRespaldo` in `EjecucionListada` and its select.
  - A non-array value reads as null.
  - A listing test in `automatizaciones-rutas.test.ts`.

## 5. Docs (CH-39a)
- [x] 5.1 `docs/guia/05-plantillas.md`: the message texts, the placeholder rule, the static header, `columnasPrueba`, the fallback and `mensajeRespaldo`, with a `stock-fisico` example (design §8).

## 6. Console (CH-39b)
- [ ] 6.1 `src/consola/consola.ts`, markup:
  - `#plantilla-f-encabezado` (`maxlength` 200) and `#plantilla-f-linea` (`maxlength` 300), with labels and the hint.
  - `#plantilla-mensaje` in the drawer.
  - `zd-*` classes only in static markup (design §6).
- [ ] 6.2 `src/consola/consola.ts`, script:
  - `ultimaPruebaPlantilla.columnas`.
  - `cuerpoPlantilla` with the texts, and `columnasPrueba` on save only.
  - The dirty snapshot.
  - Fill in every mode, so duplicate keeps the texts.
  - The labels, and the `marcadores` message.
  - `textoMensajeDe` for the drawer.
  - The `mensajeRespaldo` line in `verEjecuciones`, with no backtick in the copy.
- [ ] 6.3 `src/consola/consola.test.ts`:
  - New ids in `IDS`; G3' unchanged.
  - The `maxlength` regexes.
  - Exact save and test bodies.
  - Editing the line keeps «Guardar» enabled.
  - The `400 marcadores` message.
  - Duplicate keeps the message texts.
  - The drawer without texts.
  - The runs view with and without `mensajeRespaldo`.
- [ ] 6.4 `guidelines/consola.md` C-03 entry in `.claude/skills/zerodashboard-design/` and `.agents/skills/zerodashboard-design/`: the two fields and the hint.

## Verification
- `npx tsc --noEmit`
- `npx prisma validate`
- CH-39a: `npx tsx --test src/plantillas/marcadores-mensaje.test.ts src/automatizaciones/correo.test.ts src/plantillas/catalogo-inicial.test.ts src/automatizaciones/notificador-mailpit.test.ts`
- CH-39b: `npx tsx --test src/consola/consola.test.ts`
- `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db`. Known environmental failures: the 4 false positives in `conexiones.test.ts` (the response contains `"motor":"postgres"` with the `postgres` password).

## Review Workload Forecast
- Estimated changed lines: CH-39a ~460 (code ~230, tests ~200, docs ~30); CH-39b ~235 (code ~90, tests ~130, docs ~15).
- 400-line budget risk: High for CH-39a (about 60 over), Low for CH-39b.
- Chained PRs recommended: Yes (already two stacked PRs).
- Decision needed before apply: No. The user chose `size:exception` for CH-39a on 2026-10-27 (option (a), against a third slice CH-39a2). CH-39b stays within budget.
