# Design: CH-39 — Message text: header and per-row line

Inputs: proposal.md, the five delta specs, DEC-188 (b), DEC-192 (exploration decisions 1–5). Delivered as two stacked PRs: CH-39a (sections 1–5, 7) and CH-39b (section 6).

## 0. Two refinements of DEC-188's "Forma"

The specs add two rules that DEC-188 does not state. Both are recorded in DEC-192 together with decisions 1–5.
- **The header is static.** Placeholders are cell values, and the header has no row. A placeholder in the header is refused instead of being given an arbitrary row's value. A header with a per-run count (`{filas}`) can come later as a reserved name.
- **The line needs at least one placeholder.** A line without one would repeat the same sentence once per row.

## 1. Model and migration

- `prisma/schema.prisma`:
  - `Plantilla` gains `encabezadoMensaje String?` and `lineaMensaje String?`. Its doc comment (`:148-161`) cites DEC-188/192.
  - `Ejecucion` gains `mensajeRespaldo Json?`, an array of column names, with a comment saying it holds names only, never values.
- Migration `prisma/migrations/20261028000000_mensaje_plantilla/migration.sql`: two `ALTER TABLE ... ADD COLUMN` statements (`"Plantilla"`: two `TEXT`; `"Ejecucion"`: one `JSONB`), no backfill. The header comment carries the rollback `DROP COLUMN`s, as in CH-37.
- `PlantillaCompleta` (`src/plantillas/plantillas.ts:38-45`) adds both texts. `PlantillaResumen` is unchanged.

## 2. Placeholder module (`src/plantillas/marcadores-mensaje.ts`, new, pure)

```ts
const MARCADOR = /\{([^{}]+)\}/g;

export function marcadoresDe(texto: string): string[];          // unique, first-appearance order
export function textoSinMarcadores(texto: string): string;      // placeholders removed (for the glossary)
export function faltantesEn(linea: string, columnas: readonly string[]): string[]; // marcadoresDe minus columnas
export function sustituir(linea: string, valorDe: (nombre: string) => string, literal: (s: string) => string): string;
```

- `sustituir` splits the line on placeholders. It applies `literal` to the text between them (escaping for HTML, identity for text) and `valorDe` to each name. That is how "escape the value on its own, never the line twice" holds by construction.
- It lives in `src/plantillas/` because both the template routes and the renderer use it. It has no imports, so `correo.ts` stays free of Fastify and Prisma.
- CH-44 (Telegram) passes its own `literal`/`valorDe`.

## 3. Template routes (`src/plantillas/plantillas-rutas.ts`)

- **Schema.**
  - `RegistroPlantillaBody` and `registroPlantillaSchema` add `encabezadoMensaje` (`string`), `lineaMensaje` (`string`) and `columnasPrueba` (`array`, `items: {type:'string'}`, `maxItems: 200`) to `propertyNames.enum` and `properties`. The memory note on strict schemas applies: unlisted keys are silently removed.
  - The caps are checked in code, after trimming, like `titulo`.
- **`rechazoDeMensaje(body, {exigirColumnas})`**, a new step called from `rechazoDePlantilla` right after `rechazoDeTextos`.
  - It implements spec steps 1–6 in order, stops at the first refusal and returns `{error:'solicitud-invalida', campos:[...], marcadores?, terminos?}`.
  - Caps: `LARGO_MAXIMO_MENSAJE = {encabezadoMensaje: 200, lineaMensaje: 300}`.
  - It reuses `textoCliente` for trimming and blank-to-null, and `terminosProhibidosEn` on `encabezadoMensaje` and on `textoSinMarcadores(lineaMensaje)`.
- **`rechazoDePlantilla(body, opciones = {exigirColumnas: true})`**.
  - `POST /plantillas` and `PUT` keep the default.
  - `POST /plantillas/prueba` passes `{exigirColumnas: false}`.
  - The catalog seeder reaches it through `rechazoDeEntrada` (`catalogo-inicial.ts:136`) with the default. Its entries carry null texts, so the new step does nothing there.
- **Catalog (`src/plantillas/catalogo-inicial.ts`).** `CLAVES` derives from `PlantillaCompleta` (`:95`), so both entries must declare `encabezadoMensaje: null` and `lineaMensaje: null`. `rechazoDeEntrada` gains `exigir` type checks for both keys, next to `/titulo` and `/descripcion` (`:133-134`).
- **`datosDePlantilla`** maps both texts through `textoCliente` and never maps `columnasPrueba`. It is the single place that decides what is stored, so the seeder and both write routes cannot persist it by accident.
- **400 body.** It is built inline in `rechazoDePlantilla` (`:158-173`) and gains `marcadores?: string[]` next to `terminos`. Nothing else in the 400 changes.

## 4. Unsaved-template test (`src/plantillas/plantilla-prueba.ts`)

- `pruebaSinGuardarSchema` already spreads the template properties, so it gains the three keys automatically. The comment at `:62-65` changes from "eleven" to "fourteen".
- The handler calls `rechazoDePlantilla(cuerpo, {exigirColumnas: false})`. The gates, execution and audit are unchanged.

## 5. Renderer and scheduler

### 5.1 `src/automatizaciones/correo.ts`

- `EntradaCorreo` gains optional `mensaje?: {encabezado: string; linea: string} | null`.
- `componerCorreo` picks the body:
  - When `mensaje` is set and `faltantesEn(mensaje.linea, e.columnas)` is empty, the body is the lines.
  - Otherwise it is the table, exactly today's `htmlDe`/`textoDe`.
- **Lines:**
  - Each line is `sustituir(linea, nombre => textoDeCelda(fila[e.columnas.indexOf(nombre)]), literal)`. `indexOf` takes the first column of a duplicated name, as the spec says.
  - HTML part: `escaparHtml` as `literal` and `escaparHtml(textoDeCelda(...))` as the value. The header is an escaped paragraph. Each line is its own `<p>` inside the same card that holds the table today.
  - Text part: identity `literal` and `sinSaltos(textoDeCelda(...))` as the value. The header is plain, then one line per row.
- **Unchanged:** `avisosDe`, the subject, the theme and the footer. The return type stays `Omit<Correo,'para'>`, so `notificador-mailpit.test.ts` and the console-preview parity tests compile and pass unchanged.
- **Exported `respaldoDe(mensaje, columnas): string[] | null`.** This is how "the renderer reports the missing names" in the email-notification spec is met. It is null when `mensaje` is null or nothing is missing, otherwise `faltantesEn`. The renderer and the scheduler share this one decision, so "fell back" cannot drift between what was sent and what was recorded.

### 5.2 `src/automatizaciones/planificador.ts`

- `PlantillaACorrer` (`:194-200`) and the select at `:420-423` add `encabezadoMensaje` and `lineaMensaje`.
- `notificar` builds `mensaje` only when both are non-null and passes it to `componerCorreo`. It returns `{salida, respaldo}`:
  - `respaldo` is `respaldoDe(mensaje, resultado.columnas)` once the message is composed.
  - `respaldo` is null on every path that composes nothing (no send decided, compose throw).
- `correr` passes `respaldo` into the single close `update` as `mensajeRespaldo` only when it is non-null. The row is created without it, so null is the default, and `Prisma.DbNull` is never needed. `cierreConNotificacion` is unchanged: the outcome and the format stay separate (DEC-192 2(a)).

### 5.3 Listing (`src/automatizaciones/automatizaciones-rutas.ts`)

`EjecucionListada` and its select add `mensajeRespaldo`. A stored value that is not an array of strings reads as null, defensively, with no throw.

## 6. Console (`src/consola/consola.ts`) — CH-39b

- **Markup.**
  - After the client texts in `#plantilla-form`, add an `<input id="plantilla-f-encabezado" maxlength="200">` and a `<textarea id="plantilla-f-linea" maxlength="300">`, each with a label and a `.zd-field__hint`.
  - In the drawer, add `#plantilla-mensaje`, a text node filled by the script.
  - Static markup carries the `zd-*` classes, so G3' stays at its three tokens.
- **Script.**
  - `ultimaPruebaPlantilla` becomes `{huella, ok, columnas}`. `probarEnDialogoPlantilla` stores the response's `leido.cuerpo.columnas` on a passing test (`:5232-5252`).
  - The hint reads: `{columna}` in the line is replaced by that column's value in each row; the header takes no columns; both go together; without them the email shows the table.
  - The drawer without texts reads «Sin texto propio: el correo muestra la tabla.»
  - `huellaPlantilla()` is unchanged.
  - `cuerpoPlantilla()` adds both texts. The save handler adds `columnasPrueba: ultimaPruebaPlantilla.columnas`. The test call does not, because it is built from `cuerpoPlantilla()` plus `conexionId`/`valores`.
  - `instantaneaDeFormularioPlantilla()` adds both texts.
  - `llenarFormularioPlantilla` fills them in every mode, so duplicate keeps them. `pasarAduplicarPlantilla` clears only the client texts.
  - `ETIQUETAS_CAMPO_PLANTILLA` gets the two labels. `mensajeDeRechazoPlantilla` reads `marcadores` and writes «No están entre las columnas de la última prueba: a, b».
  - `textosClienteDe`'s sibling `textoMensajeDe` fills `#plantilla-mensaje`.
- **Runs view.** `verEjecuciones` adds a cell or line for `mensajeRespaldo`: «Se envió la tabla: faltan las columnas a, b». Nothing is shown when it is null. No new copy contains a backtick, because the script is a template literal.
- **Tests (`consola.test.ts`).**
  - Register the new ids in `IDS`.
  - Extend the exact request bodies (~`:4310-4350`), the `maxlength` regexes and the dirty snapshot.
  - Add tests for the duplicate and the 400 `marcadores` message.

## 7. Tests (CH-39a)

| File | Cases |
|---|---|
| `marcadores-mensaje.test.ts` (new) | Extraction order and dedup; nested and unmatched braces are literal; `textoSinMarcadores`; `sustituir` escapes literal and value separately |
| `plantillas-rutas.test.ts` | Each spec scenario of the message texts. Exercises the order of the steps, `columnasPrueba` never stored or echoed (DB), and that `PUT` without texts clears them |
| `plantilla-prueba.test.ts` | Texts without `columnasPrueba` reach execution; unpaired text is a 400 before any dial |
| `correo.test.ts` | Lines per row in both parts; escape once (`A<B & C`); CR/LF in a value; null value; truncation notice with lines; table unchanged without texts; fallback plus `respaldoDe`; duplicated column name |
| `planificador.test.ts` (DB) | Fallback run: `enviada` plus `mensajeRespaldo ["stock"]`; text run: null; send failure after fallback keeps both |
| `automatizaciones-rutas.test.ts` | Listing carries `mensajeRespaldo` |
| `catalogo-inicial.test.ts` | U1 key set; both entries null |

## 8. Docs

- `docs/guia/05-plantillas.md` (CH-39a): the texts, the placeholder rule, the header that takes none, the fallback and where it shows. A short example uses the `stock-fisico` columns.
- `guidelines/consola.md` C-03 entry in both copies of the design skill (CH-39b): the two fields and the hint.
- DEC-192 in `docs/01-decisiones.md` on branch `v2/dec-192` from `v2/dec-191`: decisions 1–5 and the two refinements of section 0.

## 9. Rejected alternatives

- **`componerCorreo` returning `respaldo`.** Its result is spread into `enviar`, so an extra key would travel to the mailer and break the deep-equal tests. A separate pure `respaldoDe` keeps the contract.
- **`String[]` (Postgres `text[]`) for `mensajeRespaldo`.** Prisma lists are non-nullable, so null would have to mean `[]`. That loses "no message composed" against "nothing missing", which the spec keeps distinct only as null. `Json?` with write-only-when-set is simpler.
- **Checking placeholders against SELECT aliases parsed from the SQL.** It is unreliable (`*`, expressions, views), and DEC-188 says "the columns of the last test".

## 10. Size forecast

| Slice | Code | Tests | Docs | Total |
|---|---|---|---|---|
| CH-39a | schema + migration 25, parser 45, routes 70, prueba 5, renderer 55, scheduler + listing 30 = **230** | ~200 | ~30 | **~460** |
| CH-39b | markup 20, script 70 = **90** | ~130 | ~15 | **~235** |

CH-39a is over 400 by about 60 lines, mostly tests. Under `single-pr` this needs either `size:exception` for CH-39a, or a third slice CH-39a2 with the scheduler, `mensajeRespaldo` and the listing (~120 with tests) between CH-39a and CH-39b. The tasks forecast records both options, and the review-workload guard stops for the decision. These figures supersede the proposal's rough ~420 / ~260.
