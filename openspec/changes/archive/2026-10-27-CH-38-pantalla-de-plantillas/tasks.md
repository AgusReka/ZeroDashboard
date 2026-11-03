# Tasks: CH-38 — Templates screen in the console

Inputs: proposal.md, specs/automation-templates/spec.md, specs/tenant-isolation/spec.md, specs/execution-audit/spec.md, specs/query-console/spec.md, design.md. Delivery: single-pr with `size:exception` (chosen by the user, exploration decision 5(b)). Code branch `ch38/pantalla-plantillas` from `ch37/textos-cliente` (CH-37, PR #211); DEC-191 is in PR #213.

## 1. Isolation extension
- [x] 1.1 `src/aislamiento/aislamiento-prisma.ts`:
  - `automatizacion.plantillaEnUso` and `automatizacion.reemplazarPlantillaLibre` on the closed-over raw client (design §1).
  - The `FOR UPDATE` lock goes through a tagged `$queryRaw`.
  - The CH-38 paragraph in the file header.
  - If importing `PlantillaCompleta` makes a cycle, move the select to `src/plantillas/plantillas.ts`.
- [x] 1.2 Isolation tests, two tenants:
  - The use read answers `true`/`false` with no context and only a boolean.
  - `automatizacion.count` and `findMany` with no context still throw.
  - `reemplazarPlantillaLibre` returns `'no-encontrada'`, `'en-uso'` (active in B) or the row (only deactivated rows).
- [x] 1.3 Race test (DB): an open transaction inserts an automation on T; a concurrent `reemplazarPlantillaLibre(T)` waits on the lock and answers `'en-uso'` after the commit. Timeboxed so it fails instead of hanging.

## 2. Template routes
- [x] 2.1 `src/plantillas/plantillas-rutas.ts`:
  - `UsoDePlantillas` and the new signature.
  - `enUso` in the `GET /:id`, `POST` and `PUT` bodies.
  - `PUT`: `rechazoDePlantilla` first, then `reemplazarSiLibre`, mapped to `404`/`409 plantilla-en-uso`/`200`.
  - Remove `esPlantillaInexistente` if it becomes unused (design §2).
- [x] 2.2 `src/app/rutas.ts`: build the port from the two extension methods and extend the comment (design §2.1).
- [x] 2.3 `src/plantillas/plantillas-rutas.test.ts`:
  - Signature pin `(app, delegate, uso)`.
  - Unit suite with a fake port: the three `PUT` outcomes; a `400` never calls the port; `GET` carries `enUso`.
  - DB cases: active automation in B → `409` without header and row unchanged; only deactivated → `200`; `GET` has `enUso` and no count or ids.
  - Update `catalogo-inicial.test.ts:228` to the new signature.

## 3. Unsaved-template test
- [x] 3.1 `src/plantillas/plantilla-prueba.ts`:
  - `plantilla.id: string | null` in `ejecutarPrueba` and the audit call.
  - Extract `probarContraConexion` (ownership, views, `evaluarVistas`, `ejecutarPrueba`).
  - New `POST /plantillas/prueba` with `pruebaSinGuardarSchema`, `conexionId`/`valores` errors mapped before `rechazoDePlantilla`, first page only (design §3).
- [x] 3.2 `src/plantillas/plantilla-prueba.test.ts`: `POST /plantillas/prueba` → `400` invalid template (nothing executes), `400 tenant-no-indicado`, `404` another tenant's connection, `409` unapproved views, `200` with rows, no `Plantilla` row written. The existing `/:id/prueba` cases pass unedited.
- [x] 3.3 `src/auditoria/auditoria-registro.test.ts`: a `POST /plantillas/prueba` row with `origen` "plantilla-prueba", the composed SQL and `plantillaId` null.

## 4. Console
- [x] 4.1 `src/consola/consola.ts`, markup:
  - `#plantilla-nueva` in the C-03 header.
  - Drawer: `#plantilla-textos`, `#plantilla-editar`, `#plantilla-duplicar`, `#plantilla-en-uso-aviso`.
  - The `#plantilla-dialogo` pop-up with every id of design §4.1, `zd-*` only in markup, bridge classes for script-built nodes.
- [x] 4.2 `src/consola/consola.ts`, script refactors with no behavior change:
  - `crearEditorParametros` factory, with the Consultas callers moved to `editorConsulta`.
  - `mostrarResultadoPrueba(nodo, respuesta)` extracted from `probarPlantilla` (design §4.2, §4.3).
  - Run the Consultas and side-panel tests before going on: they must pass unedited.
- [x] 4.3 `src/consola/consola.ts`, the pop-up:
  - Literals `ENTIDADES_PLANTILLA`, the automation tags and formats.
  - `abrirDialogoPlantilla` with the three modes.
  - `huellaPlantilla`, `guardadoPlantillaHabilitado` and `motivoGuardadoPlantilla`.
  - «Probar» against `/plantillas/prueba` with a generation counter.
  - «Guardar» with the double-submit guard and the `201`/`200`/`400`/`409` handling.
  - Drawer toggles by `enUso` (design §4.3).
- [x] 4.4 `src/consola/consola.test.ts`:
  - New ids in `IDS`/`IDS_OCULTOS`/the select list; G3' unchanged.
  - The pin of the three literal lists against `ENTIDADES_CANONICAS`, `VALORES_AUTOMATIZACION` and `FORMATOS`.
  - The pop-up and drawer scenarios of `specs/query-console/spec.md`.

## 5. Docs
- [x] 5.1 `docs/guia/05-plantillas.md`: the screen, the in-use rule and `409`, `enUso`, `POST /plantillas/prueba`, removal of the "Límites" line, and the demo note (design §6).
- [x] 5.2 `guidelines/consola.md`, C-03 entry, in `.claude/skills/zerodashboard-design/` and `.agents/skills/zerodashboard-design/`: no longer read-only; the header action, drawer actions and pop-up.

## Verification
- `npx tsc --noEmit`
- `npx tsx --test src/plantillas/plantillas-rutas.test.ts src/plantillas/plantilla-prueba.test.ts src/plantillas/catalogo-inicial.test.ts src/consola/consola.test.ts src/app/rutas.test.ts`
- `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db`. Known environmental failures: the 4 false positives in `conexiones.test.ts` (the response contains `"motor":"postgres"` with the `postgres` password).

## Review Workload Forecast
- Estimated changed lines: ~900 (code ~430, tests ~330, docs ~40, refactors ~100)
- 400-line budget risk: High
- Chained PRs recommended: No (the user chose one PR)
- Decision needed before apply: No. `size:exception` was accepted up front in the exploration (decision 5(b)).
