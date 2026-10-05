# Design: CH-21c — Two-Step Automation Creation (D2) and Template-Tied Email Format (N3)

## Technical Approach

This design implements DEC-129 (b)+(P1), DEC-130 (a), DEC-131 (a) and DEC-132 (a) inside DEC-124 A5 (HTML and script stay in `src/consola.ts`) and DEC-127 (the disabled hint derives from the template's own `entidades`). PR0 (the DECs) is committed.

- **Server (PR1).** A pure `proximaEjecucion` in `src/automatizaciones.ts` feeds two additive fields of the `POST /automatizaciones` 201 body. A scoped `GET /conexiones` returns `{id, nombre}` with the listing cap. There is no engine, schema, migration, env or dependency change (rule 6). `cron-parser` is already a dependency.
- **Console (PR2a-PR5).** The flat form becomes a wizard. The panels and the stepper are static markup, the cards are built by the script, and the schedule presets write into the existing `#auto-cron`. The disabled hint mirrors `evaluarVistas` from two existing GETs. The preview is static nodes filled through `textContent`. The POST body keys do not change. The inline script changes, so the spec delta drops the "byte-identical script" clause (spec phase). One `</script>`, no backtick, no `${` and no markup-assigning property stay enforced.
- **PR split.** The proposal's PR2 (~380, at the edge of the budget) is split now into PR2a, PR2b and PR2c. The proposal's PR3/PR4/PR5 keep their numbers.

## Architecture Decisions (design-level, inside DEC-124/127/129..132)

| Topic | Choice | Rejected | Rationale |
|---|---|---|---|
| First-run computation | `proximaEjecucion(cron, row.creadaEn, zonaHoraria)` after `create`, using the same call as `estaVencida`: `CronExpressionParser.parse(campos.join(' '), { currentDate: desde, tz: zona }).next().toDate()` | Computing it from `new Date()` or before `create` | The scheduler's lower window edge is `max(windowStart, creadaEn)` with the edge exclusive. The library also returns the first fire strictly after `currentDate`. Both use the stored `creadaEn`, so the banner and the scheduler agree by construction (test N5) |
| First-run failure path | No try/catch | Returning `null` on a throw | `cronValido` already ran `.next()` in the same zone. A five-field cron has no year, so a valid expression always has a next fire. A catch branch would be dead code |
| Zone handling | `tz: zona` resolves the fields in the deployment zone (DEC-77). `currentDate` and the result are absolute instants. The response carries `toISOString()` (UTC `Z`) plus `zonaHoraria` | Returning a preformatted local string | The client formats the instant in `zonaHoraria`, not in the browser zone (DEC-129: the browser cannot know the deployment zone) |
| `GET /conexiones` placement | A handler inside `registerConexionRoutes` (`src/conexiones.ts`) | A new registrar | Every app that registers connection routes gets it, the T2 app included (`aislamiento.test.ts:165`). `server.ts` does not change |
| Projection and order | `ConexionListada = { id: true, nombre: true }`, `orderBy: [{ nombre: 'asc' }, { id: 'asc' }]`, `take: LIMITE_LISTADO + 1`, body `{ conexiones, truncado }` | Reusing `ConexionPublica`; newest first | DEC-132 allows only `id`/`nombre` (rules 5, 7). Alphabetical order follows the other picker's feed, `GET /plantillas` (`nombre, id`). The cap and `truncado` follow every other listing |
| Cap constant | `LIMITE_LISTADO` moves to a new leaf module `src/listados.ts`. `consultas-guardadas.ts` re-exports it, so its importers and tests are unchanged | Importing it from `consultas-guardadas.ts` | `consultas-guardadas.ts` already imports `camposInvalidos` from `conexiones.ts`, so that import would create an import cycle |
| Exemption | **Not exempt.** `contexto-tenant.ts` is unchanged, so `GET /conexiones` with no header answers `400 tenant-no-indicado` | Any exemption row | Connections are tenant data (DEC-15, DEC-132). Scoping comes from the extension (`findMany` is in `OPERACIONES_FILTRO`, and `Conexion` is in `MODELOS_AISLADOS`). The handler has no `where` |
| Connection fetch timing | Fetched when the wizard opens (`abrirAlta`), never on tenant load | Fetching on tenant load | Tenant load stays at exactly 3 responses (`guardadas`, `/plantillas`, `/automatizaciones`). The connection list is fresh each time the wizard opens |
| Wizard ids | Keep `auto-plantilla`, which becomes the picker container in PR2c, plus `auto-valores`, `auto-conexion` (an input until PR2b, then a select), `auto-cron`, `auto-destinatario`, `auto-crear`, `auto-lista` and `auto-ejecuciones`. New ids, all with an `auto-` prefix, are listed in the PR sections. `siguiente` is the pager's id, so the wizard button is `auto-siguiente` | Renaming `auto-plantilla` | This keeps the guard diff small. The fake `getElementById` returns `null` for unknown ids, so every new id enters `IDS` in the PR that adds it |
| Stepper done state | The script only toggles `aria-current` (`setAttribute`/`removeAttribute`). The done look comes from 2 bridge rules on `#auto-marca-1:not([aria-current])` | Script-assigned `'zd-step is-done'` | No multi-class string and no stepper class in the script. Step 1 is never "pending" while step 2 is current |
| G3 replacement | Exact set of the script's `zd-` tokens: `['zd-template', 'zd-template__desc', 'zd-template__name']`. Every `className = '...zd-...'` is single-class | Dropping G3 | `porClase` compares by strict equality. Adding a class becomes a deliberate test edit |
| Siguiente gating | Enabled only with a non-empty connection **and** a chosen, non-disabled template | Requiring the values too | Values have their own server-side legible errors. Step 2 builds controls from the template |
| No connections / validation failure | Empty list: the placeholder option reads "No hay conexiones registradas", `#auto-aviso` explains, and Siguiente stays disabled. Probe failure: **fail open**. All cards stay enabled and `#auto-aviso` says the view gate still applies at run time | Failing closed | The hint is advisory (DEC-127). The run-time gate is authoritative |
| Hour control | `<input type="time">` with the default `08:00`, checked with character tests against `'0123456789'` | Two selects; a regex | It matches the mockup and gives the 24 h `HH:MM` value. A regex in the template literal would need `\\d` (a single `\d` cooks to `d`), so it is avoided entirely |
| Schedule source of truth | `#auto-cron` is **always visible**. It is read-only while a preset is selected (showing the computed cron) and editable for `personalizado`. `crearAutomatizacion` still reads `entradaCron.value.trim()` | A separate hidden value; hiding the cron field for presets | One path to the POST, and pass-through for `personalizado` is trivially exact. DEC-129 only says that `personalizado` exposes the raw cron. Showing it read-only for presets is a design-level refinement (the operator sees the exact cron sent), and the user may object |
| Class matching in tests | DEC-124's note about a class-tolerant `porClase` is **intentionally not used**. Every script-assigned class stays single, and G3 becomes an exact token set | A class-tolerant `porClase` | It keeps the fake DOM and every existing `porClase` assertion unchanged |
| Stale responses | `generacionAlta` changes on every reset (open, cancel, created, tenant switch). PR4 adds `generacionSondeo`, which changes on every connection change. Each continuation checks its token(s) | Request abort | No `AbortController` in the fake fetch. This is the existing "later choice wins" idiom (`consola.ts:1159`), generalized |
| Probe shape | One `GET /conexiones/:id/validacion-mapeo`, then `GET /plantillas/:id` per catalog entry, **sequentially** in catalog order, with details cached per wizard session | Parallel fetch | It gives a deterministic test queue. The catalog is small (2 seeded), and the cache also serves the step-2 controls |
| Preview | Static nodes with ids, filled by `textContent`. The accent goes through `style.backgroundColor` (CSSOM, not markup). The subject is `{emoji} {nombre} (n)`, with a literal `n` explained by the note | `iframe srcdoc`; a sample count | `srcdoc` breaks the `textContent` boundary (DEC-131 (c) rejected). A fake count could be mistaken for data (rule 5) |
| Parity | The preview subject carries a literal `(n)` count placeholder. The test computes `asuntoCorreo({..., filas: 0, hayMas: false})`, replaces its trailing ` (0)` with ` (n)`, and compares. The client accent is compared with `componerCorreo(...).html` (`background:<acento>`) | Exporting `TEMAS` from `correo.ts` | `correo.ts` stays untouched (the DEC-107/108 path) |
| Accepted subject divergence | The client subject skips the server's `unaLinea` normalization (control characters, repeated spaces) and the 200-code-point cut. E1/E3 use ordinary names | Mirroring `unaLinea` in the script | The mirror would need a control-character regex with doubled escapes in the template literal, for a cosmetic preview. `textContent` keeps a hostile name inert anyway |
| T2 coverage | A two-direction listing test in `aislamiento.test.ts`, modeled on "the listing never shows the other tenant's saved queries" | A row in the per-id 404 table | A listing has no foreign id to refuse. The 404 table cannot express it |

## Needs User Decision

None. Every choice stays inside DEC-124/127/129..132. The user may still object to:

- The preview quotes the email subject with its emoji. `lenguaje.md` forbids emoji in UI copy, but this is a quotation of the email, which carries one (DEC-85).
- `#auto-cron` stays visible as a read-only field for presets. DEC-129 only requires the raw cron for `personalizado`.
- Disabled cards cannot be selected in the UI, while the server stays ungated.
- The fail-open behavior on a probe failure.
- The 8-PR chain.

## PR Plan

| PR | Content | Authored ± (est.) | Depends on |
|---|---|---|---|
| PR0 | DEC-129..132, planning docs | done | — |
| PR1 | Server: `proximaEjecucion`, 201 fields, `GET /conexiones`, `listados.ts`, tests, smoke | ~250 | PR0 |
| PR2a | Wizard shell: Nueva, stepper, two panels, Siguiente/Volver/Cancelar, existing fields moved, `Nodo` attribute stubs, the 3 broken tests rewritten | ~330 | — |
| PR2b | Connection dropdown from `GET /conexiones` | ~190 | PR1, PR2a |
| PR2c | TemplatePicker cards, description map, detail cache, G3 replaced | ~220 | PR2b |
| PR3 | Schedule presets, hour, sentence, `personalizado`, first-run banner, schedule reset | ~305 | PR1, PR2a |
| PR4 | Disabled-with-reason (client mirror, stale guard, fail open, bridge CSS) | ~270 | PR2c |
| PR5 | N3 preview and parity tests | ~170 | PR2c |

## PR1 — Server

**Changes:**

- `src/automatizaciones.ts`: `export function proximaEjecucion(cron: string, desde: Date, zona: string): Date`. It goes through `camposCron` (throws `'proximaEjecucion: horario fuera de cron estándar'` on `null`), then makes the parse/next call above.
- `src/automatizaciones-rutas.ts`: the 201 becomes `{ automatizacion, proximaEjecucion: proximaEjecucion(cron, automatizacion.creadaEn, zonaHoraria).toISOString(), zonaHoraria }`.
- `src/conexiones.ts`: `ConexionListada` and `app.get('/conexiones', ...)`, as in the table.

| File | Action | ± |
|---|---|---|
| `src/listados.ts` | Create: `LIMITE_LISTADO = 200` and its doc | +10 |
| `src/consultas-guardadas.ts` | Replace the definition with `import { LIMITE_LISTADO } from './listados.js';` plus `export { LIMITE_LISTADO };`. The module uses the constant itself (`:187-192`), and a bare `export ... from` would not bind it locally | ±4 |
| `src/automatizaciones.ts` | `proximaEjecucion` | +17 |
| `src/automatizaciones-rutas.ts` | 201 fields, import | +6/−1 |
| `src/conexiones.ts` | Projection and listing route | +26 |
| `src/automatizaciones.test.ts` | N1-N6 | +55 |
| `src/automatizaciones-rutas.test.ts` | R1 | +10 |
| `src/conexiones.test.ts` | R2 (new no-read block), C1, C2, C3 | +75 |
| `src/aislamiento.test.ts` | T2-L | +32 |
| `scripts/smoke.sh` | S1 | +12 |
| **PR1 total** | | **~250** |

**Tests:**

- **N1**: `30 8 * * 1-5` from Fri `2026-10-02T12:00Z` (UTC) gives `2026-10-05T08:30Z`.
- **N2**: `1-6` from the same instant gives Sat `2026-10-03T08:30Z`.
- **N3**: `1-5` from Sat `2026-10-03T09:00Z` gives Mon `2026-10-05T08:30Z`.
- **N4**: `30 8 * * *` from `2026-10-02T12:00Z` in `America/Argentina/Buenos_Aires` gives `2026-10-03T11:30Z`. In UTC it gives `2026-10-03T08:30Z`.
- **N5**: Strictly after: from exactly `08:30:00.000Z`, the result is the next day. `estaVencida(cron, creadaEn, p, zona)` is true, and with `p − 1 ms` it is false.
- **N6**: `@daily` and six fields throw.
- **R1** (live): the 201 body keys are exactly `automatizacion, proximaEjecucion, zonaHoraria`, and the `automatizacion` keys are unchanged. `proximaEjecucion` equals the function applied to `creadaEn`, and `zonaHoraria === 'UTC'`.
- **R2** (`src/conexiones.test.ts`): `GET /conexiones` with no header answers 400 `tenant-no-indicado`. It sits in a new **non-skipped** describe block, before the live block. That block registers `registrarContextoTenant` and `registerConexionRoutes` on a no-read client that mirrors `clienteSoloTenant` (`automatizaciones-rutas.test.ts:19-30`). Every connection route test lives in the connections test file, and `automatizaciones-rutas.test.ts` keeps registering only automation routes (`:46`).
- **C1** (live): two connections. Every row's keys equal `['id','nombre']`, the body excludes the `credencial` key, the password and the host, and the order is `nombre`, then `id`.
- **C2** (live): `LIMITE_LISTADO + 1` rows via `createMany` (dummy `credencial`, fresh tenant) give 200 rows and `truncado: true`, then cleanup.
- **C3** (live): a fresh tenant with no connections gets `200 { conexiones: [], truncado: false }`.
- **T2-L**: for `[a,b]` and `[b,a]`, the response is 200, own `conexionId` is in, and the owner's is out. The body excludes all of the following:
  - `duenio.conexionId`;
  - the owner's connection **name**: `!body.includes('Replica B')` when A calls, and `!body.includes('Replica A')` when B calls (fixture names are `Replica ${etiqueta}`, `aislamiento.test.ts:216`);
  - `duenio.tenantId`;
  - `objetivo.password`.

  The header comment notes that listing routes are proven by listing tests.
- **S1**: without the header the answer is 400. With the smoke tenant it is 200, it contains the registered smoke connection id, and it does not contain `credencial`.

## PR2a — Wizard Shell (no new request)

**Markup** (replaces `consola.ts:188-202`, everything outside `#automatizaciones` is unchanged):

- `<button id="auto-nueva" class="zd-btn zd-btn--primary" type="button">Nueva automatización</button>`
- `<div id="auto-alta" class="zd-card zd-form" hidden>` contains:
  - `<ol class="zd-steps" aria-label="Pasos del alta">` with two items:
    - `<li id="auto-marca-1" class="zd-step" aria-current="step"><span class="zd-step__n">1</span><span>Conexión y plantilla</span></li>`
    - `<li id="auto-marca-2" ...>` (step 2, "Parámetros y horario")
  - `<div id="auto-paso-1">`: the connection field (current input), `<p id="auto-aviso" class="ayuda" hidden>`, the template `<select id="auto-plantilla">`, `auto-siguiente` (primary, `disabled`) and `auto-cancelar` (ghost).
  - `<div id="auto-paso-2" hidden>`: `<p id="auto-resumen" class="ayuda">`, `auto-valores`, `auto-cron` (raw), `auto-destinatario`, and the actions `auto-volver` (secondary) and `auto-crear` (primary).
- Every button is `type="button"`.

**Bridge CSS:** two `#auto-marca-1:not([aria-current])` rules (color `--text-2`; `.zd-step__n` border `--accent`, color `--accent-text`), plus spacing for `#auto-alta`.

**Script:**

- `var SIN_TENANT` is shared by `pedir()` and `abrirAlta`.
- `generacionAlta` is the stale-response token.
- `abrirAlta()`:
  1. With no tenant, it shows the `SIN_TENANT` banner and does not open.
  2. It calls `ocultarBanner()` and `reiniciarAlta()`, shows `#auto-alta`, hides `#auto-nueva`, and calls `irAPaso(1)`.
- `cerrarAlta()` hides the wizard, resets it, and shows `#auto-nueva`.
- `reiniciarAlta()` increments `generacionAlta`, empties the values, cron, recipient and connection, and calls `actualizarSiguiente()`.
- `irAPaso(n)` toggles the panels' `hidden` and calls `setAttribute('aria-current','step')` / `removeAttribute`.
- `actualizarSiguiente()` applies the gating.
- Siguiente re-checks the gating, then fills `#auto-resumen` ("Plantilla: X · Conexión: Y") and calls `irAPaso(2)`.
- An `input` listener on the text `#auto-conexion` calls `actualizarSiguiente()`. PR2b switches this to a `change` listener on the select.
- `limpiarAutomatizaciones()` also calls `cerrarAlta()`.
- `elegirPlantilla` (still select-based here) captures `g` and drops the detail response unless `g === generacionAlta` and the choice is unchanged.
- `crearAutomatizacion` captures `g`. On the 201 with `g === generacionAlta`, it calls `cerrarAlta()`, then `mostrarConfirmacion`, then reloads the list. A server 400 keeps step 2 visible with every value in place.

**Tests (`consola.test.ts`):**

- `Nodo` gains `setAttribute`/`removeAttribute`/`getAttribute` (a `Map`), plus `checked`, `name` and `readOnly` fields.
- The 11 ids enter `IDS`. Helpers `abrirAlta` and `avanzar` are added. `arrancar()` (`:336`) keeps `auto-plantilla` as a `select`, and `auto-conexion` stays a `div` for now.
- The 3 broken tests are rewritten through Nueva → step 1 → Siguiente → step 2. They assert the **same POST body** as today:
  - **RW1** (`:803`): values from the template.
  - **RW2** (`:881`): the recipient is sent only when entered.
  - **RW3** (`:900`): a rejected recipient. It also asserts that after the 400 `#auto-paso-2` is still visible and `#auto-paso-1` hidden, and that the recipient, cron and value controls keep what was typed.
- **W3**: Siguiente is disabled until both are set (via the connection `input` event). Volver keeps the values. `aria-current` moves.
- **W6**: a tenant switch hides and wipes the wizard, and still issues exactly 3 requests.
- **W7**: Cancelar closes and resets.
- **W10**: a deferred `GET /plantillas/:id` (an unresolved `cuerpo`) resolved after a tenant switch builds no value control. PR2c adapts it to a card click.

| File | ± |
|---|---|
| `src/consola.ts` | +128/−20 |
| `src/consola.test.ts` | +150/−30 |
| **PR2a total** | **~330** |

## PR2b — Connection Dropdown

- The `#auto-conexion` input becomes `<select id="auto-conexion" class="zd-select">` labeled "Conexión".
- `cargarConexiones()` (called by `abrirAlta`) goes through `pedirAutomatizacion('/conexiones')` and drops the response unless `g === generacionAlta`. On 200, `renderizarConexiones` adds a `''` placeholder ("Elegí una conexión") and one option per row. The option text is `nombre + ' (' + id.slice(0, 8) + '…)'`, which disambiguates names that repeat (the T4 idiom).
- Empty list or `truncado` shows the copy in `#auto-aviso`.
- A non-200 calls `mostrarRechazo`, and a network failure gets the generic banner from `pedirAutomatizacion`. In both cases the wizard stays open on step 1 with only the placeholder option, and Cancelar works. Reopening the wizard retries the fetch.
- The text field's `input` listener is replaced by a `change` listener on the select, which calls `actualizarSiguiente()`.
- Harness: `arrancar()` (`consola.test.ts:336`) must create `auto-conexion` as a `select`.
- Late responses can be simulated without changing the harness: queue `cuerpo` as an unresolved `Promise`, because `json: async () => cuerpo` adopts it.
- **Tests:**
  - **W2**: opening issues `GET /conexiones` with `X-Tenant-Id`. The options are built through `textContent`.
  - **W4**: an empty list shows `#auto-aviso` and Siguiente stays disabled.
  - **W5**: a deferred `/conexiones` resolved after a tenant switch adds no option.
  - **W9**: a `500` on `/conexiones` shows the `mostrarRechazo` banner, the wizard stays open and Siguiente stays disabled. Cancelar closes it, and reopening issues a fresh `/conexiones`.
  - RW1-RW3 pick from the dropdown.
- Estimate: `consola.ts` +48/−10, test +120/−12 (**~190**).

## PR2c — TemplatePicker

- `#auto-plantilla` becomes `<div id="auto-plantilla" class="zd-templates" role="radiogroup" aria-label="Plantilla">`.
- **Catalog and cache:** `cargarCatalogoPlantillas` also stores `catalogoPlantillas` (`{id, nombre, automatizacion}`) and calls `renderizarPicker()`. `detallesPlantilla` is a cache that `reiniciarAlta` clears.
- **`tarjetaPlantilla(fila)`** builds, in this order:
  - a `label` with `className = 'zd-template'`;
  - an `input` with `type='radio'`, `name='auto-plantilla-opcion'` and `value=id`, plus a `change` listener;
  - a `span` with `'zd-template__name'`;
  - a `span` with `'zd-template__desc'`, which reads `DESCRIPCIONES_PLANTILLA` through `Object.prototype.hasOwnProperty.call(DESCRIPCIONES_PLANTILLA, String(fila.automatizacion))`. An `undefined` label (the `elegirTenant` fixture at `consola.test.ts:368` has no `automatizacion`) becomes `'undefined'`, finds no own key, and gets the fallback. Never a throw, never a prototype key.
- **Descriptions:** `stock-fisico` is "Avisa cuando un producto queda por debajo del mínimo." and `stock-producible` is "Avisa cuando los insumos no alcanzan para producir." Other labels use "Plantilla del catálogo, sin descripción en la consola." There is no icon and no tolerance.
- **`elegirPlantilla(id)`** sets `plantillaElegida`, then reads `detallePlantilla(id)` (cache or GET). It is guarded by `plantillaElegida === id && g === generacionAlta`.
- `crearAutomatizacion` sends `plantillaId: plantillaElegida`. `selectorPlantilla` and its listener are removed.
- **Harness:** `arrancar()` (`consola.test.ts:336`) must create `auto-plantilla` as a `div`, not a `select`.
- **Tests:**
  - **G3′** replaces `:327`.
  - **W1**: one single-class card per template, with name and description text. It includes the fallback description for an unknown label and for the fixture's missing label.
  - **W8**: when two choices are in flight, the later one wins (deferred detail).
  - W10 and RW1-RW3 pick a card instead of the select.
- Estimate: `consola.ts` +72/−25, test +95/−25 (**~220**).

## PR3 — Step-2 Schedule (DEC-129)

**Markup:**

- `<select id="auto-frecuencia">` with the options `diaria` ("Todos los días"), `lun-vie` ("De lunes a viernes"), `lun-sab` ("De lunes a sábado") and `personalizado` ("Personalizado (expresión cron)").
- `<input id="auto-hora" class="zd-input" type="time" value="08:00">`.
- `<p id="auto-horario-texto" class="ayuda">`.

**Script** (concatenation only, no regex):

```js
var DIAS_FRECUENCIA = { 'diaria': '*', 'lun-vie': '1-5', 'lun-sab': '1-6' };
var DIGITOS = '0123456789';
function horaDe(texto) {
  if (typeof texto !== 'string' || texto.length !== 5 || texto.charAt(2) !== ':') { return null; }
  for (var i = 0; i < 5; i++) {
    if (i !== 2 && DIGITOS.indexOf(texto.charAt(i)) === -1) { return null; }
  }
  var h = Number(texto.slice(0, 2)), m = Number(texto.slice(3));
  return h <= 23 && m <= 59 ? { h: h, m: m } : null;
}
function cronDeFrecuencia(frecuencia, texto) {
  var hora = horaDe(texto);
  if (hora === null || !Object.prototype.hasOwnProperty.call(DIAS_FRECUENCIA, frecuencia)) { return null; }
  return hora.m + ' ' + hora.h + ' * * ' + DIAS_FRECUENCIA[frecuencia];
}
```

**`actualizarHorario()`:**

- `#auto-cron` is never hidden.
- For a preset, it sets `cron.readOnly = true` and `cron.value` to the result, or `''`.
- The sentence reads "Todos los días a las 08:30, en la zona horaria configurada del despliegue." When the hour is invalid it reads "Elegí una hora válida (HH:MM, 24 horas)."
- For `personalizado`, it sets `readOnly = false`, keeps the cron as a starting point, and shows "Expresión cron estándar de cinco campos, en la zona horaria configurada del despliegue. Se valida al crear."
- Listeners: the frequency `change`, and the hour `input` and `change`. `reiniciarAlta` sets `diaria`/`08:00`, then calls it.

**Creation:**

- With a preset and an invalid hour, the banner says "La hora no es válida. Escribí HH:MM en 24 horas, por ejemplo 08:30." and no request is sent.
- On the 201, the banner says "Se creó la automatización y ya aparece en la lista. Primera ejecución programada: dd/mm/aaaa HH:MM, zona horaria Z. Es un horario, no una garantía: si el servicio no está en marcha a esa hora, esa ejecución no se recupera." (DEC-95). The date and time come from `formatearInstante(iso, zona)`. That function calls `Intl.DateTimeFormat('es-AR', { timeZone: zona, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(...)` and assembles `dd/mm/aaaa HH:MM`. On a `RangeError` it falls back to the raw ISO.
- With no `proximaEjecucion` string in the body, the banner falls back to today's sentence.

**Tests:**

- **H1**: preset vectors, each also accepted by the server's `cronValido(·,'UTC')`:

  | Frequency | Hour | Cron |
  |---|---|---|
  | `diaria` | 08:30 | `30 8 * * *` |
  | `lun-vie` | 08:30 | `30 8 * * 1-5` |
  | `lun-sab` | 08:30 | `30 8 * * 1-6` |
  | `diaria` | 00:00 | `0 0 * * *` |
  | `lun-vie` | 23:59 | `59 23 * * 1-5` |
  | `diaria` | 07:05 | `5 7 * * *` |

  CH-23 reuses this table.
- **H2**: `personalizado` passes two vectors through unchanged: `30 7 * * 1` and `0 */2 * * *` (the spec's literal). The POST keys are unchanged.
- **H3**: `24:00`, `8:30`, `08:60`, `ab:cd`, `''` and `08:30:00` give an empty cron, the error sentence, and no request on Crear.
- **H4**: a 201 with `2026-10-06T11:30:00.000Z` in `America/Argentina/Buenos_Aires` gives a banner containing `06/10/2026 08:30` and the zone.
- **H5**: a legacy 201 without the field shows the old sentence.
- **H6**: a tenant switch resets to `diaria`/`08:00`.

| File | ± |
|---|---|
| `src/consola.ts` | +95/−10 |
| `src/consola.test.ts` | +185/−15 |
| **PR3 total** | **~305** |

## PR4 — Disabled With Reason (DEC-127)

**Mirror of `evaluarVistas`**, which reads the report's contract-ordered `entidades[]`:

```js
function entidadesNoAprobadas(declaradas, informe) {
  return informe.filter(function (fila) {
    return declaradas.indexOf(fila.entidad) !== -1 && fila.estado !== 'valida';
  }).map(function (fila) { return { entidad: fila.entidad, estado: fila.estado }; });
}
```

- `informe` yields `no-mapeada` for a missing row. A declared entity outside the contract cannot be saved (CH-12 checks), so the mirror does not need `evaluarVistas`'s throw.
- **Reason copy:** "No disponible con esta conexión: receta_componente (sin vista registrada). Cada ejecución se frenaría antes de conectar." The state words come from `MOTIVOS_VISTA`:

  | State | Text |
  |---|---|
  | `no-mapeada` | sin vista registrada |
  | `no-validado` | vista sin validar |
  | `invalida` | la validación de la vista falló |

**`sondearConexion()`** runs on the connection `change`:

1. It increments `generacionSondeo` and re-enables every card.
2. `#auto-aviso` shows "Verificando las vistas canónicas de la conexión elegida…".
3. It fetches the probe and then each detail. Every step drops its response unless both tokens are still current.
4. `aplicarVeredictos()` sets `input.disabled` and the `span.motivo-plantilla` text and `hidden`. It also deselects a chosen template that became disabled, clearing its values and Siguiente.
5. On any null, non-200 or malformed response, the affected cards stay enabled. `#auto-aviso` then shows "No se pudo verificar el mapeo de esta conexión. Las plantillas quedan habilitadas; la compuerta de vistas se aplica igual en cada ejecución."

**Bridge CSS:**

- `.zd-template:has(input:disabled)`: `cursor: not-allowed; background: var(--surface-sunken); border-style: dashed`.
- `:hover` on the disabled card keeps `--border-2`.
- `.motivo-plantilla`: `font-size: var(--text-help); color: var(--warn-text)`.

**Tests:**

- **V1**: shared vectors that run through the UI and through the server's imported `evaluarVistas`. The enabled state must equal `ok`, and the reason must name the same entities. The vectors:
  - all valid;
  - `no-mapeada`;
  - `no-validado`;
  - `invalida`;
  - DEC-127 `stock-fisico` `['producto','receta_componente']` without `receta_componente`. The report's M4 block says `aplicable`, and the test ignores it.
- **V2**: no raw state code in the text.
- **V3**: a chosen template that becomes disabled is deselected.
- **V4**: a deferred probe for an earlier connection is discarded.
- **V5**: a 500 or non-JSON response fails open with the note.
- **V6**: a tenant switch mid-probe discards the probe.
- **V7**: creation still works after a failed probe, with an unchanged body.

| File | ± |
|---|---|
| `src/consola.ts` | +85/−5 |
| `src/consola.test.ts` | +180 |

## PR5 — N3 Preview (DEC-131)

**Static block in step 2** (`role="group" aria-label="Vista previa del correo"`, `zd-card`):

- "Asunto: `<span id="auto-vista-asunto">`".
- "Para: `<span id="auto-vista-para">`".
- `<p id="auto-vista-titulo" class="vista-correo__titulo">`.
- A note: "Debajo del título va una tabla cuyas columnas son los alias de la consulta de la plantilla. Si la consulta no devuelve filas, no se envía correo. n es la cantidad de filas; lleva + cuando el resultado se cortó en el tope."
- The footer "Enviado automáticamente por ZeroDashboard.".

**Script:**

- `TEMAS_CORREO` copies the three labels of `correo.ts:123-127` (literal emoji). `TEMA_NEUTRO` is `#6b7280` with no emoji.
- `temaCorreo` looks the label up through `hasOwnProperty`.
- `asuntoVistaPrevia(nombre, etiqueta)` returns `prefijo + nombre + ' (n)'`.
- `actualizarVistaPrevia()` runs on Siguiente and on the recipient `input`. It sets the `textContent` of the subject, the title and the recipient ("sin destinatario: la ejecución no envía correo"), and sets `style.backgroundColor` on the title.
- Bridge `.vista-correo__titulo` (padding, `--text-on-accent`).
- `Nodo` gains a `style` field.

**Tests:**

- **E1**: the subject, which carries the literal `(n)` placeholder, equals `asuntoCorreo({nombre, automatizacion, filas: 0, hayMas: false})` once the trailing ` (0)` is replaced by ` (n)`. This is checked for `stock-fisico`, `stock-producible`, `reporte-diario`, `otra` and `constructor`, with ordinary names (see the accepted divergence: no `unaLinea`, no 200-character cut).
- **E2**: the accent matches the `background:` in `componerCorreo(...).html` for the same labels.
- **E3**: a hostile `nombre` renders verbatim through `textContent`. The document has no `inner`+`HTML` and no `src`+`doc`.
- **E4**: the preview nodes have no children (no row content, rule 5). The footer string is in both the document and `componerCorreo(...).texto`.

| File | ± |
|---|---|
| `src/consola.ts` | +45 |
| `src/consola.test.ts` | +115 |

## Sequence Diagrams

**Wizard open and connection fetch (PR2a/2b)**

```
Operator   console script                          API                     isolation ext
 |click Nueva|                                      |                          |
 |---------->| tenantActivo? no -> SIN_TENANT banner, stop                     |
 |           | reiniciarAlta(): g = ++generacionAlta; clear cache/values/select |
 |           | irAPaso(1): marca-1 aria-current=step, paso-2 hidden             |
 |           | pedir('/conexiones') + X-Tenant-Id ->|                          |
 |           |                                      | onRequest: not exempt, tenant resolved
 |           |                                      | conexion.findMany(select id,nombre;
 |           |                                      |  nombre,id; take 201) -->| AND tenantId
 |           |<- 200 {conexiones, truncado} --------|                          |
 |           | g === generacionAlta ? render options : drop                    |
 |           | empty -> #auto-aviso; Siguiente stays disabled                  |
```

**Step-1 gate probe (PR4)**

```
change #auto-conexion -> s = ++generacionSondeo; cards enabled; aviso "Verificando..."
  GET /conexiones/:id/validacion-mapeo ---------> 200 {validacionMapeo:{entidades[]}}
  (g,s) stale? -> drop        non-200/null -> fail open + aviso, stop
  for fila in catalogoPlantillas (sequential):
     detallePlantilla(id): cache | GET /plantillas/:id -> entidades
     (g,s) stale? -> drop
     veredicto[id] = textoMotivo(entidadesNoAprobadas(entidades, informe))
  aplicarVeredictos(): disabled + motivo; deselect chosen if disabled; actualizarSiguiente()
```

**Create with first run (PR3 + PR1)**

```
click Crear -> preset && horaDe(hora) null? -> banner, no request
  POST /automatizaciones {plantillaId, conexionId, valores, cron, destinatario?}
    AJV -> cronValido(cron, zona) -> direccionValida -> plantilla.findUnique
    -> conexion.findUnique (scoped) -> prepararSentencia -> automatizacion.create
    -> proximaEjecucion(cron, row.creadaEn, zona)
  <- 201 {automatizacion, proximaEjecucion: ISO, zonaHoraria}
  g current? -> cerrarAlta(); mostrarConfirmacion(formatearInstante(iso, zona) + zone + DEC-95);
               listarAutomatizaciones()
```

## Interfaces

```ts
// POST /automatizaciones -> 201 (additive)
{ automatizacion: AutomatizacionCompleta; proximaEjecucion: string /* ISO 8601, UTC */; zonaHoraria: string /* IANA */ }
// GET /conexiones -> 200 (scoped, X-Tenant-Id required)
{ conexiones: { id: string; nombre: string }[]; truncado: boolean }
export function proximaEjecucion(cron: string, desde: Date, zona: string): Date;
export const ConexionListada: { readonly id: true; readonly nombre: true };
```

## Threat Matrix

| Boundary | Applicability | Response / tests |
|---|---|---|
| Documentation-like paths, git selection, commit, push and PR commands | N/A: no VCS/PR automation, nothing is classified or executed by path | — |
| New scoped route (rule 2) | **Applicable** | Not exempt. The extension conjoins `tenantId`. Tests R2, C1, C3, T2-L, S1 |
| Credential projection (rule 7) | **Applicable** | The `{id,nombre}` select never fetches `credencial`. Tests C1, T2-L, S1 |
| Browser markup injection (stored names) | **Applicable** | Only `textContent` and CSSOM are used. Tests E3 and the existing no-`innerHTML` guard |
| Cross-tenant late response (T4) | **Applicable** | Generation tokens. Tests W5, W6, W10, V4, V6 |

## Migration / Rollout

There is no migration, env var or dependency. Merge order: PR0, PR1, PR2a, PR2b, PR2c, PR3, PR4, PR5.

**Rollback** goes in reverse order:

- PR5 and PR4 are independent console-only reverts.
- **Revert PR3 before PR1**: the banner reads `proximaEjecucion` (H5 tolerates its absence, but the order is kept).
- PR2c restores the select.
- **Revert PR2b before PR1**: the dropdown needs `GET /conexiones`.
- PR2a restores the flat form.
- PR1 removes the route and the two fields.

## Open Questions (from the proposal), Resolved

- **Wizard ids**: see the decision table. `auto-plantilla` is reused as the picker container.
- **Cap and order**: `LIMITE_LISTADO`, ordered by `nombre`, then `id`.
- **No connections, or probe failure**: an advisory note. The probe fails open.
- **Siguiente**: requires a connection and an enabled template.
- **Hour control**: `type="time"` with string checks.

None blocking. A browser check of `:has()`, the disabled card and focus order is left to manual verification, because the fake DOM cannot render.
