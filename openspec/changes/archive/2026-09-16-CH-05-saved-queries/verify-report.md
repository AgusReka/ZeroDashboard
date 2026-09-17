# Verification Report: CH-05 - Saved Queries

**Change**: CH-05-saved-queries
**Mode**: Full artifacts (proposal referenced, specs + design + tasks present)
**Verdict**: PASS WITH WARNINGS

## Completeness

24/24 tasks marked done in tasks.md. Verified against actual source state, not the checkbox alone.

- Phase 1 (route module and wiring, tasks 1.1-1.6): src/consultas-guardadas.ts (176 lines) exists with schema, both select allowlists, LIMITE_LISTADO, all three routes; src/server.ts imports and calls registerConsultaGuardadaRoutes.
- Phase 2 (integration tests, tasks 2.1-2.10): src/consultas-guardadas.test.ts (597 lines), 17 test cases, all mapped below.
- Phase 3 (console UI, tasks 3.1-3.5): src/consola.ts has the guardado section, and listarGuardadas/renderizarGuardadas/guardar/cargarGuardada are present and wired.
- Phase 4 (smoke, manual, process, tasks 4.1-4.3): scripts/smoke.sh CH-05 section present; bitacora at docs/bitacora/CH-05-consultas-guardadas.md present with V-1..V-7.

No unchecked task found. No task claims completion without matching code.

## Build and Test Evidence (executed by verify, not assumed)

- `npm run build`: exit 0, no diagnostics.
- `npm test` against a live PostgreSQL target (temporary out-of-repo Compose port-publish override, deleted after): 84 pass, 0 fail, 0 skipped (11 suites, includes CH-03/CH-04/CH-05 live suites running together).
- `npm run smoke` (`docker compose up -d --build` then full CH-01/03/04/05 smoke then `docker compose down`): SMOKE TEST PASSED, exit 0, including the new CH-05 section (empty list, save, tenantId rejection, metadata-only list, verbatim get-by-id, 404, R0 execution round trip, hostile-name round trip, console controls plus the exactly-one closing-script-tag guard).

Both `npm test` and `npm run smoke` were independently executed during this verify pass, not taken on the apply agent's report alone, and both reproduce the 84/84 pass count and the smoke pass the apply agent reported.

## Spec Compliance Matrix

specs/saved-queries/spec.md - 4 requirements, 11 scenarios.

| Requirement | Scenario | Covering test | Result |
|---|---|---|---|
| Creating a Saved Query | Creating a valid saved query | 2.2 a valid create persists the full row, readable by get-by-id | PASS |
| Creating a Saved Query | Saving a query with a name already in use | 2.8 two saved queries may share a nombre, and both persist independently | PASS |
| Creation Rejects Invalid Input | Missing nombre | 2.4 a create without nombre is rejected and creates no row | PASS |
| Creation Rejects Invalid Input | Missing sql | 2.4 a create without sql is rejected and creates no row | PASS |
| Creation Rejects Invalid Input | sql empty after trimming | 2.4 a statement that is empty after trimming is rejected | PASS |
| Creation Rejects Invalid Input | Unknown property | 2.5 an unknown property is rejected and creates no row | PASS |
| Creation Rejects Invalid Input | tenantId supplied | 2.5 a body carrying tenantId is rejected, and the tenant stays server-resolved | PASS |
| Listing Returns Metadata Only | Listing metadata-only rows | 2.6 no list row carries sql, and the stored statement is not in the payload | PASS |
| Listing Returns Metadata Only | Listing when no saved query exists | 2.6 an empty table lists as 200 (conditional literal assertion) plus scripts/smoke.sh empty-list check (unconditional, throwaway DB) | PASS - the smoke run observed guardadas_previas=0 and asserted the literal empty array |
| Retrieving by Id | Retrieving an existing saved query | 2.2 and 2.3 round trips via obtener(), plus 2.9 | PASS |
| Retrieving by Id | Retrieving an unknown id | 2.9 an unknown id answers a legible 404, with no driver error or stack | PASS |

specs/query-console/spec.md - 3 requirements, 3 scenarios.

| Requirement | Scenario | Covering evidence | Result |
|---|---|---|---|
| Saving the Current Statement From the Console | Saving the statement currently in the editor | Source read of guardar(), which posts nombre/descripcion/sql and confirms via mostrarConfirmacion() on 201. Smoke confirms the guardar and nombre controls exist and are wired (type=button). The apply agent DOM-shim harness (19/19) exercised the click-fetch-confirm flow but was not independently re-run during this verify pass | PASS, evidence-tier WARNING below |
| Console Displays the List of Saved Queries | Viewing the saved queries list | Source read of listarGuardadas()/renderizarGuardadas(), which render nombre via textContent with no sql fetched for the list. Smoke confirms the guardadas list element exists. DOM-shim harness (apply-reported) exercised list-on-load | PASS, evidence-tier WARNING below |
| Loading a Saved Query Into the Editor | Loading a saved query into the editor | Source read of cargarGuardada(id), which GETs by id and sets the editor value, then focuses it. Test 2.10 (R0 closure) proves the underlying storage-to-execution path round-trips the same statement value the console would load. DOM-shim harness (apply-reported) exercised the click-load-focus flow | PASS, evidence-tier WARNING below |

Total: 7/7 requirements compliant, 14/14 scenarios compliant. No CRITICAL scenario failures.

## Two Flagged Deviations, Adjudicated

### 1. src/conexiones.ts modification (camposInvalidos field-name fix)

Verdict: correct fix, no spec conflict, safe to keep.

- Spec-conflict check: read openspec/specs/connection-registration/spec.md and openspec/specs/query-execution/spec.md in full. Neither pins the literal ['/'] value anywhere. CH-03 spec only requires rejection and "no row created" on an incomplete registration; CH-04 spec has no campos or validation-shape requirement at all - its 400-adjacent concerns are about execution-time syntax and permission errors, not request-shape validation. Grepped both archived test files (src/conexiones.test.ts, src/consultas.test.ts) for any assertion on the literal campos value or on '/' - none found; conexiones.test.ts only asserts campos.length greater than 0. No existing spec scenario or test pins the old, less informative ['/'] shape, so the fix is a strict improvement with zero regression risk against CH-03/CH-04 own contracts.
- Runtime confirmation: independently ran npm test against a live target (not relying solely on the apply agent 84/84 report) - 84 pass, 0 fail, 0 skipped, with the CH-03 conexion routes suite and the CH-04 consulta routes suite both running live in the same process alongside the CH-05 suite. This directly confirms the fix does not regress either archived change behavior.
- The change is correctly scoped and documented: the new nombreDelCampo() helper reads params.missingProperty / additionalProperty / propertyName as a fallback only when propertyName and instancePath do not already name the field, preserving old behavior for value-level errors and only improving key-level ones.

### 2. Closing-script-tag defect in src/consola.ts and the smoke regression guard

Verdict: confirmed fixed, confirmed guarded.

- Grepped the entire src/consola.ts file for a literal closing-script-tag sequence inside the template literal: zero occurrences inside DOCUMENTO_CONSOLA. The only related text is a code comment near line 317 stating the rule (no closing script tag may appear anywhere in this inline script, not even inside a comment), which is a warning, not a violation.
- scripts/smoke.sh (around lines 346-352) now counts closing-script-tag occurrences in the served /consola HTML and fails unless the count is exactly one. Independently ran npm run smoke end to end; it reached this exact check and printed the expected OK line, confirming the guard is live and passing against the real served document, not just present as text in the script source.

## Design Coherence

Compared design.md decisions 1-7 against the actual route module, tests, and console.

| Decision | Design says | Code does | Match |
|---|---|---|---|
| 1. Route shape | /consultas-guardadas top-level collection, 3 routes | Exactly implemented | Yes |
| 2. Module and export names | src/consultas-guardadas.ts, registerConsultaGuardadaRoutes | Exact match | Yes |
| 3. List shape and cap | Metadata only, desc order plus id tiebreak, cap 200, truncado flag | Exact match (ConsultaGuardadaResumen, orderBy, LIMITE_LISTADO+1 slice) | Yes |
| 4. Duplicate nombre allowed | No uniqueness constraint | No constraint added; test 2.8 pins it | Yes |
| 5. Validation mirrors conexiones.ts, verbatim sql storage | schema shape, camposInvalidos, sanearSql as predicate only | Exact match, plus the propertyNames fix (see deviation 1) | Yes, improved |
| 6. Get-by-id, no params schema, 404 always | Literal precedent from conexiones prueba route | Exact match | Yes |
| 7. Reads not tenant-scoped | Deliberate, consistent with existing read paths | Exact match; documented as a known limit | Yes |

Three self-initiated console additions from work unit 3, each checked against scope:

1. mostrarConfirmacion() plus a banner-exito CSS rule - required by spec, not scope creep: specs/query-console/spec.md explicitly requires that on success the console confirm the statement was saved, and design.md under-specified the mechanism (only described clearing inputs and re-listing). Confirming via the existing banner region, styled distinctly from the failure state, satisfies the letter of the spec without adding new UI surface, a new alert region, or a new data flow. In scope.
2. Two extra CSS rules beyond the design stated two (a list-item help-text margin reset and an h2 rule) - purely cosmetic corrections; the shared help-text class margin would otherwise break the flex-row layout the design already specifies, and the section needed a heading style the file had none of. No new behavior, no new data exposure, no spec surface touched. In scope, cosmetic only.
3. Smoke coverage beyond task 4.1 literal line (empty-list and rule-2/tenantId assertions) - these are two of the 14 scenarios already required by the two specs (saved-queries "Listing when no saved query exists" and "tenantId supplied"); adding them to scripts/smoke.sh closes the literal-empty-list coverage gap the integration suite explicitly stated it could not close on its own, because it shares a non-disposable dev database. This fills an already-declared coverage gap using the one environment where the scenario is actually observable; it does not invent new behavior. In scope, and net-positive for spec compliance.

None of the three deviations invent behavior the specs never asked for; all three stay inside DEC-12 console-extension scope and the two spec files literal requirements.

## Issues

CRITICAL: None.

WARNING:
1. The three query-console spec scenarios (save-and-confirm, list-on-load, load-into-editor) have no browser available in this environment. The deepest behavioral evidence, the apply agent 19/19 DOM-shim harness result, was not independently re-executed during this verify pass, since it lived in a temp directory outside the repo and was deleted by apply. Verify corroborated it with a full source read of guardar()/listarGuardadas()/renderizarGuardadas()/cargarGuardada() confirming each does exactly what its scenario requires, an independently-run npm run smoke confirming the served document is well formed, carries every required control, and uses no innerHTML, and test 2.10 R0 closure proving the underlying data path (save, get-by-id, execute) round-trips correctly, the same path cargarGuardada exercises client-side. This is strong but not fully independent runtime proof of the three console scenarios; recorded as a WARNING rather than CRITICAL because the apply agent report was explicit and unhidden about the harness nature and limits, and the corroborating evidence gathered here is consistent with it.
2. The bitacora entry (docs/bitacora/CH-05-consultas-guardadas.md) states that verify and archive of the change remain pending. This is informational only, expected at this pipeline stage, and not an issue with the change itself.

SUGGESTION:
1. camposInvalidos() now lives in src/conexiones.ts and is imported by both src/consultas.ts (CH-04) and src/consultas-guardadas.ts (CH-05), per design decision 5 own noted cleanup deferral. A future change should extract it to a shared validation module now that a third caller exists, exactly as design.md already flagged.
2. docs/01-decisiones.md DEC-10/11/12 entries are firm and correctly cited throughout design.md; no action needed, noted only for completeness of the reviewed diff.

## Final Verdict

PASS WITH WARNINGS. 24/24 tasks complete and verified against actual code; 7/7 requirements and 14/14 scenarios compliant with runtime evidence; both flagged apply-time deviations adjudicated as correct with no spec conflict and no regression, confirmed by an independently-run 84/84 npm test and a full npm run smoke pass; the three self-initiated console additions stay inside the console spec own requirements. The one open WARNING is an environment limit (no browser) already disclosed by the apply agent, not a functional defect. Ready for sdd-archive.
