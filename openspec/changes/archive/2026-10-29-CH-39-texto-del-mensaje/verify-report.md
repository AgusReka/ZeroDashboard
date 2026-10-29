```yaml
schema: gentle-ai.verify-result/v1
verdict: pass-with-warnings
blockers: 0
critical_findings: 0
warnings: 0
suggestions: 6
requirements: 12/12
scenarios: 37/37 (36 covered, 1 weak, 0 missing)
test_command: TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db
test_exit_code: 1 (only the 4 known environmental failures)
build_command: npx tsc --noEmit
build_exit_code: 0
```

# Verify report: CH-39 — Message text: header and per-row line

**Verdict: PASS WITH WARNINGS** (0 CRITICAL, 0 WARNING, 6 SUGGESTION; the status keeps the "with warnings" label only because the suite exits non-zero on the 4 known environmental failures). Date: 2026-10-29. Branch: `ch39b/texto-mensaje-consola`, commits `40a33ec` (planning), `6b00a8d` (CH-39a code), `c24ede3` (CH-39b console); base `ch38/pantalla-plantillas`. Independent read-only verification: no source or test file was edited and no git state was touched.

## Commands
| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0, no output |
| `npx prisma validate` | "The schema at prisma\schema.prisma is valid" |
| `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db` | 1623 tests, 1619 pass, 4 fail, 0 skipped, 0 cancelled. The 4 failures are exactly the known false positives in `src/conexiones/conexiones.test.ts` (5.1, 5.3, 5.4, "CH-07 the probe deciphers…": "the registration response must not echo the submitted credential"). No other failure. |

Baseline: CH-38 closed at 1564 tests; CH-39 adds 59 (1623).

Size: CH-39a 995 insertions + 24 deletions in `git show --shortstat` (about 907 net changed lines per the caller's count; `size:exception` accepted by the user on 2026-10-27). CH-39b 341 + 19 (about 360). CH-39b is within the 400-line budget.

## Tasks
All 19 task lines in `tasks.md` are ticked and each was found implemented.

| Task | Evidence |
|---|---|
| 1.1 | `prisma/schema.prisma` (`Plantilla.encabezadoMensaje`, `lineaMensaje`; `Ejecucion.mensajeRespaldo Json?`, comments), `prisma/migrations/20261028000000_mensaje_plantilla/migration.sql` (two `ADD COLUMN` statements, rollback in header, no backfill) |
| 1.2 | `src/plantillas/plantillas.ts:42-47` (`PlantillaCompleta` gains both texts; `PlantillaResumen` untouched) |
| 1.3 | `src/plantillas/catalogo-inicial.ts` (both entries null; `exigir` type checks in `rechazoDeEntrada`), `catalogo-inicial.test.ts` U1 CH-39 |
| 2.1, 2.2 | `src/plantillas/marcadores-mensaje.ts` (49 lines, no imports) and `marcadores-mensaje.test.ts` (order/dedup, exact names, literal braces, `sustituir` separation, placeholders-only line) |
| 3.1 | `plantillas-rutas.ts`: schema keys + `propertyNames.enum`, `LARGO_MAXIMO_MENSAJE`, `rechazoDeMensaje` (steps 1-6 in order), `exigirColumnas` option, `marcadores` in the 400, `datosDePlantilla` maps both texts and never `columnasPrueba` |
| 3.2 | `plantilla-prueba.ts` (`{exigirColumnas: false}`, "fourteen" comment) |
| 3.3, 3.4 | `plantillas-rutas.test.ts` (13 new cases), `plantilla-prueba.test.ts` (2 new cases + 3 rows in the nine-bad-bodies table) |
| 4.1, 4.2 | `correo.ts` (`mensaje?`, `respaldoDe`, `mensajeDe`, `htmlDe`/`textoDe` branches), `correo.test.ts` (14 new cases) |
| 4.3, 4.4 | `planificador.ts` (`PlantillaACorrer`, select, `notificar` returns `{salida, respaldo}`, conditional spread in the close), `planificador.test.ts` (4 DB cases) |
| 4.5 | `automatizaciones-rutas.ts` (`EjecucionListada`, `respaldoLeido`), `automatizaciones-rutas.test.ts` |
| 5.1 | `docs/guia/05-plantillas.md` (section "Texto del mensaje (CH-39)", six-step table, `stock-fisico` example: the columns `Producto` and `Stock disponible` match the seed SQL at `catalogo-inicial.ts:38-39`) |
| 6.1, 6.2 | `consola.ts`: markup (:572-583, :502), `notificacionDeCorrida` (:3098), `textoMensajeDe` (:4896), `ultimaPruebaPlantilla.columnas` (:5308), `cuerpoPlantilla`, dirty snapshot, `llenarFormularioPlantilla`, `mensajeDeRechazoPlantilla` |
| 6.3 | `consola.test.ts`: `IDS`, `maxlength` regexes, exact save and test bodies, 11 `CH-39b` cases |
| 6.4 | `guidelines/consola.md` in `.claude/` and `.agents/` (`cmp` reports the two files identical) |

## Spec scenarios → evidence
Legend: covered = a test that fails if the behavior breaks; weak = covered only indirectly. Paths are under `src/`. `PR` = `plantillas/plantillas-rutas.test.ts`, `PP` = `plantillas/plantilla-prueba.test.ts`, `CAT` = `plantillas/catalogo-inicial.test.ts`, `COR` = `automatizaciones/correo.test.ts`, `PLA` = `automatizaciones/planificador.test.ts`, `AUT` = `automatizaciones/automatizaciones-rutas.test.ts`, `CON` = `consola/consola.test.ts`.

### automation-templates (13)
| Scenario | Test | Status |
|---|---|---|
| Creating with message texts (201 echoes both, no `columnasPrueba`; GET agrees) | PR "3.1 CH-39 a create with message texts echoes both…" (also reads the stored row) | covered |
| Creating without message texts (both null) | PR "…a create without message texts stores null for both, and the list summary has neither" | covered |
| Placeholder outside the test columns (`campos`, `marcadores ["stock"]`, no row) | PR "…a placeholder outside the test columns…" (POST and PUT, order of first appearance) + "…a rejected message writes no row, on create and on replace" | covered |
| Placeholder names are exact | PR "…placeholder names are exact: case and spaces count" | covered |
| Only one text | PR "…only one text is refused naming the absent one" | covered |
| Texts without test columns | PR "…texts without test columns are refused naming /columnasPrueba" | covered |
| Placeholder in the header | PR "…a placeholder in the header is refused with its names" | covered |
| Line without placeholders | PR "…a line without placeholders is refused, and lone or empty braces are literal text" | covered |
| Glossary ignores placeholder names | PR "…blank texts are absent, and the glossary ignores placeholder names" | covered |
| Forbidden term in the literal text | PR "…the glossary reads the literal text only, header and line" (`terminos ['consulta']`) | covered |
| Line over its cap (301) | PR "…a text over its cap is refused after trimming" (301 chars; also the 300-char boundary after trim) | covered |
| MODIFIED: testing with texts and no `columnasPrueba` → 200 with `columnas` | PP "CH-39 an unsaved template with message texts and no columnasPrueba runs…" (placeholder not in the columns, `columnas == ['id','nombre']`, no `Plantilla` row) | covered |
| MODIFIED: unpaired text still 400, no query runs | PP "CH-39 an unpaired message text is a 400… and nothing is read" (client throws on any read) + the table rows at PP:148-151 | covered |

Design-level properties also pinned: step order and "first refusal wins" (PR "…the steps run in spec order…"), client-text refusal beats message refusal beats SQL checks, keys are schema keys and not stripped, `columnasPrueba` accepted without texts and never stored or echoed (PR "…columnasPrueba without texts is accepted, ignored…", DB row has no such field), `PUT` without texts stores null (PR "4.1 CH-39 a PUT replaces the texts…"), `GET /plantillas` summary has neither text.

### email-notification (10)
| Scenario | Test | Status |
|---|---|---|
| Lines per row (order, no table, no "Central") | COR "lines per row…" + "the text part is the header and one plain line per row, between the date and the footer" | covered |
| Empty value in a line (em-dash, never `null`) | COR "a null or empty value reads as the em-dash…" | covered |
| Truncated result with lines | COR "a truncated result carries the notice in both parts, with lines" | covered |
| Template without texts (identical) | COR "without texts the message is the table, identical whether mensaje is absent or null"; the pre-existing table tests are unedited (the diff only adds) | covered |
| A column disappeared → table + `["stock"]` | COR "a column that disappeared gives the table in both parts, and respaldoDe names it" (deep-equal to the no-text render) + 3 `respaldoDe` cases | covered |
| MODIFIED: body excludes internals | Pre-existing test, not re-run with texts. Holds structurally: the only new input is the template's two texts, which `componerCorreo` receives without SQL, parameters, host or recipient | weak (S1) |
| MODIFIED: markup in a cell neutralized | Pre-existing; the lines path is covered by COR "markup in a value and in the literal text of the line never opens a tag" | covered |
| MODIFIED: value escaped once (`A&lt;B &amp; C &amp; más`, no `&amp;amp;`) | COR "a value is escaped once, on its own…" | covered |
| MODIFIED: newline in a line value (one line in the text part) | COR "CR and LF in a value keep each row on one line of the text part" (CRLF, LF, CR) | covered |
| MODIFIED: both parts present | Pre-existing; COR text-part test asserts the exact text lines for the message body | covered |

### execution-log (5)
| Scenario | Test | Status |
|---|---|---|
| A run falls back (`enviada` + `["stock"]`) | PLA "CH-39 4.4 a run whose line names a missing column sends the table…" (also asserts the table was sent) | covered |
| A run uses the texts (null) | PLA "…a run that uses the texts, and one without texts, leave mensajeRespaldo null" | covered |
| Send failure after a fallback (`fallo-envio` + names) | PLA "…a send that fails after a fallback keeps fallo-envio and the names" | covered |
| MODIFIED: listing shows `notificacion` | Pre-existing (AUT) | covered |
| MODIFIED: listing shows the fallback (`["stock"]` and `null`) | AUT listing test (third run `['stock']`, middle run pre-CH-39 null, newest holds `['stock', 1]` and reads null) | covered |

Extra: PLA "…a run that composes nothing never writes mensajeRespaldo" (`sin-destinatario`) pins the null-on-no-compose rule; the `COLUMNAS_EJECUCION` list pin includes `mensajeRespaldo`.

### initial-template-catalog (2)
| Scenario | Test | Status |
|---|---|---|
| Fresh install (both rows null) | CAT L1 (DB): `leer()` deep-equals `prueba.map(fila)` where `fila` spreads `datosDePlantilla`, which now carries both texts as null; CAT U1 CH-39 asserts the entries and the mapped data | covered |
| Key set matches the projection | CAT U1 `Object.keys(e).sort()` equals `Object.keys(PlantillaCompleta).sort()` (line 69), which now includes both keys | covered |

### query-console (7)
| Scenario | Test (`CON`) | Status |
|---|---|---|
| Saving with message texts (one request, both texts, `columnasPrueba ["producto","cantidad"]`; test request has no `columnasPrueba`) | "CH-39b Guardar sends both message texts and the columns of the last test…" (exact `deepEqual` body) | covered |
| Editing the line keeps saving enabled | "CH-39b editing either message text after a passing test keeps Guardar enabled…" (both fields; no request sent) | covered |
| An unknown column (names field, lists `stock`, stays open) | "CH-39b a 400 with marcadores on the line names the field…" (exact message, dialog not hidden) | covered |
| Duplicating keeps the message texts (client texts empty) | "CH-39b «Duplicar y editar» copies both message texts…" + the 409 variant "…turns the pop-up into a copy that keeps the message texts" | covered |
| A run that fell back (runs view) | "CH-39b the runs view says when the email was sent with the table…" (singular, plural, null, absent, `fallo-envio`, null notificacion; no `null`/`undefined` text; 8 cells per row) | covered |
| MODIFIED: viewing a template (message texts as text) | "CH-39b the drawer shows the message texts as text…" (hostile text written as text, no child nodes) | covered |
| MODIFIED: template without message texts | same test (null, null and absent keys read «Sin texto propio: el correo muestra la tabla.») | covered |

Also pinned: the two fields' labels, caps (`maxlength` 200/300) and hint texts (markup test), «Editar» fills both texts, Cancel and Escape count either field as a change (the new-pop-up blank check also proves no leak). "The copy MUST NOT contain a backtick" has no dedicated assertion: the console script is a template literal, so a backtick in new copy would break every console test (S2). `git diff` shows no backtick on any added `consola.ts` line.

**Totals: 37 scenarios, 36 covered, 1 weak, 0 missing.**

## Design conformance (design.md §0-§8)
- **`columnasPrueba` never stored or echoed.** Holds: it is read only inside `rechazoDeMensaje`; `datosDePlantilla` (`plantillas-rutas.ts:~270-281`) does not map it; the 201/200/GET bodies come from the `PlantillaCompleta` select. PR asserts `'columnasPrueba' in creada === false`, and that the stored row has no such key.
- **Test route skips step 6.** Holds: `plantilla-prueba.ts` passes `{exigirColumnas: false}`; `rechazoDeMensaje` returns null before reading `columnasPrueba`. PP runs a line whose placeholder is not a column and gets 200.
- **Header static, line needs at least one placeholder.** Holds: steps 3 and 4 of `rechazoDeMensaje`.
- **Glossary on text minus placeholders.** Holds: `terminosProhibidosEn(textoSinMarcadores(linea))`; the header is checked whole (it cannot hold placeholders at that step).
- **`componerCorreo` return type unchanged, byte-identical without texts.** Holds: still `Omit<Correo,'para'>`; the new `mensaje` is optional; `mensaje: null` yields `datos = tabla`, the pre-change expression; COR asserts three keys only and that absent equals null. `notificador-mailpit.test.ts` and the console-preview parity tests pass unedited.
- **Value escaped once.** Holds: `sustituir` applies `literal` to the pieces between placeholders and `valorDe` to the names; HTML lines are not escaped again in `htmlDe`.
- **`mensajeRespaldo` only when composed and fell back, kept on `fallo-envio`.** Holds: `respaldo` stays null on the no-send path and when `componerCorreo` throws (it is assigned after the call); it is assigned before the send, so a failed send keeps it; the close spreads it only when non-null.
- **Fingerprint `huellaPlantilla` unchanged.** Holds: `consola.ts:5032` is not in the diff; only `instantaneaDeFormularioPlantilla` (dirty snapshot) gains the two texts. The existing fingerprint test (CON, "fingerprint = SQL, declaration, entities, connection") passes unedited.
- **Duplicate copies the message texts.** Holds: `llenarFormularioPlantilla` fills them whenever a template is loaded; `pasarAduplicarPlantilla` clears only the client texts.
- **G3' unchanged.** Holds: no hunk of `consola.test.ts` touches the G3' test; the new fields use only the static classes `zd-label`, `zd-input` and `zd-textarea`, and the script assigns no `zd-*` class.
- **No backtick in new console copy.** Holds (no added `consola.ts` line contains one).
- **Both guideline copies identical.** Holds (`cmp` identical; both diffs are 13 lines).
- **Rule 2 (tenant isolation).** No new `Automatizacion`/`Ejecucion` access outside the scheduler's own client and the tenant-scoped listing; `mensajeRespaldo` is selected through the existing scoped `EjecucionListada`.
- **Rule 4 (SQL).** The only SQL is the migration's two `ALTER TABLE` statements; no raw query in the diff.

### Known, deliberate CH-39b deviations (judged, none breaks a spec THEN)
1. **Fallback inside the Notificación cell, not a new column.** The run row is pinned at 8 cells by CH-17b; CON asserts `length === 8` for every row and the cell text. The spec says "that run says the table was sent because the column `stock` was missing"; the cell reads «Enviada. Se envió la tabla: falta la columna stock». Satisfies the THEN. Accepted.
2. **Wording «falta la columna x» / «faltan las columnas a, b»; «Iba a enviarse la tabla» on `fallo-envio`.** The singular/plural is correct Spanish and the `fallo-envio` form avoids claiming a send that failed. The `notificacion` precedence rule is respected (the label comes first). Accepted.
3. **Header-marker 400 reads «El encabezado no admite columnas: x».** The spec sentence "those columns are not in the last test" is only specified for `/lineaMensaje` (its scenario); for the header the placeholders are refused for being in a static header, so this wording is the accurate one. The line case uses the spec wording. Accepted.
4. **Hint uses `class="ayuda"` instead of `.zd-field__hint`.** The class already exists in the console and is used by the neighbouring client-text hints and the in-use notice, so the pop-up is consistent. Visual only. Accepted (S4 notes that the design doc names a different class).

## Findings
No CRITICAL and no WARNING.

- **S1 (suggestion).** "Body excludes internals" has no test with message texts. The renderer receives no SQL, parameters, host or recipient, so it holds by construction. One assertion in the `CH-39` COR block (SQL text and host absent from both parts when `mensaje` is set) would pin it.
- **S2 (suggestion).** No dedicated assertion for "the fallback copy contains no backtick". Today a backtick would break the template-literal script and every console test, so the risk is covered indirectly. A one-line check on the rendered strings would make the rule explicit.
- **S3 (suggestion).** The `Línea por fila` textarea (`rows="3"`) and the API accept newlines in the literal part of the line. In the text part a row can then span several lines; the spec only requires CR/LF to be removed from values. The header (single-line input in the console, free in the API) can also carry a newline into the text part. Harmless; either state it in the guide or collapse line breaks in the literal text.
- **S4 (suggestion).** `design.md` section 6 names `.zd-field__hint` for the hints; the code uses `class="ayuda"` (deviation 4). Update the design text or the markup so they agree before archive.
- **S5 (suggestion).** `null` for either message text on the wire relies on Fastify's AJV coercion of `null` to `''` (same as `titulo`). The `CH-39` PR cases send blank strings, not `null`. One case with `encabezadoMensaje: null` would pin the documented "null or absent" behavior.
- **S6 (suggestion).** `consola.test.ts` has a stray blank line before the `OK_CH39` helper block (two consecutive empty lines); cosmetic.

## Key Learnings
1. The CH-39 branch typechecks cleanly, the Prisma schema validates, and the DB suite passes 1619 of 1623 tests, the four failures being exactly the known `conexiones.test.ts` false positives.
2. All 37 delta-spec scenarios across the five specs are backed by a test, 36 directly and one ("body excludes internals") only structurally, with no scenario left without coverage.
3. The "fell back" decision lives in one pure function, `respaldoDe`, shared by `componerCorreo` and the scheduler, so the table that was sent and the `mensajeRespaldo` that was recorded cannot disagree.
4. `columnasPrueba` is only a check input: `datosDePlantilla` never maps it, so it is neither persisted nor echoed, and the unsaved-template test route skips the column check because that test is what produces the columns.
5. The four CH-39b deviations (fallback text in the existing Notificación cell, the singular/plural and `fallo-envio` wording, the header-marker message, and `class="ayuda"`) do not break any spec THEN clause; only the `class="ayuda"` choice contradicts the design text and is worth reconciling.
