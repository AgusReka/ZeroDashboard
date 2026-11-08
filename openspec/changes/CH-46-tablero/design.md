# Design: CH-46 — Tenant dashboard

Inputs: proposal.md, the five delta specs, DEC-183, DEC-198, DEC-199. Story R2h.

## 0. What the specs settle beyond DEC-199

None of these changes the model or a boundary, so none needs a new DEC. They are listed so the user can object.

- **`pendientes` is computed on read.** `GET /tablero` and the `PUT` answer report it; nothing about views is stored.
- **An unknown report id is a 400 with `desconocidos`.** It is not a 404, because the dashboard itself exists.
- **`conexionId` is required even for an empty dashboard.** One rule, with no null branch.
- **Switching the tenant discards unsaved changes on the screen**, with no prompt. The screen has no pop-up, so `crearDialogo`'s guard does not apply.
- **Changing the connection clears the pending lines until the next save.** The server is the only source of `pendientes`.
- **The duplicate keeps every field, client texts included**, unlike the template duplicate (DEC-191). A report's title is required, and the copy is not on any dashboard until P1 swaps it in.
- **The connection relation restricts deletes.** No route deletes a connection, so this only guards direct SQL.

## 1. Model and migration

`prisma/schema.prisma`:

```prisma
// CH-46 (DEC-199): one dashboard per tenant. `reportes` holds report ids in display order;
// no foreign key, because reports are never deleted (DEC-68) and the save checks each id.
model Tablero {
  id         String   @id @default(uuid())
  tenantId   String   @unique
  tenant     Tenant   @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  conexionId String
  conexion   Conexion @relation(fields: [conexionId], references: [id], onDelete: Restrict)
  reportes   String[]
}
```

Add the inverse fields: `Tenant.tablero Tablero?` and `Conexion.tableros Tablero[]`.

New migration `20261108000000_tablero`. It creates the table, the unique index on `tenantId`, and both foreign keys with `ON DELETE RESTRICT`. The header carries the rollback, `DROP TABLE "Tablero";`, and notes that reports become editable again. Follow the style of `20261105000000_vinculo_telegram`.

## 2. Isolation (`src/aislamiento/aislamiento-prisma.ts`)

- `Tablero` joins `MODELOS_AISLADOS`.
- The model-list test (`aislamiento.test.ts:1323-1348`) gains `Tablero`.
- A new `tablero` key in `extenderConAislamiento` holds two methods, beside `automatizacion.plantillaEnUso`, over the raw client:

```ts
/** CH-46 (DEC-199): whether any tenant's dashboard holds the report. Boolean only. */
async reporteEnUso(reporteId: string): Promise<boolean>;
// prisma.tablero.findFirst({ where: { reportes: { has: reporteId } }, select: { id: true } }) !== null

/** CH-46 (DEC-199): replace a report only if no dashboard holds it, under a row lock. */
async reemplazarReporteLibre(id: string, datos: Prisma.ReporteUpdateInput):
  Promise<'no-encontrado' | 'en-uso' | ReporteCompletoFila>;
// $transaction: SELECT "id" FROM "Reporte" WHERE "id" = ${id} FOR UPDATE; then the use check; then update.
```

**Decision: an explicit lock on the dashboard side.** The template lock works because an automation insert takes `FOR KEY SHARE` on its template through the foreign key (DEC-191). `reportes` is an array with no foreign key, so `PUT /tablero` must take that lock itself. Inside one `$transaction` on the scoped client, it runs:

```sql
SELECT "id" FROM "Reporte" WHERE "id" = ANY(${ids}) FOR KEY SHARE
```

and then writes. `FOR UPDATE` in the replace and `FOR KEY SHARE` in the save conflict, so neither can commit between the other's check and write. The query also gives the existing ids for the `desconocidos` check. It is a tagged `$queryRaw` over a global model: the ids go as one driver parameter (rule 4), and the tenant filter is not needed for `Reporte`.

**Decision: find, then create or update, instead of `upsert`.** The extension refuses `upsert` (`aislamiento-prisma.ts:154`). Inside the transaction, `findFirst` gives the tenant's row (scoped), then `update` by id or `create`. The unique `tenantId` turns a racing second create into a constraint error. The route answers it as a retry: one more attempt, inside the same handler.

## 3. Routes

### `src/tablero/tablero.ts`, pure

```ts
export const TOPE_REPORTES_TABLERO = 8;
export const tableroSchema; // strict body: conexionId (string, minLength 1), reportes (array of strings, maxItems 8, uniqueItems)
export function pendientesDe(entidades: unknown, filas: FilaVista[]): string[]; // over evaluarVistas
```

### `src/tablero/tablero-rutas.ts`

`registerTableroRoutes(app, prisma)` receives the scoped client and registers:

- **`GET /tablero`.**
  1. Read the tenant's row.
  2. Read the reports by id from the global delegate.
  3. Read the connection's `VistaCanonica` rows once.
  4. Build the entries in stored order. An id with no report is skipped, which cannot happen because reports are never deleted.
- **`PUT /tablero`.**
  1. AJV, giving 400 with `campos`.
  2. Ownership of the connection with a scoped `findUnique`, giving 404.
  3. The transaction of §2: lock, `desconocidos` check (400), write.
  4. Answer as `GET` does.

Neither route is exempt, and no row is added to `EXENCIONES_OPERADOR`.

### `src/reportes/reportes-rutas.ts`

- `registerReporteRoutes(app, reportes, uso: UsoDeReportes)`, with `UsoDeReportes = { enUso, reemplazarSiLibre }`, as `UsoDePlantillas` does.
- `GET /reportes/:id` adds `enUso`.
- `PUT /reportes/:id` keeps `rechazoDeReporte` first, then calls `uso.reemplazarSiLibre` and maps its answer to 404, 409 `reporte-en-uso` or 200.

### `src/app/rutas.ts`

- `registerReporteRoutes(app, prisma.reporte, { enUso: (id) => prisma.tablero.reporteEnUso(id), reemplazarSiLibre: (id, d) => prisma.tablero.reemplazarReporteLibre(id, d) })`.
- `registerTableroRoutes(app, prisma)` beside `/usuarios`.

## 4. Console (`src/consola/consola.ts`)

- **Nav.** `#tablero` in "Puesta en marcha" after `#usuarios`, with the label «Tablero del cliente».
- **Screen wiring.** `pantalla-tablero` with `zd-scope--tenant`. `PANTALLAS` gets `'tablero'` after `'usuarios'`, in both lists. `cargarPantallaTablero()` is called from `mostrarPantalla` and `cambiarTenant`.
- **Script block `// ---- CH-46 (DEC-199)`.**
  - State: `tableroGuardado` (`{ conexionId, ids }`), `tableroActual` and `generacionTablero`, the stale-answer token, as in Tiempos.
  - Rows are built with `createElement` and `textContent`.
  - «Subir» and «Bajar» swap neighbours in `tableroActual.ids` and re-render.
  - «Guardar» is enabled when `conexionId` is set and `tableroActual` differs from `tableroGuardado`.
  - No new `zd-*` token in the script.
- **Reportes changes.**
  - The side panel toggles `#reporte-editar` and a new `#reporte-duplicar`, plus `#reporte-en-uso-aviso`, from `enUso`, read as `enUso !== false` like templates.
  - The pop-up gains a duplicate mode: «(copia)» in the name, `POST` on save.
  - A 409 `reporte-en-uso` is handled as `plantilla-en-uso` is.
- **Design skill first.** In `guidelines/consola.md`, in both copies: a screen C-14 «Tablero del cliente», and the ordering pattern. The pattern is «Subir», «Bajar» and «Quitar» as secondary small buttons on each row, the disabled states at the ends, and the cap line.

## 5. Data flow (save)

```
console ──PUT /tablero {conexionId, reportes[]} (X-Tenant-Id)──▶ tablero-rutas.ts
   AJV ─────────────────────── 400 campos
   conexion.findUnique (scoped) ── 404 conexion-no-encontrada
   $transaction:
     SELECT id FROM "Reporte" WHERE id = ANY($1) FOR KEY SHARE ── 400 desconocidos
     tablero.findFirst (scoped) → update | create (tenantId from context)
   vistaCanonica.findMany({conexionId}) → pendientes per report
   200 { conexionId, reportes: [{id, nombre, titulo, visualizacion, pendientes}] }
```

## 6. Files

| File | Action | Estimate |
|---|---|---|
| `prisma/schema.prisma`, migration `20261108000000_tablero` | Modify, create | 40 |
| `src/aislamiento/aislamiento-prisma.ts` | Modify | 55 |
| `src/tablero/tablero.ts`, `tablero-rutas.ts` | Create | 220 |
| `src/reportes/reportes-rutas.ts`, `src/app/rutas.ts` | Modify | 50 |
| `src/consola/consola.ts` | Modify | 420 |
| Tests (below) | Create, modify | 850 |
| Guidelines (both copies), `docs/guia/09-reportes.md`, map | Modify | 80 |

About 1,700 changed lines.

## 7. Testing

| Layer | What | Where |
|---|---|---|
| Unit | Schema shape (9 ids, repeats, unknown key), `pendientesDe` | `src/tablero/tablero.test.ts` |
| Integration (DB) | No dashboard; save and read in order; empty list; another tenant's connection; unknown ids with nothing written; pending views not blocking; two tenants isolated; no audit row and nothing dialed on read | `src/tablero/tablero-rutas.test.ts` |
| Integration (DB) | `enUso` on read; 409 for a report on another tenant's dashboard; 200 after it leaves; 400 before 409; the lock: a save and a replace started concurrently, where one waits and the result is consistent | `src/reportes/reportes-rutas.test.ts` |
| Isolation | `Tablero` in `MODELOS_AISLADOS` and in the model list; the two unscoped methods return only a boolean or the outcome; `/tablero` not exempt | `aislamiento.test.ts`, `contexto-tenant.test.ts` |
| Routes | `/tablero` under the operator guard | `src/app/rutas.test.ts` |
| Console | Ids, nav order and `PANTALLAS`; load and render; «Subir» and «Bajar» limits; cap; «Guardar» state; pending lines and their clearing; no-tenant text; tenant switch; Reportes `enUso` toggles; duplicate mode; 409 handling | `src/consola/consola.test.ts` |

Run with `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db` and `npx tsc -p tsconfig.json --noEmit`.

## 8. Threat matrix

N/A: no shell, subprocess, VCS automation, executable-file classification or process integration. The tenant boundary is covered by the isolation tests above.

## 9. Rollout

The migration is additive, and no data is copied. Rollback is in its header.

## 10. Delivery

About 1,700 lines against the 400-line budget, with the Single PR strategy. The tasks forecast must stop for a `size:exception` or a split. If it splits, the natural cut is:
1. **CH-46a.** Model, isolation, routes and the in-use rule, with their tests (about 900 lines).
2. **CH-46b.** The console screen, the Reportes changes and the docs (about 800 lines).

## Open questions

None.
