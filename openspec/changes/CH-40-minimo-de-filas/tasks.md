# Tasks: CH-40 — Minimum rows per automation

Inputs: proposal.md, specs/automation-scheduling/spec.md, specs/email-notification/spec.md, specs/execution-log/spec.md, specs/query-console/spec.md, design.md.

Delivery: single-pr (exploration decision 3(a)). Branch `ch40/minimo-filas` from `master`.

DEC-193 goes on `v2/dec-193` from `master`, in its own PR.

## 1. Model
- [x] 1.1 `prisma/schema.prisma`: `Automatizacion.minimoFilas Int @default(1)` after `destinatario`, with the CH-40 doc comment (design §1).
- [x] 1.2 Migration `20261103000000_automatizacion_minimo_filas` (`ADD COLUMN ... INTEGER NOT NULL DEFAULT 1`), with the rollback in its header. Regenerate the Prisma client.

## 2. Outcome and decision
- [x] 2.1 `src/automatizaciones/automatizaciones.ts`:
  - `'omitida-bajo-minimo'` in `EstadoNotificacion` and `OmisionNotificacion`.
  - `MINIMO_FILAS_POR_DEFECTO = 1`.
  - `decidirNotificacion(..., minimoFilas)` with the new row after zero rows and the `hayMas` rule (design §3), doc comment updated.
- [x] 2.2 `src/automatizaciones/automatizaciones.test.ts`: the precedence cases of design §7, the `permitidos` set, and the existing callers updated to pass 1.

## 3. Routes
- [x] 3.1 `src/automatizaciones/automatizaciones-rutas.ts`:
  - `minimoFilasValido(valor, tope)`.
  - Create: body type, schema keys, pure check after `direccionValida` against the `topeFilas` the registrar receives from `server.ts` (design §4.1), default from `MINIMO_FILAS_POR_DEFECTO`, written on `create`.
  - `AutomatizacionCompleta` gains `minimoFilas`; `AutomatizacionResumen` unchanged.
  - Adjust: schema keys, `CuerpoAjusteOperador`/`DatosAjusteOperador`, `resolverAjusteOperador(..., tope)` block after `destinatario`, spread in the `update` (design §4).
- [x] 3.2 `src/automatizaciones/automatizaciones-rutas.test.ts`:
  - Create with 5, without (→ 1), with 0, cap + 1, 2.5 and `"5"`; one case with `MAX_FILAS_CONSULTA` lowered.
  - Adjust with 10 (same row, runs kept), with 0, and another tenant's id (→ 404, row unchanged).
  - The runs listing returns `omitida-bajo-minimo`.
- [x] 3.3 `src/panel/panel-ajustes-rutas.test.ts`: `minimoFilas` in the panel adjust body is `400`.

## 4. Scheduler
- [x] 4.1 `src/automatizaciones/planificador.ts`: `minimoFilas` in `AutomatizacionACorrer` and the due select; passed to `decidirNotificacion` in `notificar` (design §5).
- [x] 4.2 `src/automatizaciones/planificador.test.ts`: minimum 5 with 2 rows closes `ok`/`omitida-bajo-minimo`, `filas: 2`, no send; a row inserted without the column reads `MINIMO_FILAS_POR_DEFECTO`.

## 5. Console
- [x] 5.1 `src/consola/consola.ts`, create wizard step 2: `auto-minimo` field and hint, `auto-vista-minimo` in the schematic, `numeroDeMinimo`, `minimoFilas` always in the body, reset to 1, the `/minimoFilas` branch in `mensajeDe400DeAutomatizacion` (design §6.1).
- [x] 5.2 `src/consola/consola.ts`, adjust pop-up: `aj-minimo`, prefill, `estadoAjuste`/`hayCambiosEnAjuste`, `cambios.minimoFilas` (design §6.2).
- [x] 5.3 `src/consola/consola.ts`: `ETIQUETAS_NOTIFICACION['omitida-bajo-minimo']` (design §6.3).
- [x] 5.4 `src/consola/consola.test.ts`: the three ids in `IDS`; G3' still green; default and preview text; create bodies with 5 and 1; the `/minimoFilas` message; adjust prefill and the `{ "minimoFilas": 10 }` body; the new label.

## 6. Docs
- [x] 6.1 `docs/guia/06-automatizaciones.md`: the minimum, its default and range, the new outcome, not in the panel.
- [x] 6.2 `.claude/skills/zerodashboard-design/guidelines/consola.md` and its `.agents/` copy: the field in create and adjust.
- [x] 6.3 `docs/02-mapa-de-changes.md`: PR numbers for CH-37 (#211), CH-38 (#214), CH-39 (#215, #216).
- [x] 6.4 DEC-193 in `docs/01-decisiones.md` on `v2/dec-193` from `master` (design §0 and §3), its own PR.

## 7. Verification
- [x] 7.1 `npm run build` (typecheck; the project has no lint script).
- [x] 7.2 `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db`; only the known false positives of `conexiones` may fail. Run 2026-11-03: 1641/1645; the 4 failures are the known `conexiones.test.ts` false positives (the password `postgres` matches `"motor":"postgres"`), outside this change.
- [x] 7.3 Every scenario of the four delta specs maps to a test or is marked as covered by an existing one in the verify report.

## Review Workload Forecast
- Estimated changed lines: ~345 (code ~120, tests ~200, docs ~25). DEC-193 is on its own branch and not counted; the specs are synced at archive.
- Actual after apply: 614 (551 added, 63 removed): code ~190, tests ~400, docs ~30. The tests doubled: precedence cases, create and adjust at three levels (pure, before any read, database), and eight existing console tests whose exact bodies gained `minimoFilas`.
- 400-line budget risk: High (about 215 over).
- Chained PRs recommended: No.
- Decision: the user chose `size:exception` for one PR on 2026-11-03, against a CH-40a/CH-40b split.
