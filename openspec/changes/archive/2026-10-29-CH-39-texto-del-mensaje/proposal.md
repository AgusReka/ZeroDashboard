# Proposal: CH-39 — Message text: header and per-row line

**Status**: ready for spec and design. Inputs: exploration.md, DEC-188 (b), DEC-192 (exploration decisions 1–5), DEC-191, DEC-190, DEC-137, DEC-85, DEC-83. Story N7.

## Intent
P1 decides what the client reads in the email: a header and one sentence per row built from the result columns («Harina 000: quedan 3 unidades»), instead of a grid of every column. A template without these texts keeps today's table, and a run whose result lacks a column falls back to the table and says so, instead of sending a text with gaps (DEC-188).

## Scope

### In Scope
- **Model.** Two nullable columns on `Plantilla`: `encabezadoMensaje` and `lineaMensaje`. One migration, no backfill: the seeded templates keep the table.
- **Placeholders.** `{nombre}` stands for the column whose name is exactly `nombre`. No expressions, no formats, no escape for literal braces. One pure parser, shared by save-time validation and the renderer.
- **Save-time rules** (`POST /plantillas`, `PUT /plantillas/:id`, and `POST /plantillas/prueba` for the shared body):
  - Both texts or none (DEC-192, 3(a)). A blank text counts as absent.
  - Caps: header ≤ 200, line ≤ 300 characters.
  - The header is static (no placeholders) and the line needs at least one placeholder (refinements recorded in design §0 and DEC-192).
  - The panel glossary (DEC-137) applies to the literal text with the placeholders removed (DEC-192, 4(a)).
  - When the texts are present, the body carries `columnasPrueba: string[]`, the columns of the passing test. Any placeholder not in it is rejected with 400 and the offending names (DEC-192, 1(a)). It is not stored.
  - `GET /plantillas/:id` returns both texts. The `GET /plantillas` summary does not change.
- **Renderer** (`src/automatizaciones/correo.ts`). `componerCorreo` takes optional `{encabezado, linea}`:
  - With both texts and every placeholder present, the HTML part is the escaped header plus one escaped line per row. Each value goes through `textoDeCelda` and then `escaparHtml`. The text part is the header plus the lines, passed through `sinSaltos`.
  - The subject, themes, cut notice (`hayMas`, N2), empty-cell notice and footer are unchanged.
  - If a placeholder has no column, the renderer uses today's table and reports the missing names to the caller.
  - Callers that pass no texts get exactly today's message.
- **Run record.** New nullable `Ejecucion.mensajeRespaldo`: the missing column names when a run fell back to the table, null otherwise (DEC-192, 2(a)). The send outcome (`notificacion`) is unchanged. The runs listing and the console run detail show it.
- **Scheduler.** `planificador.ts` selects the two texts, passes them to the renderer and writes `mensajeRespaldo`.
- **Console pop-up** (CH-38, `src/consola/consola.ts`):
  - Two fields, «Encabezado del mensaje» and «Línea por fila», with a short hint on `{columna}`.
  - They stay outside the test fingerprint: editing them does not force a re-test.
  - The passing test keeps its `columnas` next to the fingerprint and sends them as `columnasPrueba` on save.
  - A 400 for an unknown placeholder names it.
  - «Duplicar y editar» copies both texts (DEC-192, 5(a)).
  - The drawer shows them.
- **Seed.** The two seeded catalog entries declare both texts as null.
- **Docs.**
  - `docs/guia/05-plantillas.md`: the texts, the placeholders and the fallback.
  - The C-03 entry in `guidelines/consola.md`, in both copies of the design skill.
  - DEC-192 in `docs/01-decisiones.md`, on a `v2/dec-192` branch after `v2/dec-191`.

### Out of Scope
- Telegram (CH-44) and the message preview (CH-42): both reuse this parser and renderer later.
- Per-column formats (currency, date), conditions or loops (DEC-188 (c)).
- Independent header-only or line-only messages (DEC-192 3(b)). This can be added later without a migration.
- Storing the column list of a test.
- Any change to the subject, the row cap, the zero-row rule, the client panel, or the `GET /plantillas` summary.

## Delivery (exploration decision 6(b))
One SDD change, two stacked PRs:
- **CH-39a, backend** (~420 lines). Branch `ch39a/texto-mensaje` from `ch38/pantalla-plantillas`. Covers the migration, parser, save-time rules, renderer, scheduler, `mensajeRespaldo` and the listing, seed, guide and specs. It is testable through the API and Mailpit on its own.
- **CH-39b, console** (~260 lines). Branch `ch39b/texto-mensaje-consola` from CH-39a. Covers the pop-up fields, `columnasPrueba`, refusal message, duplicate, drawer, run detail and the design guideline.

## Capabilities

### Modified Capabilities
- `automation-templates`:
  - New requirement for the message texts: pairing, caps, glossary, placeholders checked against `columnasPrueba`.
  - The full projection carries the texts.
  - The unsaved-test body gains the new keys.
- `email-notification`:
  - Body built from the template's texts and the result columns.
  - Per-part escaping.
  - Missing-column fallback to the table.
  - text/plain variant.
  - The truncation notice is kept.
- `execution-log`: `Ejecucion.mensajeRespaldo` recorded and listed.
- `query-console`:
  - The template pop-up's message fields, outside the fingerprint, sent with `columnasPrueba`.
  - Duplicate copies them.
  - The run detail shows the fallback.
- `initial-template-catalog`: seeded entries declare the new keys.

## Approach
- **Parser.** `src/plantillas/marcadores-mensaje.ts`, pure. It exports `marcadoresDe`, `textoSinMarcadores`, `faltantesEn` and `sustituir(linea, valorDe, literal)`. The renderer escapes each value and each literal piece separately, never the whole line (design §2).
- **Validation.** A new `rechazoDeMensaje` step in `rechazoDePlantilla`, right after `rechazoDeTextos`, with the same 400 shape: `campos`, plus `marcadores` for the unknown names. The schema lists `encabezadoMensaje`, `lineaMensaje` and `columnasPrueba` in `propertyNames` and `properties`. `datosDePlantilla` maps the texts and drops `columnasPrueba`.
- **Renderer.** `componerCorreo` keeps its signature with an optional field and keeps its return type, so the Mailpit and console-preview tests stay green unchanged. A separate pure `respaldoDe(mensaje, columnas)` reports the missing names (design §5.1).
- **Run record.** `notificar` returns the `respaldo`, and `correr` writes it in the single close `update`. There is no extra write and `cierreConNotificacion` is unchanged.
- **Console.** It follows the CH-38 patterns: new ids in `IDS`, no `zd-*` tokens in the script (G3'), the dirty snapshot extended, and the exact request-body tests updated.

## Affected Areas
- `prisma/schema.prisma`, new migration under `prisma/migrations/`
- `src/plantillas/marcadores-mensaje.ts` (new) and its test
- `src/plantillas/plantillas-rutas.ts`, `plantillas.ts`, `plantilla-prueba.ts`, `catalogo-inicial.ts` and their tests
- `src/automatizaciones/correo.ts`, `planificador.ts`, `automatizaciones.ts`, `automatizaciones-rutas.ts` and their tests
- `src/consola/consola.ts`, `src/consola/consola.test.ts` (CH-39b)
- `docs/guia/05-plantillas.md`, `.claude/skills/zerodashboard-design/guidelines/consola.md` and its `.agents/` copy
- The five specs above (at archive)

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `columnasPrueba` comes from the client and can be wrong | Medium | It is a consistency check, not a guarantee. The runtime fallback (DEC-188) is the guarantee, with its own scheduler test |
| Column names depend on the driver (aliases, case) | Medium | Exact match against the same `fields[].name` the test returns; a test with a quoted alias |
| A value carries markup or newlines into the line | Medium | Escape the value, never the substituted line; `sinSaltos` on the text part; renderer tests with `<`, `&` and CR/LF |
| The glossary trips on column names used as placeholders | Certain | Glossary runs on `textoSinMarcadores` |
| Adding keys to `PlantillaCompleta` breaks the seeded catalog (U1) | Certain | Both entries declare null; U1 updated |
| Console guards (`IDS`, G3', exact bodies) | High | CH-39b follows CH-38's patterns; budgeted in its size |
| CH-39a brushes the 400 budget | Medium | Renderer and validation tests are most of it. If the forecast exceeds 400, the tasks phase stops for a decision |
| Stack base: CH-38 (#214) and DEC-191 (#213) are unmerged | Medium | CH-39a branches from `ch38/pantalla-plantillas`; DEC-192 on `v2/dec-192` after `v2/dec-191` |
