# Tasks: CH-41 — Several recipients per automation

Inputs: proposal.md, specs/automation-scheduling/spec.md, specs/email-notification/spec.md, specs/client-panel-automations/spec.md, specs/query-console/spec.md, specs/tenant-isolation/spec.md, design.md.

Delivery: single-pr with `size:exception`, accepted up front (exploration decision 4(a)). Branch `ch41/varios-destinatarios` from `master`.

DEC-194 goes on `v2/dec-194` from `master`, in its own PR, before the code (AGENTS.md).

## 0. Decision
- [x] 0.1 DEC-194 in `docs/01-decisiones.md` on `v2/dec-194` (design §0), committed before any code.

## 1. Model
- [x] 1.1 `prisma/schema.prisma`: `destinatarios String[] @default([])` replaces `destinatario`, with the rewritten comment (design §1).
- [x] 1.2 Migration `20261104000000_automatizacion_destinatarios` (add, copy, drop) with the rollback in its header. Regenerate the Prisma client.

## 2. List rule and console routes
- [x] 2.1 `src/automatizaciones/automatizaciones-rutas.ts`: `MAX_DESTINATARIOS`, `destinatariosDe` replacing `destinatarioDe` (design §2); create, projection and adjust with `destinatarios` (design §3).
- [x] 2.2 `src/automatizaciones/automatizaciones-rutas.test.ts`: the rule's pure cases, the no-read table, the DB cases of design §8, the old key refused, fixtures renamed.

## 3. Panel route
- [x] 3.1 `src/panel/panel-ajustes.ts`: types, selects, schema, `resolverAjustes` with the "at least one" check, `proyectarAjustes` (design §4).
- [x] 3.2 `src/panel/panel-ajustes.test.ts` and `panel-ajustes-rutas.test.ts`: read and write the list, `[]` and six refused, the old key refused, the snapshot.

## 4. Engine and scheduler
- [x] 4.1 `automatizaciones.ts` (`decidirNotificacion`), `correo.ts` (`Correo.para`), `notificador.ts` (type only), `planificador.ts` (type, select, call) (design §5).
- [x] 4.2 `automatizaciones.test.ts`, `notificador.test.ts` (the array reaches `sendMail`), `planificador.test.ts` (one send to both addresses; fixtures), and the T2 tick with A's two addresses (`planificador.test.ts` CH-14 5.11 and `aislamiento.test.ts`).

## 5. Console UI
- [x] 5.1 `src/consola/consola.ts`: both inputs `type="text" inputmode="email"`, labels and hint, `direccionesDe`, create body, adjust state/fill/diff, the 400 messages with the typed address, the preview «Para» (design §6).
- [x] 5.2 `src/consola/consola.test.ts`: the cases of design §8 and the exact bodies.

## 6. Panel UI
- [x] 6.1 `src/panel/panel.ts`: the «Enviar a» control, hint, `direccionesDe`, body diff, `ERRORES_CAMPO.destinatarios` (design §7).
- [x] 6.2 `src/panel/panel.test.ts`: the field list (`:296`) and a case that sends two addresses.

## 7. Other readers
- [x] 7.1 `src/semillas/semilla-demo.ts` and its test: `destinatarios: [entorno.correoPanel]`.
- [x] 7.2 `src/aislamiento/aislamiento.test.ts`, `src/panel/panel-automatizaciones.test.ts`: fixtures renamed.
- [x] 7.3 A search for `destinatario\b` outside `contrato.test.ts`, `sin-destinatario`, comments about the former column and the migration finds nothing.

## 8. Docs
- [x] 8.1 `docs/guia/06-automatizaciones.md` (Anatomía, Camino rápido, Ajustar, Límites) and `docs/guia/01-arquitectura.md` if it says "un destinatario".
- [x] 8.2 `guidelines/consola.md` (C-09) and `guidelines/pantallas.md` (P-04), both copies identical.

## 9. Verification
- [x] 9.1 `npm run build` (typecheck) and `npx prisma validate`.
- [x] 9.2 `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db`; only the known `conexiones.test.ts` false positives may fail.
- [x] 9.3 With the user's go-ahead: the migration's copy checked on the development database (design §8), and `docker compose up -d --build app` so the running app reads the new column. Done 2026-11-03: the dev database applied 4 pending migrations (CH-37, CH-39, CH-40, CH-41); its one automation with an address kept it as a one-element list (before and after identical); `destinatario` is gone. The app ran the new code against Mailpit: one message at 18:41 with both addresses in «Para», run `ok`/`enviada`.
- [x] 9.4 Every scenario of the five delta specs maps to a test, or is marked as covered by 9.3, in the verify report.

## Review Workload Forecast
- Estimated changed lines: ~690 (code ~200, tests ~450, docs ~40). DEC-194 is on its own branch and not counted; the specs are synced at archive.
- Actual after apply: ~1204 (884 added, 320 removed): tests ~820, code and docs ~384. The fixture churn from `destinatario` to `destinatarios` was larger than estimated.
- 400-line budget risk: High (about 290 over).
- Chained PRs recommended: No: the key rename touches the server and both UIs at once (exploration decision 4).
- Decision: `size:exception` accepted by the user on 2026-11-03, before apply.
