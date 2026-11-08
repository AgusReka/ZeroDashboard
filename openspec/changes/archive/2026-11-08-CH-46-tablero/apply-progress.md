# Apply progress: CH-46 — Tenant dashboard

## Unit 1 (backend): tasks 1.1 to 5.1, done

Phases 6 to 8 (console, docs, final verification) are unit 2, below.

### Tasks done

- 1.1, 1.2: the `Tablero` model, the inverse fields and migration `20261108000000_tablero`. The Prisma client is regenerated.
- 2.1, 2.2: `Tablero` in `MODELOS_AISLADOS`, the `tablero.reporteEnUso` and `tablero.reemplazarReporteLibre` methods, and their isolation tests.
- 3.1 to 3.6: `src/tablero/tablero.ts`, `src/tablero/tablero-rutas.ts`, the wiring in `src/app/rutas.ts`, and their tests.
- 4.1 to 4.3: the `UsoDeReportes` port, `enUso`, the `409 reporte-en-uso`, the wiring, and the tests.
- 5.1: typecheck and the focused command.

### Files touched

| File | Action | Lines (+/-) |
|---|---|---|
| `prisma/schema.prisma` | Modify | +15 |
| `prisma/migrations/20261108000000_tablero/migration.sql` | Create | +28 |
| `src/aislamiento/aislamiento-prisma.ts` | Modify | +48 |
| `src/reportes/reportes.ts` | Modify | +28 |
| `src/reportes/reportes-rutas.ts` | Modify | +42 / -29 |
| `src/app/rutas.ts` | Modify | +10 / -1 |
| `src/tablero/tablero.ts` | Create | +49 |
| `src/tablero/tablero-rutas.ts` | Create | +141 |
| `src/tablero/tablero.test.ts` | Create | +105 |
| `src/tablero/tablero-rutas.test.ts` | Create | +265 |
| `src/reportes/reportes-rutas.test.ts` | Modify | +371 / -11 |
| `src/aislamiento/aislamiento.test.ts` | Modify | +166 / -1 |
| `src/aislamiento/contexto-tenant.test.ts` | Modify | +32 |
| `src/app/rutas.test.ts` | Modify | +7 |

### Deviations from the design, with reasons

- **`ReporteResumen` and `ReporteCompleto` moved to `src/reportes/reportes.ts`.** The isolation extension needs `ReporteCompleto` at runtime, and `reportes-rutas.ts` reaches `aislamiento-prisma.ts` through `plantillas-rutas.ts`, which would be a cycle. This repeats what CH-38 did with `PlantillaCompleta`. `reportes-rutas.ts` re-exports both, so no importer changes.
- **`POST /reportes` and a successful `PUT /reportes/:id` also answer `enUso: false`.** The design only names `GET`. This mirrors the template routes (DEC-191), so every report answer has the same shape. The existing CH-45 test that compared the create echo with the stored row now takes `enUso` out first and asserts it is `false`. No assertion was weakened.
- **The `PUT /tablero` answer is built from the saved values**, not from a second read of the row. Same body as `GET`, one read fewer.
- **The `tablero.test.ts` shape cases run through Fastify's AJV** with a client that throws on any use, not through a separate AJV instance. Fastify's options (`coerceTypes: 'array'`, `removeAdditional`) are the ones that matter. So a bare string for `reportes` is wrapped into a one-item array rather than refused. No case depends on that.

### Verification

- `npx tsc -p tsconfig.json --noEmit`: exit 0, no output.
- `npm run build:agente`: exit 0.
- `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db`: applied `20261108000000_tablero`. 2000 tests, 1996 pass, 4 fail. The 4 are the known failures in `src/conexiones/conexiones.test.ts` (5.1, 5.3, 5.4, CH-07), which also fail on master.
- Focused command (`src/tablero`, `src/reportes`, `src/aislamiento`, `src/app/rutas.test.ts`, `src/plantillas/plantillas-rutas.test.ts`): 312 tests, 312 pass, 0 fail.
- A mutation check took `FOR KEY SHARE` out of the `PUT /tablero` lock. The case "a replace in flight makes a dashboard save wait" failed, so the lock tests discriminate. The code was restored.

## Unit 2 (console and docs): tasks 6.1 to 8.2, done

### Tasks done

- 6.1: screen C-14 «Tablero del cliente», the ordering pattern (section 4), the C-13 in-use and duplicate rules, the `#tablero` route and the CH-46 row in `guidelines/consola.md`; C-24 and its row in `guidelines/pantallas.md`. Both copies (`.claude` and `.agents`) are byte-identical.
- 6.2: `#nav-tablero` after `#nav-usuarios`, and `pantalla-tablero` with «Guardar» (primary, in the header), the connection select, the ordered list, «Agregar reporte» and «Agregar». Local CSS classes only; no new `zd-*` token in the script.
- 6.3: the `// ---- CH-46 (DEC-199, screen C-14)` block: the three reads in parallel with the `generacionTablero` stale-answer token, rows with «Subir», «Bajar» and «Quitar», the cap of 8, the «Guardar» state, the pending lines and their clearing on a connection change, the empty and no-tenant texts, the save and its refusals. `PANTALLAS`, `mostrarPantalla` and `cambiarTenant` are wired.
- 6.4: Reportes: `enUso` toggles «Editar», «Duplicar y editar» and the notice; the pop-up's duplicate mode («Duplicar reporte», « (copia)», every field, `POST`); the `409 reporte-en-uso` handling with `#reporte-dialogo-duplicar`.
- 6.5: `IDS`, `IDS_OCULTOS`, the test's `PANTALLAS`, the fake DOM's select list, and 15 new cases (every "Tenant Dashboard Screen" scenario, the nav order, the in-use panel, the duplicate mode, the 409, markup as text).
- 7.1: `docs/guia/09-reportes.md`: the dashboard section, pending views, a report in use, the two routes and the `enUso` and `409` additions, two limits.
- 7.2: `docs/02-mapa-de-changes.md`: the CH-46 row with DEC-199, "Un solo PR con `size:exception`" and "PR #—".
- 8.1, 8.2: the verification below.

### Files touched

| File | Action | Lines (+/-) |
|---|---|---|
| `src/consola/consola.ts` | Modify | +432 / -14 |
| `src/consola/consola.test.ts` | Modify | +375 / -3 |
| `.claude/skills/zerodashboard-design/guidelines/consola.md` | Modify | +31 / -2 |
| `.claude/skills/zerodashboard-design/guidelines/pantallas.md` | Modify | +8 |
| `.agents/skills/zerodashboard-design/guidelines/consola.md` | Modify | +31 / -2 |
| `.agents/skills/zerodashboard-design/guidelines/pantallas.md` | Modify | +8 |
| `docs/guia/09-reportes.md` | Modify | +35 / -5 |
| `docs/02-mapa-de-changes.md` | Modify | +1 / -1 |

### Deviations from the design, with reasons

- **«Guardar» sits in the screen header as the primary action**, with its result in the status line right below. The guideline asks for one primary action per screen, in the header.
- **The three reads leave together** (`Promise.all`), the dashboard first. It saves two round trips and keeps the request order fixed, which the fake-`fetch` tests depend on.
- **The 409 path keeps the passing test.** After `409 reporte-en-uso`, «Duplicar y editar» turns the open pop-up into a copy of what was just tested, so «Guardar» stays enabled and sends a `POST`, as the template 409 path does (CH-38). A copy opened from the side panel needs its own test, as the spec says.
- **`#reporte-dialogo-duplicar`** is a new id beside the design's `#reporte-duplicar` and `#reporte-en-uso-aviso`, mirroring `#plantilla-dialogo-duplicar`.
- **`CH-45`'s fixture `REPORTE_CH45` gained `enUso: false`.** A missing `enUso` now reads as in use, so the CH-45 cases that press «Editar» need a free report. No assertion was changed.

### Verification

- `npx tsc -p tsconfig.json --noEmit`: exit 0.
- `npm run build`: exit 0. `npm run build:agente`: exit 0.
- `npx tsx --test src/consola/*.test.ts` (with the `TEST_DB_*` and `DATABASE_URL` variables): 471 tests, 471 pass.
- `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db`: 2015 tests, 2011 pass, 4 fail. The 4 are the known failures in `src/conexiones/conexiones.test.ts` (5.1, 5.3, 5.4, CH-07).
- `npx prisma migrate status` on the test database: 23 migrations, "Database schema is up to date!". `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma`: "No difference detected."
- A mutation check broke three behaviours (the first row's «Subir» enabled, pending lines kept on a connection change, a missing `enUso` read as free); each made a CH-46 case fail. The code was restored.
