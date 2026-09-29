# Design: CH-13 — Engine: Scheduling and Execution (X1, X2)

## Technical Approach

Two new tenant-scoped models, `Automatizacion` and `Ejecucion`, join `MODELOS_AISLADOS`. An in-process scheduler (`src/planificador.ts`) is started by `src/server.ts` after `listen` (DEC-75). On each tick it reads active `Tenant` rows, enters each tenant's context with `conTenantActivo`, and runs that tenant's due active automations. A run reuses the CH-12 pipeline unchanged: `evaluarVistas` → `componerSentencia` → `prepararSentencia` → `destinoDeConexion` → `ejecutarConsulta`. Each run writes one `Ejecucion` row that holds metadata only. New header-scoped routes and a console section cover DEC-78/79/80. No existing route, budget, or execution path changes.

## Architecture Decisions (implementation-level, within DEC-01..80)

| Topic | Choice | Rejected | Rationale |
|---|---|---|---|
| Cron library (DEC-76) | `cron-parser` 5.x, pinned to the exact version at install. API: `CronExpressionParser.parse(expr, { currentDate, tz }).next().toDate()` | `croner`, `node-cron`, `node-schedule` (these include a job runner); hand-rolled parsing | Parse and next-fire only, as DEC-76 requires; TS types included; `tz` is native |
| Cron shape | Exactly 5 fields, checked before parsing; no `@aliases`, no seconds field | Anything the library accepts | "Standard cron" (DEC-76); keeps the parsed surface closed |
| Timezone (DEC-77) | `ZONA_HORARIA_AUTOMATIZACIONES`, optional, default `UTC`. Validated at boot with `Intl.DateTimeFormat(…, { timeZone })`; an invalid value stops the process | A required variable; per-tenant timezone | Same optional-with-default pattern as DEC-19. Fails closed like DEC-17. No new dependency |
| Tick | A self-rescheduling `setTimeout` aligned to the next whole minute + 1 s. Each tick evaluates the window `(previous tick, now]` | `setInterval`; a timer per automation | Ticks never overlap. A slow tick does not lose fires, because the next window covers the gap. At boot, `previous = now`, so there is no catch-up (DEC-75, CH-17) |
| Due check | Due when `next(max(windowStart, creadaEn)) <= now`. At most one run per automation per tick | One run per fire missed inside the window | Never fires before creation. Catch-up and overlap handling belong to CH-17 |
| Concurrency | Sequential: tenant by tenant, then automation by automation | Parallel runs | Enough for R1 volume. The per-run `catch` only records the failure; CH-18 owns isolation guarantees |
| Run placement | Pipeline in `planificador.ts`; pure helpers in `automatizaciones.ts` | Refactoring `plantilla-prueba.ts` into a shared runner | Leaves CH-12 untouched, so rollback stays clean. The two differ only in how they map outcomes (reply vs row) |
| Page for a run | `limite = maxFilasPorConsulta`, `desplazamiento = 0` | A new budget | No new configuration (DEC-19). Rows are counted and then discarded (D-1 leaning) |
| Values | Checked when the automation is created (`prepararSentencia` against the template's declaration), and checked again on every run | Trusting the stored JSON | DEC-68 replaces a template in place, so stored values can go stale. A stale value becomes `valores-invalidos` |
| Stop | `POST /automatizaciones/:id/desactivar`: read first; `404` if unknown, `409 automatizacion-desactivada` if already inactive | `PATCH`, delete | Shape mirrors `/tenants/:id/baja`; named `desactivar` per the spec. DEC-79 allows no edit and no reactivation |
| Timestamps | `iniciadaEn` and `finalizadaEn` come from the injected clock, not `@default(now())` | DB defaults | Tests can control time |

## Design-level resolutions (register in `docs/01-decisiones.md`, CH-06 format)

1. **Under DEC-13 / DEC-14:** the scheduler becomes the second production entry into the tenant context, so `conTenantActivo` is no longer limited to tests and seeds. Tenant ids come only from own-database `Tenant` rows with `activo = true`, never from a request (rule 2). There is one context per tenant, and only that tenant's automations run inside it. The fail-closed extension stays the only filter: the scheduler never writes `tenantId` in a `where`.
2. **Under DEC-71:** the gate applies to scheduled runs as well. A refused run records `fallo / preparacion / vista-canonica-no-aprobada` and connects to nothing.

## Data Flow — Scheduled Run

```
Reloj  Planificador                 own DB (extended client)            tenant PG
 │ tick(now)
 ├───▶ tenant.findMany{activo:true}            (Tenant: unscoped model)
 │     for each T: conTenantActivo(T, …)
 │       automatizacion.findMany{activo:true}  [+tenantId]
 │       filter estaVencida(cron, max(start,creadaEn), now, zona)
 │       for each due A:
 │         ejecucion.create{en-curso, iniciadaEn}          [+tenantId]
 │         plantilla.findUnique (global) · vistaCanonica.findMany{conexionId} [+tenantId]
 │         evaluarVistas ──✗──▶ close: fallo/preparacion/vista-canonica-no-aprobada
 │         componerSentencia → prepararSentencia ──✗──▶ close: valores-invalidos
 │         destinoDeConexion ──✗──▶ close: conexion-no-encontrada | credencial-ilegible
 │         ejecutarConsulta ─────────────────────────────────────▶ READ ONLY + DEC-08
 │         ejecucion.update{estado, finalizadaEn, duracionMs, filas, corte, fase, error, codigoError} [+tenantId]
 │         (unexpected throw → close: error-interno; log error name only)
 └─ programar(next minute)
```

Nothing is dialed until every pre-dial check has passed. Logs contain only `{automatizacionId, fase, error, codigoError}`. Values, SQL, and driver text are never logged.

## Interfaces / Contracts

```prisma
model Automatizacion {            // + back-relations on Tenant, Plantilla, Conexion
  id String @id @default(uuid())
  tenantId String;  plantillaId String;  conexionId String   // FKs, RESTRICT
  valores Json @default("{}");  cron String;  activo Boolean @default(true)
  creadaEn DateTime @default(now());  ejecuciones Ejecucion[]
  @@index([tenantId])
}
model Ejecucion {
  id String @id @default(uuid());  tenantId String;  automatizacionId String
  estado String            // 'en-curso' | 'ok' | 'fallo'
  iniciadaEn DateTime;  finalizadaEn DateTime?;  duracionMs Int?;  filas Int?
  corte String?;  fase String?     // 'preparacion' | FaseEjecucion
  error String?;  codigoError String?   // closed category + publishable SQLSTATE; never raw text
  @@index([tenantId])  @@index([automatizacionId, iniciadaEn])
}
```

```ts
// src/automatizaciones.ts — pure
export function cronValido(cron: string, zona: string): boolean;
export function estaVencida(cron: string, desde: Date, hasta: Date, zona: string): boolean;
export function cierreDeResultado(r: ResultadoEjecucion): CierreEjecucion; // ok → filas/corte; fallo → fase/categoria/codigo
// src/planificador.ts
export interface Reloj { ahora(): Date; programar(ms: number, fn: () => void): () => void }
export function crearPlanificador(d: { prisma: PrismaAislado; zonaHoraria: string;
  log: FastifyBaseLogger; reloj?: Reloj }): { iniciar(): void; detener(): Promise<void>;
  ejecutarTick(ahora: Date): Promise<void> };
```

Routes (none exempt; all scoped by `x-tenant-id`):

| Route | Result |
|---|---|
| `POST /automatizaciones` `{plantillaId, conexionId, valores={}, cron}` (strict, `propertyNames`, no `tenantId`) | `201 {automatizacion}`; `400 {campos[,problemas]}`; `404 plantilla-no-encontrada` / `conexion-no-encontrada` (scoped lookup) |
| `GET /automatizaciones` | `200 {automatizaciones, truncado}` (`LIMITE_LISTADO`, no `valores`) |
| `GET /automatizaciones/:id` | `200` / `404 automatizacion-no-encontrada` |
| `POST /automatizaciones/:id/desactivar` | `200` / `404` / `409 automatizacion-desactivada` |
| `GET /automatizaciones/:id/ejecuciones` | `200 {ejecuciones, truncado}`, newest first / `404` |

Server wiring: `crearPlanificador` is built next to `prisma`; `app.addHook('onClose', detener)`; `iniciar()` runs inside `listen().then`. `detener` clears the timer and awaits the in-flight tick.

## File Changes

| File | Action | Description |
|---|---|---|
| `prisma/schema.prisma`, `prisma/migrations/20260928000000_automatizacion_ejecucion/migration.sql` | Modify/Create | Two tables, FKs, indexes; additive |
| `src/aislamiento-prisma.ts` | Modify | Add both models to `MODELOS_AISLADOS` |
| `src/contexto-tenant.ts` | Modify | `conTenantActivo` doc comment: scheduler entry |
| `src/config.ts` (+ test), `.env.example` | Modify | `zonaHoraria` |
| `package.json` | Modify | `cron-parser` exact pin |
| `src/automatizaciones.ts`, `src/planificador.ts`, `src/automatizaciones-rutas.ts` (+ tests) | Create | Pure helpers, loop + run, routes |
| `src/server.ts` | Modify | Register routes; start/stop scheduler |
| `src/consola.ts` (+ test) | Modify | "Automatizaciones" section: create (template/connection selects, value controls reusing `controlDeValor`, cron), list, deactivate, runs table; every call goes through `pedir()` |
| `src/aislamiento.test.ts` | Modify | Model list; T2 rows; scheduler isolation |
| `docs/01-decisiones.md` | Modify | The two resolutions above |

## Testing Strategy (`npm test`, `node:test`)

| Layer | What |
|---|---|
| Unit | `cronValido` (5 fields, invalid input, `@daily` rejected); `estaVencida` window edges, `creadaEn` bound, timezone offset; `cierreDeResultado` for every category; config `UTC` default and invalid-zone refusal |
| Scheduler (fake `Reloj`, live PG, skipped when unreachable) | `ejecutarTick` runs a due job exactly once; skips inactive automations and inactive tenants; gate refusal and stale values leave no dial (closed port); `en-curso` → closed row with every X2 field; an unexpected throw → `error-interno` and the loop continues; `detener` awaits the in-flight tick |
| T2 | 404 both ways on `GET /:id`, `/desactivar`, `/ejecuciones`, and `POST` with a foreign `conexionId`; list shows only own rows; tick with A+B: every `Ejecucion.tenantId` matches its owner; a scoped read outside the context throws |
| Routing | No header → `400` on all five routes |

## Threat Matrix

The generic rows (documentation paths, git selection, commit, push, PR) are N/A: the change has no shell, subprocess, VCS, or PR automation. The routing and process rows apply:

| Case | Expected | RED test |
|---|---|---|
| A new route called without the header | `400 tenant-no-indicado` | Routing |
| `tenantId` in the body | `400` (strict schema) | Routes |
| Tenant B reaching A's automation, runs, or connection | `404`; nothing leaks | T2 |
| A scheduler query outside any context | Throws `ErrorSinTenantActivo` | Scheduler |
| A deactivated tenant or automation | Never runs | Scheduler |
| Driver or error text reaching `Ejecucion` | Only closed categories and a publishable code are stored | Unit + scheduler |

## Migration / Rollout

Additive migration. Suggested chain: (1) schema, isolation, config, and dependency; (2) pure module; (3) create/list/get/desactivar routes; (4) scheduler and server wiring; (5) runs route and T2; (6) console. `400-line budget risk: High`.

**Rollback:** removing the `iniciar()` call stops all runs immediately. Then revert slices in reverse order. The down migration is `DROP TABLE "Ejecucion"; DROP TABLE "Automatizacion";`. Existing routes are unaffected.

## Open Questions

- [ ] The `cron-parser` version and API were not verified against live documentation in this phase (context7 was unavailable). Apply must run `npm view cron-parser version` and confirm the `CronExpressionParser.parse(...).next()` API before pinning.
