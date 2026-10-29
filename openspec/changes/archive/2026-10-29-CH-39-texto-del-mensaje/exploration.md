# Exploration: CH-39 — Message text: header and per-row line

Status: **decided** (2026-10-27): 1(a), 2(a), 3(a), 4(a), 5(a), 6(b), the recommended options, chosen by the user; 1–5 to be registered as DEC-192, 6 is delivery only. Store: openspec. Story N7. Decision: DEC-188 (b): "two optional texts in the template: a header and a line per row with `{columna}` placeholders. Placeholders are replaced by the cell value (`textoDeCelda`), escaped per channel. Without the two texts, today's table is used." Depends on CH-38 (PR #214, open, base `ch37/textos-cliente`). No research phase.

The v2 docs are on unmerged branches: DEC-188 on `v2/dec-187-189` (merged into the chain up to `v2/dec-190`), the CH-39 map row on `v2/mapa`, DEC-191 on `v2/dec-191` (#213, open). The map row says: "header and per-row line with `{columna}` placeholders, validated against the last test, in the email. The fields are loaded in the CH-38 screen." CH-42 (preview) and CH-44 (Telegram) reuse this text.

DEC-188 "Forma":
- Two optional fields on `Plantilla`, with a migration.
- On save, a placeholder that is not among the columns of the template's **last test** is rejected with its name.
- At execution, if a column is missing, the message uses today's table and the execution records it, instead of sending a text with gaps.
- The row cap and the cut notice stay as in the email (N2).
- Resigned: no per-column formats (formatting is done in the SQL); a new kind of template error (placeholders) shown on the DEC-182 screen.

## What exists (verified)

| Piece | State |
|---|---|
| Model | `Plantilla` (`prisma/schema.prisma:162-174`), doc comment `:148-161`. Last migration `20261027000000_plantilla_textos_cliente` (CH-37: two nullable `TEXT` columns plus a backfill). Caps and glossary live in the application. |
| Renderer | `src/automatizaciones/correo.ts`, pure. `componerCorreo` (`:193-214`) takes `{nombre, automatizacion, columnas, filas, hayMas, fecha, zona}`; cells via `textoDeCelda` (`:60-94`, `—` for empty, 500-char cap); HTML via `htmlDe` (`:301-322`) with `escaparHtml` (`:98-109`); text part via `textoDe` (`:259-270`), cells joined by ` | `, `sinSaltos` strips CR/LF; notices `avisosDe` (`:227-239`): no columns, `hayMas` cut notice, empty cells. |
| Row cap | Not in the renderer: `limite = maxFilasPorConsulta` (default 200, `src/compartido/config.ts:42`) set in `planificador.ts:257-266`; `hayMas` drives the notice. Zero rows send nothing (`omitida-sin-filas`). |
| Scheduler | Only production caller of `componerCorreo`: `planificador.ts:356-363` in `notificar`. `PlantillaACorrer` (`:197-203`) and the select at `:420-423` carry `sql, parametros, entidades, nombre, automatizacion`; the new fields must be added to both. |
| Run record | `Ejecucion` (`schema.prisma:235-255`): `estado, …, error, codigoError, notificacion, intentos`. `notificacion` is free TEXT typed in code (`EstadoNotificacion`: `enviada | omitida-sin-filas | fallo-envio | sin-destinatario | no-configurada | enviando | incierta`). **No field for "fell back to the table".** `error`/`fase` are reserved for failures (`cierreConNotificacion`). Listing shape `EjecucionListada` (`automatizaciones-rutas.ts:~44-58`); console labels `ETIQUETAS_NOTIFICACION` (`consola.ts:1151-1159`). |
| Template routes | `src/plantillas/plantillas-rutas.ts`: strict schema `:53-100` (`propertyNames.enum` of 9 keys `:56-68`); `rechazoDePlantilla` `:154-189`: AJV → `rechazoDeTextos` (caps 80/200 + glossary, `:121-146`) → `sanearSql` → `problemasDePlantilla`. `datosDePlantilla` `:192-204` is the single column mapping (POST, PUT, seeder, unsaved test). Full projection `PlantillaCompleta` (`plantillas.ts:38-45`); summary `PlantillaResumen` stays as is. |
| Test routes | `src/plantillas/plantilla-prueba.ts`: `POST /plantillas/prueba` (`:233-257`, schema spreads the template properties, comment says "eleven" keys `:62-65`) and `POST /plantillas/:id/prueba` (`:259-288`). Success body `EjecucionExitosa` has `columnas: string[]` (`consulta-ejecucion.ts:92-106`, `:498`). **Persists only `RegistroEjecucion` with a row count; the column names of a test are not stored anywhere.** |
| Console pop-up | `src/consola/consola.ts:527-593` (markup), script ~`:4955-5300`. `ultimaPruebaPlantilla = {huella, ok}` (`:4955`, set `:5252`); `mostrarResultadoPrueba` (`:4804-4835`) reads `cuerpo.columnas` and drops them. `huellaPlantilla()` (`:4991`) = sql, declaration, entities, connection (texts excluded, spec'd). `cuerpoPlantilla()` (`:5003`), `instantaneaDeFormularioPlantilla()` (`:4995`), `ETIQUETAS_CAMPO_PLANTILLA` (`:5096`), `mensajeDeRechazoPlantilla` (`:5118`), duplicate clears client texts (`:5162`, `:5206`). |
| Glossary | `src/compartido/glosario-panel.ts`: `tenant, cron, sql, consulta, query, ejecución, réplica, parámetro, timeout, plantilla`, case-insensitive `includes`. A `{consulta}` placeholder would trip it. |
| Catalog seed | `src/plantillas/catalogo-inicial.ts`: `CLAVES` derives from `PlantillaCompleta` (`:95`) and a missing key is an error; U1 (`catalogo-inicial.test.ts:68`) compares key sets. Both seeded entries must declare the new fields (null). Demo seed creates no templates. |
| Other readers | Panel (`panel-automatizaciones.ts:~283-290`) selects only `titulo, descripcion`; other selects read `sql, parametros`. No leak of the new fields. |

### Specs affected

- `automation-templates`: new requirement for the message texts (caps, placeholder check against test columns); "Testing an Unsaved Template" (13 keys); "The Full Projection Reports Use" (new fields).
- `email-notification`: "Body Contains Only Query Result Columns" (carve-out for the template's texts), "Renderer Escapes Cells and Column Names", "Gracefully Degraded Rendering" (missing-column fallback), "Message Carries a text/plain Alternative"; "Truncated Results Show a Notice" kept.
- `execution-log`: notification-outcome and runs-listing requirements, if the fallback is a column (decision 2).
- `query-console`: "Template Pop-Up for Create, Edit and Duplicate" (fields, fingerprint unchanged, placeholder rejection), "Console Markup Ids Are Guarded".
- `initial-template-catalog`: key set of seeded entries.

### Tests that pin it

- `correo.test.ts` (renderer), `notificador-mailpit.test.ts:65` and `consola.test.ts:2564-2614` (`componerCorreo` input; keep the signature backward compatible).
- `planificador.test.ts` (DB): template helpers ~`:454-471`, fallback record.
- `plantillas-rutas.test.ts` (fixtures `:32`, schema/key tests ~`:170-230`), `plantilla-prueba.test.ts` (`PLANTILLA_VALIDA` `:25`).
- `catalogo-inicial.test.ts` U1/U2.
- `consola.test.ts`: `IDS` (`:150`), `IDS_OCULTOS` (`:425`), selects (`:695`), G3' (`:648-657`), `maxlength` regexes (`:4273-4275`), exact request bodies (~`:4310-4350`), dirty snapshot.

## Shape that fits

- **Model.** `Plantilla.encabezadoMensaje String?` and `Plantilla.lineaMensaje String?` (names to confirm in design), one migration, no backfill (seeded templates keep the table).
- **Placeholders.** `{nombre}` matches a column name exactly (case-sensitive, as returned by the driver). No escape for literal braces, no expressions (DEC-188 rejects (c)). One parser shared by save-time validation and the renderer.
- **Renderer.** `componerCorreo` takes optional `{encabezado, linea}`. With texts and every placeholder present: HTML part = escaped header + one escaped line per row (cell via `textoDeCelda`, then `escaparHtml`); text part = header + lines through `sinSaltos`. Same subject, cut notice (`hayMas`), empty-cell notice and footer. Missing column → today's table plus a fallback flag returned to the caller.
- **Scheduler.** Selects the new fields, passes them, records the fallback (decision 2).
- **Console.** Two fields in the CH-38 pop-up, outside `huellaPlantilla()`, inside `cuerpoPlantilla()` and the dirty snapshot; the passing test keeps its `columnas` next to the fingerprint; a 400 for an unknown placeholder names it.
- **Unchanged.** Subject, themes, row cap, zero-row rule, `PlantillaResumen`, the panel, Telegram (CH-44), preview (CH-42).

## Decisions (chosen by the user on 2026-10-27: 1(a), 2(a), 3(a), 4(a), 5(a), 6(b))

1. **Where the save-time check gets "the columns of the last test".** They are not stored anywhere; the unsaved test route has no template id. (a) The save body carries `columnasPrueba: string[]` from the passing test; the server rejects any placeholder not in it (400 with the names). Required only when a message text is present. The CH-38 gate already forces a passing test of the same SQL before saving, so the list is fresh; an API caller could send a wrong list, which the runtime fallback still covers. (b) Persist `columnasPrueba Json?` on `Plantilla`, written on save from (a) and by `POST /plantillas/:id/prueba`: a later PUT that only changes texts still needs a fresh test anyway, so it adds a column without removing the trust issue. (c) The save route re-runs the query: needs a connection and a tenant on tenant-exempt catalog routes. *Recommended: (a): smallest data path, reuses the CH-38 gate, and DEC-188 already accepts the runtime fallback as the real safety net.*
2. **How the run records the fallback to the table.** (a) New nullable column on `Ejecucion` (e.g. `mensajeRespaldo` with the missing column names), exposed in the runs listing and shown in the console detail. (b) A new `notificacion` value (`enviada-con-tabla`): no migration, but it mixes the send outcome with the format and breaks the precedence table of `email-notification`. *Recommended: (a): the outcome stays one thing, and the missing names tell P1 what to fix.*
3. **One text without the other.** DEC-188: "without the two texts, today's table is used". (a) Both or none: save rejects a header without a line and vice versa. (b) Independent: header alone = header above the table; line alone = lines without a header. *Recommended: (a): literal reading, one rule for the renderer and for CH-44; (b) can be added later without migration.*
4. **Glossary and length caps.** The email is read by P2, like the panel texts (DEC-190). (a) Apply the panel glossary to the literal text with placeholders removed (so `{consulta}` as a column name passes), caps header ≤200 and line ≤300. (b) No glossary, caps only: column names already reach the email today through the table headers. *Recommended: (a): the text is client-facing copy written by P1, the same reason DEC-190 applied it to `titulo`/`descripcion`.*
5. **What «Duplicar y editar» does with the message texts.** DEC-191 4(b) clears `titulo`/`descripcion` so the copy stays out of the panel. (a) Copy the message texts: they do not identify the template in the panel, and the copy usually exists to tweak the SQL. (b) Clear them too, as with the client texts. *Recommended: (a).*
6. **Delivery.** Rough size: migration + schema ~20, placeholder parser + validation ~80, renderer ~90, scheduler + `Ejecucion` column + listing ~50, console ~100, tests ~300, specs/guide/design guideline ~40 → **~680 changed lines**. The session chose Single PR (400 budget). (a) One PR with `size:exception`, as CH-37 and CH-38. (b) Two changes: CH-39a backend (model, validation, renderer, scheduler, run record) ~420, then CH-39b console fields ~260. *Recommended: (b): the backend half is testable via API and Mailpit on its own; CH-39a may still brush the budget because of the renderer tests.*

## Risks

- With 1(a), the placeholder check trusts the client's column list; it is a consistency check, not a guarantee. The runtime fallback (DEC-188) is the guarantee and needs its own scheduler test.
- Column names depend on the driver (aliases, case); exact matching must use the same `fields[].name` the test returns.
- Two escapings: HTML for the HTML part, none (plus `sinSaltos`) for the text part. CH-44 will add Telegram's; the parser must stay channel-agnostic.
- A placeholder value can contain markup or newlines: `textoDeCelda` + escaping must run on the value, never on the substituted line as a whole.
- The console guards (`IDS`, `IDS_OCULTOS`, G3', exact request bodies) break on any new id or body key; G3' forbids new `zd-*` tokens in the script.
- Adding keys to `PlantillaCompleta` forces the seeded catalog entries to declare them (U1).
- `componerCorreo` is also called by Mailpit and console-preview tests: the new input must be optional to keep them green.
- CH-38 (#214) and DEC-191 (#213) are unmerged; CH-39 branches from `ch38/pantalla-plantillas`. The decisions above would be registered as DEC-192.
