# Apply progress: CH-48 — Panel dashboard

## CH-48a (server): tasks 1.1 to 4.2, done

Branch `ch48a/servidor`, from `master` after PR #249 (DEC-201, DEC-202). CH-48b (tasks 5 to 7) and CH-48c (tasks 8 to 10) are not started.

### Tasks done

- 1.1: `PedidoSobreVistas.auditoria` accepts `null`, which skips `registrarEjecucion`. The warn line, the gate and the answers are unchanged.
- 1.2, 1.3: `src/reportes/reporte-ejecucion.ts` with `diasDelPedido`, `ReporteAEjecutar`, `ContextoReporte`, `ResultadoReporte` and `ejecutarReporte`. `probarReporte` calls it with the `reporte-prueba` audit and keeps its answers. `diasDeLaPrueba` is gone.
- 1.4: `src/reportes/reporte-ejecucion.test.ts`: the `diasDelPedido` cases, and both audit choices bind the same date and ceiling under a fixed clock. `src/reportes/reporte-prueba.test.ts` passes unchanged.
- 1.5: `src/auditoria/auditoria-registro.test.ts`: a run with `auditoria: null` and no operator writes no row and logs no `error`; `/consultas/ejecutar` still writes one.
- 2.1 to 2.3: `src/panel/panel-tablero.ts` (constants, `leerDiasDeConsulta`, `entradaDeConfiguracion`, `respuestaDeEjecucion`, `normalizarValor`, `aNumero`, `crearCompuerta`) and `src/panel/panel-tablero.test.ts` (26 cases).
- 3.1, 3.2: `src/panel/panel-tablero-rutas.ts`, the two rows in `RUTAS_PANEL_PUBLICAS`, and the registration in `src/app/rutas.ts` after the Telegram routes.
- 3.3: `src/panel/panel-tablero-rutas.test.ts` (12 cases, live test DB, `VALUES` views).
- 3.4: `src/aislamiento/aislamiento-panel.test.ts`: a new two-tenant suite with the three `tenant-isolation` scenarios and the gate counting each tenant apart.
- 3.5: `src/app/rutas.test.ts`, `src/consola/consola-auth.test.ts` and `src/aislamiento/contexto-tenant.test.ts`: the rows are exact and exempt, and another method or a longer path stays scoped.
- 4.1, 4.2: the verification below.

### Files touched

| File | Action | Lines (+/-) |
|---|---|---|
| `src/ejecucion/ejecucion-sobre-vistas.ts` | Modify | +18 / -10 |
| `src/reportes/reporte-ejecucion.ts` | Create | +88 |
| `src/reportes/reporte-prueba.ts` | Modify | +19 / -48 |
| `src/panel/panel-tablero.ts` | Create | +283 |
| `src/panel/panel-tablero-rutas.ts` | Create | +173 |
| `src/aislamiento/contexto-tenant.ts` | Modify | +4 |
| `src/app/rutas.ts` | Modify | +5 |
| `src/reportes/reporte-ejecucion.test.ts` | Create | +170 |
| `src/panel/panel-tablero.test.ts` | Create | +404 |
| `src/panel/panel-tablero-rutas.test.ts` | Create | +427 |
| `src/aislamiento/aislamiento-panel.test.ts` | Modify | +250 |
| `src/auditoria/auditoria-registro.test.ts` | Modify | +48 |
| `src/aislamiento/contexto-tenant.test.ts` | Modify | +41 |
| `src/app/rutas.test.ts` | Modify | +8 |
| `src/consola/consola-auth.test.ts` | Modify | +8 |

### Deviations from the design, with reasons

- **`sigueAbierto` reads the response, not the request.** The design's `!request.raw.destroyed && !reply.raw.writableEnded` would drop every queued run: on Node 24, `request.raw.destroyed` is already `true` once a GET's empty body has been read (checked with a plain `http` server). The route uses `!reply.raw.destroyed && !reply.raw.writableEnded`. `reply.raw.destroyed` turns `true` when the client goes away (also checked).
- **`Compuerta.pedir` answers `Promise<T | 'descartado'>`.** The design does not say what a dropped run resolves to. It resolves to the exported `DESCARTADO`, which only reaches requests that are already closed. The route answers it as `{ estado: 'error' }`, which goes nowhere.
- **`Compuerta` has an `ocupacion()` method, for tests only.** It proves that an idle tenant leaves no record.
- **The single-flight key uses the resolved days.** It is `tenant|report|days` after `diasDelPedido`, so a request with no `dias` and one with the default `dias` share a run. The design wrote `dias ?? '-'` from the raw query.
- **`no-store` is set in a route-level `onRequest` hook.** So the session hook's `401` carries it too, not only the handler's answers.
- **The `info` line's `filas` is `0` for `sin-datos`.** It is the row count for `ok` and `null` for every other state. The spec says "row count, or null".
- **The corrupt-report `error` line uses `app.log`**, like the `info` line, so both carry only their own fields.
- **The 400 for a malformed `dias` comes before the 404.** This is the design's order (§1.5 step 1). The spec lists the 404 first. Both answer before anything is dialed.
- **`ejecutarReporte` is checked through its two audit choices, not through the two routes.** The console route has no clock seam, and adding one would change its registrar. Both routes call this one function.

### Verification

- `npx tsc -p tsconfig.json --noEmit`: exit 0, no output.
- `npm run build`: exit 0.
- Focused command of unit a, with `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres TEST_DB_NAME=zerodashboard_test DATABASE_URL=postgresql://zerodashboard:postgres@localhost:5434/zerodashboard_test`: 192 tests, 192 pass, 0 fail.
- `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db`: 2102 tests, 2098 pass, 4 fail. The 4 are the known failures in `src/conexiones/conexiones.test.ts` (5.1, 5.3, 5.4, CH-07).

### For CH-48b

- The page reads `GET /api/panel/tablero` → `{ reportes: [{ id, titulo, descripcion, visualizacion, periodo: { dias, predeterminado } | null }], datos: { actualizadosEn: string | null }, zonaHoraria }`.
- A run is `GET /api/panel/tablero/<id>/resultado[?dias=N]` → `200 { estado }`. With `ok` it also has `columnas: [{ rol, titulo }]`, `filas` (positional, `valor` already a number), `corte: boolean` and `periodo: { dias, desde: 'YYYY-MM-DD' } | null`. The other answers are `400 { error: 'solicitud-invalida', campos: ['/dias'] }`, `404 reporte-no-encontrado`, `429 demasiadas-solicitudes`, and `401 sesion-invalida` / `sesion-expirada` (or `409 tenant-desactivado`) from the session hook.
- Any query key other than `dias`, or `dias` that is not 1 to 3 digits, is a `400`. The page sends no other key.
