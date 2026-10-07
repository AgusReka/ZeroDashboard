# Design: CH-22b — Panel "My Automations" (P1h)

## Technical Approach

One read-only route plus one screen, in the panel surface (DEC-04, DEC-136). The contract is fixed by DEC-137; the tenant derives only from the session (DEC-135); the template copy lives in the panel module (DEC-128); the three frequency patterns come from DEC-129. No schema change, no migration, no new model. Decisions not covered by those DECs are listed under "Open questions" and are NOT decided here.

### 1. Module layout

`src/panel-automatizaciones.ts` (new) holds two layers:

- **Pure functions, no I/O, no Prisma, unit-testable without a database:**
  - `COPY_NEGOCIO`: `ReadonlyMap<string, { titulo; descripcion }>` keyed by the template `automatizacion` slug, same shape and placement logic as `TEMAS` in `src/correo.ts:123`; plus `COPY_NEUTRO` (fallback).
  - `copyDe(slug)`: map lookup or `COPY_NEUTRO`, never throws.
  - `frecuenciaDeCron(cron): string | null`.
  - `resultadoDe(estado): 'completada' | 'no-realizada'`.
  - `proyectarActiva(fila, ultima, ahora, zona)`: the allow-list builder for one `activas` item; the only place that names output keys.
  - `proyectarDisponibles(plantillas, plantillaIdsActivas)`: filters by copy map and absence of an active automation, returns `{ titulo, descripcion }[]`.
- **Route registrar:** `registerPanelAutomatizacionesRoutes(app, prisma, zonaHoraria, ahora = () => new Date())`. It declares `GET /api/panel/automatizaciones` with `preHandler: [levantarSesionPanel(prisma)]`, wraps the reads in `conTenantActivo({ id: sesion.tenantId, nombre: sesion.tenantNombre }, ...)` (as `src/panel-auth.ts` does for `/api/panel/auth/sesion`), calls the queries, then the pure functions, and sends the body.

Why one module: the route is ~70 lines and the pure layer is its testable core; `src/panel-auth.ts` stays untouched. The registrar is called in `src/server.ts` right after `registerPanelAuthRoutes(app, prisma)`, passing `config.zonaHoraria` (same source as `registerAutomatizacionRoutes`, `src/server.ts:97`).

Imports that exist today and are reused: `levantarSesionPanel` (`src/panel-auth.ts:185`), `conTenantActivo` (`src/contexto-tenant.ts`), `PrismaAislado` (`src/aislamiento-prisma.ts`), `proximaEjecucion` and `cronValido` (`src/automatizaciones.ts:118`, `:63`), `LIMITE_LISTADO` (defined in `src/listados.ts:12`; `src/automatizaciones-rutas.ts` imports it through the `consultas-guardadas` re-export, this module imports it from its source).

### 2. Response and projection

```
{ activas: [{ titulo, descripcion, estado: 'activa'|'pausada', frecuencia?, ultimaEjecucion: { fecha, resultado } | null,
              proximaEjecucion: string | null }],
  disponibles: [{ titulo, descripcion }],
  zonaHoraria: string, truncado: boolean }
```

- `frecuencia` is a missing key (not `null`) when the cron is not one of the three patterns.
- No `id` is exposed: DEC-137 lists no identifier and CH-23 can add it additively.
- `fecha`: `finalizadaEn ?? iniciadaEn`, `.toISOString()`.
- `proximaEjecucion`: `null` when `activo` is false; otherwise `proximaEjecucion(cron, ahora, zona).toISOString()` inside a `try/catch` that yields `null` for an invalid stored cron (see Open question 4). A deactivated tenant never reaches this code: the session hook answers `409` first.
- The builder constructs the output object literally from named inputs; no spread of a stored row. Forbidden keys (`tenantId`, `conexionId`, `valores`, `codigoError`, `error`, `sql`) are also never in the Prisma `select`, so they are not even read into memory.

### 3. Query plan (no N+1; fixed count regardless of the number of automations)

All reads run inside one `conTenantActivo` callback; independent ones run with `Promise.all` (AsyncLocalStorage propagates through it).

| # | Query | Scoping |
|---|-------|---------|
| Q1 | `automatizacion.findMany({ select: { id, plantillaId, activo, cron, plantilla: { select: { automatizacion: true } } }, orderBy: [{ creadaEn: 'desc' }, { id: 'asc' }], take: LIMITE_LISTADO + 1 })` | Extension injects `tenantId` (`findMany` in `OPERACIONES_FILTRO`). Nested `plantilla` is a select of a global model (DEC-61). |
| Q2 | `ejecucion.groupBy({ by: ['automatizacionId'], where: { automatizacionId: { in: ids }, estado: { not: 'en-curso' } }, _max: { iniciadaEn: true } })` | `groupBy` is in `OPERACIONES_FILTRO`: the extension conjoins `{ AND: [where, { tenantId }] }`. Uses index `[automatizacionId, iniciadaEn]`. |
| Q3 | `ejecucion.findMany({ where: { OR: pares de { automatizacionId, iniciadaEn } }, select: { automatizacionId, estado, iniciadaEn, finalizadaEn } })` | Same extension conjunction; the caller's `OR` cannot widen it because the injected predicate sits in a top-level `AND`. At most `LIMITE_LISTADO` pairs. Skipped when Q2 returns no groups. |
| Q4 | `plantilla.findMany({ where: { automatizacion: { in: slugsConCopy } }, select: { id, automatizacion } })` | `Plantilla` is outside the filter (DEC-61); the catalog is bounded by the copy map. Never `select`s `sql`, `nombre` or `parametros`. |
| Q5 | `automatizacion.groupBy({ by: ['plantillaId'], where: { activo: true } })` | Extension-scoped. One row per template at most. See Open question 2. |

**"Latest per automation" under the isolation extension.** The extension (`src/aislamiento-prisma.ts`) accepts `findMany` and `groupBy` and conjoins `tenantId` at the top-level `where`; any other operation throws `ErrorAislamientoNoSoportado`. Options checked:

- `distinct: ['automatizacionId']` with `orderBy`: allowed (only `where` is rewritten), but Prisma implements `distinct` as in-memory post-processing over every matching row, so the read grows with the whole execution history. Rejected.
- Nested `ejecuciones: { orderBy, take: 1 }` inside Q1: one query, but a nested read is not rewritten by the extension (it relies on the parent relation, not on an injected `tenantId`). Rejected to keep the structural filter on every table read; listed in Open question 2.
- `$queryRaw` (`DISTINCT ON`): bypasses the extension. Forbidden.
- **Chosen:** `groupBy` with `_max.iniciadaEn` (Q2) then a single `findMany` by `(automatizacionId, iniciadaEn)` pairs (Q3). Both are index-served and extension-scoped. Ties on the same `(automatizacionId, iniciadaEn)` are resolved by taking the first row (a run's `iniciadaEn` comes from the scheduler clock, one run at a time per automation: overlap is skipped, DEC-96).

**Disponibles.** Never use a relation filter from `Plantilla` into `Automatizacion` (for example `automatizaciones: { none: { activo: true } }`): `Plantilla` is outside the extension, so a nested relation filter would span every tenant's automations. The "active automation of this tenant" set always comes from the tenant-scoped Q5, then is subtracted in code (`proyectarDisponibles`). Order: the copy map's insertion order, then template `id`.

### 4. Clock injection

`ahora: () => Date` is a registrar parameter with default `() => new Date()`. The handler calls it once per request and passes the same `Date` to every `proximaEjecucion` call, so all items in one response share the reference instant. Tests pass a fixed clock; no `Date` mocking and no global timers. `src/server.ts` does not pass the argument.

### 5. Copy map: location and fallback

- Location: `src/panel-automatizaciones.ts`, a constant next to the projection, per DEC-128 (first consumer resolves the text; no column, no migration). Keys are the slugs of the initial catalog (`src/catalogo-inicial.ts`: `stock-fisico`, `stock-producible`).
- Proposed copy (Spanish, glossary-compliant; final wording is Open question 3):
  - `stock-fisico`: titulo "Aviso de stock bajo", descripcion "Te avisamos por correo cuando un producto se está quedando sin stock."
  - `stock-producible`: titulo "Aviso de productos que ya casi no podés armar", descripcion "Te avisamos por correo cuando, con los insumos que tenés, ya casi no podés armar un producto."
  - fallback: titulo "Automatización de tu negocio", descripcion "Una revisión automática que te mandamos por correo."
- An existing automation with an unmapped slug is listed with the fallback; an unmapped template is not listed as available (DEC-137). The template `nombre` is never a fallback.

### 6. Frequency mapping

`frecuenciaDeCron(cron)`: normalize with `cron.trim().split(/\s+/).join(' ')`, then match `/^(\d{1,2}) (\d{1,2}) \* \* (\*|1-5|1-6)$/`; require minute <= 59 and hour <= 23; format `HH:MM` zero-padded. Mapping of the day field: `*` to "Todos los días", `1-5` to "De lunes a viernes", `1-6` to "De lunes a sábado"; result `"{dias} a las HH:MM"`. Anything else returns `null` and the key is omitted. The three day sets mirror the console translation of DEC-129 (duplicated by design, pinned by test vectors, not imported from the browser-side console script). `HH:MM` is in the deployment zone, the same zone `proximaEjecucion` is resolved in.

### 7. Panel page (`src/panel.ts`)

`documentoShell` replaces the `<section data-estado="parcial">` inside `<main class="panel-main">` with the P-02 screen: title and subtitle (kept), a region for loading skeleton, empty state, error state, a list of active cards, and an "available" section. The existing Salir script stays. Layout rules go in the existing page-local `<style>` block using tokens only; shared components `.zd-card`, `.zd-banner`, status badge and skeleton from `/ui/styles.css` are reused (verify class names against the design skill before coding; nothing console-specific in `public/ui/`, DEC-124).

Script constraints (the page is a TypeScript template literal):

- String concatenation only: no JS backticks, no `${...}` anywhere in the script (the file's own header documents this). Avoid regex literals and backslash escapes in the script; where a Unicode char is needed use the existing `…` style that TypeScript resolves.
- Every API value goes into the DOM with `textContent` (or `createElement` + `textContent`); `innerHTML` is never used with API data. The tenant name is already interpolated through `escaparHtml`. No `href`/`src` is built from API data.
- Dates: `new Intl.DateTimeFormat('es-AR', { timeZone: zonaHoraria, weekday, day, month, hour, minute, hour12: false })`. If `Intl` throws for the zone, fall back to the browser default zone rather than failing the screen.
- `fetch('/api/panel/automatizaciones', { credentials: 'same-origin' })` with no custom header. `401` runs `window.location.reload()`; `409` and any other failure show the error state (a `409` reuses the login screen's "Tu negocio no está activo en este momento. Comunicate con quien te dio acceso." text); network errors show the generic error.
- States and copy (P-02, DEC-137): loading skeleton; empty title "Todavía no activaste ninguna automatización" plus a one-line explanation of when entries appear; error "No pudimos cargar tus automatizaciones" with "Volvé a intentar en unos minutos."; last run none "Todavía no hubo una revisión"; status labels "Activa" and "Pausada"; `resultado` texts "Se completó" and "No se pudo hacer". No "Ajustar" or "Activar" markup anywhere. Words like cron, tenant, SQL, consulta, ejecución, plantilla do not appear in visible text or string literals (identifiers such as `ultimaEjecucion` are keys, not copy).

### 8. Wiring

- `src/contexto-tenant.ts`: add the exact row `'GET /api/panel/automatizaciones'` to `RUTAS_PANEL_PUBLICAS` (`:141`). The set is matched by `` `${metodo} ${patron}` `` equality, so no prefix is introduced. Without it the header hooks answer `400` for a request with no `X-Tenant-Id`. The set's comment about the closed list and `src/contexto-tenant.test.ts` need the one row.
- `src/server.ts`: import and call `registerPanelAutomatizacionesRoutes(app, prisma, config.zonaHoraria)` after `registerPanelAuthRoutes(app, prisma)` and before `registerPanelRoutes(app, prisma)`; header hooks are already registered earlier.

### 9. Test plan mapped to scenarios

| Test file | Covers (spec scenarios) |
|-----------|-------------------------|
| `src/panel-automatizaciones.test.ts` (pure, no DB) | Frequency: the three patterns, zero-padding, `*/15 * * * *`, `0 8 1 * *`, `0 8 * * 0-6`, `0 8 * * 1`, `61 8 * * *`, `0 24 * * *`; copy map and unmapped fallback (no `nombre`); `resultadoDe`; projection builds only allow-listed keys (recursive forbidden-key walk over a fixture row carrying every forbidden field); status mapping; next run with fixed clock in `UTC` and `America/Argentina/Buenos_Aires`; paused gives `null`; corrupt cron gives `null`; disponibles rule (active hides, paused-only shows, unmapped hidden); glossary scan of copy map, fallback and frequency texts |
| `src/panel-automatizaciones.test.ts` (route, live DB, skip when unreachable, same fixture style as `src/panel-auth.test.ts`) | 200 shape and exact keys; 401 no cookie; 401 expired; 409 deactivated tenant; no `X-Tenant-Id` needed (200 not 400); `ultimaEjecucion` null / only `en-curso` / latest finished per automation / failed is neutral; truncation with `LIMITE_LISTADO + 1` rows; response never contains forbidden keys or the template SQL |
| `src/aislamiento-panel.test.ts` | Two tenants: A sees only A (and the mirror), foreign `X-Tenant-Id` gives an identical body, other tenant's use does not hide a template, no foreign id or execution instant in either body |
| `src/contexto-tenant.test.ts` | Exact row present; `GET /api/panel/automatizaciones/extra` and `POST` on the path are not exempt |
| `src/panel.test.ts` | Authenticated `/panel` contains the screen markup and the script URL; script has no template literal or `${`, no `innerHTML`; no "Ajustar"/"Activar"; glossary scan of visible text and script string literals; login render unchanged. Loading, empty, error and 401-reload behavior are asserted on the script text (state strings and the `reload` branch present); runtime rendering is covered by the human visual review |

### 10. Review Workload Forecast and PR strategy

Estimated changed lines (additions plus deletions):

| Item | Lines |
|------|-------|
| `src/panel-automatizaciones.ts` (pure layer about 130, route about 80, doc comments) | ~230 |
| `src/panel-automatizaciones.test.ts` (pure about 140, route about 130) | ~270 |
| `src/panel.ts` (screen markup, CSS, script) | ~140 |
| `src/panel.test.ts` additions | ~50 |
| `src/aislamiento-panel.test.ts` additions | ~90 |
| `src/contexto-tenant.ts`, `.test.ts`, `src/server.ts` | ~20 |
| **Total** | **~800** |

This exceeds the 400-line review budget. Suggested split into chained PRs (each at or below 400), following the CH-22a precedent:

- **PR0**: OpenSpec artifacts (this folder) and docs.
- **PR1**: pure layer in `src/panel-automatizaciones.ts` (copy map, frequency, projection, disponibles rule) and its unit tests (~280).
- **PR2**: route registrar, query plan, wiring (`RUTAS_PANEL_PUBLICAS` row, `src/server.ts`), route tests, `contexto-tenant.test.ts` and the two-tenant cases in `src/aislamiento-panel.test.ts` (~330).
- **PR3**: panel page (`src/panel.ts`) and `src/panel.test.ts` (~190).

Rollback: revert the PR(s); no migration or data change.

## Open questions (all resolved by the user, 2026-10-06)

Resolution: (1) `ultimaEjecucion` is `{ fecha, resultado }` with `completada` for `ok` and `no-realizada` for `fallo` and `omitida`; an `omitida` run counts as the last run. (2) Five queries are accepted. (3) The copy in section 5 is approved as written, including the fallback. (4) A corrupt stored cron yields `proximaEjecucion: null` and no `frecuencia`. (5) A `409` shows the login screen's inactive-business text. (6) Duplicate template slugs are deduplicated by slug, and a slug is hidden when any template with that slug has an active automation. Recorded in DEC-137. The original questions follow for traceability.

These are not decided in DEC-137, DEC-128, DEC-129, DEC-135 or DEC-136. Per `AGENTS.md`, decisions of architecture must be registered in `docs/01-decisiones.md` before implementation; the first two may need that, the rest are confirmations.

1. **`ultimaEjecucion` vocabulary.** DEC-137 fixes "the latest that is not `en-curso`" and the empty text, but not the object shape or the neutral outcome values. This design proposes `{ fecha, resultado }` with `completada` for `ok` and `no-realizada` for `fallo` and `omitida`, and any unknown state. Confirm the shape, and whether `omitida` (skipped for overlap) should count as a last run at all (the glossary says it is communicated only when it affects the client).
2. **Execution query count.** The proposal says "one grouped query"; checking the isolation extension shows a single scoped query cannot return the latest row per automation without in-memory `distinct` (unbounded) or nested reads (unscoped) or raw SQL (bypasses the extension). This design uses `groupBy` plus one `findMany` (Q2, Q3) and a fifth query (Q5) so that `disponibles` stays correct when `activas` is truncated. Confirm 5 fixed queries, or drop Q5 and accept the edge for tenants above `LIMITE_LISTADO` automations.
3. **Business copy wording.** The titles and descriptions in section 5 are proposals; product wording and the fallback text need user confirmation (content, not code).
4. **Corrupt stored cron.** The design makes an invalid stored cron yield `proximaEjecucion: null` and no `frecuencia` instead of a `500` that would blank the whole screen. This is a resilience choice not in the DECs; confirm.
5. **Deactivated tenant on the page.** A `409` from the route reuses the login screen's inactive-business text inside the error state of the screen. Confirm, or specify other copy.
6. **Duplicate slugs.** If two global templates share the same `automatizacion` slug, `disponibles` would list both with identical copy. The catalog today has one template per slug; confirm whether to dedupe by slug.
