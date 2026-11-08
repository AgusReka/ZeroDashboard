# Design: CH-45 — Reports: model, global catalog and console screen

Inputs: proposal.md, the five delta specs, DEC-183, DEC-184, DEC-198. Story R1h.

## 0. What the specs settle beyond DEC-198

None of these changes the model or a boundary, so none needs a new DEC. They are listed so the user can object.

- **Caps on the declaration.**
  - `dias`: 1 to 6 values, each from 1 to 366.
  - `nombre` and `titulo`: 80 characters each. Column titles: 40.
  - A table: at most 10 columns.
  - `columna`: 63 characters, the PostgreSQL identifier limit.
- **The unsaved test does not need columns.** It is what produces them, like the unsaved-template test (DEC-191).
- **The test answer adds `periodo` and `faltantes`.** The console shows the date used, and the missing columns become the report's error state instead of a broken table (DEC-184).
- **The side-panel test shows only the assigned columns, under their titles.** It is the closest thing to what the client will see before CH-48. The pop-up test shows every column, because P1 is still choosing them.
- **The column inputs are selects filled from the last test.** That removes typos, which save time would otherwise refuse anyway.
- **The fingerprint covers the SQL, the period, the entities and the connection.** Titles, visualization and columns do not touch the query, as client texts do not for templates.

## 1. Model and migration

`prisma/schema.prisma`:

```prisma
// CH-45 (DEC-183, DEC-198): a report is global like `Plantilla` (no `tenantId`). Values of
// `visualizacion`, `columnas` and `periodo` are checked in code. Replaced in place, never
// deleted (DEC-68). It holds no rows (DEC-93).
model Reporte {
  id            String  @id @default(uuid())
  nombre        String
  titulo        String
  descripcion   String?
  sql           String
  entidades     Json
  visualizacion String
  columnas      Json
  periodo       Json?
}

model RegistroEjecucion {
  // ...
  reporteId          String?
}
```

New migration `20261107000000_reportes`:

```sql
-- CH-45: the global report catalog and the report id of an audit row (DEC-183, DEC-198).
-- Additive. "RegistroEjecucion" triggers fire on UPDATE, DELETE and TRUNCATE only, so
-- ADD COLUMN is allowed and existing rows read null.
-- Rollback (after reverting the code units):
--   ALTER TABLE "RegistroEjecucion" DROP COLUMN "reporteId";
--   DROP TABLE "Reporte";
CREATE TABLE "Reporte" (
  "id" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "titulo" TEXT NOT NULL,
  "descripcion" TEXT,
  "sql" TEXT NOT NULL,
  "entidades" JSONB NOT NULL,
  "visualizacion" TEXT NOT NULL,
  "columnas" JSONB NOT NULL,
  "periodo" JSONB,
  CONSTRAINT "Reporte_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "RegistroEjecucion" ADD COLUMN "reporteId" TEXT;
```

Before writing the migration, check how `20260927100000_plantilla` declares its id. If it relies on Prisma generating the uuid in the client, as `@default(uuid())` does, follow it.

## 2. Pure rules (`src/reportes/reportes.ts`)

```ts
export const VISUALIZACIONES = ['numero', 'tabla', 'barras', 'linea'] as const;
export type Visualizacion = (typeof VISUALIZACIONES)[number];

/** DEC-198. The effective ceiling is `Math.min(TOPE_FILAS[v], maxFilasPorConsulta)`. */
export const TOPE_FILAS: Record<Visualizacion, number> = { numero: 1, barras: 20, tabla: 50, linea: 100 };

export type Rol = 'valor' | 'etiqueta' | 'columna';
export interface ColumnaAsignada { rol: Rol; columna: string; titulo: string }
export interface Periodo { parametro: string; dias: number[] }

/** The roles each type takes, in order; `tabla` is 1..10 entries of `columna`. */
export function rechazoDeColumnas(v: Visualizacion, columnas: readonly ColumnaAsignada[]): string[]; // JSON pointers

/** `[]` with no period, else `[{ nombre: parametro, tipo: 'fecha' }]` for `problemasDePlantilla` and `prepararSentencia`. */
export function declaracionDelPeriodo(periodo: Periodo | null): DeclaracionParametro[];

/** `YYYY-MM-DD`: today in `zona`, minus `dias` calendar days. */
export function fechaDelPeriodo(ahora: Date, zona: string, dias: number): string;

/** Assigned columns absent from `columnas`, in assignment order. */
export function faltantesEn(asignadas: readonly ColumnaAsignada[], columnas: readonly string[]): string[];

/** Stored JSON read back fail-closed, like `leerEntidades`: a corrupt row throws, never runs. */
export function leerReporte(fila: FilaReporte): ReporteLeido;
```

`fechaDelPeriodo` reads the year, month and day with `Intl.DateTimeFormat(…, { timeZone: zona }).formatToParts`, then subtracts with `Date.UTC(a, m - 1, d - dias)`. Calendar arithmetic in UTC has no daylight-saving gaps, and the zone is only used to know which day "today" is. The zone is `loadConfig().zonaHoraria` (DEC-77), the one the scheduler uses.

**Decision: derive the declaration, do not store it.** One source of truth for the period. `problemasDePlantilla` and `prepararSentencia` receive the derived array, so the DEC-56/57/59 checks and the bind path are reused unchanged.

## 3. Shared run step (`src/ejecucion/ejecucion-sobre-vistas.ts`)

`ejecutarPrueba` and `probarContraConexion` move out of `plantilla-prueba.ts` into one exported function that returns the answer instead of sending it:

```ts
export interface PedidoSobreVistas {
  conexionId: string;
  sql: string;
  parametros: unknown;
  entidades: unknown;
  valores: Record<string, unknown>;
  limite: number;
  desplazamiento: number;
  topeFilas: number;
  auditoria: { origen: OrigenEjecucion; plantillaId: string | null; reporteId: string | null };
  /** The `warn` line's message, kept per caller so existing logs do not change. */
  mensajeFallo: string;
}

export type RespuestaSobreVistas =
  | { codigo: 200; cuerpo: ResultadoEjecucion }
  | { codigo: 400 | 404 | 409; cuerpo: Record<string, unknown> };

export function ejecutarSobreVistas(
  app: FastifyInstance, prisma: PrismaAislado, request: FastifyRequest,
  pedido: PedidoSobreVistas, canales: AbridorDeCanales,
): Promise<RespuestaSobreVistas>;
```

The order and the bodies stay exactly as they are today: ownership (404), DEC-71 gate (409), prepare (400 `{campos, problemas}`), credential (409 or 404), execute, `warn` on failure, audit, 200. `plantilla-prueba.ts` keeps its schemas and routes and sends what the function returns. Its `topeFilas` stays `loadConfig().maxFilasPorConsulta`.

**Decision: extract rather than copy.** CH-48 runs the same sequence from the panel. With a copy, the DEC-71 gate would live in two places. `plantilla-prueba.test.ts` must pass unchanged: it is the proof that the extraction changed no behavior.

**Decision: return the answer instead of sending it.** The report routes add `periodo` and `faltantes` to a 200. A function that sent the reply would need a callback for that.

## 4. Routes

### Catalog (`src/reportes/reportes-rutas.ts`)

`registerReporteRoutes(app, prisma.reporte)` receives only the `reporte` delegate, like the template catalog (DEC-61).

`registroReporteSchema` is strict (`additionalProperties: false`, `propertyNames.enum`). Every key is listed in `properties`, or `removeAdditional` would drop it in silence. `columnasPrueba` is a check input only, as in CH-39.

`rechazoDeReporte(validationError, cuerpo, { exigirColumnas })` runs these checks in order. The first refusal wins:
1. AJV, with `campos` from `camposInvalidos`.
2. Client texts: caps and glossary, with `terminos`.
3. The period: `/periodo/parametro` against the name rule of `validarDeclaracion`, and `/periodo/dias`.
4. Columns by role, then the column titles: caps and glossary.
5. `exigirColumnas`: `columnasPrueba` is present and `faltantes` is empty.
6. A statement that is blank once sanitized.
7. `problemasDePlantilla(sql, declaracionDelPeriodo(periodo))`, as `{campos, problemas}`.

### Test (`src/reportes/reporte-prueba.ts`)

`registerReportePruebaRoutes(app, prisma, zonaHoraria, topeFilas, canales)`, scoped.

`POST /reportes/prueba` takes the registration schema plus `conexionId` and `dias`, with `exigirColumnas: false`. `POST /reportes/:id/prueba` takes `{ conexionId, dias? }`, reads the report unscoped (it is global) and answers 404 `reporte-no-encontrado` if there is none.

Both routes then do the following before calling `ejecutarSobreVistas`:
- Check `dias` against the period (400 `/dias`).
- Compute `desde = fechaDelPeriodo(new Date(), zonaHoraria, dias)`.
- Use `valores = { [parametro]: desde }`, or `{}` with no period.
- Use `topeFilas = tope`, with `tope = Math.min(TOPE_FILAS[v], topeFilas)`, and `limite = tope + 1` with `desplazamiento = 0`. The engine reports `corte` only when the requested page is larger than the ceiling (DEC-18), so asking for one more row is what makes the cut visible.

On a 200 `ok`, they add `periodo` and `faltantes`.

### Wiring and isolation

- `src/app/rutas.ts` registers both, beside the template ones, passing `zonaHoraria` and `topeFilas` from its one `loadConfig()`.
- `src/aislamiento/contexto-tenant.ts` gains `REPORTES_EXENTOS`, with exact rows for the four catalog routes, checked beside `PLANTILLAS_EXENTAS`.
- `Reporte` stays out of `MODELOS_AISLADOS`.
- No row is added to `EXENCIONES_OPERADOR`.

### Audit

- `OrigenEjecucion` gains `reporte-prueba`.
- `ContextoAuditado` gains `reporteId?: string | null`, written as `?? null` by `filaDeAuditoria`, so the existing callers do not change.
- The `GET /auditoria` select (`auditoria.ts:201`) adds `reporteId`.

## 5. Data flow (stored-report test)

```
console ──POST /reportes/:id/prueba {conexionId, dias}──▶ reporte-prueba.ts
   reporte.findUnique (global) ── 404 reporte-no-encontrado
   dias ∈ periodo.dias ─────────── 400 /dias
   desde = fechaDelPeriodo(now, DEC-77 zone, dias)
   ejecutarSobreVistas ─▶ conexion (scoped, 404) ─▶ vistas + evaluarVistas (409)
        ─▶ componerSentencia ─▶ prepararSentencia(:desde bound) (400)
        ─▶ destinoDeConexion (409/404) ─▶ ejecutarConsulta(limite = tope)
        ─▶ registrarEjecucion {origen: reporte-prueba, reporteId}
   200 + { periodo: {dias, desde}, faltantes }
```

## 6. Console (`src/consola/consola.ts`)

- **Nav and screen.** `#reportes` in "Global" after `#plantillas`, `pantalla-reportes` and its `PANTALLAS` entry, and `cargarPantallaReportes()` in `mostrarPantalla`.
- **Script block.** `// ---- CH-45 (DEC-183, DEC-198)`, mirroring the templates block:
  - list and drawer;
  - side-panel test;
  - pop-up with the fingerprint, `ultimaPruebaReporte = { huella, ok, columnas }` and the «Guardar» reason, as `motivoGuardadoPlantilla` does;
  - column rows per role.
- **Audit.** `ORIGENES_AUDITORIA` gains «Prueba de reporte». The Consulta cell shows «Reporte <id>» when `reporteId` is set.
- **Guards.**
  - Every new id goes in `IDS`, and the ones that start hidden in `IDS_OCULTOS`.
  - `PANTALLAS` is updated in both lists.
  - No `zd-*` token is added to the script, so G3' stays as is.
  - All text goes through `textContent` (`sinPeligros`).
- **Design skill.** `guidelines/consola.md` and `guidelines/pantallas.md` gain the screen, in both copies, written before the markup.

## 7. Files

| File | Action | Estimate |
|---|---|---|
| `prisma/schema.prisma`, `prisma/migrations/20261107000000_reportes/` | Modify, create | 40 |
| `src/reportes/reportes.ts` | Create | 170 |
| `src/reportes/reportes-rutas.ts` | Create | 260 |
| `src/reportes/reporte-prueba.ts` | Create | 170 |
| `src/ejecucion/ejecucion-sobre-vistas.ts` | Create (moved code) | 130 |
| `src/plantillas/plantilla-prueba.ts` | Modify (−110) | 30 |
| `src/auditoria/auditoria.ts` | Modify | 15 |
| `src/aislamiento/contexto-tenant.ts`, `src/app/rutas.ts` | Modify | 25 |
| `src/consola/consola.ts` | Modify | 700 |
| Tests (below) | Create, modify | 1300 |
| Design guidelines (both copies), `docs/guia/05-plantillas.md` or a new `docs/guia/` page, `docs/02-mapa-de-changes.md` | Modify | 120 |

About 2,950 changed lines, with the moved block counted on both sides.

## 8. Testing

| Layer | What | Where |
|---|---|---|
| Unit | Roles per type; period caps; derived declaration; `fechaDelPeriodo` across a zone offset and a month boundary; `faltantesEn`; `leerReporte` failing closed; effective cap | `src/reportes/reportes.test.ts` |
| Integration (DB) | Catalog CRUD with no tenant header; every 400 of the check order; `columnasPrueba`; replace in place; no delete; 401 without an operator | `src/reportes/reportes-rutas.test.ts` |
| Integration (DB) | Both tests: two tenants with one report; another tenant's connection (404, nothing dialed); 409 gate; undeclared `dias`; bound date; cap and `corte`; `faltantes`; one audit row with `reporteId` and no date; refused requests write nothing | `src/reportes/reporte-prueba.test.ts` |
| Regression | Unchanged after the extraction | `src/plantillas/plantilla-prueba.test.ts` |
| Isolation | The four exempt rows and the look-alikes; `Reporte` not in `MODELOS_AISLADOS` | `contexto-tenant.test.ts`, `aislamiento.test.ts` |
| Routes | Every new route guarded by the operator guard | `src/app/rutas.test.ts` (existing sweep) |
| Audit | `reporte-prueba` and `reporteId` written; null on older rows | `auditoria.test.ts`, `auditoria-registro.test.ts` |
| Console | Ids, nav order, `PANTALLAS`, drawer, test block states, pop-up fingerprint and «Guardar» reasons, column rows, audit labels, markup as text | `src/consola/consola.test.ts` |

Run with `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db`, and type-check with `npx tsc -p tsconfig.json --noEmit`.

## 9. Threat matrix

N/A: no shell, subprocess, VCS automation, executable-file classification or process integration. The HTTP boundary that matters here, the tenant exemption, is covered by exact rows and by the isolation tests above.

## 10. Rollout

The migration is additive. Existing audit rows read `reporteId` null. Rollback is in the migration header.

## 11. Delivery

About 2,950 lines against the 400-line budget, with the Single PR strategy. The tasks forecast must stop for a `size:exception` or a split. If it splits, the natural cut is:
1. **CH-45a.** Model, rules, routes, extraction, audit and their tests (about 1,500 lines).
2. **CH-45b.** Console screen, guides and its tests (about 1,450 lines).

## Open questions

None.
