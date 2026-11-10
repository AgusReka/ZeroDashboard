# Design: CH-48 — Panel dashboard

Inputs: proposal.md, the seven delta specs, DEC-183, DEC-184, DEC-198, DEC-199, DEC-200, DEC-201, DEC-202. Stories R3h, R4h, R5h.

## 0. What the design settles beyond DEC-201 and DEC-202

None of these changes a model or a boundary, so none needs a new DEC. They are listed so the user can object.

- **Queue bound of 8 per tenant.** One full dashboard can wait behind the 3 in flight. A second tab mostly joins the first through single-flight.
- **A corrupt stored report is still listed** in the configuration, with a null period, and its run answers `no-disponible`. The client sees an error card rather than a missing one, and the configuration never fails because of one report.
- **`zonaHoraria` travels in the configuration**, as it does in `GET /api/panel/automatizaciones`, so the page formats the freshness time and «Desde el dd/mm» in the deployment zone.
- **A run whose request closed while running is not cancelled.** The engine has no cancel (rule 6). Its answer is dropped, and its slot is freed when it ends.
- **The nav reuses `.zd-tabs` / `.zd-tab`** (the guide's component for sibling views) as hash links. One panel-local rule gives `aria-current="page"` the look of `aria-selected="true"`. The exploration said the panel had no nav component: the component exists, it was just not used in the panel.
- **New panel styles stay in the panel's own `<style>`** in `CABEZA_PAGINA`, with a `panel-` prefix and tokens only, as P-07 did. The five vendored stylesheets are not touched ("Vendored Files Are Verbatim").
- **The Telegram card moves below the list for every tenant**, not only when the nav shows. The markup stays static, and P-07 of the UX review applies to every client. Without reports, the page differs from today's only in that order.

## 1. Slice CH-48a — server

### 1.1 `ejecutarSobreVistas` (`src/ejecucion/ejecucion-sobre-vistas.ts`)

`PedidoSobreVistas.auditoria` becomes `{ origen; plantillaId; reporteId } | null`. With `null`, the `registrarEjecucion` call is skipped. Nothing else changes: the warn line, the gate and the answers stay. Every existing caller passes an object, so the type change is checked by `tsc`.

### 1.2 Shared run (`src/reportes/reporte-ejecucion.ts`, new)

Moved out of `reporte-prueba.ts`, with no change of behavior:

```ts
/** CH-48 (DEC-198): the requested days when declared, the first declared when none, else a refusal. */
export function diasDelPedido(periodo: Periodo | null, dias: number | undefined): number | null | 'rechazo';

export interface ReporteAEjecutar {
  id: string | null; sql: string; entidades: unknown;
  visualizacion: Visualizacion; periodo: Periodo | null;
}

export interface ContextoReporte {
  zonaHoraria: string; topeFilas: number; canales: AbridorDeCanales; ahora?: () => Date;
}

export type ResultadoReporte =
  | { tipo: 'dias-rechazados' }
  | { tipo: 'respuesta'; respuesta: RespuestaSobreVistas; periodo: { dias: number; desde: string } | null };

/** The one report run: days → date → `valores`, `topeEfectivo`, `limite = tope + 1`, first page. */
export async function ejecutarReporte(
  app: FastifyInstance, prisma: PrismaAislado, request: FastifyRequest,
  reporte: ReporteAEjecutar, pedido: { conexionId: string; dias?: number },
  contexto: ContextoReporte,
  auditoria: PedidoSobreVistas['auditoria'], mensajeFallo: string,
): Promise<ResultadoReporte>;
```

`probarReporte` in `reporte-prueba.ts` keeps its answer shape (`400 /dias`, `faltantes`) and calls `ejecutarReporte` with `{ origen: 'reporte-prueba', … }` and `'report test execution failed'`. `ColumnaAsignada` stays out of `ReporteAEjecutar`: only the callers read the columns.

### 1.3 Pure panel logic (`src/panel/panel-tablero.ts`, new)

```ts
export const EN_CURSO_POR_TENANT = 3;
export const EN_COLA_POR_TENANT = 8;
export type EstadoReporte = 'ok' | 'sin-datos' | 'no-disponible' | 'tiempo-agotado' | 'sin-conexion' | 'error';

/** `dias` from the raw query: absent, or a digits-only string. Any other key or shape is a refusal. */
export function leerDiasDeConsulta(query: unknown): number | undefined | 'rechazo';

/** The configuration entry of one stored report, fail-soft for a corrupt row (§0). */
export function entradaDeConfiguracion(fila: FilaReporte): EntradaTablero;

/** The answer of one run (spec "Closed Result States", "Projection"). */
export function respuestaDeEjecucion(
  reporte: ReporteLeido, resultado: RespuestaSobreVistas,
  periodo: { dias: number; desde: string } | null,
): RespuestaReporte;

export function normalizarValor(valor: unknown): string | number | boolean | null;
export function aNumero(valor: unknown): number | null;
```

`leerDiasDeConsulta` avoids AJV coercion. The route declares no querystring schema. The function takes `request.query` and accepts only `{}` or `{ dias: /^\d{1,3}$/ }`. The `includes` check against the declared list happens in `diasDelPedido`.

`respuestaDeEjecucion` decision order:
1. `codigo` 400, 404 or 409 → `no-disponible`. Covers the DEC-71 gate, the credential, a connection gone, and values out of the declaration.
2. `resultado: 'fallo'` → `tiempo-agotado` if `categoria === 'tiempo-agotado'`; else `sin-conexion` if `fase === 'conexion'`; else `error`. The `permisos` phase falls into `error`.
3. `ok`: build `indices = reporte.columnas.map(c => ejecucion.columnas.indexOf(c.columna))`. Any `-1` → `no-disponible`.
4. Project each row to `indices`, then normalize each value. For `numero`, `barras` and `linea`, the `valor` index goes through `aNumero`, and any `null` → `no-disponible`.
5. Zero rows → `sin-datos`, else `ok` with `columnas: reporte.columnas.map(({ rol, titulo }) => ({ rol, titulo }))`, `filas`, `corte: ejecucion.corte !== null`, `periodo`.

The full row array is local to the function. Only the projected array is returned, so nothing else can be serialized (rule 5).

`normalizarValor`: a `Date` at `00:00:00.000Z` becomes `toISOString().slice(0, 10)`, any other `Date` its ISO string. `bigint` becomes a string. A string, number, boolean or null is kept. Anything else becomes `String(v)`. `aNumero` accepts a finite number, or a string matching `/^-?\d+(\.\d+)?$/` that converts to a finite number.

### 1.4 The gate (`src/panel/panel-tablero.ts`)

```ts
export interface Compuerta {
  /** 'lleno' when the tenant's queue is full; otherwise the shared run's answer. */
  pedir<T>(tenantId: string, clave: string, sigueAbierto: () => boolean, tarea: () => Promise<T>): Promise<T> | 'lleno';
}
export function crearCompuerta(limites = { enCurso: EN_CURSO_POR_TENANT, enCola: EN_COLA_POR_TENANT }): Compuerta;
```

State per tenant: `enCurso: number`, `cola: Entrada[]`. A `Map<clave, Entrada>` holds the shared entries. An `Entrada` is `{ clave, tarea, esperas: Array<() => boolean>, promesa, resolver }`.

- **Join.** If `clave` (`tenantId|reporteId|dias`) has an entry, its `sigueAbierto` is added to `esperas` and the same promise is returned. No slot is taken.
- **Admit.** If `enCurso < 3`, start now. Else, if `cola.length < 8`, push. Else answer `'lleno'`.
- **Start.** `enCurso++`, run `tarea()`, settle the shared promise. In `finally`: `enCurso--`, delete the `clave`, then start the next queued entry.
- **Drop.** Before starting a queued entry, if every `sigueAbierto()` is false, the entry is resolved as dropped and deleted, and the next is tried.
- **Cleanup.** When `enCurso === 0` and the queue is empty, the tenant's record is deleted. The gate holds nothing between runs (DEC-93, "sin caché").

`sigueAbierto` is `() => !request.raw.destroyed && !reply.raw.writableEnded`. One process, one gate (DEC-201 "Se resigna").

### 1.5 Routes (`src/panel/panel-tablero-rutas.ts`, new)

```ts
export interface DependenciasPanelTablero {
  prisma: PrismaAislado; zonaHoraria: string; topeFilas: number;
  canales: AbridorDeCanales; compuerta?: Compuerta; ahora?: () => Date;
}
export function registerPanelTableroRoutes(app: FastifyInstance, deps: DependenciasPanelTablero): void;
```

Both routes use `{ preHandler: [levantarSesionPanel(prisma)] }`, run inside `conTenantActivo({ id: sesion.tenantId, nombre: sesion.tenantNombre }, …)`, and set `Cache-Control: no-store` on every answer.

**`GET /api/panel/tablero`:**
1. `prisma.tablero.findFirst({ select: { reportes: true } })`, scoped. No row → `reportes: []`.
2. `prisma.reporte.findMany({ where: { id: { in: ids } } })`, global, then ordered by `ids`. An id with no report is skipped.
3. `prisma.tenant.findUnique({ where: { id: sesion.tenantId }, select: { replicaActualizadaEn: true } })`. `Tenant` is global, and the id is the session's.
4. Answer `{ reportes: filas.map(entradaDeConfiguracion), datos: { actualizadosEn }, zonaHoraria }`.

**`GET /api/panel/tablero/:reporteId/resultado`:**
1. `leerDiasDeConsulta(request.query)`: a refusal → `400 { error: 'solicitud-invalida', campos: ['/dias'] }`.
2. Scoped `tablero.findFirst({ select: { conexionId, reportes } })`. No row, or `reportes` does not include `:reporteId` → `404 reporte-no-encontrado`.
3. `reporte.findUnique` by id, then `leerReporte` in `try`. A throw logs `error` (`{ reporteId }`, `'stored report out of rules'`) and answers `200 { estado: 'no-disponible' }`.
4. `diasDelPedido(reporte.periodo, dias)`: a refusal → the 400 of step 1.
5. `compuerta.pedir(tenantId, \`${tenantId}|${id}|${dias ?? '-'}\`, sigueAbierto, tarea)`. `'lleno'` → `429 { error: 'demasiadas-solicitudes' }`.
6. `tarea` runs `ejecutarReporte(…, { conexionId: tablero.conexionId, dias }, contexto, null, 'panel report execution failed')`, then `respuestaDeEjecucion`, then the `info` line: `app.log.info({ tenantId, reporteId, conexionId, estado, filas, duracionMs }, 'panel report run')`.
7. Answer 200 with the shared result. If the request already closed, nothing is sent.

Steps 1 to 4 dial nothing. The gate and the single-flight sit after every refusal, so a refused request takes no place.

### 1.6 Wiring

- `src/aislamiento/contexto-tenant.ts`: two rows in `RUTAS_PANEL_PUBLICAS`, with a CH-48 comment: `'GET /api/panel/tablero'` and `'GET /api/panel/tablero/:reporteId/resultado'`. `EXENCIONES_OPERADOR` picks them up from the set.
- `src/app/rutas.ts`: `registerPanelTableroRoutes(app, { prisma, zonaHoraria, topeFilas, canales })` after the Telegram routes, with the same `canales` and `topeFilas` the console test receives.

### 1.7 Data flow (one run)

```
browser ──GET /api/panel/tablero/r-1/resultado?dias=7 (cookie)──▶ levantarSesionPanel ─ 401
  conTenantActivo(session tenant)
    leerDiasDeConsulta ──────────── 400 /dias
    tablero.findFirst (scoped) ──── 404 reporte-no-encontrado (not on this tenant's dashboard)
    reporte.findUnique + leerReporte ── 200 no-disponible (+ error log)
    diasDelPedido ───────────────── 400 /dias
    compuerta.pedir(tenant|r-1|7) ── 429 demasiadas-solicitudes
      ejecutarReporte(conexionId = tablero.conexionId, auditoria = null)
        ejecutarSobreVistas: ownership → DEC-71 gate → prepare (date bound) → credential → engine
      respuestaDeEjecucion: state, projection by index, normalization
      log.info { tenantId, reporteId, conexionId, estado, filas, duracionMs }
  200 { estado, columnas?, filas?, corte?, periodo? }   Cache-Control: no-store
```

## 2. Slice CH-48b — page without the library

### 2.1 Design guide first (both copies, before any markup)

`.claude/skills/zerodashboard-design/` and `.agents/skills/zerodashboard-design/` change the same way:

- **`SKILL.md` scope line.** Replace the ban with: «Alcance: CH-27 / P-06 "Último resultado" está fuera de alcance (DEC-93, D-1): no diseñes ni implementes vistas con filas guardadas de una ejecución. El tablero del panel (P-08, CH-48) sí muestra resultados: se ejecutan en vivo, solo con las columnas asignadas, y no se guardan (DEC-183).»
- **`guidelines/pantallas.md`, new P-08 «Tablero» — R3h, R4h, R5h · CH-48 · EXISTE:**
  - **Propósito** and **Datos** (title, description, visualization, period, assigned column titles, freshness);
  - **Navegación**: «Tablero» / «Avisos» as `.zd-tabs` hash links, only with reports, default «Tablero», `aria-current="page"`, a second row under the header on mobile;
  - **Tarjetas**: `zd-card` per report, full width, one column; number card (value at `--text-3xl`, `es-AR`, column title as label); table (`zd-table` in `zd-table-wrap`/`zd-table-scroll`); chart (fixed height of about 220 px, one series in `--accent`, ticks `--text-2`, grid `--border-1`, no library palette, collapsed «Ver los datos en una tabla»);
  - **Estados**, with the exact copy of §2.4;
  - **Acciones**: Período, Reintentar, Actualizar;
  - **Frescura**: the line, informative only.
  - P-07's line «Tarjeta arriba de "Mis automatizaciones"» becomes «debajo de "Mis automatizaciones", en Avisos».
  - The change table gets a CH-48 row.
- **`guidelines/lenguaje.md`**: the row «filas, rows» also allows «resultados» in the dashboard («Mostramos solo los primeros 20 resultados.»), since a report is not always about products or orders.

### 2.2 Page module (`src/panel/panel-tablero-pagina.ts`, new)

Strings only, no server logic:

```ts
export const ESTILOS_TABLERO: string;   // panel-nav, panel-tablero, panel-numero, panel-grafico, panel-frescura (tokens only)
export const MARCADO_NAV: string;       // <nav id="nav-panel" class="zd-tabs panel-nav" aria-label="Secciones" hidden>
export const MARCADO_TABLERO: string;   // <section id="seccion-tablero" hidden> freshness line, «Actualizar», #lista-tablero
export const SCRIPT_TABLERO: string;    // the dashboard script, ES5 like the rest of the page
```

`panel.ts` changes:
- `ESTILOS_TABLERO` goes into the `<style>` of `CABEZA_PAGINA`.
- The shell becomes header, `MARCADO_NAV`, `MARCADO_TABLERO`, then `<div id="seccion-avisos">`. That div holds the automations list and, **after it**, the Telegram card.
- Scripts, in order: «Salir», `<script>` + `SCRIPT_TABLERO`, then the existing automations script, which stays **last** so `shellConScript` keeps extracting it. CH-48c inserts the Chart.js `<script src>` before `SCRIPT_TABLERO`.

### 2.3 Script behavior (`SCRIPT_TABLERO`)

- **Load.** `fetch('/api/panel/tablero')`. On `401` reload. On failure, or with `reportes: []`, the nav stays hidden and «Avisos» shows, which is today's page. Otherwise the script shows the nav, applies the hash, renders the freshness line and one card per report with a skeleton, then queues every run.
- **Queue.** At most 3 requests in flight, FIFO in dashboard order. Each card has a generation counter. A re-run increments it, and an answer from an older generation is dropped.
- **Run.** `fetch('/api/panel/tablero/' + encodeURIComponent(id) + '/resultado' + (dias ? '?dias=' + dias : ''))`, with no header and no body. `401` reloads. `429`, `5xx` and network failures show the `error` state. A `200` is rendered by `estado`.
- **Hash nav.** `#tablero` and `#avisos`. Any other hash means «Tablero» when the nav shows. `hashchange` toggles `hidden` on the two sections and `aria-current` on the links.
- **Period.** A `<select>` with a visible label «Período». Its options are «Últimos N días», starting on `predeterminado`. `change` re-queues only that card. The value lives only in the card's state.
- **Actualizar.** Disabled while any request of the section is pending. It re-reads the configuration and re-queues every card. There is no `setInterval` or `setTimeout` loop.
- **Bodies.**
  - `numero`: `Intl.NumberFormat('es-AR').format(v)` in `.panel-numero__valor`, with the title as label.
  - `tabla`: a `<table class="zd-table">` with a `<caption>` (the report title), `<th scope="col">` and `zd-num` on all-number columns.
  - `barras` and `linea`: in this slice, the same table inside `<details open>`, with no canvas.
- **Text.** Values only through `textContent`. Dates `YYYY-MM-DD` show as `dd/mm`. «Desde el dd/mm» comes from `periodo.desde`.
- **Freshness.** Relative time from `actualizadosEn`: minutes under 1 h, hours under 48 h, days after that. The absolute time is `Intl.DateTimeFormat('es-AR', { timeZone: zonaHoraria, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })`.

### 2.4 Copy (glossary-checked)

| State | Title | Body | Action |
|---|---|---|---|
| `sin-datos` | No hay datos para este período. | — | — |
| `no-disponible` | No podemos mostrar este reporte por ahora. | Si sigue así, avisale a quien te dio acceso. | — |
| `tiempo-agotado` | Tu tienda tardó demasiado en responder. | Volvé a intentar en unos minutos. | Reintentar |
| `sin-conexion` | No pudimos llegar a los datos de tu negocio. | Volvé a intentar en unos minutos. | Reintentar |
| `error`, 429, network | No pudimos cargar este reporte. | Volvé a intentar en unos minutos. | Reintentar |
| `corte` | Mostramos solo los primeros N resultados. | — | — |

None contains `consulta`, `réplica`, `ejecución`, `parámetro`, `plantilla`, `timeout`, `sql`, `tenant`, `cron` or `query`. The glossary test of `panel.test.ts` also scans `SCRIPT_TABLERO`, because it is part of the served page.

## 3. Slice CH-48c — charts

- **Loading.** `<script src="/ui/vendor/chart.umd.js"></script>` in `documentoShell` only, before the dashboard script. There is no SRI (DEC-200), and no server change, since no page sets a CSP.
- **Drawing.** For `barras` and `linea`, when `typeof Chart === 'function'`, the card holds `<div class="panel-grafico"><canvas role="img" aria-label="…"></canvas></div>`, then the `<details>` with the table, now collapsed. The config is one dataset, `animation: false`, `maintainAspectRatio: false`, legend hidden (the card title names the series), x labels from `etiqueta` (dates as `dd/mm`), and the y axis titled with the `valor` column title.
- **Colors.** `function colores() { var s = getComputedStyle(document.body); return { serie: s.getPropertyValue('--accent').trim(), texto: s.getPropertyValue('--text-2').trim(), grilla: s.getPropertyValue('--border-1').trim(), fuente: s.getPropertyValue('--font-sans').trim() }; }`. The chart takes them through dataset colors, `scales.*.ticks.color`, `scales.*.grid.color` and `font.family`.
- **Theme.** A `matchMedia('(prefers-color-scheme: dark)')` `change` listener and a `MutationObserver` on `document.documentElement` for `data-theme`. Both re-read `colores()`, patch each live chart's options and call `chart.update()`.
- **Lifecycle.** Each card keeps its `chart`. A re-run or a period change calls `chart.destroy()` before rendering.
- **`aria-label`.** «<título>: valores de <mín> a <máx>.», with numbers formatted `es-AR`.
- **Fallback.** No `Chart` means the slice-b rendering: the table open and no canvas.
- **Spec line.** `shared-visual-system`: the panel shell is the only consumer.
- **Docs.** The panel section of `docs/guia/09-reportes.md` (what the client sees, the period, the states, the gate and why there is no audit row), and the map row.

## 4. Files

| File | Slice | Action | Estimate |
|---|---|---|---|
| `src/ejecucion/ejecucion-sobre-vistas.ts` | a | Modify | 10 |
| `src/reportes/reporte-ejecucion.ts`, `reporte-prueba.ts` | a | Create, modify | 90 |
| `src/panel/panel-tablero.ts` | a | Create | 170 |
| `src/panel/panel-tablero-rutas.ts` | a | Create | 110 |
| `src/aislamiento/contexto-tenant.ts`, `src/app/rutas.ts` | a | Modify | 15 |
| Tests of a (below) | a | Create, modify | 520 |
| Guide, both copies (`SKILL.md`, `pantallas.md`, `lenguaje.md`) | b | Modify | 90 |
| `src/panel/panel-tablero-pagina.ts` | b | Create | 380 |
| `src/panel/panel.ts` | b | Modify | 40 |
| Tests of b | b | Create, modify | 380 |
| `panel-tablero-pagina.ts` (charts), `panel.ts` (`<script src>`) | c | Modify | 150 |
| Tests of c, spec line, `docs/guia/09-reportes.md`, map | c | Create, modify | 290 |

Totals with tests, guide and docs: about 915 for a (395 production), 890 for b (420 production), 440 for c (150 production). About 2,250 in all.

## 5. Testing

| Layer | What | Where | Slice |
|---|---|---|---|
| Unit | `leerDiasDeConsulta` (absent, "7", "7.0", "-7", "1e1", an array, an extra key); `entradaDeConfiguracion` (no technical keys, corrupt row); `respuestaDeEjecucion` (every state row of the spec, projection drops unassigned columns, numeric strings, a non-numeric `valor`, dates, `corte`); `normalizarValor` | `src/panel/panel-tablero.test.ts` | a |
| Unit | Gate: 4th waits; another tenant does not; 9th queued → `'lleno'`; single-flight calls once and answers both; nothing kept after a run; closed request dropped; slot freed on throw; empty record deleted | `src/panel/panel-tablero.test.ts` | a |
| Unit | `diasDelPedido` moved unchanged; same date and `limite` on both callers under a fixed clock | `src/reportes/reporte-ejecucion.test.ts` | a |
| Regression | The existing console test suite passes unchanged | `src/reportes/reporte-prueba.test.ts` | a |
| Integration (DB) | Configuration in order; no dashboard; freshness null and set; 401; `no-store`; 404 not on the dashboard; 400 `/dias`; the default period; `ok` with projected rows over a `VALUES` view; `no-disponible` for unapproved views and a missing column; no audit row and no `error` line; one `info` line with the six fields; 429 with a stub gate | `src/panel/panel-tablero-rutas.test.ts` | a |
| Isolation (DB) | The two-tenant scenarios of `tenant-isolation` | `src/aislamiento/aislamiento-panel.test.ts` | a |
| Routes | The two rows are exact, exempt from the header hooks and the operator guard, and the counts derived from `RUTAS_PANEL_PUBLICAS` still hold | `src/app/rutas.test.ts`, `src/consola/consola-auth.test.ts`, `src/aislamiento/contexto-tenant.test.ts` | a |
| Audit | `auditoria: null` writes nothing and logs no `error`; the console paths still write | `src/auditoria/auditoria-registro.test.ts` | a |
| Page (fake DOM) | Nav only with reports; default section; hash switch; 3 requests at a time; card states and copy; retry re-runs one card; period select re-runs one card with `dias`; «Actualizar» disabled while pending; no timer; number formatting; table headers and `zd-num`; markup in values as text; 401 reload; no tenant identifier sent | `src/panel/panel-tablero-pagina.test.ts`, running `SCRIPT_TABLERO` through `new Function('document', 'fetch', 'window', …)` with the fake DOM of `panel.test.ts`, moved to a shared test helper if needed | b |
| Page | The automations script is still last; the glossary scan covers the dashboard script; the Telegram card follows the list | `src/panel/panel.test.ts` | b |
| Charts (fake DOM, stub `Chart`) | Canvas with `role="img"` and `aria-label`; config colors equal stubbed token values; theme flip updates; `destroy` before re-run; no `Chart` → table open | `src/panel/panel-tablero-pagina.test.ts` | c |
| Visual system | Only the authenticated shell loads the script, once, before the dashboard script | `src/panel/panel.test.ts`, `src/compartido/estilos-rutas.test.ts` | c |

There is no manual visual pass at 360 or 1280 px (project memory). The fake-DOM tests are the check.

Commands: `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db` and `npx tsc -p tsconfig.json --noEmit`. Focused commands per slice are in tasks.md.

## 6. Threat matrix

| Threat | Vector | Control | Proof |
|---|---|---|---|
| Cross-tenant read | A report id of another tenant's dashboard, or `X-Tenant-Id` | Tenant only from `SesionPanel`; id checked against the scoped `Tablero`; connection taken from the dashboard; scoped `Conexion` and `VistaCanonica` | Two-tenant test (a) |
| Arbitrary SQL from the panel | Any input | Only `:reporteId` and `dias`; `dias` is a declared integer; the date is server-computed and bound (rules 1, 4) | Unit and route tests (a) |
| Unassigned or personal columns reaching the browser | The report's statement returns more columns | Projection by index, everything else dropped in memory (rule 5) | Unit test with an extra `email` column (a) |
| Results persisted | Cache, audit, single-flight, browser cache | No cache; `auditoria: null`; the shared entry is deleted on settle; `no-store` | Gate and route tests (a) |
| Technical detail leaking | Failure verdicts, corrupt reports | Closed `estado` only; reasons stay in sanitized logs | State tests (a), glossary scan (b) |
| Agent sessions starved, so automations fail | Refresh storms, many tabs | 3 per tenant in flight, queue of 8, 429, single-flight, client queue of 3, no auto-refresh | Gate tests (a), page tests (b) |
| Markup injection | Titles or values containing HTML | `textContent` and Chart.js canvas only | Page tests (b) |
| Logs carrying data | The `info` line | Six closed fields, never SQL, date or values | Route test (a) |
| Third-party script | `chart.umd.js` | Pinned bytes and sha256 test (DEC-200), served from the app only, authenticated shell only | Existing pin test, consumer test (c) |

There is no shell, subprocess, VCS automation or executable-file classification.

## 7. Rollout and rollback

No migration and no environment variable. Each slice merges on its own and reverts on its own (proposal, "Rollback"). After CH-48a the API exists with nothing visible. After CH-48b the client sees numbers, tables, periods and freshness, with charts as tables. CH-48c draws the charts.

## 8. Delivery

Three chained PRs after the docs-only DEC PR. Each slice passes 400 lines with tests, so each needs `size:exception`, as CH-44 to CH-47 had. A four-slice fallback splits b into b1 (nav, freshness, number and table) and b2 (period select, states, retry).

## Open questions

None for the design. DEC-201 and DEC-202 are open to the user's review. A different answer there changes slice a (API shape, gate) or adds a migration (audit options (b) and (d)).
