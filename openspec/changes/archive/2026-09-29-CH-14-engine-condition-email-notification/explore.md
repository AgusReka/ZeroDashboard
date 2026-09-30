# Exploration: CH-14 — Engine: Condition and Email Notification (X3, N1, N2)

Convention followed: CH-13 archived exploration (English, OQ-A.. list). Persisted by the orchestrator from Engram `sdd/CH-14-engine-condition-email-notification/explore` (the explore executor has no Write tool).

## Scope
- X3: notification is sent only if the condition holds ("Sin filas, no se envía nada").
- N1: result by email, readable, "Reutiliza el HTML ya validado en los tres workflows".
- N2: email looks good with no data: "Degradación elegante con mensaje, sin campos rotos".
- Out: N3 configurable format (CH-21), retries (X5/CH-17), duplicates (X6/CH-18), overlap (X4), Telegram, freshness (CH-24), personal-field override (DEC-72), reporte-diario query (DEC-69).

## Current State
- CH-12: `Plantilla` has `formato` enum only `correo-html` (DEC-65, "no effect until CH-14"), `automatizacion` label enum, no condition field (DEC-64: condition = parameterized WHERE + CH-14 rule "no rows -> no send"). One SQL per template. No templates seeded (catalog D3/CH-21).
- CH-13: `src/planificador.ts` `correr()`: create `Ejecucion` `en-curso` -> `resultadoDeCorrida()` (evaluarVistas -> componerSentencia -> prepararSentencia -> destinoDeConexion -> ejecutarConsulta, `limite = topeFilas`) -> `cierreDeResultado()` reduces rows to `filas.length` and DROPS them -> update row. `ResultadoEjecucion.ok` carries `columnas`, `filas: unknown[][]`, `paginacion.hayMas`. Plug-in point: between `resultadoDeCorrida` and `cierreDeResultado` (the only moment rows exist in memory). Plantilla select today: `sql`, `parametros`, `entidades` only (needs `nombre`, `automatizacion`, `formato`).
- `Ejecucion`: estado `en-curso|ok|fallo`, fase `preparacion|conexion|permisos|ejecucion`, closed `error` category, `codigoError`. No notification column. `Automatizacion` has no name and no recipient. `Tenant` has only `nombre`/`activo`. `Usuario` is forbidden by the domain-data-model spec. No email code, dependency, env var or compose service exists today.
- Finding: scheduled runs pass `limite = topeFilas`, so `corteDeEjecucion` (`limiteSolicitado > topeFilas && hayMas`) is always false -> `Ejecucion.corte` is never set; only `paginacion.hayMas` reveals truncation. The email must use `hayMas`.
- D-1 leaning "el resultado viaja al correo y no se guarda": CH-14 is where rows first leave the system (to an SMTP relay). Consistent with the leaning; does not close D-1.

## "El HTML ya validado" — where it lives
Not in the repo as HTML. Searched `docs/`, `openspec/`, `experimentos/`, `src/`, `scripts/` and all tracked text. `docs/bitacora/estudio_previo/bitacora_WF-01.md` (§6, §9) and `bitacora_WF-03_reportes.md` (§2.5, §5, §6, §7) describe it: inline styles, table layout for mail-client compatibility, accent-colour header, explanatory text, data table, discreet footer; accents amber `#f59e0b` (WF-01a stock-fisico), red `#dc2626` (WF-01c stock-producible), blue `#2563eb` (WF-03 reporte); emojis in subject; per-section "Sin datos para el período" message; empty-day case validated. The original is an n8n Send Email node expression in the author's n8n instance, not exported. The untracked root `files.zip` was checked by the orchestrator: it only contains early copies of the docs (00-contexto, 01-decisiones, 02-mapa, _plantilla, mapa-historias), no HTML.

Consequence: "reuse" can only mean re-implementing the documented visual system, unless the author supplies the node HTML. WF-03 is 3 queries / 1 mail; the engine is 1 query / 1 notification (mapa-historias §6), so a multi-section report is a documented artifact limit (rule 6).

## Story semantics and tension
X3 (never send on 0 rows) vs N2 (nice mail with no data) collide for WF-03, whose empty day was sent. Consistent reading: X3 = zero rows -> nothing sent, run recorded ok / filas 0 / not sent; N2 = rows exist but cells NULL, aggregate rows of zeros, missing optional columns, truncated set -> mail renders without `undefined`/`null`/broken cells and with a message. By extension, an SMTP failure must not crash the run or the tick.

## Execution log states needed
not sent (no rows) | sent | send failed | not configured (automations without recipient / SMTP unset). Query success is independent of delivery.

## Email design notes
- Transport: nodemailer (v10.0.12 per registry, MIT-0, zero deps; verify at apply). WF used SMTP Gmail 465 SSL -> SMTP continuity. `jsonTransport` allows transport tests with no network; inject a `Notificador` interface like `Reloj`. Dev catcher: Mailpit (`axllent/mailpit`, SMTP 1025, UI 8025) under a compose profile.
- Secrets (rule 7): `SMTP_HOST/PORT/SECURE/USER/PASSWORD/FROM` env only; placeholders in `.env.example`, forwarded in compose with `${VAR:-}`; read inside the transport module, not on `AppConfig` (master-key precedent); never logged; closed error categories only, never raw SMTP text.
- Rule 5: body = only what the composed query returned (DEC-71 gate + DEC-43). No SQL, parameter values, connection data, credentials or error text. The recipient is operator data, distinct from buyer `correo` (DEC-23/72); stays in own DB, never logged.
- Safety: escape `& < > " '` in every cell and column name; strip CR/LF from subject; validate recipient (header injection); add text/plain alternative; Gmail clips HTML > ~102 KB; use `hayMas` for a "showing first N" notice.
- Sequential tick: slow SMTP blocks siblings -> send timeout required; no retry (CH-17); crash between send and row close can duplicate or leave `en-curso` (CH-17/18 limit).
- Only send when `plantilla.formato === 'correo-html'`.
- Testing (strict TDD, `npm test`, live PG `TEST_DB_PORT=5434`): pure unit tests for condition/renderer/escape; fake `Notificador` in scheduler tests (not called on 0 rows, once on rows, per-tenant recipient in A+B tick = T2); jsonTransport for transport; optional live Mailpit test skipped when unreachable. Existing fixtures create `Automatizacion` directly -> new columns nullable, notifier dependency optional.

## Open Questions (user decision required; register as DEC-81+ before propose)
- **OQ-A Email transport.** (a) nodemailer over SMTP + Mailpit in compose [recommended]; (b) provider HTTP API via fetch (vendor lock-in, rows to a third party); (c) hand-rolled SMTP over `node:net` (reject).
- **OQ-B Recipient source.** (a) `destinatario` column on `Automatizacion`, one validated address, set at creation, nullable, no edit (DEC-79) [recommended]; (b) column on `Tenant`; (c) one global env recipient (breaks multi-tenant); (d) both with override; (e) `Usuario` entity (forbidden). Sub-choice: single address vs list (recommend single).
- **OQ-C Notification outcome in `Ejecucion`.** (a) new nullable `notificacion` column (`enviada|omitida-sin-filas|fallo-envio|sin-destinatario|no-configurada`) [recommended]; to confirm: whether a send failure also sets `estado='fallo'`, `fase='notificacion'`, closed `error` category; (b) only extend `estado`/`fase`; (c) child `Notificacion` table (overkill, X6).
- **OQ-D Zero-row rule vs N2.** (a) X3 literal; N2 covers NULLs, zero aggregates, empty cells, truncation notice [recommended]; (b) per-template "send on empty" flag (N3 territory); (c) always send "no data" mail (contradicts X3).
- **OQ-E Renderer / source of the validated HTML.** (a) generic columns-driven table renderer; accent + subject emoji by `automatizacion` label using the documented palette [recommended]; (b) three fixed per-label layouts (needs original n8n HTML); (c) HTML stored per template (N3, out of scope).
- **OQ-F SMTP unconfigured policy.** (a) `SMTP_*` optional; unset -> run executes, records `no-configurada` [recommended]; (b) fail closed at boot like DEC-17.

## Approaches
1. Inline in planificador (condition + render + send inside `correr` via injected `Notificador`; pure modules) — Low-Med [recommended].
2. Outbox table decoupled from the run — resilient but is X5/X6 (CH-17/18), widens the engine (rule 6). High.
3. Provider API instead of SMTP — see OQ-A.

## Size and slicing
~1.6-1.9k authored lines incl. tests; 400-line budget risk High. Stacked-to-main, 7 PRs:
1. schema + migration, nodemailer pin, SMTP env, Mailpit profile (~180)
2. pure `correo.ts`: escape, table, degradation, accent/subject, text part (~300)
3. pure condition + outcome mapping (~150)
4. `notificador.ts` wrapper, error classification, timeout (~250)
5. planificador integration + scheduler tests with fake notifier + T2 (~400; may split 5a/5b)
6. routes + console field/column (~350)
7. docs: DEC-81+, bitácora, verify, archive

Threats: header injection, HTML injection via cell, SMTP creds in log/DB, cross-tenant recipient (T2), SMTP hang blocking the tick, secrets in repo, sending on 0 rows.

## Risks
- Original HTML not in repo (OQ-E).
- First outbound egress of tenant data (D-1 open).
- Blocking SMTP in the sequential tick.
- Duplicate/lost mails on crash until CH-17/18.
- New dependency.
- AGENTS.md still lists D-4/D-5 as open though DEC-25/26 closed them (doc-only).
