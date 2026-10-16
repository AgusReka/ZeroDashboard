# Design: CH-30e2 — Onboarding times route and screen

Inputs: proposal.md, specs/onboarding-timing-marks/spec.md, specs/query-console/spec.md, DEC-178, DEC-89, `scripts/marcas-alta.sql`, `src/auditoria.ts`.

## 1. Route (`src/tiempos-alta.ts`)

`registerTiemposAltaRoutes(app, prisma: PrismaAislado)`, registered in `src/rutas.ts` after the audit, with a CH-30e2 / DEC-178 comment. No new exemption: the header hooks and the operator guard apply as on every scoped route.

```text
GET /tiempos-alta
  tenant        = exigirTenantActivo()                        -- from the header context
  creadoEn      = tenant.findUniqueOrThrow({ id: tenant.id })   -- Tenant is global, read by the context id
  conexiones    = conexion.findMany(order creadaEn, id; take LIMITE_LISTADO + 1)
  mapeos        = vistaCanonica.groupBy(conexionId; _min creadaEn, _max actualizadaEn)
  automatizaciones = automatizacion.groupBy(conexionId; _min creadaEn)
  per connection, in parallel:
    validacion  = vistaCanonica.findFirst(conexionId, validadaEn not null; order validadaEn desc, entidad, id)
    primera     = ejecucion.findFirst(automatizacion.conexionId; order iniciadaEn, id)
    primeraOk   = ejecucion.findFirst(automatizacion.conexionId, estado 'ok'; order iniciadaEn, id)
  200 { conexiones: [...], truncado }
```

Every scoped call gets the tenant conjoined by the isolation extension (`groupBy` and `findFirst` are in its filter map). Orderings and tie-breaks run in PostgreSQL, like the script's `DISTINCT ON`, so both see the same collation. The answer fields are the spec's table; dates go out as ISO strings (Fastify's JSON of `Date`).

Why one `findFirst` per connection instead of loading runs: `Ejecucion` grows with every scheduled run; the index `(automatizacionId, iniciadaEn)` serves the per-connection read, and a tenant has few connections.

## 2. Parity test (`src/tiempos-alta-rutas.test.ts`)

Live, skipped like `auditoria-rutas.test.ts` (`consola-auth-apoyo.js`). One fixture with fixed 2020 instants for tenant A (connections A1 full, A2 registered only) and tenant B (one connection):

- A1: two views (re-validation ending `invalida`), two automations, runs fallo/preparacion → fallo → ok, plus a second run at the first run's exact instant to exercise the `id` tie-break.
- The script is read from `scripts/marcas-alta.sql` and run unchanged with `pg` (timestamp parser as in `marcas-alta.test.ts`, UTC); its rows are filtered to A and mapped from snake_case to the route's names.
- `GET /tiempos-alta` for A: same connections, same marks, nulls included. B's connection is absent. No header → `400 tenant-no-indicado`. Answer carries no `credencial`, `host` or `tenantId`.

The CH-15 static guard scans only non-test modules, so it keeps passing.

## 3. Console markup

`<a id="nav-tiempos" class="zd-sidenav__item" href="#tiempos"><span>Tiempos de alta</span></a>` after `nav-usuarios`. The section goes after `pantalla-usuarios`:

```html
<section id="pantalla-tiempos" aria-labelledby="titulo-tiempos" hidden>
<header class="zd-pagehead">
  <div class="zd-pagehead__text">
    <div class="zd-pagehead__meta"><span class="zd-scope zd-scope--tenant">Del tenant activo</span></div>
    <h1 id="titulo-tiempos" class="zd-h1">Tiempos de alta</h1>
    <p class="zd-pagehead__desc">En qué etapa está cada conexión del tenant y cuándo llegó. Las marcas miden tiempo transcurrido, no esfuerzo: la conexión cuenta desde que se registró y la validación muestra solo la última.</p>
  </div>
</header>
<p id="tiempos-aviso" class="ayuda" role="status"></p>
<div id="tiempos-lista"></div>
</section>
```

Bridge style (local classes, no `zd-*` from the script): `#tiempos-lista` a grid of blocks; `#tiempos-lista dl` the KeyValueList grid (`max-content 1fr`, the `.zd-kv` tokens); `.etapa-pendiente` the neutral badge tokens of `.zd-badge`.

## 4. Script

- `PANTALLAS` gains `'tiempos'`; `mostrarPantalla` and `cambiarTenant` load it like Auditoría.
- **`ETAPAS_ALTA`**: `[campo, etiqueta]` pairs in the spec's order.
- **`transcurrido(ms)`**: `< 60 000` → «+menos de 1 min»; `< 1 h` → `+N min`; `< 1 d` → `+H h M min`; else `+D d H h`.
- **`detalleEtapa(conexion, campo)`**: `validacionUltima` → «Válida» / «Inválida» / the state; `primeraEjecucion` → «OK», or «Falló» plus « en » and the phase when there is one; else empty.
- **`bloqueTiempos(conexion)`**: a `section` with an `h2` (name) and a `dl`; per stage a `dt` with the label and a `dd`:
  - reached: `fechaTenant` + ` hh:mm`, then ` · detalle` when there is one, then ` · +…` when the previous reached stage's instant is not later;
  - unreached: «—» and a `span.etapa-pendiente` «Pendiente».
- **`cargarPantallaTiempos()`**, the Auditoría ladder: no tenant, network, `manejarFalloDeTenant`, non-JSON or non-200 («No se pudo leer los tiempos de alta (HTTP N).»), generation counter; empty → «Este tenant todavía no tiene conexiones.»; `truncado` → «Se muestran las primeras 200 conexiones.».

## 5. Console tests (`src/consola.test.ts`, CH-30e2 prefix)

- `nav-tiempos` comes after `nav-usuarios`; `#tiempos` shows only `pantalla-tiempos`.
- With a tenant: one `GET /tiempos-alta` with `X-Tenant-Id`; the block of a connection mapped but not validated shows four dates and four «Pendiente».
- Elapsed: `+2 h 5 min` on «Conexión registrada»; a stage earlier than the previous one shows no elapsed time.
- First run failed in `preparacion` → «Falló en preparacion»; validation `invalida` → «Inválida».
- No tenant → message, no request; empty list → the no-connections notice; `truncado` → the notice; HTTP 500 → the error notice.
- A name with `<b>` renders verbatim.
- Switching tenant while shown reloads it.

## Files
`src/tiempos-alta.ts`, `src/tiempos-alta-rutas.test.ts`, `src/rutas.ts`, `src/consola.ts`, `src/consola.test.ts`, `guidelines/consola.md` (both copies).

## Size
About 70 lines of route, 110 of console, 110 of route tests and 120 of console tests. One PR.
