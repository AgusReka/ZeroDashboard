# Design: CH-57 — Threshold and minimum rows, told apart

Inputs: proposal.md, specs/automation-templates, specs/query-console, DEC-209.

## Technical Approach

### 1. Route (`src/plantillas/plantillas-rutas.ts`)
- **Item schema.** It becomes `properties: { nombre: {}, tipo: { enum: TIPOS_PARAMETRO }, etiqueta: {}, ayuda: {} }`, keeping `additionalProperties: false` and `required: ['nombre', 'tipo']`.
  - Both new keys are listed so `removeAdditional` keeps them.
  - They take `{}` (no `type`) so AJV cannot coerce a number into a string. The route checks the type.
  - The items also carry `propertyNames: { enum: ['nombre', 'tipo', 'etiqueta', 'ayuda'] }`. Added at apply: with `additionalProperties: false` alone, `removeAdditional` strips an unknown key silently and the body is accepted, which breaks the spec's «unknown key is refused». The body uses the same trick at its top level.
- **Body type.** `RegistroPlantillaBody.parametros` becomes `{ nombre: string; tipo: string; etiqueta?: unknown; ayuda?: unknown }[]`.
- **`LARGO_MAXIMO_TEXTO_PARAMETRO = { etiqueta: 60, ayuda: 240 }`.**
- **`rechazoDeTextosDeParametros(cuerpo)`** returns the offending fields as `/parametros/{i}/etiqueta` and `/parametros/{i}/ayuda`. A field is refused when it is present and not a string, or when its trimmed length is over the limit.
  - It runs next to `rechazoDeTextos`, and its fields join that same `solicitud-invalida` answer.
  - Placement: before the SQL checks, as with the client texts.
- **`datosDePlantilla`** maps each entry to `{nombre, tipo}` plus each text that `textoCliente` (trim, blank → null) leaves non-null. A null text adds no key.
- **`POST /plantillas/prueba`** goes through the same validation function, so it accepts the keys. The texts are unused there.

### 2. Console editor (`src/consola/consola.ts`)
- **`crearEditorParametros(contenedor, alCambiar, conValor, conTextos)`.**
  - With `conTextos`, `agregar(nombre, tipo, etiqueta, ayuda)` adds two inputs with classes `parametro-etiqueta` and `parametro-ayuda-texto`, labeled «Rótulo para el operador» and «Ayuda» through `rotular`, with `maxlength` 60 and 240.
  - Each fires `alCambiar`.
- **`declaracion()`** is unchanged, `{nombre, tipo}`, so `huellaPlantilla()` is untouched.
- **`declaracionConTextos()`** returns `{nombre, tipo}` plus the non-blank trimmed texts.
  - `cuerpoPlantilla()` and `instantaneaDeFormularioPlantilla()` use it.
  - The snapshot change makes the texts count as unsaved changes.
- **Only `editorPlantilla`** is built with `conTextos = true`.
- **`llenarFormularioPlantilla`** passes `parametro.etiqueta` and `parametro.ayuda` in every mode. The copy keeps them.
- **`alCambiarDeclaracionPlantilla`** runs on every keystroke. It re-evaluates the save gate, but the gate compares fingerprints, so a text-only change keeps it open.

### 3. Labels in the automation forms
`descripcionDeParametro(plantilla, nombre)` first looks for the entry in `plantilla.parametros` with that `nombre` and a string `etiqueta`, and returns `{etiqueta, ayuda: ayuda || ''}`. If there is none, it falls back to `PARAMETROS_PLANTILLA`, as today, and then to the name.

### 4. Minimum's help
- **Constants.** `AYUDA_MINIMO_CORREO` and `AYUDA_MINIMO_TELEGRAM` get the full two-sentence texts of the spec. The static markup of `auto-minimo-ayuda` equals `AYUDA_MINIMO_CORREO`.
- **Adjust markup.** It gains `<p id="aj-minimo-ayuda" class="ayuda">` after `aj-minimo`, and `aj-minimo` gains `aria-describedby="aj-minimo-ayuda"`.
- **`aplicarCanalAjuste`** sets its text the way `aplicarCanalAlta` does.
- **`IDS`** in `consola.test.ts` registers `aj-minimo-ayuda`.

## Architecture Decisions

### Decision: Template-only keys, not a wider shared declaration
Saved queries, reports and the panel validate through `validarDeclaracion`, which keeps `{nombre, tipo}`. Widening the shared type would spread the texts into saved-query versions (`consultas-versiones.ts` compares entries) and the query editor, which the user did not ask for. The template route accepts and projects the texts on its own.

### Decision: Texts outside the fingerprint
A test proves the SQL and its declaration run. A label does not change what runs, the same reasoning DEC-191 applies to the client texts.

## Data Flow
editor row → `declaracionConTextos()` → `POST/PUT /plantillas` → `datosDePlantilla` → `Plantilla.parametros` (JSON) → `GET /plantillas/:id` → `construirValores` → `descripcionDeParametro` → label and help.

## File Changes
| File | Change |
|---|---|
| `src/plantillas/plantillas-rutas.ts` | schema, body type, limits, refusal, projection |
| `src/plantillas/plantillas-rutas.test.ts` | round trip, blank, too long, non-string, unknown key, the test route accepts the keys |
| `src/consola/consola.ts` | editor option, body and snapshot, fill, label precedence, minimum's help, adjust markup |
| `src/consola/consola.test.ts` | `IDS`, editor inputs, fingerprint unaffected, copy keeps texts, label precedence, help after a channel change, adjust help |

## Interfaces / Contracts
- Template parameter entry: `{ nombre: string; tipo: 'texto'|'numero'|'booleano'|'fecha'; etiqueta?: string; ayuda?: string }`.
- Error: `400 { error: 'solicitud-invalida', campos: ['/parametros/0/ayuda', …] }`.

## Testing Strategy
- **Route tests** against the test database (`npm run test:db`). Panel tests stay as they are and prove the threshold detection is unaffected.
- **Console tests** in the fake DOM of `consola.test.ts`. New classes stay out of `zd-*` (guard G3').

## Migration / Rollout
No migration. Old rows have no texts, and seeded rows keep the fixed map.

## Open Questions
None.
