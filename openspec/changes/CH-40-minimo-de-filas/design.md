# Design: CH-40 — Minimum rows per automation

Inputs: proposal.md, the four delta specs, DEC-186 (b), DEC-193 (exploration decisions 1–2), DEC-174. Delivered as one PR (exploration decision 3(a)).

## 0. One refinement of DEC-186's "Forma"

DEC-186 says the minimum is loaded in the console's create form and keeps the panel out. DEC-174 says the operator adjusts in place what it loads at creation. The console adjust therefore takes `minimoFilas` too (DEC-193 1(a)); the panel adjust (P-04) does not. Recorded in DEC-193 as a precision of DEC-186, together with the cap rule (§3).

## 1. Model and migration

- `prisma/schema.prisma`, `Automatizacion`: `minimoFilas Int @default(1)`, after `destinatario`. The doc comment gains a CH-40 paragraph: integer, 1 to the row cap, validated in the application, set at creation and in the operator adjust, never in the panel.
- Migration `20261103000000_automatizacion_minimo_filas`: `ALTER TABLE "Automatizacion" ADD COLUMN "minimoFilas" INTEGER NOT NULL DEFAULT 1;`. The default fills existing rows; no backfill, no check constraint (the upper bound is runtime configuration, so a database constraint could only hold the lower one, and the application already owns both).
- `Ejecucion` does not change: `notificacion` is TEXT typed in code.

## 2. Outcome types (`src/automatizaciones/automatizaciones.ts`)

- `EstadoNotificacion` and `OmisionNotificacion` gain `'omitida-bajo-minimo'`, next to `'omitida-sin-filas'`.
- `export const MINIMO_FILAS_POR_DEFECTO = 1`: the one place the code states the default, used by the create route when the body has none. The migration's `DEFAULT 1` must match it; a test pins the pair (§6).
- `cierreConNotificacion` does not change: it already writes any string omission as it comes.

## 3. Decision (`decidirNotificacion`)

New signature: `decidirNotificacion(r, destinatario, configurado, minimoFilas)`. The order follows the spec's table:

```ts
if (r.resultado !== 'ok') return { enviar: false, notificacion: null };
if (r.filas.length === 0) return { enviar: false, notificacion: 'omitida-sin-filas' };
if (r.filas.length < minimoFilas && !r.paginacion.hayMas) {
  return { enviar: false, notificacion: 'omitida-bajo-minimo' };
}
// recipient, SMTP, send: unchanged
```

- With `minimoFilas = 1` the new branch is unreachable: any non-empty result has at least one row. That is the whole backward-compatibility argument (DEC-84).
- `hayMas` (DEC-193 2(a)): the scheduler reads one page of `maxFilasPorConsulta` rows, so `filas.length` never exceeds the cap. A cut result had more rows than were read and counts as reaching the minimum. This only matters when the cap was lowered after the automation was created; otherwise `minimoFilas ≤ cap` already holds.
- The function stays pure; `minimoFilas` is a plain number, read by the caller.

## 4. Routes (`src/automatizaciones/automatizaciones-rutas.ts`)

### 4.1 Shared rule

```ts
/** CH-40 (DEC-186): an integer from 1 to the engine's row cap. */
export function minimoFilasValido(valor: number, tope: number): boolean {
  return Number.isInteger(valor) && valor >= 1 && valor <= tope;
}
```

- **Coercion.** The schemas declare `minimoFilas: { type: 'integer', minimum: 1 }`. Under Fastify's default AJV options `"5"` becomes `5` and `2.5` or `"abc"` fail the type, like `puerto` and `limite` already do. DEC-60's no-coercion rule is for `valores`, whose JSON type changes the SQL parameter; here it does not. The schema refusal is reported through `camposInvalidos` as `/minimoFilas`, the same pointer the handler uses.
- **Upper bound.** Not in the schema, because the cap is configuration. `registerAutomatizacionRoutes(app, prisma, zonaHoraria, topeFilas)` receives it from `src/server.ts`'s one `loadConfig()` through `DependenciasRutas.topeFilas`, exactly as `zonaHoraria` arrives (DEC-77). The environment does not change while the process runs, so it is the cap the scheduler reads its page with.
- **Apply-time refinement (2026-11-03).** The first draft read `loadConfig()` per request. It was dropped during apply: `loadConfig()` also validates the master key and requires `APP_PORT`, so every pure route test would have had to fake the whole environment, and the route file already takes its other configuration as a parameter.

### 4.2 Create (`POST /automatizaciones`)

- `RegistroAutomatizacionBody` gains `minimoFilas?: number`; `registroAutomatizacionSchema` lists it in `propertyNames.enum` and `properties` (strict schema, `removeAdditional`).
- Pure check, right after `direccionValida` and before any read: `const minimoFilas = request.body.minimoFilas ?? MINIMO_FILAS_POR_DEFECTO;` and, if `!minimoFilasValido(minimoFilas, tope)`, `400 { error: 'solicitud-invalida', campos: ['/minimoFilas'] }`.
- `create` writes `minimoFilas`. `AutomatizacionCompleta` adds `minimoFilas: true`, so create, get, deactivate and adjust return it. `AutomatizacionResumen` (the list) does not change.

### 4.3 Operator adjust (`PUT /automatizaciones/:id/ajustes`)

- `ajusteOperadorSchema`: `minimoFilas` in `propertyNames.enum` and `properties` (`{ type: 'integer', minimum: 1 }`); `minProperties: 1` stays.
- `CuerpoAjusteOperador` and `DatosAjusteOperador` gain `minimoFilas?: number`.
- `resolverAjusteOperador(cuerpo, plantilla, zona, tope)`: a new block after `destinatario`, pushing `/minimoFilas` when invalid, so every offender is still named together. The handler passes `topeFilas`.
- The `update` spreads `minimoFilas` like the other keys. Ownership, `404` and `409` are unchanged: the scoped `findUnique` already answers another tenant's id with `404` before anything is resolved.
- `panel-ajustes.ts` does not change; its strict schema keeps refusing an unknown `minimoFilas`.

## 5. Scheduler (`src/automatizaciones/planificador.ts`)

- `AutomatizacionACorrer` gains `minimoFilas: number`; the due-automations select (`:~495-503`) adds `minimoFilas: true`.
- `notificar` passes `automatizacion.minimoFilas` to `decidirNotificacion`. Nothing else changes: the skip returns `{ salida: decision.notificacion, respaldo: null }` like the other omissions, and the single close `update` writes it.

## 6. Console (`src/consola/consola.ts`)

### 6.1 Create wizard, step 2

- Markup, after `auto-destinatario`:
  ```html
  <label for="auto-minimo" class="zd-label">Mínimo de filas para avisar</label>
  <input id="auto-minimo" class="zd-input" type="number" min="1" step="1" value="1" inputmode="numeric">
  <p class="ayuda">El correo sale solo si la consulta devuelve al menos esta cantidad de filas.</p>
  ```
  No `max`: the cap lives in the server's configuration and the 400 names the field.
- Email schematic: a new `<p class="ayuda">Se envía con: <span id="auto-vista-minimo"></span></p>`, filled by `actualizarVistaPrevia()` with «1 fila o más» or «N filas o más», and refreshed on the field's `input` event.
- Body: `alta.minimoFilas = numeroDeMinimo(entradaMinimo.value)`, always sent. `numeroDeMinimo` returns `Number(texto)` when the trimmed text is all digits, and the trimmed text otherwise, so a non-number reaches the server and comes back as `400 /minimoFilas` with the field named, instead of a second client-side rule.
- Reset: the wizard's reset puts the field back to 1.
- `mensajeDe400DeAutomatizacion` gains a branch: `/minimoFilas` → «El mínimo de filas tiene que ser un número entero desde 1 hasta el tope de filas del motor.»

### 6.2 Adjust pop-up

- Markup, after `aj-destinatario`: label «Mínimo de filas para avisar» and `<input id="aj-minimo" class="zd-input" type="number" min="1" step="1" inputmode="numeric">`.
- Filled from `guardada.minimoFilas` (`String(...)`, `'1'` when absent, for a server older than this change).
- `estadoAjuste()` gains `minimo: entradaMinimoAjuste.value.trim()`; `hayCambiosEnAjuste()` compares it; the save adds `cambios.minimoFilas = numeroDeMinimo(ahora.minimo)` when it changed. The same `mensajeDe400DeAutomatizacion` covers the 400.

### 6.3 Runs view

- `ETIQUETAS_NOTIFICACION['omitida-bajo-minimo'] = 'No enviada: menos filas que el mínimo'`.

### 6.4 Guards

- New ids `auto-minimo`, `auto-vista-minimo`, `aj-minimo` go into `IDS` in `consola.test.ts`. No `zd-*` token is added to the script (G3'): the classes live in the markup only.
- The exact request-body tests for create and adjust gain `minimoFilas`.

## 7. Tests

- `automatizaciones.test.ts` (pure): the precedence table row by row: zero rows with minimum 5 → `omitida-sin-filas`; 3 rows with minimum 5 → `omitida-bajo-minimo`; 5 rows with minimum 5 → send; 20 rows, `hayMas`, minimum 50 → send; 3 rows, minimum 5, no recipient → `omitida-bajo-minimo`; minimum 1 with 1 row → send. The closed value set (`permitidos`) gains the value. `minimoFilasValido`: 1, cap, 0, cap + 1, 2.5.
- `automatizaciones-rutas.test.ts` (DB): create with 5, without (→ 1), with 0 / cap + 1 / 2.5 / `"5"`; `MAX_FILAS_CONSULTA` lowered for one case; adjust with 10, with 0, with another tenant's id (→ 404, row unchanged, in the T2 sweep); the runs listing shows `omitida-bajo-minimo`.
- `planificador.test.ts` (DB): a due automation with minimum 5 and 2 rows closes `ok`/`omitida-bajo-minimo` with `filas: 2` and no send; a row inserted without the column reads 1 (pins migration default = `MINIMO_FILAS_POR_DEFECTO`).
- `panel-ajustes-rutas.test.ts`: `minimoFilas` in the panel body is `400` (strict schema).
- `consola.test.ts`: the three ids, default 1 and its preview text, create body with `minimoFilas` 5 and 1, the `/minimoFilas` message, adjust prefill and the `{ "minimoFilas": 10 }` body, the new label.

## 8. Docs

- `docs/guia/06-automatizaciones.md`: the minimum (what it is for, default, range), the new outcome, and that the panel does not show it.
- `guidelines/consola.md` (both copies of the design skill): the automations entry gains the field in create and adjust.
- `docs/01-decisiones.md`: DEC-193 (§0 and §3), on branch `v2/dec-193` from `master`.
- `docs/02-mapa-de-changes.md`: PR numbers for CH-37 (#211), CH-38 (#214), CH-39 (#215, #216), and CH-40's own at close.

## 9. Rejected alternatives

- **A nullable column with "null = no minimum".** It adds a third state that behaves like 1; DEC-186 fixes 1 as the default.
- **Comparing against `min(minimoFilas, cap)`.** Equivalent to the `hayMas` rule only when the result is exactly the cap; with `hayMas` the decision says why, from the result itself.
- **A `max` attribute in the console.** It needs the cap sent to the client for a rule the server already enforces and names.
- **A database check constraint.** It could only hold the lower bound; split validation in two places for no gain.

## 10. Size forecast

| Area | Lines |
|---|---|
| Schema + migration | ~12 |
| Types, default, decision | ~20 |
| Routes (create, adjust, rule) | ~40 |
| Scheduler | ~4 |
| Console (create, preview, adjust, label, message) | ~45 |
| Tests (pure, routes, scheduler, panel, console) | ~200 |
| Docs (guide, guideline ×2, map) | ~25 |
| **Total** | **~345** |

DEC-193 lives on its own branch (`v2/dec-193`) and is not counted. The specs are synced at archive. Under the 400 budget for one PR.
