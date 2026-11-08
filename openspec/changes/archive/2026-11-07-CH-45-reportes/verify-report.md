```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:67d9d6556edef015eb71a3a976ee9d4d7f94e40111fde4b62bf20cb15f2810a7
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 17/17
scenarios: 63/64
test_command: TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db
test_exit_code: 1
test_output_hash: sha256:8fa089a1d105216618fca4a4e121b58f62ed8b7186a1db56bab19f38bc715e54
build_command: npm run build
build_exit_code: 0
build_output_hash: sha256:cf1f47dca7e9410721bb54c90a6b42478a7d021d69f0287a29c38a6706ae6bdd
```

# Verify report: CH-45 — Reports: model, global catalog and console screen

**Verdict: PASS WITH WARNINGS** (0 CRITICAL, 2 WARNING, 4 SUGGESTION). Verified 2026-11-07 on branch `ch45/reportes` at `8693234` (PR #237). Independent pass: the verifier did not write the code. Mode: Standard (`strict_tdd: false`). Counts follow native status (`### Requirement:` and `#### Scenario:` headings): domain-data-model 2/3, execution-audit 2/9, query-console 4/22, report-catalog 8/26, tenant-isolation 1/4. The `gentle-ai sdd-verify-validate` step was not run because the brief forbids calling `gentle-ai`, so this envelope is not admitted by the validator.

## Commands
| Command | Result |
|---|---|
| `npx tsc -p tsconfig.json --noEmit` | exit 0, no output |
| `npm run build` | exit 0 |
| `npm run build:agente` (task 9.1, extra) | exit 0 |
| `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db` | exit 1; 1959 tests, 1955 pass, 4 fail, 0 cancelled, 0 skipped |
| `git diff origin/master...HEAD -- src/plantillas/plantilla-prueba.test.ts` | empty (0 bytes): the template test is unchanged |

The 4 failures are exactly the known environmental ones in `src/conexiones/conexiones.test.ts`: 5.1, 5.3, 5.4 and CH-07, each «the registration response must not echo the submitted credential» (test.out lines 968-976). No other test failed. Port 5432 was never used and `.env` was never read. Coverage: not available (no coverage tool configured).

## Completeness
| Metric | Value |
|---|---|
| Tasks total | 34 (0.1; 1.1-1.2; 2.1-2.2; 3.1-3.3; 4.1-4.2; 5.1-5.5; 6.1-6.4; 7.1-7.5; 8.1-8.2; 9.1-9.2) |
| Tasks complete | 34 |
| Tasks incomplete | 0 |

Each task was checked against the diff, not only the checkbox:
- 0.1: DEC-198 exists at `docs/01-decisiones.md:4156` and its options, caps, roles and period rules match the specs (it merged as #236, the base of this branch).
- 1.x: `prisma/schema.prisma` (`Reporte`, `RegistroEjecucion.reporteId`) and migration `20261107000000_reportes` (rollback in the header, no DB default on `id`, as `Plantilla`).
- 2.x to 6.x: `src/reportes/{reportes,reportes-rutas,reporte-prueba}.ts`, `src/ejecucion/ejecucion-sobre-vistas.ts`, `src/plantillas/plantilla-prueba.ts` calls the extraction, `src/auditoria/auditoria.ts`, `src/aislamiento/contexto-tenant.ts`, `src/app/rutas.ts:98-106`, and every test file named in the tasks.
- 7.x: `src/consola/consola.ts` (markup `#reportes` after `#plantillas`, script block from line 5867, `PANTALLAS` at 7044, audit label and Consulta cell) and 25 new CH-45 console tests; the design skill guidelines changed in both copies, which are byte-identical at HEAD.
- 8.x: `docs/guia/09-reportes.md`, `docs/guia/README.md` ("Nueve guías" plus row 09), `docs/02-mapa-de-changes.md:67` (row with DEC-183, DEC-198, the guide, `size:exception`, PR #237).
- 9.x: re-run above. `prisma migrate status` (9.2) was not re-run by the verifier; `test:db` applies all migrations, and the DB tests that read and write `Reporte` and `reporteId` pass.

## Spec compliance matrix

Test paths are relative to `src/`. "rutas" = `reportes/reportes-rutas.test.ts`, "prueba" = `reportes/reporte-prueba.test.ts`, "reglas" = `reportes/reportes.test.ts`, "consola" = `consola/consola.test.ts`.

### report-catalog (8 requirements, 26 scenarios)
| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Report Fields | A complete report is accepted | rutas:264 (201, echoes every field, no `columnasPrueba`) | COMPLIANT |
| Report Fields | An unknown visualization | rutas:97 (`/visualizacion`) | COMPLIANT |
| Report Fields | A technical word in the client title | rutas:122 (`/titulo`, `terminos`) | COMPLIANT |
| Declared Period | A period with its default | prueba:371 (default 30 of [30,7,90]); prueba:488 (unsaved) | COMPLIANT |
| Declared Period | The date follows the deployment zone | reglas:86 (2026-11-07T02:00Z, Buenos Aires, 7 days gives 2026-10-30); prueba:371 binds the computed value | COMPLIANT |
| Declared Period | A marker the period does not declare | rutas:180 (`sin-declarar` for `hasta`) | COMPLIANT |
| Declared Period | A declared period the statement never uses | rutas:180 (`sin-usar`, pointer `/periodo/parametro`) | COMPLIANT |
| Declared Period | Repeated or out-of-range days | rutas:133 ([7,7], [0], [400], [] all `/periodo/dias`); reglas:74 | COMPLIANT |
| Columns by Role | Bars need a label and a value | rutas:143 (`/columnas`) | COMPLIANT |
| Columns by Role | A table keeps the declared order | rutas:280 | COMPLIANT |
| Columns by Role | The same column twice | rutas:143; reglas:47 | COMPLIANT |
| Saving Checks the Columns | A column the test did not return | rutas:169 (`faltantes` ["total"]) | COMPLIANT |
| Saving Checks the Columns | No preceding test | rutas:169 (`/columnasPrueba`) | COMPLIANT |
| Catalog Routes | Replace in place | rutas:341 | COMPLIANT |
| Catalog Routes | No delete | rutas:384 (404, report remains) | COMPLIANT |
| Catalog Routes | No operator session | rutas:220 (401 on all four routes) | COMPLIANT |
| Row Cap by Visualization | Bars are cut at twenty | prueba:422 (20 rows, `corte` "tope-de-filas", none at exactly 20) | COMPLIANT |
| Row Cap by Visualization | A lower global ceiling wins | prueba:448 (30 with `maxFilasPorConsulta` 30, 100 with 200); reglas:109 | COMPLIANT |
| Testing a Report | Testing on two tenants without rewriting | prueba:308 | COMPLIANT |
| Testing a Report | Another tenant's connection | prueba:318 (404 for stored and unsaved, no audit row; see S1) | COMPLIANT |
| Testing a Report | Views not approved | prueba:337 (409 names `pedido`) | COMPLIANT |
| Testing a Report | A period that was not declared | prueba:354 (400 `/dias`, nothing recorded) | COMPLIANT |
| Testing a Report | A missing column after a rename | prueba:463 (`faltantes` ["total","id"] in order) | COMPLIANT |
| Testing a Report | Testing before assigning columns | prueba:478 (columns of the result, `faltantes` [], nothing stored) | COMPLIANT |
| Not a Query Builder | The period is the only input | prueba:89 (stored), prueba:111 (unsaved: `valores`, `limite`, `tenantId`) | COMPLIANT |
| Not a Query Builder | A data-modifying statement | prueba:501 (CTE gives `no-es-lectura`, bare `DELETE` gives `fallo`; catalog intact) | COMPLIANT |

### tenant-isolation (1 requirement, 4 scenarios)
| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Reporte Outside the Tenant Filter | Catalog routes work without a tenant header | `aislamiento/contexto-tenant.test.ts:343` (four exact rows, with and without header); rutas:233 block (headerless create, list, get, replace) | COMPLIANT |
| Reporte Outside the Tenant Filter | Test routes require an active tenant | prueba:76; `contexto-tenant.test.ts:369` | COMPLIANT |
| Reporte Outside the Tenant Filter | A look-alike route is not exempt | `contexto-tenant.test.ts:369` (`DELETE`, `PATCH`, `GET /reportes/x/y`, `/reportes-falsos`) | COMPLIANT |
| Reporte Outside the Tenant Filter | A report test reads only the active tenant | prueba:308, prueba:318; `aislamiento/aislamiento.test.ts:1142`, `:1381` (and `Reporte` in the unscoped list, `:1344`) | COMPLIANT |

### execution-audit (2 requirements, 9 scenarios)
| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Audit Record | An ad hoc query is recorded | existing CH-20 tests in `auditoria/auditoria-registro.test.ts` (pass; `reporteId` null asserted at :180, :222) | COMPLIANT |
| Audit Record | Bound values never reach the record | existing CH-20 tests; prueba:389 for the report path | COMPLIANT |
| Every Audited Path | A read-only rejection is recorded as a failure | existing CH-20 tests (pass) | COMPLIANT |
| Every Audited Path | A refused request records nothing | existing CH-20 tests; prueba:318, :337, :354 for reports | COMPLIANT |
| Every Audited Path | An unsaved template test is recorded without a template id | existing `plantillas/plantilla-prueba.test.ts` (unchanged, passes) | COMPLIANT |
| Every Audited Path | A message preview is recorded under its own origin | existing CH-42 tests (pass) | COMPLIANT |
| Every Audited Path | A refused preview records nothing | existing CH-42 tests (pass) | COMPLIANT |
| Every Audited Path | A report test is recorded under its own origin | prueba:389 (one row, `reporte-prueba`, `reporteId`, `plantillaId` null, statement with `:desde`, date absent from the row); `auditoria/auditoria.test.ts:94` | COMPLIANT |
| Every Audited Path | A refused report test records nothing | prueba:318 (404), :337 (409), :354 (400); prueba:514 (500, nothing recorded) | COMPLIANT |

### domain-data-model (2 requirements, 3 scenarios)
| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Reporte Is a Global Model | Reporte carries no tenant reference | `aislamiento.test.ts:1381` (field list has no `tenantId`), :1159; migration SQL read | COMPLIANT |
| Audit Rows Can Name a Report | Older audit rows | `auditoria-rutas.test.ts:84-85` reads null on a row written without the column; no test migrates a row written before the column existed | PARTIAL |
| Audit Rows Can Name a Report | The record stays immutable | `auditoria/auditoria-tabla.test.ts:50` (update of `reporteId` refused with «inmutable») | COMPLIANT |

### query-console (4 requirements, 22 scenarios)
The console is exercised against the suite's fake DOM, not a real browser.
| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Reports Screen | Viewing a report | consola:5755 (entities, period with default marked, statement, texts, visualization, columns in order, hostile title as text); consola:5785 (no period, no description) | COMPLIANT |
| Reports Screen | Testing with a declared period | consola:5799 (one `POST /reportes/r-1/prueba` with `conexionId` and `dias` 7; only assigned columns under their titles) | COMPLIANT |
| Reports Screen | A column is missing | consola:5831 (names the column, no table) | COMPLIANT |
| Reports Screen | No active tenant | consola:5863 (message, nothing sent) | COMPLIANT |
| Reports Screen | Markup in a title is text | consola:5813 (`<b>` header stays text, no element) | COMPLIANT |
| Report Pop-Up | Creating a bar report after a passing test | consola:5932 (test body has no `columnas`, then one `POST /reportes` with the columns and `columnasPrueba`; double press sends once; pop-up closes, list reloads, panel shows the report) | COMPLIANT |
| Report Pop-Up | Changing the SQL after a test disables saving | consola:5999 (reason text asserted) | COMPLIANT |
| Report Pop-Up | Changing the visualization keeps saving enabled | consola:6058 (rows with an existing role keep their choice) | COMPLIANT |
| Report Pop-Up | A table with too many columns | consola:6077 («Agregar columna» disabled at 10, «Quitar» disabled at 1) | COMPLIANT |
| Navigation by Hash | Default screen | consola `soloVisible` tests from :3981 (13 screens, `aria-current` on one) | COMPLIANT |
| Navigation by Hash | Switching screens | consola `soloVisible` tests from :3981 | COMPLIANT |
| Navigation by Hash | Unknown hash | consola `soloVisible` tests from :3981 | COMPLIANT |
| Navigation by Hash | The reports screen | consola:5738 (`soloVisible(…, 'reportes')`); order in consola:5709 | COMPLIANT |
| Audit Screen | Listing the audit | existing CH-30e tests (pass) | COMPLIANT |
| Audit Screen | A message preview row | existing CH-42 test (pass) | COMPLIANT |
| Audit Screen | A report test row | consola:6305 («Prueba de reporte», «Reporte r-1») | COMPLIANT |
| Audit Screen | An unsaved report test row | consola:6305 («Ad hoc») | COMPLIANT |
| Audit Screen | Filtering by local day and result | existing CH-30e1 test (pass) | COMPLIANT |
| Audit Screen | Inverted dates | existing CH-30e1 test (pass) | COMPLIANT |
| Audit Screen | No active tenant | existing CH-30e test (pass) | COMPLIANT |
| Audit Screen | Cut list | existing CH-30e test (pass) | COMPLIANT |
| Audit Screen | Markup in a statement is text | existing CH-30e test (pass) | COMPLIANT |

**Compliance summary**: 63/64 scenarios compliant, 1 partial, 0 untested, 0 failing. Requirements: 17/17 implemented and covered.

Pop-up behaviour that has no scenario but is in the requirement text, also covered: Cancel and Escape ask before discarding and a tenant switch closes the pop-up (consola:6159); with no tenant the test block says so, sends nothing and «Guardar» stays closed (consola:6145); «Editar» saves with one `PUT` (consola:6114); a refused save names fields, glossary terms and missing columns while the pop-up stays open (consola:6096); a failed test keeps «Guardar» closed with the right reason (consola:6040); the period, entities and connection are in the fingerprint (consola:6017).

## Correctness (static evidence)
| Area | Status | Evidence |
|---|---|---|
| Report fields, caps, glossary, `terminos` | Implemented | `reportes-rutas.ts:85-169` (strict schema with `propertyNames`, `rechazoDeTextos`) |
| Check order (seven steps, first refusal wins) | Implemented | `reportes-rutas.ts:189-230`, same order as design §4 |
| Period rules, derived declaration | Implemented | `reportes.ts:100-131`; declaration never stored (`datosDeReporte`, `reportes-rutas.ts:233-246`) |
| Columns by role and titles | Implemented | `reportes.ts:63-98` |
| `columnasPrueba` required on save, not stored | Implemented | `reportes-rutas.ts:213-217`; `datosDeReporte` omits it; rutas:264 asserts it is absent from the echo |
| Catalog routes, no delete, `truncado` | Implemented | `reportes-rutas.ts:248-307`; no `DELETE` route |
| Row cap by type with `corte` | Implemented | `reportes.ts:54-56`, `reporte-prueba.ts:112-125` (see W1 for `limite`) |
| Test routes order: ownership, DEC-71 gate, prepare, credential, execute | Implemented | `ejecucion-sobre-vistas.ts:53-144`, same order and bodies as the code removed from `plantilla-prueba.ts` |
| `periodo` on every 200, `faltantes` on `ok` | Implemented | `reporte-prueba.ts:132-136` |
| Audit origin, `reporteId`, listing select | Implemented | `auditoria.ts:29-34, 52-59, 128-131, 210-214` |
| Tenant exemption by exact rows | Implemented | `contexto-tenant.ts:134-146, 204-211`; `Reporte` not in `MODELOS_AISLADOS` |
| Console | Implemented | `consola.ts` markup and script block 5867-6548, `PANTALLAS` 7044, audit label |

## Rules and decisions
- **Rule 2 (tenant from the operator scope only).** The test routes read no tenant from the body: `pruebaSchema` and `pruebaSinGuardarSchema` are strict (`reporte-prueba.ts:40-68`) and `tenantId` is refused (prueba:97, :120). The connection lookup is scoped by the extension (`ejecucion-sobre-vistas.ts:57-60`). The catalog registrar receives `prisma.reporte` alone (`rutas.ts:105`), pinned by a `@ts-expect-error` signature test (rutas:55-58).
- **Rule 4 (period bound as a driver parameter).** `desde` is computed server side (`reporte-prueba.ts:109`) and goes through `prepararSentencia`, never into the text; prueba:371 shows the driver receives it (`:desde::text` returns the date) and prueba:389 shows the stored statement holds the placeholder.
- **Rule 5 / DEC-93 (no rows or date in audit).** `registrarEjecucion` receives the composed statement and ids only (`ejecucion-sobre-vistas.ts:135-142`); prueba:409 asserts the date is absent from the whole row. The `warn` log carries only ids and the failure category.
- **Catalog exemption by exact rows.** `REPORTES_EXENTOS` has four rows; `DELETE`, `PATCH`, both test routes and look-alikes are refused 400 without a header (`contexto-tenant.test.ts:369`). No `EXENCIONES_OPERADOR` row was added (rutas:78).
- **`plantilla-prueba.test.ts` unchanged versus master.** The diff is empty, and the file passes inside the 1955.
- **Console guards.** Zero `innerHTML`, `outerHTML`, `insertAdjacentHTML` or `document.write` in the added lines of `consola.ts`. Zero `zd-*` tokens in the new script block (lines 5867-6548); the 24 distinct tokens added by the diff are all markup, before the script. All 49 ids the new script looks up with `getElementById` appear in the test's `IDS`; the only new markup id absent from `IDS` is `reporte-prueba-titulo`, an `aria-labelledby` target the script never reads. `IDS_OCULTOS` and both `PANTALLAS` lists were updated, and the existing G1/G3' guard tests pass. Text goes through `textContent`, and tests assert `<b>` stays text for titles, values and the report name.
- **Anti-scope / rule 6.** The engine gained no capability: `topeFilas` became optional on the shared step and `ejecutarConsulta` was not changed. The "reads only `v_*`" limit is documented (`docs/guia/09-reportes.md:123`), as the spec requires.

## Coherence (design) and deviations
| Decision | Followed? | Notes |
|---|---|---|
| Migration and model as design §1 | Yes | Matches the SQL in the design; id has no DB default like `Plantilla` |
| Pure rules module (§2) | Yes | Adds `topeEfectivo`, `rechazoDelPeriodo`, `rechazoDeTitulos`; no new behavior |
| Extract the shared run step (§3) | Yes | Same order and bodies; template routes pass `reporteId` null |
| Strict registration schema, seven-step check (§4) | Yes | |
| Exempt only the four catalog rows (§4) | Yes | |
| Console block, guards, design skill first (§6) | Yes | |
| Apply deviation U1-1: `limite = tope + 1`, `topeFilas = tope` | Acceptable, see W1 | Needed for `corte`; the page served and the ceiling are both `tope` |
| Apply deviation U1-2: `topeFilas` optional in `PedidoSobreVistas` | Acceptable | `ejecutarConsulta` reads `maxFilasPorConsulta` at execution when absent, the same value the removed code read, so the template tests are unaffected (they pass unchanged) |
| Apply deviation U1-3: `periodo` on every 200 | Acceptable | Matches the spec text ("a completed attempt SHALL be 200 … plus `periodo`"); the design was the outlier |
| Apply deviation U1-4: `sin-usar` points at `/periodo/parametro` | Acceptable | Spec only fixes `sin-usar` as a problem; rutas:180 pins the pointer |
| Apply deviation U1-5: title refusals name `/columnas/<i>/titulo` | Acceptable | Spec requires `/columnas` only for a wrong role shape |
| Apply deviation U1-6: unsaved test skips the role check without columns | Acceptable | The spec says `columnas` is optional on that route |
| Apply deviation U2-1: pop-up test sends no `columnas` | Acceptable | The pop-up requirement says exactly that; consola:5932 asserts the body |
| Apply deviation U2-2: «Último día» for 1 | Acceptable | Wording only, see S3 |
| Apply deviation U2-3: selects disabled while they offer nothing | Acceptable | Consistent with «Probá el reporte para elegir sus columnas»; consola:5911 |
| Apply deviation U2-4: «Guardar» gated only by test and fingerprint | Acceptable | This is what the spec says; the server's 400 names the field |
| Apply deviation U2-5: period control is a select | Acceptable | Spec leaves the control open ("«Sin período», or a parameter name and the days") |
| Apply deviation U2-6: test days not in the fingerprint | Acceptable | Spec fingerprint is SQL, period, entities, connection |
| Apply deviation U2-7: ⚠ marker removed from the map row | Acceptable | DEC-198 is firm |

None of the deviations breaks a spec scenario.

## Issues found
**CRITICAL**: None.

**WARNING**
- **W1. The spec and design text for the row cap disagree with the code, though the behavior meets the scenario.** The spec ("Row Cap by Visualization") and design §4 say the cap is "both page size and row ceiling", and design §4 writes `limite = topeFilas = tope`. The code sends `limite: tope + 1` with `topeFilas: tope` (`reporte-prueba.ts:122-124`) because `corteDeEjecucion` only reports a cut when the requested limit exceeds the ceiling (`consulta-ejecucion.ts:232-237`, DEC-18). The scenarios hold (prueba:422 and :448 assert 20/30/100 rows and `corte`), and the deviation is recorded in apply-progress, but the artifacts still describe the old formula. Correct the design (and the spec wording) before archive so the archived spec matches the code.
- **W2. The console has been proven only against the suite's fake DOM.** Layout, focus order, dialog behavior on Escape, real `Intl` rendering of «Desde el dd/mm/aaaa» and the actual `fetch` path were never exercised in a browser. This follows the project's choice not to run the manual visual pass, so it is stated as untested, not as a request to add one.

**SUGGESTION**
- **S1. "Nothing is dialed" is proven by outcome, not by a spy.** Prueba:318, :337 and :354 assert the status, the body and that no audit row was written. The order in `ejecucion-sobre-vistas.ts` (ownership, gate, prepare, then `destinoDeConexion`) makes it true, and tenant B's rows would have appeared as a 200 if a dial had happened, but no test counts connections opened. The same gap exists for the template tests.
- **S2. "Older audit rows" is covered by equivalence.** A nullable `ADD COLUMN` is read as null (auditoria-rutas.test.ts:85, auditoria-registro.test.ts:180, :222), but no test writes a row before the column exists. Low value to add; the migration is additive.
- **S3. Spec wording to sync at archive.** «Últimos N días» reads «Último día» for 1 (`consola.ts:5906`, deviation U2-2); the console messages end with a period («Elegí un tenant para probar el reporte.») where the spec text has none; the apply-progress note says the data-modifying scenario should read "a data-modifying statement" (the spec already uses the CTE form).
- **S4. Not executed: a non-integer entry in `periodo.dias` through HTTP.** `registroReporteSchema` types `dias` items as `integer`, so Fastify's AJV most likely refuses `[1.5]` with the pointer `/periodo/dias/0` rather than `/periodo/dias` that `rechazoDelPeriodo` would give (reglas:76 covers the pure function only). The spec lists only [7,7], [0], [400] and [], which pass, and the console label function handles `/periodo/dias/<i>` (`consola.ts:5981`). An attempt to confirm it with a throwaway script hung and was stopped, so this stays a reading, not an observation.

## What remains untested
- No real browser run of the console (W2).
- No spy-level proof that a refused test dials nothing (S1).
- No migration of audit rows written before the column (S2).
- `npx prisma migrate status` was not re-run in this pass (task 9.2 was reported done in apply-progress; `test:db` applies the migration).
- The `gentle-ai sdd-verify-validate` admission step was not run (forbidden by the brief).
- The 4 known `conexiones.test.ts` failures were not re-run on master in this pass; the brief records that they fail there too.

## Verdict
**PASS WITH WARNINGS.** Every one of the 17 requirements is implemented and 63 of 64 scenarios have a passing covering test, the other being partial by equivalence; all 34 tasks are done; the only failing tests are the 4 known environmental ones; the template test file is untouched; the rules, the exemption and the console guards hold. The two warnings are a stale cap formula in the design and spec text, and the lack of any real-browser run.

## Key Learnings
1. A report test needs the row ceiling set at `tope` and the requested limit at `tope + 1`, because the engine reports `corte` only when the request exceeds the ceiling (`consulta-ejecucion.ts:232-237`).
2. The catalog exemption holds by exact method and route rows, and the look-alike cases (`DELETE /reportes/:id`, `GET /reportes/x/y`, `/reportes-falsos`) are what prove it does not widen to the test routes.
3. In this repo a bare `DELETE` nested inside the composed `SELECT * FROM (...)` is a syntax error, and only a data-modifying CTE reaches the engine's `no-es-lectura` verdict.
4. The console guard `IDS` lists only the ids the script looks up, so an `aria-labelledby` heading such as `reporte-prueba-titulo` is correctly absent from it.
5. `test:db` with the password `postgres` leaves exactly four failures in `conexiones.test.ts` on this branch (1955 of 1959 pass), so any fifth failure is a real finding.
