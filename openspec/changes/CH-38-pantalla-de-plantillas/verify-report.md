```yaml
schema: gentle-ai.verify-result/v1
verdict: pass-with-warnings
blockers: 0
critical_findings: 0
warnings: 0
suggestions: 5
requirements: 8/8
scenarios: 30/30
test_command: TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db
test_exit_code: 1 (only the 4 known environmental failures)
build_command: npx tsc --noEmit
build_exit_code: 0
```

# Verify report: CH-38 — Templates screen in the console

**Verdict: PASS WITH WARNINGS** (0 CRITICAL, 0 WARNING, 5 SUGGESTION; the status keeps the "with warnings" label only because the suite exits non-zero on the 4 known environmental failures). Date: 2026-10-27. Branch: `ch38/pantalla-plantillas`, uncommitted working tree against HEAD `603bbc5` (planning docs only). Independent read-only verification: no source or test file was edited.

## Commands
| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0, no output |
| `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db` | 1564 tests, 1560 pass, 4 fail, 0 skipped, 0 cancelled. The 4 failures are exactly the known false positives in `src/conexiones/conexiones.test.ts` (5.1, 5.3, 5.4 and "CH-07 the probe deciphers…": "the registration response must not echo the submitted credential", because the body contains `"motor":"postgres"` with the `postgres` password). No other failure. |

Baseline for comparison: CH-37 closed at 1519 tests; CH-38 adds 45 (1564).

## Tasks
All 15 task lines in `tasks.md` are ticked (`[x]`), and each one was found implemented:

| Task | Evidence |
|---|---|
| 1.1 | `src/aislamiento/aislamiento-prisma.ts:185-222` (`automatizacion.plantillaEnUso`, `reemplazarPlantillaLibre`, tagged `$queryRaw` at :212-213); header paragraph :40-48; select moved to `src/plantillas/plantillas.ts:20-48` (cycle avoidance, accepted) |
| 1.2 | `src/aislamiento/aislamiento.test.ts:1602, 1615, 1629, 1636` |
| 1.3 | `src/aislamiento/aislamiento.test.ts:1659` (race, timeboxed 10 s and 750 ms wait probe) |
| 2.1 | `src/plantillas/plantillas-rutas.ts` `UsoDePlantillas` (:206-217), `GET` `enUso` (:271), `POST` `enUso:false` (:241), `PUT` order and mapping (:282-297); `esPlantillaInexistente` and the `Prisma` import removed |
| 2.2 | `src/app/rutas.ts:75-82` port built from the two methods, comment extended |
| 2.3 | `src/plantillas/plantillas-rutas.test.ts:44-72` (signature pin, fake port helpers), :216-296 (unit suite), :599-660 (DB cases); `src/plantillas/catalogo-inicial.test.ts` call sites updated |
| 3.1 | `src/plantillas/plantilla-prueba.ts` `pruebaSinGuardarSchema` (:67-79), `PruebaAprobada.plantilla.id: string \| null` (:88-92), `probarContraConexion` (:182-221), `POST /plantillas/prueba` (:228-257) |
| 3.2 | `src/plantillas/plantilla-prueba.test.ts:105-170, 389-441, 599-655` |
| 3.3 | `src/auditoria/auditoria-registro.test.ts:225` |
| 4.1 | `src/consola/consola.ts` markup: header `#plantilla-nueva`, drawer `#plantilla-textos/-editar/-duplicar/-en-uso-aviso`, pop-up `#plantilla-dialogo` with every id of design §4.1; the ids are listed in `consola.test.ts` `IDS` |
| 4.2 | `consola.ts:1619-1707` (`crearEditorParametros`, `editorConsulta`), `consola.ts:4804` (`mostrarResultadoPrueba`), `probarPlantilla` :4837. The only deleted lines in `consola.test.ts` are the `IDS_OCULTOS` and select-list entries, so no Consultas test was edited |
| 4.3 | `consola.ts:4926-5333` (literals, `abrirDialogoPlantilla` :5192, `huellaPlantilla` :4991, `guardadoPlantillaHabilitado` :5020, `motivoGuardadoPlantilla` :5026, `probarEnDialogoPlantilla` :5218 with `generacionFormPlantilla`, submit handler :5276 with `guardandoPlantilla` flag and 201/200/400/409/404 handling, drawer toggles :4880-4886) |
| 4.4 | `src/consola/consola.test.ts` `IDS` (:218-250), pin test :4252, markup test :4263, scenarios :4280-4678; G3' test at :648 passes unedited |
| 5.1 | `docs/guia/05-plantillas.md` (screen, in-use rule and `409`, `enUso`, `POST /plantillas/prueba`, "Límites" line trimmed, demo note; the demo claim is true: `src/semillas/semilla-demo.ts:309-325` creates an active automation on `stock-fisico`) |
| 5.2 | `guidelines/consola.md` C-03 entry in both `.claude/skills/zerodashboard-design/` and `.agents/skills/zerodashboard-design/` (the two files are byte-identical) |

## Spec scenarios → evidence
Legend: covered = a test that fails if the behavior breaks; weak = covered only indirectly. Paths are under `src/`. `PR` is `plantillas/plantillas-rutas.test.ts`, `PP` is `plantillas/plantilla-prueba.test.ts`, `ISO` is `aislamiento/aislamiento.test.ts`, `AUD` is `auditoria/auditoria-registro.test.ts`, `CON` is `consola/consola.test.ts`.

### automation-templates
| Requirement / scenario | Test | Status |
|---|---|---|
| In use: replacing a template with an active automation → 409, row unchanged | PR:599 (active automation in B, headerless `PUT`, row deep-equal after) | covered |
| In use: only deactivated automations → 200 | PR:627; ISO:1636 (row returned) | covered |
| In use: use in another tenant counts (no `x-tenant-id`) | PR:599 (the app has `registrarContextoTenant`, no header); ISO:1615 | covered |
| In use: invalid body on a template in use → 400 | PR:615 (DB); PR:285 (port never reached) | covered |
| In use: unknown id stays 404 | PR:268 (port mapping); PR:549 (DB) | covered |
| In use: check and write atomic against concurrent automation create | ISO:1659 (open transaction holds `FOR KEY SHARE`; replacement must wait, then `'en-uso'`, row unchanged). Fails if the `FOR UPDATE` is removed (the 750 ms probe would resolve) | covered |
| Projection: reading a template in use (`enUso: true`, no count, tenant, automation id) | PR:642 (three automations, keys equal to the creation keys, body has no `tenantId`) | covered |
| Projection: reading a free template (`enUso: false`) | PR:251, PR:642 | covered |
| Projection: `201`/`200` carry `enUso:false`; list does not | PR:260, PR:268, PR:361 (3.1), PR:512 (4.1); list shape by existing 3.3 | covered |
| Unsaved test: testing before saving, 200 with rows, no `Plantilla` row | PP:599 (rows, no row written); AUD:225 | covered |
| Unsaved test: invalid template refused before any execution (400, same body) | PP:139 (nine bad bodies on a client that throws if read) | covered (the `terminos` key of the body is not asserted on this route, see S1) |
| Unsaved test: no tenant header → 400 `tenant-no-indicado` | PP:120, PP:129 (real allowlist, so the route is not exempt) | covered |
| Unsaved test: another tenant's connection → 404 | PP:389 | covered |
| Unsaved test: views gate 409, values 400, credential 409, order | PP:399, PP:415 | covered |
| Unsaved test: first page only (`limite`/`desplazamiento` not accepted) | PP:139 (`limite` refused). The hard-coded 50/0 page is not exercised with more than 50 rows | covered (see S2) |
| Unsaved test: `:id/prueba` keeps matching only paths with an id | PP:120 (`hasRoute` for both); the existing `/:id/prueba` cases pass unedited | covered |
| MODIFIED catalog: round-trip create/get/replace | PR:494 (4.1, updated for `enUso`) | covered |
| MODIFIED catalog: unknown id → 404 on GET/PUT | PR:486, PR:549 | covered |

### tenant-isolation
| Scenario | Test | Status |
|---|---|---|
| Use answered without a context (`true`, boolean only) | ISO:1602 (`strictEqual true/false`, deactivated and unknown id give `false`) | covered |
| Other unscoped operations still fail (`count`, `findMany`) | ISO:1629 (also `findFirst`) | covered |
| Two tenants: from A's context answers `true`, no id of B reachable | ISO:1615 (`uso: true`, scoped `count` is 0) | covered |
| Neither operation accepts a tenant id, neither returns rows/counts/ids | Structural: signatures `(plantillaId)` and `(id, datos)`; the return types are `boolean` and `'no-encontrada' \| 'en-uso' \| PlantillaCompletaFila`. ISO:1636 pins the three returns | covered |
| Routes reach them only through the injected port | PR:44-72 (signature pin; the full client is a `@ts-expect-error`); `rutas.ts:75-82` | covered |

### execution-audit
| Scenario | Test | Status |
|---|---|---|
| Unsaved template test recorded without a template id (`origen`, composed SQL, `plantillaId` null, no parameter value) | AUD:225 | covered |
| Read-only rejection recorded as failure | existing AUD:195 | covered (pre-existing) |
| A refused request records nothing | existing AUD:205 (`/consultas/ejecutar`). The refusals of `POST /plantillas/prueba` (400/404/409) return before `ejecutarPrueba`, which is where the row is written, but no test pins "no row" for this route | covered structurally (see S3) |

### query-console
| Scenario | Test (`CON`) | Status |
|---|---|---|
| Templates Screen: viewing a template (entities, parameters, statement, client texts) | CON:3950 (pre-existing), CON:4508, :4529 (hostile text written as text) | covered |
| A template in use offers only duplication | CON:4508 (`Duplicar y editar` visible, `Editar` hidden, notice shown) | covered |
| Free template offers only «Editar» | CON:4519 | covered |
| Testing a template on a connection | CON:4044 (pre-existing, unedited) | covered |
| The views are not approved | CON:4065 (pre-existing) | covered |
| No active tenant (side panel) | CON:4098 (pre-existing) | covered |
| Another template clears the result | CON:4128 (pre-existing) | covered |
| Header holds «Nueva plantilla» | CON:4263 (markup order: before `#plantillas-aviso`) | covered |
| Pop-up: creating a template after a passing test (one `POST /plantillas`, both texts, no tenant header) | CON:4297 | covered |
| Pop-up: changing the SQL disables saving and says so | CON:4371 | covered |
| Pop-up: changing the client title keeps saving enabled | CON:4371 (title, name, tolerance, description and tag change; button stays open) | covered |
| Pop-up: fingerprint = SQL, declaration, entities, connection | CON:4387 | covered |
| Pop-up: duplicating a template in use (name + « (copia)», fields kept, empty texts, nothing written) | CON:4538 (only `/conexiones` is requested), CON:4566 (notice goes with both texts) | covered |
| Pop-up: the template became in use while editing (409 → message, «Duplicar y editar», stays open) | CON:4610 | covered |
| Pop-up: forbidden term in the description (400 with `campos` and `terminos`) | CON:4648 | covered |
| Pop-up: why Guardar is disabled (no test yet / last test failed / changed) | CON:4280, :4408, :4371 | covered |
| Pop-up: «Probar» answers shown as the side panel does; 400 names fields | CON:4297, :4408, :4420 (`mostrarResultadoPrueba` shared) | covered |
| Pop-up: no tenant → test block message, Guardar closed; no connection chosen | CON:4449, :4466 | covered |
| Pop-up: Cancel and Escape ask; tenant switch closes | CON:4477 (Cancelar, Escape, Seguir, Descartar), CON:4498 | covered |
| Pop-up: «Editar» sends `PUT /plantillas/:id` with both texts (blank as `''`) | CON:4579 | covered |
| Pop-up: double submit guard | CON:4357 | covered |
| Pop-up: lists pinned to the code (`ENTIDADES_CANONICAS`, `VALORES_AUTOMATIZACION`, `FORMATOS`) | CON:4252 | covered |
| Pop-up: each save refusal legible and the pop-up stays open | CON:4664 | covered |

## Design conformance (design.md §0-§4)
- **§0-§1.** Matches. The two methods live on the extension's `automatizacion` entry, run on the closed-over raw client, and the lock is a tagged `$queryRaw` with the id as a driver parameter.
- **§2.** Matches. Port and `rutas.ts` wiring as designed; `PUT` keeps `rechazoDePlantilla` first; `esPlantillaInexistente` is gone.
- **§3.** Matches, with the accepted `conexionId`/`valores` handling. `limite` and `desplazamiento` are not accepted and the defaults are 50 and 0. The new pattern is not in `PLANTILLAS_EXENTAS` (`src/aislamiento/contexto-tenant.ts:124`, unchanged).
- **§4.** Matches. `zd-*` appears only in static markup; the script-built nodes use the bridge class `entidad-opcion` (`consola.ts:137`, :4973); every `zd-*` class added in the diff exists in the shared stylesheet. No `innerHTML`.

Deviations:
- Accepted by the caller: `PlantillaCompleta`/`PlantillaResumen` moved to `src/plantillas/plantillas.ts` (re-exported from `plantillas-rutas.ts`); `conexionId`/`valores` AJV errors flow through `rechazoDePlantilla`'s existing AJV branch; `crearEditorParametros(contenedor, alCambiar, conValor)`; after a 409, «Duplicar y editar» clears the client texts (DEC-191).
- Not listed by the caller, harmless: `probarContraConexion` also takes `app` (it is needed to reach `ejecutarPrueba`); `crearEditorParametros` also returns `entradas()`; `verPlantilla` reads a missing `enUso` as "in use" (`consola.ts:4882`), the safe default (duplicating loses nothing, editing would be refused); «Guardar» also requires a non-empty name (`consola.ts:5022`), a guard beyond the spec's fingerprint rule that matches the server's own `nombre` check. None changes specified behavior.

## Rules
- **Rule 2 (tenant isolation).** The two new operations take a template id and never a tenant id. `plantillaEnUso` returns a boolean; `reemplazarPlantillaLibre` returns the string states or the replaced `Plantilla` row (a global table). A grep for `automatizacion.` in non-test `src` shows no new access: the only added accesses are `aislamiento-prisma.ts:194, 215` and the two port lines in `app/rutas.ts:80-81`. The other hits (`planificador.ts`, `tiempos-alta.ts`, `semilla-demo.ts`, panel and automation routes) are untouched by this diff. `$allOperations` still rejects every other `Automatizacion` operation without a context (ISO:1629). The test route resolves the connection through the scoped client (`probarContraConexion`) and rejects `tenantId` in the body (PP:139).
- **Rule 4 (no SQL concatenation).** The only SQL added is the tagged `$queryRaw` in `aislamiento-prisma.ts:212-213`; no `$queryRawUnsafe` or `$executeRaw*` in the diff. The unsaved-template SQL goes through the unchanged `prepararSentencia`/`componerSentencia` pipeline with bound values (PP:599 uses `O'Brien`).
- **Rule 3, 6.** No engine or execution file changed; the new route reuses `ejecutarPrueba` and its read-only gates (PP:630 shows a `DELETE` ends in a 200 `fallo`).
- **Console G3'.** The test `CH-21c G3'` (`consola.test.ts:648`) passes unedited, and the script assigns no `zd-*` class.
- **Untracked files.** `0`, `tolerancia` and `docs/design/ZeroDashboard Design System.zip` are untouched; `.atl/` changes were already in the starting status.

## Findings
No CRITICAL and no WARNING.

- **S1 (suggestion).** PP:139 asserts `error` and `campos` for the unsaved route, but never the `terminos` array of the glossary refusal (the spec says "same body as `POST /plantillas`"). The route uses the same `rechazoDePlantilla`, so the risk is low; one extra case `{ titulo: 'Corre la consulta' }` asserting `terminos` would pin it.
- **S2 (suggestion).** "First page only" for `POST /plantillas/prueba` is pinned by refusing `limite`, not by a result over more than 50 rows. A regression that changed the hard-coded 50/0 would pass.
- **S3 (suggestion).** No test pins "a refused `POST /plantillas/prueba` writes no audit row" (400, 404, 409 before the engine). Today it holds because the row is written inside `ejecutarPrueba`, after all gates; add one assertion to the AUD suite.
- **S4 (suggestion).** ISO:1659 detects the lock through a 750 ms "still waiting" probe. It fails correctly if the lock is removed, but a very slow runner could in theory let the replacement hang past 750 ms for another reason; it is timeboxed, so it cannot hang the suite.
- **S5 (suggestion).** Cosmetic: `src/auditoria/auditoria-registro.test.ts:226` has an over-indented `const r = await post(...)`; `tasks.md` and `plantilla-prueba.ts` trigger a CRLF warning from git (working copy is LF).

## Key Learnings
1. The CH-38 working tree typechecks cleanly and the full DB suite passes 1560 of 1564, the four failures being exactly the known `conexiones.test.ts` false positives.
2. Every one of the 30 spec scenarios in the four deltas has at least one test that fails if the behavior breaks, with the two atomicity and isolation properties pinned by a real two-tenant, real-lock race test.
3. The only unscoped `Automatizacion` access added is the pair `plantillaEnUso`/`reemplazarPlantillaLibre` in `aislamiento-prisma.ts`, reached from routes only through the injected `UsoDePlantillas` port, and the only new SQL is one tagged `$queryRaw`.
4. The existing Consultas tests were not edited by the `crearEditorParametros` refactor: the only deleted lines in `consola.test.ts` are fixture lists (`IDS_OCULTOS` and the select list), so the refactor is covered by the unmodified regression net.
5. The residual gaps are test-strength suggestions only: the `terminos` body and the first-page size of the unsaved route, and the no-audit-row-on-refusal case for the new route.
