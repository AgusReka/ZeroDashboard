# Tasks: CH-14 — Engine: Condition and Email Notification (X3, N1, N2)

Derived from `design.md`. Verification tasks map to scenarios in
`specs/email-notification/spec.md`, `specs/automation-scheduling/spec.md`,
`specs/execution-log/spec.md`, `specs/tenant-isolation/spec.md`,
`specs/query-console/spec.md`, and `specs/project-environment/spec.md`.

`docs/01-decisiones.md` already holds DEC-81..86, the DEC-86 addendum and the
"Resoluciones ... (CH-14)" block. No task edits it beyond committing the
already-modified working copy in task 1.1.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,650–1,950 total including tests and planning artifacts (see per-slice table) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (schema+config+pins+compose, plus planning commit) → PR 2 (`correo.ts`) → PR 3 (mapping) → PR 4 (`notificador.ts`) → PR 5a (planificador) → PR 5b (server wiring+T2) → PR 6 (routes+console) → PR 7 (docs, verify, archive) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

| Slice | Content | Est. changed lines | Risk |
|-------|---------|--------------------|------|
| 1 | Schema, migration, `smtpTimeoutMs`, pins, compose, `.env.example` | ~170 authored (+ planning commit, docs only) | Low |
| 2 | `src/correo.ts` + tests | ~380 | Medium (near budget) |
| 3 | Mapping in `src/automatizaciones.ts` + tests | ~180 | Low |
| 4 | `src/notificador.ts` + tests + Mailpit live test | ~330 | Medium |
| 5a | `src/planificador.ts` + tests | ~300 | Medium |
| 5b | `src/server.ts` wiring + T2 | ~150 | Low |
| 6 | Routes + console + tests | ~350 | Medium |
| 7 | Bitácora, verify, archive | ~120 docs | Low |

Planning-artifact commit (explore, proposal, specs, design, tasks, and the
`docs/01-decisiones.md` DEC-81..86 changes) is the first commit of slice 1, as CH-13 did. It is
documentation only and is counted separately from the authored-code budget; if a reviewer counts it,
record it as a documented exception for that one commit.

Contingencies: slice 2 splits into 2a (helpers: `escaparHtml`, `textoDeCelda`, `direccionValida`,
subject) and 2b (HTML/text composition, notices, accent map) if it passes 400. Slice 6 splits into
6a (routes) and 6b (console). Slice 5a splits at the RED/GREEN boundary of task 5.7 if it passes 400.
Threat Matrix rows carried as RED tests: CRLF or `,` in recipient (6.1), CRLF in name (2.5), HTML in
cell/column/name (2.3), file/URL reference (4.5), SMTP text or credentials in `Ejecucion`/logs (4.4,
5.6), invalid config revealing a value (4.2), cross-tenant recipient or rows (5.11), SMTP hang
(4.6, 5.9), 0 rows never sends (5.1), secrets committed (1.9 review). Generic shell/VCS rows are
`N/A` per design.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Planning commit, schema, migration, `smtpTimeoutMs`, pins, compose, `.env.example` | `ch14/1-esquema-config` (base `master`) | `npm test -- src/config.test.ts` | `npx prisma validate`; `docker compose --profile correo config` | Drop two columns; revert config, compose, pins; planning commit stays |
| 2 | Pure renderer and `direccionValida` | `ch14/2-correo` (base unit 1) | `npm test -- src/correo.test.ts` | N/A — pure functions | Delete `src/correo.ts` and its test; nothing consumes it |
| 3 | Outcome mapping and close types | `ch14/3-mapeo-notificacion` (base unit 2) | `npm test -- src/automatizaciones.test.ts` | N/A — pure functions | Revert the added exports and type widening; nothing consumes them |
| 4 | Notifier: env parsing, transport wrapper, timeout, classification | `ch14/4-notificador` (base unit 3) | `npm test -- src/notificador.test.ts` | Optional live Mailpit test on `localhost:1025`, skipped when unreachable | Delete `src/notificador.ts` and tests; nothing consumes it |
| 5a | Scheduler notify step, single close | `ch14/5a-planificador-notifica` (base unit 4) | `npm test -- src/planificador.test.ts` | Fake `Notificador` and `Reloj` + live PostgreSQL, skipped when unreachable | Revert the notify step in `planificador.ts`; runs record `null` again |
| 5b | Server wiring and T2 | `ch14/5b-servidor-t2` (base unit 5a) | `npm test -- src/aislamiento.test.ts` | Boot with SMTP unset and with Mailpit profile | Remove the `crearNotificadorSmtp` call in `server.ts`; T2 additions |
| 6 | `destinatario` on create, `notificacion` in listing and console | `ch14/6-rutas-consola` (base unit 5b; fallback 6a/6b) | `npm test -- src/automatizaciones-rutas.test.ts src/consola.test.ts` | `app.inject()` against live PostgreSQL; manual console check | Revert route and console changes; engine unaffected |
| 7 | Bitácora, full-suite checkpoint, verify, archive | `ch14/7-verify-archivo` (base unit 6) | `npm test` (full suite) | N/A — docs/verification only | Revert the archive move and bitácora entry |

## 1. Schema, Config, Pins & Compose (`prisma/schema.prisma`, migration, `src/config.ts`, `package.json`, `docker-compose.yml`, `.env.example`)

- [x] 1.1 First commit of the slice: planning artifacts. Stage `openspec/changes/CH-14-engine-condition-email-notification/` (explore, proposal, specs, design, tasks) and the modified `docs/01-decisiones.md` (DEC-81..86 + addendum + CH-14 resolutions), as one docs commit. Do not stage the untracked stray files `0` and `run`. No further edits to `docs/01-decisiones.md`
- [x] 1.2 Verify at slice start: `npm view nodemailer version` (explore reported `10.0.12`); check whether nodemailer ships bundled types, else pin `@types/nodemailer` as a devDependency; confirm the error `code` set (`ECONNECTION`, `ESOCKET`, `EDNS`, `ETLS`, `EPROXY`, `ETIMEDOUT`, `EAUTH`, `ENOAUTH`, `EENVELOPE`, `EMESSAGE`, `EPROTOCOL`, `ESTREAM`) and `disableFileAccess`/`disableUrlAccess`/`jsonTransport` options; look up the current Mailpit image tag for `axllent/mailpit`. Record findings in the PR body
- [x] 1.3 Pin exact versions (no caret) in `package.json`: `nodemailer` and, if needed, `@types/nodemailer` (design "Nodemailer version"); run `npm install` and commit `package-lock.json`
- [x] 1.4 Modify `prisma/schema.prisma`: `Automatizacion.destinatario String?` and `Ejecucion.notificacion String?`; create `prisma/migrations/20260929000000_notificacion/migration.sql` with `ALTER TABLE "Automatizacion" ADD COLUMN "destinatario" TEXT; ALTER TABLE "Ejecucion" ADD COLUMN "notificacion" TEXT;` (spec `execution-log` "Legacy rows read as null")
- [x] 1.5 RED extend `src/config.test.ts`: `SMTP_TIMEOUT_MS` unset defaults to `10000`; a valid value is parsed; a non-positive or non-integer value stops the boot naming the variable, never its value (spec `project-environment`; design R2)
- [x] 1.6 GREEN modify `src/config.ts`: add `smtpTimeoutMs` on `AppConfig` via `enteroPositivoOpcional`; satisfies 1.5. `SMTP_*` connection variables stay off `AppConfig`
- [x] 1.7 Modify `docker-compose.yml`: `mailpit` service under `profiles: ["correo"]`, image tag pinned per 1.2, ports 1025/8025, no `depends_on` from the app; forward `SMTP_*: ${VAR:-}` (spec `project-environment` "Default bring-up excludes the mail catcher", "Profile bring-up includes the mail catcher")
- [x] 1.8 Modify `.env.example`: empty placeholders for `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_TIMEOUT_MS` (spec "Inspecting the example file and Compose definition")
- [x] 1.9 Checkpoint: `npx prisma validate`; `npx tsc --noEmit` clean; `docker compose config` and `docker compose --profile correo config` parse; `npm test -- src/config.test.ts` green; review that no real secret is in `.env.example` or compose (Threat Matrix "Secrets committed")

## 2. Pure Renderer (`src/correo.ts`)

- [x] 2.1 RED `src/correo.test.ts`: `direccionValida` table — accepts a plain ASCII address; rejects whitespace, CR/LF, `,;<>"()`, leading/trailing/doubled dot, local part over 64 chars, total over 254 chars, single-label domain, TLD under 2 letters, non-ASCII (spec `email-notification` "Invalid recipient rejected", "Header injection or multiple addresses rejected")
- [x] 2.2 RED extend: `textoDeCelda` rules — `null`/`undefined`/`''`/`NaN`/`±Infinity` → `—`, booleans → `Sí`/`No`, `Date` → ISO, bytes → `[binario]`, objects → `JSON.stringify` with `—` on failure, 500-char cap with `…`, short rows padded with `—`, no output ever contains the text `undefined` (spec "Null, undefined, and empty cells", "Aggregate row of zeros")
- [x] 2.3 RED extend: `componerCorreo` escapes `& < > " '` in every cell, column name, template name and date; `<script>` in a cell and in a column name appears only as escaped text (spec "Markup in a cell is neutralized"; Threat Matrix "HTML in a cell, column, or name")
- [x] 2.4 RED extend: notices — `hayMas` shows "Se muestran las primeras {n} filas; la consulta devolvió más."; empty cell shows "Las celdas sin valor se muestran como —."; zero columns shows "La consulta devolvió {n} filas sin columnas."; a complete result shows no truncation notice (spec "Truncation notice", "No notice for a complete result")
- [x] 2.5 RED extend: subject is `{emoji} {nombre} ({n}{+})` with CR/LF and control characters stripped and a 200-char cap; accent/emoji per label (`stock-fisico`, `stock-producible`, `reporte-diario`) and the neutral fallback for an unknown label, never a throw (spec "CR/LF stripped from subject", "Label selects accent and emoji"; Threat Matrix "CRLF in template name")
- [x] 2.6 RED extend: `texto` part carries the same content with ` | `-joined rows and CR/LF in cells turned into spaces; the run date is formatted in the given `zona`; the body contains only returned columns, no ids, SQL, connection or tenant data (spec "Both parts present", "Body excludes internals")
- [x] 2.7 GREEN create `src/correo.ts`: `Correo`, `componerCorreo`, `direccionValida`, `escaparHtml`, `textoDeCelda` (pure — no Fastify, Prisma, pg or nodemailer; `style` attributes only from the closed accent map) — satisfies 2.1–2.6
- [x] 2.8 REFACTOR and checkpoint: `npx tsc --noEmit` clean; `npm test -- src/correo.test.ts` green; if over 400 lines, apply the 2a/2b split from the forecast

## 3. Outcome Mapping (`src/automatizaciones.ts`)

- [x] 3.1 RED extend `src/automatizaciones.test.ts`: `decidirNotificacion(resultado, destinatario, configurado)` covers every precedence row — not-`ok` → `null`/no send; `ok` with 0 rows → `omitida-sin-filas`; no recipient → `sin-destinatario` (also wins over unset SMTP); unset SMTP with recipient → `no-configurada`; else sends once (spec `email-notification` "Query failed records null and sends nothing", "Zero rows never sends", "Precedence between missing recipient and unset SMTP", "SMTP unset with a recipient", "Rows with recipient and SMTP configured send exactly once")
- [x] 3.2 RED extend: `cierreConNotificacion(cierre, salida)` — on `enviada` and on every non-send outcome of an `ok` run, `fase` stays `'ejecucion'` and the run stays `ok`; on a failed send the result is `fallo`/`notificacion`, `error` = category, `filas`/`corte` kept (R1, R3) (spec `execution-log` "Query succeeded, send failed", "Successful notification leaves the run ok")
- [x] 3.3 RED extend: `codigoError` gating — a 3-digit SMTP code (`/^[2-5]\d\d$/`) is kept; `ECONNECTION`, a SQLSTATE and free text become `null`; the result is built from named fields, never a spread of the send result (spec "A failed send's error is a closed category"; Threat Matrix "SMTP text or credentials in Ejecucion/logs")
- [x] 3.4 GREEN modify `src/automatizaciones.ts`: add `EstadoNotificacion`, `CategoriaEnvio`, `ResultadoEnvio`, widen `FaseCierre` with `'notificacion'` and `CategoriaCierre` with `CategoriaEnvio`, add the third `CierreEjecucion` variant (`estado: 'fallo'`, `fase: 'notificacion'`, `filas: number`, `corte: CorteEjecucion | null`, `error: CategoriaEnvio`, `codigoError: string | null`), implement `decidirNotificacion` and `cierreConNotificacion` — satisfies 3.1–3.3
- [x] 3.5 Compiler fallout check: run `npx tsc --noEmit` right after 3.4 and inspect every consumer of `CierreEjecucion`, `FaseCierre` and `CategoriaCierre` (at least `src/planificador.ts`, `src/automatizaciones.test.ts`, `src/planificador.test.ts`, and any route or console projection). The existing query-failure variant has `filas: null`; narrowing on `fase`/`filas` must not break. Fix only type narrowing that the new `filas: number` fallo variant forces, with no behavior change; list the touched sites in the PR body
- [x] 3.6 Checkpoint: `npx tsc --noEmit` clean; `npm test -- src/automatizaciones.test.ts` green (existing `cierreDeResultado` tests unchanged)

## 4. Notifier (`src/notificador.ts`)

- [x] 4.1 RED `src/notificador.test.ts`: `leerSmtp(env)` — absent or empty `SMTP_HOST` returns `null`; `SMTP_FROM` required and valid; `SMTP_SECURE` only `true`/`false` (default `false`); `SMTP_PORT` positive integer with default 465 if secure else 587; `SMTP_USER`/`SMTP_PASSWORD` set together or not at all (spec `project-environment` "Application starts with SMTP unset", "SMTP_HOST present but configuration invalid or incomplete")
- [x] 4.2 RED extend: every invalid or partial `SMTP_*` case throws an error naming the variable and never containing its value or a password (Threat Matrix "Invalid config error reveals a value"; spec "Failure log carries no secrets")
- [x] 4.3 RED extend: with nodemailer `jsonTransport`, `notificadorDesdeTransporte(...).enviar` produces a message with to/from/subject/html/text, `from` = `{name:'ZeroDashboard', address}`, and no attachments; returns `{resultado:'enviada'}` (spec "Scheduler runs with a fake notifier")
- [x] 4.4 RED extend: a fake rejecting transport per code maps to the closed category (`ETIMEDOUT`→`tiempo-agotado`; `ECONNECTION`/`ESOCKET`/`EDNS`/`ETLS`/`EPROXY`→`servidor-inalcanzable`; `EAUTH`/`ENOAUTH`→`credenciales-invalidas`; `EENVELOPE`/`EMESSAGE`/bare 4xx-5xx `responseCode`→`envio-rechazado`; `EPROTOCOL`/`ESTREAM`/non-Error→`error-desconocido`); `codigoSmtp` keeps only a 3-digit `responseCode`; `message` and `response` never appear in the result (spec "SMTP rejects the message")
- [x] 4.5 RED extend: content referencing a file path or URL is not fetched (`disableFileAccess`, `disableUrlAccess` set; `logger:false`, `debug:false`) (Threat Matrix "Content references a file or URL")
- [x] 4.6 RED extend: a hanging transport with a 20 ms `timeoutMs` returns `tiempo-agotado` through the outer `Promise.race` guard and calls `transporter.close()`; `enviar` never throws (spec "Unresponsive SMTP server")
- [x] 4.7 GREEN create `src/notificador.ts`: `Notificador`, `leerSmtp`, `codigoSmtp`, `notificadorDesdeTransporte`, `crearNotificadorSmtp({timeoutMs}, env?)`; sets nodemailer `connectionTimeout`/`greetingTimeout`/`socketTimeout` — satisfies 4.1–4.6
- [x] 4.8 Create `src/notificador-mailpit.test.ts`: live delivery to `localhost:1025`, asserts via the Mailpit HTTP API on 8025; skipped when unreachable
- [x] 4.9 Checkpoint: `npx tsc --noEmit` clean; `npm test -- src/notificador.test.ts src/notificador-mailpit.test.ts` green (the live test may report skipped)

## 5. Scheduler Integration & Server Wiring (`src/planificador.ts`, `src/server.ts`, `src/aislamiento.test.ts`)

- [ ] 5.1 RED extend `src/planificador.test.ts` (fake `Notificador`, fake `Reloj`): a run with 0 rows never calls the notifier and records `omitida-sin-filas`; a run with rows and a recipient calls it exactly once with own `para` and records `enviada` (spec `automation-scheduling` "One run, one row, one send"; Threat Matrix "0 rows")
- [ ] 5.2 RED extend: no recipient records `sin-destinatario`; a `null` or absent notifier records `no-configurada`; an existing automation without recipient keeps running (spec "Existing automation without recipient keeps running")
- [ ] 5.3 RED extend: a query failure or gate refusal records `notificacion: null` and never calls the notifier (spec `execution-log` "Query failure leaves notificacion null")
- [ ] 5.4 RED extend: a failing send closes the row `fallo`/`notificacion` with the closed category, keeps `filas`, and a sibling automation in the same tick still completes (spec "A failed send does not block a sibling")
- [ ] 5.5 RED extend: a notifier that throws closes the row as `fallo`/`notificacion`/`error-interno` with `notificacion='fallo-envio'`, never leaves `en-curso`, and only the error name is logged
- [ ] 5.6 RED extend: on a send failure `log.warn` carries `automatizacionId`, `fase`, `error`, `codigoError` and never the recipient, rows, or SMTP text (spec "Failure log carries no secrets")
- [ ] 5.7 RED extend: a delayed send is included in `duracionMs`; the row is written by a single `ejecucion.update` after the send, and `finalizadaEn` is read after the send (spec "Each outcome is recorded")
- [ ] 5.8 GREEN modify `src/planificador.ts`: `DependenciasPlanificador.notificador?: Notificador | null`; select `destinatario` and the template presentation fields (`nombre`, `automatizacion`); after `resultadoDeCorrida` apply `decidirNotificacion`, `componerCorreo` (with `hayMas`, `zonaHoraria`), `notificador.enviar`, `cierreConNotificacion`, then one `update` — satisfies 5.1–5.7
- [ ] 5.9 RED then GREEN in `src/planificador.test.ts`: a hanging fake notifier bounded by the outer timeout does not block the next tenant/automation in the tick (Threat Matrix "SMTP hangs")
- [ ] 5.10 Modify `src/server.ts`: `const notificador = crearNotificadorSmtp({ timeoutMs: config.smtpTimeoutMs })` before `listen`, pass it to `crearPlanificador`, log only `correo: 'configurado' | 'no-configurado'` (spec `project-environment` "Changing SMTP settings without a code change")
- [ ] 5.11 RED/GREEN extend `src/aislamiento.test.ts` (T2): a tick with tenants A and B and a marker parameter per tenant — each call's `para` is its own recipient and its body holds only its own marker; no global fallback recipient exists (spec `tenant-isolation` "Two-tenant tick delivers each tenant's rows only to its own recipient", "Recipient comes from the run's own automation", "No global fallback recipient")
- [ ] 5.12 Checkpoint: `npx tsc --noEmit` clean; `npm test -- src/planificador.test.ts src/aislamiento.test.ts` green. Contingency: split 5a (5.1–5.9) and 5b (5.10–5.12), as planned

## 6. Routes & Console (`src/automatizaciones-rutas.ts`, `src/consola.ts`)

- [ ] 6.1 RED extend `src/automatizaciones-rutas.test.ts`: create with a valid `destinatario` persists it; without one persists `null`; an invalid recipient, one with CR/LF, or a comma-separated list is `400 {campos:['/destinatario']}` with no row persisted; no route edits the recipient (spec `automation-scheduling` "Creating with a valid recipient", "Creating without a recipient", "Invalid recipient rejected", "Recipient cannot be edited"; Threat Matrix "CRLF or `,` in recipient")
- [ ] 6.2 RED extend: `GET /automatizaciones/:id` returns `destinatario`; the list projection stays minimal; the runs listing returns `notificacion` (spec `execution-log` "Listing shows notificacion")
- [ ] 6.3 GREEN modify `src/automatizaciones-rutas.ts`: optional `destinatario` (string, 1–254, in `propertyNames`), `direccionValida` gate, add to `AutomatizacionCompleta` only, add `notificacion` to `EjecucionListada` — satisfies 6.1–6.2
- [ ] 6.4 RED extend `src/consola.test.ts`: `auto-destinatario` email input, sent only when non-empty; a rejected recipient shows a legible message naming the recipient field, never a raw error object or stack trace (spec `query-console` "Creating with a recipient", "Invalid recipient shown legibly")
- [ ] 6.5 RED extend: runs view has a "Notificación" column with labels Enviada / No enviada: sin filas / Sin destinatario / Correo no configurado / Falló el envío / —; a `fallo` run in phase `notificacion` shows one message per closed category (spec "Notification outcomes are legible", "Send failure visible as failure")
- [ ] 6.6 GREEN modify `src/consola.ts`: recipient input, error message, "Notificación" column and category messages, every call through `pedir()` — satisfies 6.4–6.5
- [ ] 6.7 Checkpoint: `npx tsc --noEmit` clean; `npm test -- src/automatizaciones-rutas.test.ts src/consola.test.ts` green; manual console check. Contingency: split 6a (6.1–6.3) and 6b (6.4–6.6)

## 7. Docs, Verify & Archive

- [ ] 7.1 Create `docs/bitacora/CH-14-motor-condicion-y-notificacion.md` (mirror CH-13's bitácora): what was built, the nodemailer/Mailpit versions verified in 1.2, limits (non-ASCII recipients, nested-JSON `null`, Gmail 102 KB clipping, duplicate or lost mail on crash until CH-17/18), rollback via unset `SMTP_HOST`
- [ ] 7.2 Full-suite checkpoint: `npm test` green; `npx tsc --noEmit` clean; `npx prisma validate` clean
- [ ] 7.3 Run `sdd-verify` against every spec under `specs/` for this change; produce the verify report
- [ ] 7.4 Run `sdd-archive`: merge each delta spec into its main spec and move `openspec/changes/CH-14-engine-condition-email-notification/` to `openspec/changes/archive/`. Do not edit `docs/01-decisiones.md` except the standard change record its archive step already prescribes

## Key Success-Criteria Traceability

- Zero-row runs never send; row runs send exactly once → 3.1, 5.1
- No `null`/`undefined`/broken cells; truncation notice shown → 2.2, 2.4
- Every run records its `notificacion` outcome → 3.1, 3.2, 5.1–5.5
- T2 green → 5.11
