# Apply progress: CH-45, work unit 1 (backend)

Scope: tasks 1.1 to 6.4. Phases 7 to 9 (console, docs, final verification) are work unit 2.

## Tasks done

1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 3.3, 4.1, 4.2, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4.

## Files

| File | Action |
|---|---|
| `prisma/schema.prisma` | `Reporte` model, `RegistroEjecucion.reporteId` |
| `prisma/migrations/20261107000000_reportes/migration.sql` | Created. The id has no database default, like `Plantilla` |
| `src/reportes/reportes.ts` | Created: lists, caps, roles, period, date, `faltantesEn`, `leerReporte` |
| `src/reportes/reportes-rutas.ts` | Created: schema, `rechazoDeReporte` (seven steps), `GET`/`POST /reportes`, `GET`/`PUT /reportes/:id` |
| `src/reportes/reporte-prueba.ts` | Created: `POST /reportes/prueba`, `POST /reportes/:id/prueba` |
| `src/ejecucion/ejecucion-sobre-vistas.ts` | Created: `ejecutarSobreVistas`, moved from `plantilla-prueba.ts` |
| `src/plantillas/plantilla-prueba.ts` | The moved block replaced by a call to `ejecutarSobreVistas` |
| `src/auditoria/auditoria.ts` | `reporte-prueba` origin, optional `reporteId`, `reporteId` in the listing select |
| `src/aislamiento/contexto-tenant.ts` | `REPORTES_EXENTOS` with four exact rows |
| `src/app/rutas.ts` | Both registrars wired |
| `src/reportes/*.test.ts` | Created: pure rules, catalog, test routes |
| `src/auditoria/auditoria*.test.ts`, `src/aislamiento/contexto-tenant.test.ts`, `src/aislamiento/aislamiento.test.ts`, `src/app/rutas.test.ts` | Extended |

`src/plantillas/plantilla-prueba.test.ts` was not edited.

## Deviations from design

1. **`limite` is the cap plus one.** Design §4 says `limite = topeFilas = tope`. With that, `corteDeEjecucion` never reports a cut, because it needs the requested limit to be above the ceiling (DEC-18). The spec requires `corte` when bars are cut at 20. The route now sends `limite: tope + 1` and `topeFilas: tope`. The page served and the ceiling are both `tope`.
2. **`topeFilas` is optional in `PedidoSobreVistas`.** The template routes leave it out. `ejecutarConsulta` then reads `maxFilasPorConsulta` at execution time, as before. A `loadConfig()` call in the route would run before the 4xx gates and could change their answers.
3. **`periodo` is on every `200`, `faltantes` only on `ok`.** Design §4 adds both only on `ok`. The spec says "a completed attempt SHALL be 200 … plus `periodo`", and that `faltantes` applies "on a successful result". The code follows the spec.
4. **A `sin-usar` problem points at `/periodo/parametro`.** `problemasDePlantilla` names the derived declaration's entry `/parametros/0/nombre`, a field the report body does not have. The pointer is remapped in the problem and in `campos`.
5. **Column title refusals name `/columnas/<i>/titulo`**, with `terminos`. A wrong role shape names `/columnas`, as the spec requires.
6. **The unsaved test runs the role check only when it assigns columns.** An absent or empty `columnas` skips it, because that test is what produces the columns.

## Spec wording note (no decision needed)

The scenario "a write statement" uses `DELETE FROM x` and expects `no-es-lectura`. Composed inside `SELECT * FROM (...)`, a bare `DELETE` is a syntax error (`42601`, `error-sintaxis`). Only a data-modifying CTE gives `0A000`, `no-es-lectura`. The same is true of the template test. The tests assert `no-es-lectura` for the CTE form and `fallo` for the bare statement. The spec could say "a data-modifying statement".

## Verification

- `npx tsc -p tsconfig.json --noEmit`: exit 0.
- `npm run build:agente`: exit 0.
- Focused run (`src/reportes/*.test.ts`, `plantilla-prueba.test.ts`, `src/auditoria/*.test.ts`, `contexto-tenant.test.ts`, `aislamiento.test.ts`, `rutas.test.ts`): 261 tests, 261 pass, 0 fail.
- `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db`: 1934 tests, 1930 pass, 4 fail. The 4 failures are the known environmental ones in `src/conexiones/conexiones.test.ts` (5.1, 5.3, 5.4, CH-07). The password `postgres` appears in `"motor":"postgres"`.
- `npx prisma migrate status` against `zerodashboard_test`: 22 migrations, the schema is up to date.

---

# Apply progress: CH-45, work unit 2 (console and docs)

Scope: tasks 7.1 to 9.2. Unit 1 was read, not changed.

## Tasks done

7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 9.1, 9.2.

## Files

| File | Action |
|---|---|
| `.claude/skills/zerodashboard-design/guidelines/consola.md` and the `.agents` copy | Reportes in the Global navigation and routes, screen C-13, the audit label in C-12, the CH-45 row |
| `.claude/skills/zerodashboard-design/guidelines/pantallas.md` and the `.agents` copy | C-23 Reportes, pointing to `consola.md` C-13, and the CH-45 row |
| `src/consola/consola.ts` | `#reportes` link, `pantalla-reportes` (list, side panel with its test block, pop-up), bridge styles for the script-built column rows, the `CH-45` script block, the tenant switch, `PANTALLAS`, `mostrarPantalla`, the audit origin and Consulta cell |
| `src/consola/consola.test.ts` | `IDS`, `IDS_OCULTOS`, the select ids of the fake DOM, `PANTALLAS`; 24 cases for the screen and 1 for the audit labels |
| `docs/guia/09-reportes.md` | Created |
| `docs/guia/README.md` | Nine guides; row for 09 |
| `docs/02-mapa-de-changes.md` | CH-45 row: DEC-183, DEC-198, the guide, one PR with `size:exception`, `PR #—` for the parent to fill |

## Deviations from design and spec

1. **The pop-up test sends no `columnas`.** The spec says it sends "the form's report". Before the first passing test the column selects are empty, so sending the rows would always fail AJV or the role check. The backend already skips the role check when `columnas` is absent (unit 1, deviation 6). The save sends the rows and `columnasPrueba`, and the server checks them there.
2. **One day reads «Último día».** The spec shows «Últimos N días»; for `1` that would read «Últimos 1 días».
3. **The column selects are disabled while they offer nothing.** An edit keeps the stored choices in the row model, so a passing test selects them again. A passing test empties an assigned column the result no longer has.
4. **«Guardar» is gated only by the test and its fingerprint**, as the spec says. A missing name, title or column is left to the server, whose `400` the pop-up names field by field (`/columnas/<i>/titulo` reads «título de la columna N»).
5. **The period control is a select «Sin período» / «Con período»**, with «Nombre del parámetro» (default `desde`) and «Días» («30, 7») shown only with a period. A day that is not an integer is sent as typed, so the server names `/periodo/dias`.
6. **The days chosen for a test are not in the fingerprint.** The fingerprint has the declared period, as the spec says.
7. **The CH-45 row lost its ⚠ marker**, since DEC-198 is firm.

## Verification

- `npx tsc -p tsconfig.json --noEmit`: exit 0.
- `npm run build`: exit 0. `npm run build:agente`: exit 0.
- `npx tsx --test src/consola/*.test.ts` (with the `TEST_DB_*` variables): 456 tests, 456 pass, 0 fail (25 of them CH-45).
- `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db`: 1959 tests, 1955 pass, 4 fail. The 4 are the known environmental ones in `src/conexiones/conexiones.test.ts` (5.1, 5.3, 5.4, CH-07).
- `npx prisma migrate status` against `zerodashboard_test`: 22 migrations, the schema is up to date.
