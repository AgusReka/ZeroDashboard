# Tasks: CH-44 — Telegram channel

Inputs: proposal.md, the eight delta specs under specs/, design.md.

Delivery: single-pr with `size:exception`, accepted by the user on 2026-11-05 after the design forecast. Branch `ch44/canal-telegram` from `master`.

DEC-197 goes on `v2/dec-197` from `master`, in its own PR, before the code (AGENTS.md), as DEC-194 to DEC-196 did.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,050, without the planning artifacts |
| 400-line budget risk | High |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | exception-ok |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High

Focused test command: `npm test`, with a file filter per phase. Runtime harness: `npm run test:db` for the migration and the database cases. Rollback boundary: the whole PR, using the recipe in the migration's header.

## 0. Decision
- [x] 0.1 DEC-197 in `docs/01-decisiones.md` on `v2/dec-197`, committed before any code. Remove the uncommitted copy from `ch43/archivo` when moving it.

## 1. Model
- [x] 1.1 `prisma/schema.prisma`: `Automatizacion.canal` and `Ejecucion.canal`, with the CH-44 comment, and `sin-vinculo` in the `notificacion` comment (design §1).
- [x] 1.2 Migration `20261106000000_canal_telegram` with the rollback in its header. Regenerate the Prisma client.

## 2. Values and decision
- [x] 2.1 `src/automatizaciones/automatizaciones.ts`: `Canal`, `esCanal`, `sin-vinculo` in both types, `omisionPorFilas`, `decidirTelegram`, and `decidirNotificacion` over `omisionPorFilas` with its signature unchanged (design §2).
- [x] 2.2 `src/automatizaciones/automatizaciones.test.ts`: every row of the Telegram precedence, the order of rows 4 and 5, and the `cierreConNotificacion` close for `sin-vinculo`.

## 3. Client and notifier
- [x] 3.1 `src/telegram/cliente-telegram.ts`: `enviarAviso` (design §3).
- [x] 3.2 `src/telegram/cliente-telegram.test.ts`: the `enviarAviso` body, the `responder` body pinned to `chat_id` and `text`, and the token never in an error.
- [x] 3.3 `src/telegram/notificador-telegram.ts`: `crearNotificadorTelegram` with the category table.
- [x] 3.4 `src/telegram/notificador-telegram.test.ts`: each mapping, `codigo` null, a 429 with a single call.

## 4. Message
- [x] 4.1 `src/automatizaciones/correo.ts`: `partesDeTexto` and `unirTexto`, with `texto` unchanged. `correo.test.ts` stays as it is and must pass (design §4).
- [x] 4.2 `src/automatizaciones/mensaje-telegram.ts`: `LIMITE_TELEGRAM`, `componerTelegram`.
- [x] 4.3 `src/automatizaciones/mensaje-telegram.test.ts`: equal to `texto` when short, table form, literal markup, cut at a whole line, both notices, one long line, no unpaired surrogate, and a loop over sizes never above 4096.

## 5. The run and wiring
- [x] 5.1 `src/automatizaciones/planificador.ts`: the `notificadorTelegram` dependency, `canal` in the type and the `select`, in both `ejecucion.create` calls, and `notificarTelegram` (design §5).
- [x] 5.2 `src/server.ts`: one shared client, `sondeo` over it, `notificadorTelegram` into the scheduler. `src/app/rutas.ts`: pass the token signal (design §6).
- [x] 5.3 `src/automatizaciones/planificador.test.ts`: each outcome, `canal` on the row and on an `omitida` row, two tenants, unlink, relink, a failed link read, one call with no retry, a `correo` run reading no link, the sweep on a Telegram row, and no chat id or token in a row or log.

## 6. Console API and preview route
- [x] 6.1 `src/automatizaciones/automatizaciones-rutas.ts`: `canal` in `AutomatizacionCompleta`, `EjecucionListada`, both schemas, create and `resolverAjusteOperador` (design §7).
- [x] 6.2 `src/automatizaciones/automatizaciones-rutas.test.ts`: the default, Telegram accepted with no link, `/canal` refused, switching keeps recipients, `canal` in the runs listing.
- [x] 6.3 `src/automatizaciones/vista-previa.ts`: `canal` and `telegram` on the email answer, `respuestaDeVistaPreviaTelegram`, the route's link read, `telegramConfigurado` (design §8).
- [x] 6.4 `src/automatizaciones/vista-previa.test.ts`: each decision, no chat id in the raw body, the email answer gaining only the two keys, a gate refusal with no link read.

## 7. Console UI
- [x] 7.1 `src/consola/consola.ts`: the select in create and adjust, `aplicarCanalAlta` and `aplicarCanalAjuste`, the bodies and the change comparison, and the guarded ids (design §9).
- [x] 7.2 `src/consola/consola.ts`: the runs labels and failure texts by the run's channel, and the preview under `telegram`.
- [x] 7.3 `src/consola/consola.test.ts`: the scenarios of the `query-console` delta, with the exact bodies, and every existing email text unchanged.

## 8. Panel
- [x] 8.1 `src/panel/panel-automatizaciones.ts`: `canal` in the select, the link read, and `sinVinculo` in `proyectarActiva` (design §10).
- [x] 8.2 `src/panel/panel-automatizaciones.test.ts`: each `sinVinculo` case, the allow-list, forbidden keys with a linked chat, two tenants. The two-tenant case there proves the read stays scoped.
- [x] 8.3 `src/panel/panel-ajustes.ts`: `canalesDe`, `proyectarAjustes`, `resolverAjustes`, the schema and `telegramConfigurado`. `src/app/rutas.ts`: pass the signal.
- [x] 8.4 `src/panel/panel-ajustes.test.ts` and `panel-ajustes-rutas.test.ts`: each `canales` case, each refusal, the go-back rule, a foreign id, `chatId` refused.
- [x] 8.5 `src/panel/panel.ts`: the «Enviar por» select, the hidden field, `cuerpoDeCambios`, `ERRORES_CAMPO`, the card banner and the subtitle.
- [x] 8.6 `src/panel/panel.test.ts`: the form cases, the banner and the glossary check on the new copy.

## 9. Docs
- [x] 9.1 `docs/guia/06-automatizaciones.md`: remove the limit, add the channel, `sin-vinculo` and the limits (burst, group migration).
- [x] 9.2 `guidelines/pantallas.md` (P-02, P-04, P-07) and the console guide, in both copies of the design skill.
- [x] 9.3 `docs/02-mapa-de-changes.md`: the CH-44 row with DEC-197 and the PR number.
- [x] 9.4 The ethical and legal note that DEC-185 asks for (design §12).

## 10. Verification
- [x] 10.1 `npm run build`, `npm run build:agente`, `npm test` and `npm run test:db`.
- [x] 10.2 `npx prisma migrate status` against the test database: the new migration is applied and the schema has no drift.
