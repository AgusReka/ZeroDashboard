# Exploration: CH-21c Two-step automation creation in the console (D2) and email format tied to the template (N3)

Date: 2026-10-05. Decisions to register BEFORE implementing: DEC-129 onward (last registered entry is DEC-128, `docs/01-decisiones.md:2322`). Decisions are the user's (`AGENTS.md`). Everything marked "recommended" is a proposal, not a decision.

## Current state

### What the operator does today

Everything lives in one static `<section id="automatizaciones">` (`src/consola.ts:184-208`) and one inline script. The flow is flat:
1. Pick a template in `#auto-plantilla`, a `<select>` (`consola.ts:188-189`). `cargarCatalogoPlantillas()` fills it from `GET /plantillas` (`:1131-1148`).
2. `elegirPlantilla()` (`:1152-1167`) does `GET /plantillas/:id` and builds one control per declared parameter into `#auto-valores` (`rotular()`, `controlDeValor()` at `:621-650`). A late response for an older choice is ignored (`:1159`).
3. Type the connection as a free-text UUID in `#auto-conexion` (`:192-193`).
4. Type a raw five-field cron in `#auto-cron` (`:195-196`).
5. Optionally type one email in `#auto-destinatario` (`:198-199`).
6. Click `#auto-crear` (`:202`). `crearAutomatizacion()` (`:1198-1230`) POSTs `{plantillaId, conexionId, valores, cron, destinatario?}`; on 201 a banner says it was created and the list reloads.
7. The list (`#auto-lista`, `:1169-1191`) shows Plantilla, Conexión, Horario (raw cron), Estado, Creada, with Ver ejecuciones and Desactivar. Runs go in `#auto-ejecuciones` (`:1268-1288`).

### Missing versus C-11 to C-13 (`pantallas.md:62-77`, `ui_kits/consola/ScreenAutomatizaciones.jsx:27-57`)

| Skill element | Console today |
|---|---|
| Stepper with two steps | None; one long form |
| Step 1 TemplatePicker (card grid with description and icon) | Plain `<select>` with names only |
| Disabled template with reason (C-12) | Nothing; the gate runs only at execution time |
| `nombre` | None |
| `consulta_guardada_id` | None, and by design |
| `frecuencia` (enum) plus `hora` | Raw cron text |
| `destinatarios` list | One optional address |
| `primera_ejecucion` computed | Not computed anywhere |
| Per-field validation | One shared banner |
| Email format preview (C-13) | None |
| "Nueva automatización" action (C-10) | Form always visible |

The skill's C-11 list has no connection; the API requires `conexionId`, so the console keeps that field.

### Constraints inherited from CH-21a (re-verified)

- `src/consola.ts` is 1,347 lines; the document is one TypeScript template literal; stylesheet link and bridge `<style>` are in (`:41-105`).
- The script assigns `className` wholesale (`banner` `:381,389,396`, `indicadorTenant` `:509,514`, `parametro*` `:648-676`, `corte` `:470`, `nulo` `:438`, `tr.className` `:1063`, `td.className` `:1074`, `boton()` `:1121`).
- `Nodo.porClase` compares `className` by strict equality (`consola.test.ts:107-114`): single-class strings such as `'zd-template'` work; multi-class strings would need exact-string assertions or a token-aware `porClase`.
- G3 asserts `!script.includes('zd-')` (`consola.test.ts:327`, commented "(CH-21c)"): CH-21c must replace it.
- The spec requires the inline script to stay "byte-identical to the script before this change" (`openspec/specs/query-console/spec.md:11`); that clause is relative to CH-21a and must be MODIFIED by the CH-21c delta.
- The fake DOM `Nodo` (`consola.test.ts:25-115`) has `appendChild`, `removeChild`, `addEventListener`, `focus`, `textContent`, `value`, `options`; no `setAttribute`, `classList` or `dataset`. `getElementById` returns `null` for ids not in `IDS` (`:118-144`). `IDS_GUARDADOS` plus `verificarIds` (`:151-160`) is guard G1; the spec requirement "Console Markup Ids Are Guarded" (`spec.md:327-347`) must be modified for any id change.
- `fetch` in tests is a strictly ordered queue (`:201-215`); `elegirTenant` (`:358-373`) queues exactly three responses on a tenant switch (saved queries, `/plantillas`, `/automatizaciones`). Extra requests on tenant load shift every test.
- `scripts/smoke.sh` greps `/consola` for `sql`, `ejecutar`, `nombre`, `guardar`, `guardadas`, `barra-tenant`, `tenant`, `tenant-activo`, `type="button"`, `textContent`, `X-Tenant-Id`, no `innerHTML`, one `</script>` and the stylesheet link (`smoke.sh:292-312`, `:421-447`); none mentions `auto-*`.
- Template-literal hazards: no backtick, no `${`, newlines written `'\\n'`; by reasoning (not run) a regex like `/^\d\d:\d\d$/` would cook to `dd:dd`, so an hh:mm check must use `\\d` or string checks.

### What a two-step restructure would break

- Directly broken tests: `create builds value controls from the template…` (`consola.test.ts:803-840`, sets `auto-plantilla` as a `<select>` with `.value` and a `change` event) and the two recipient tests (`:881-897`, `:900-918`) if client-side step gating is added.
- Not broken if the load sequence stays `guardadas`, `/plantillas`, `/automatizaciones`: the list, runs and tenant-switch tests. The list test asserts the raw cron `'0 6 * * *'` (`:781`).
- New state must be wiped on tenant switch (T4, spec `:270-277`): step, connection, values, chosen template, probe results. Today `limpiarAutomatizaciones()` (`:1082-1089`) and the `change` handler (`:1293-1305`) do that.

## What the API accepts

- `POST /automatizaciones` (`src/automatizaciones-rutas.ts`): strict body (`:81-93`) `plantillaId`, `conexionId`, `valores` (default `{}`), `cron`, `destinatario` (1-254 chars); `additionalProperties: false`. Validation order (`:118-167`): AJV, `cronValido(cron, zonaHoraria)`, `direccionValida` on the trimmed recipient, template lookup (404), connection ownership (404), `prepararSentencia` (400 with `campos` and `problemas`). Response (`:173-183`): `{ automatizacion }` with `id, plantillaId, conexionId, cron, activo, creadaEn, valores, destinatario`; no first-run field. Creation does not evaluate the DEC-71 gate (only runs do).
- `Automatizacion` model (`prisma/schema.prisma:150-166`): no `nombre`, `frecuencia`, `hora` or recipient list. `Plantilla` (`:122-132`): no `descripcion` or `icono` (DEC-128).

| C-11 field | Backing | In CH-21c? |
|---|---|---|
| `plantilla_id` | `plantillaId` | Yes |
| connection (not in C-11) | `conexionId` | Yes, required |
| parameters | template declaration; all mandatory (DEC-50) | Yes; do not reproduce "optional" |
| `frecuencia` + `hora` | none; expressible as cron (DEC-76) | Yes, as UI translation |
| `destinatarios` list | single `destinatario` (DEC-82); the mockup help "Separá varios destinatarios con coma" contradicts DEC-82 | One address only |
| `primera_ejecucion` | none | Yes if the server computes it |
| `nombre` | none; DEC-79 means no edit | Recommend out (limit of the artifact); alternative is a nullable column (~60 lines) |
| `consulta_guardada_id` | none, and conceptually wrong (template owns the SQL, DEC-85, DEC-126; `src/planificador.ts:356-363`) | Out (rule 6) |

### Cron and first run

- `cron-parser` 5.10.1 is imported only in `src/automatizaciones.ts:1` (DEC-76); server-only (no bundler). `cronValido` (`:63-74`), `estaVencida` (`:93-105`). First run = `CronExpressionParser.parse(cron, { currentDate: creadaEn, tz: zona }).next()`, a ~3-line pure function. The tick runs one second past each minute (`planificador.ts:116`); DEC-95: missed fires are never recovered, so the first run is a schedule, not a promise.
- The zone is deployment-wide (DEC-77); `DEFAULT_ZONA_HORARIA` is `'UTC'` (`config.ts:49`). Demo pitfall: an Argentine operator who picks "08:00" gets 08:00 UTC (05:00 local) with the default config; the console cannot see the zone today. A client-side first-run computation is wrong whenever the browser zone differs from the server's: it must come from the server.

## Template selection and disabled-with-reason

Existing data without new endpoints: `GET /plantillas` (id, nombre, automatizacion, formato, toleranciaFrescuraMinutos), `GET /plantillas/:id` (adds sql, parametros, entidades), `GET /conexiones/:id/validacion-mapeo` (scoped, never dials; `entidades[]` with `estado` in `no-mapeada | no-validado | valida | invalida`). The server gate is `evaluarVistas` (`plantillas.ts:85-102`): each declared entity needs `estadoValidacion === 'valida'`. The console can mirror it (~12 lines plus a reason-copy map). M4's per-automation block is keyed by label and disagrees with the gate for `stock-fisico` (DEC-127), so derive from the template's own entities. Rejected: using `POST /plantillas/:id/prueba` as a gate probe (relies on check ordering). Creation stays ungated; the UI hint is advisory, the run-time gate stays authoritative.

The connection is chosen after the template today and as free text. Disabled-with-reason needs the connection at step 1, so the connection field moves above the picker. There is no `GET /conexiones` route (only `POST /conexiones` and `POST /conexiones/:id/prueba`); a dropdown needs a new scoped route returning `{id, nombre}` (safe projection exists as `ConexionPublica`, no `credencial`); that is a user decision.

## N3 and the email format

- Already tied to the template by label: `Plantilla.formato` has one value (`correo-html`, DEC-65); `componerCorreo` (`correo.ts:193-214`) picks accent and emoji from `TEMAS` keyed by the template's `automatizacion` label (`:123-133`); subject `{emoji} {nombre} ({n}{+})` (`:149-163`); columns are the SQL aliases. DEC-85 (c) says per-template stored HTML "es N3". `texto_sin_datos` conflicts with DEC-84 (no rows, no send).
- A step-2 preview would need: no server endpoint renders a sample without dialing a connection; the console forbids markup-assigning properties (`consola.ts:11-16`, test `:268-274`, smoke `:296`), so an `iframe.srcdoc` is out. A DOM-built, `textContent`-only schematic (subject, title bar in the label's accent, a note about columns, footer) is feasible, with a small client map of `TEMAS` and a parity test against `asuntoCorreo`.
- Configurable per-template email content (new columns, strict schema change, renderer change, CH-21b seeds) is a separate, larger change that touches the notification path DEC-107/108 protect.

## Description and icon

DEC-128 left them to CH-21c "como `TEMAS` en `src/correo.ts`". A console-only map keyed by the `automatizacion` label (~8 lines) is sufficient; sample copy in `datos-muestra.js:35-36`. Skip icons (inline SVG cannot be built with `createElement` plus `textContent`; `Nodo` has no `createElementNS`). Do not show `toleranciaFrescuraMinutos` (provisional, unenforced, DEC-66/128). Keep the map standalone: the panel (CH-22b) needs different business-language copy (`lenguaje.md:5-20`).

## Visual building blocks available

Served CSS has `.zd-templates`, `.zd-template` (`:has(input:checked)` selected state), `.zd-template__icon/name/desc/check`, `.zd-steps`, `.zd-step` (`is-done`, `aria-current="step"`), `.zd-sr`, `.zd-form`, `.zd-form-row`, `.zd-form-actions`, `.zd-card`, `.zd-kv` (`public/ui/components/components.css`). `.zd-template` has no disabled style: a ~3-line bridge rule is needed. `aria-current` needs `setAttribute`/`removeAttribute` in the script and ~8 lines of stubs in `Nodo`. `[hidden]{display:none !important}` is already in the bridge (`consola.ts:43`). Stepper and panels are static markup (`zd-*` allowed); picker cards are script-built with single-class strings.

## Approaches

### Schedule representation (the cron decision, USER's)

| # | Approach | Translation lives in | API change | Effort | Fit for the panel |
|---|---|---|---|---|---|
| a | Keep the raw cron field only | n/a | none | Lowest | Misses C-11's frequency and hour |
| b | Frequency and hour presets build a 5-field cron in the script; cron shown read-only with a Spanish sentence; a "personalizado" option reveals the raw cron | Console script | none | Low (~45 script lines plus tests) | Mapping is 3 lines for the panel; pin it with a shared vector table in tests |
| c | Server preview endpoint computes cron, sentence and first run live | Server | new scoped route plus T2 sweep row | Medium-high | Reusable |
| d | `POST /automatizaciones` accepts optional `frecuencia` and `hora`, translates server-side | Server module `src/horario.ts` | body schema change; two ways to specify a schedule | Medium (~120 server lines) | Reusable by CH-23; operator cannot see the cron before submit |

First-run sub-options: P0 none; P1 the server returns `proximaEjecucion` (ISO instant) and `zonaHoraria` in the 201 body (additive, ~25 lines plus tests; existing 201 tests only assert `.automatizacion.*`), shown in the success banner; P2 live preview through (c).

Recommended (user decision): **b plus P1**. Enum for the console: `diaria` (`M H * * *`), `lun-vie` (`M H * * 1-5`), `lun-sab` (`M H * * 1-6`), `personalizado` ("Cada N horas" falls under it). Hour input `<input type="time">`, validated with string checks. Pre-creation text is generic ("en la zona horaria configurada del despliegue"); the zone shows in the success banner. The panel should never accept raw cron from a P2 client: CH-23 builds cron on the server from `{hora, dias}`.

### Template step

| # | Approach | Pros | Cons | Effort |
|---|---|---|---|---|
| 1 | Picker from `GET /plantillas`, no gating | Smallest | Does not meet "deshabilitada con motivo" | Low |
| 2 | Picker plus client mirror of the gate using the two existing GETs once a connection is entered (recommended) | No new endpoint; DEC-127-aligned | Mirrors `evaluarVistas`; one `GET /plantillas/:id` per template (N+1 over a capped list) | Medium (~60 lines plus tests) |
| 3 | New route returning the gate verdict per template and connection | Single source of truth | New endpoint, T2 row, DEC; not needed for two templates | Medium-high |

Fetch per-template details lazily on connection entry (not on tenant load) to keep the three-response queue intact.

### Connection input

Keep the free-text UUID (cheapest, demo-hostile) or add `GET /conexiones` returning `{id, nombre}` (~25 lines plus a test and a T2 row) for a dropdown.

## Recommendation (all of it the user's decision)

1. Wizard per C-10/C-11: a "Nueva automatización" button reveals the wizard; a static `.zd-steps` stepper; step 1 holds the connection above the TemplatePicker; step 2 holds parameters, schedule, one recipient and a read-only email preview with Volver and Crear automatización. `crearAutomatizacion` keeps the same POST body.
2. Keep ids `auto-conexion`, `auto-cron`, `auto-destinatario`, `auto-crear`, `auto-valores`, `auto-lista`, `auto-ejecuciones`; retire `auto-plantilla` as a `<select>` (reuse or rename); update `IDS`, `IDS_GUARDADOS` and the spec guard requirement deliberately.
3. Schedule: b plus P1. 4. Disabled-with-reason: approach 2, advisory. 5. N3: met at label level (DEC-65, DEC-85 a); add the read-only preview; configurable per-template email is a documented limit. 6. Description: console-only code map by label; no icons, no tolerance on cards. 7. Omit `nombre`, `consulta_guardada_id`, recipient lists, optional parameters, per-field inline errors, a pre-creation first-run endpoint and any editing.

## Scope and size (400 lines per PR; estimates include the ~1.7x test multiplier)

Console JS stays in `src/consola.ts` (DEC-124 A5).

| PR | Content | Est. lines |
|---|---|---|
| PR0 | DEC-129 to DEC-131 (docs) | ~100 |
| PR1 | Server: `proximaEjecucion` in `automatizaciones.ts` (+15), 201 body additions (+10), unit and live tests (+65); optional `GET /conexiones` (+25 route, +45 test with T2 row) | ~90, or ~160 with `GET /conexiones` |
| PR2 | Console shell: stepper, two panels, "Nueva automatización", connection field in step 1, picker plus description map, step navigation, unchanged POST; `Nodo` gains `setAttribute`; rewrite the 3 broken tests; replace G3; spec delta | ~380 |
| PR3 | Step 2 schedule: presets, read-only cron plus sentence, personalizado, success banner with first run, tenant-switch reset | ~330 |
| PR4 | Disabled-with-reason: probe on connection entry, reasons map, stale-response guard, bridge CSS for the disabled card | ~250-300 |
| PR5 | N3 preview (subject, title, accent, parity test against `asuntoCorreo`) and archive notes | ~150-200 |

Total ~1,000-1,150 lines in six PRs. Minimum viable demo: PR0 to PR3 (a coherent two-step flow); PR4 and PR5 are separable.

## Rules and anti-scope

1 not touched (P1 console). 2: tenant travels as `X-Tenant-Id` through `pedir()` (DEC-15; `consola.ts:581-595`), the body never names a tenant; new calls are scoped; a new route needs a T2 sweep row. 3 and 4 not touched; values still go through `prepararSentencia`. 5: the preview shows no row content. 6: `proximaEjecucion` is a pure read-side computation; do not add `consulta_guardada_id`, multiple recipients or per-template email content to the engine. 7: `GET /conexiones`, if added, never projects `credencial`. Design skill: `zd-*` on static markup and single-class picker cards; no emoji in UI copy; voseo; sentence case; no `innerHTML`, no `srcdoc`.

## Risks

Gate drift (advisory only; run-time gate authoritative); stale async results across a tenant switch (generation token); state not wiped on tenant switch (T4); the strict `fetch` queue in tests; template-literal hazards; spec and guard changes (G3, byte-identical clause, id guard); timezone (presets mean the deployment zone, default UTC); no catch-up (DEC-95); accessibility depends on `setAttribute` and `:has()` and the disabled card is bridge-only; UUID entry looks unfinished in a recorded demo without `GET /conexiones`; client copy of `TEMAS` guarded only by a parity test; PR2 sits at the edge of 400 lines.

## Open decisions (all the user's)

1. Schedule representation (a/b/c/d plus P0/P1/P2), DEC-129. Recommended b plus P1.
2. C-11 fields without backing, DEC-130. Recommended: omit `nombre`, `consulta_guardada_id`, recipient lists and optional parameters.
3. N3 scope and the description map, DEC-131. Recommended: read-only preview, label-based theme, console-only copy map, no icons.
4. Connection input: free text or `GET /conexiones` (a design-level resolution under DEC-127, or a new DEC if the route is added).
5. PR split (six PRs above).

Draft DEC-129, DEC-130 and DEC-131 (Contexto, Opciones, Decisión, Por qué, Se resigna, Estado; Spanish) are re-derived from this document when the user decides; their substance is the Recommendation and Open decisions above.

## Not verified

Rendering in a browser (including `:has()`, the disabled card, focus order); the `\d` template-literal cooking (reasoned, not run); `cron-parser` behaviour for `1-5`/`1-6` ranges and the 201 body in live tests; whether the isolation extension allows `conexion.findMany` for a new `GET /conexiones`; the T2 sweep row shape for a new route; payload size of `validacion-mapeo`; how many connections a demo tenant has.

## Ready for Proposal

Only after the user answers the open decisions and DEC-129 to DEC-131 are registered in `docs/01-decisiones.md` (`AGENTS.md`; `docs/02-mapa-de-changes.md`, CH-21c note).
