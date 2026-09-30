# Apply Progress: CH-14 — Engine: Condition and Email Notification

Mode: Strict TDD (orchestrator-injected; `openspec/config.yaml` still says `strict_tdd: false`).
Delivery: auto-chain, stacked-to-main. Test command: `TEST_DB_PORT=5434 npm test` (live PostgreSQL
container `zd-ch09-testdb` on `localhost:5434`).

## Completed

| Unit | Tasks | Branch | Commits |
|---|---|---|---|
| 1 Planning, schema, migration, `smtpTimeoutMs`, pin, compose, `.env.example` | 1.1–1.9 | `ch14/1-esquema-config` (base `master` `a4d78db`) | `ce5bea5` (planning, docs only), `b208e00`, `975c7aa`, `6c4e046`, `c1130c2`, `b05d60e`, `f40d93c` (bookkeeping) |
| 2a Pure helpers: `direccionValida`, `textoDeCelda`, `escaparHtml`, `asuntoCorreo` | 2.1, 2.2 (cell rules), 2.3 (`escaparHtml`), 2.5 (subject) | `ch14/2a-correo-auxiliares` (base `ch14/1-esquema-config` `f40d93c`) | `3b1043b` |
| 2b Composition: `componerCorreo`, HTML/text parts, notices, accent, date | 2.2 (in-message), 2.3 (in-message), 2.4, 2.5 (accent), 2.6, 2.7, 2.8 | `ch14/2b-correo-composicion` (base `ch14/2a-correo-auxiliares`) | `b45c111`, `2a3dca8` (bookkeeping) |
| 3a Precedence: `decidirNotificacion` | 3.1 | `ch14/3a-decision-notificacion` (base `ch14/2b-correo-composicion` `2a3dca8`) | `568a6eb` |
| 3b Close with notification, close-type widening | 3.2–3.6 | `ch14/3b-cierre-notificacion` (base 3a) | `6ac0ea8`, `c4cfc84` (bookkeeping) |
| 4a `SMTP_*` parsing: `leerSmtp` | 4.1, 4.2 | `ch14/4a-notificador-entorno` (base 3b `c4cfc84`) | `2d4016b` |
| 4b Send wrapper, closed categories, hardened options | 4.3, 4.4, 4.5 | `ch14/4b-notificador-transporte` (base 4a) | `576f0c5` |
| 4c Outer time limit, `crearNotificadorSmtp`, live Mailpit test | 4.6–4.9 | `ch14/4c-notificador-limite` (base 4b) | `9fffc22`, `f34c976`, `dfca3a4` (bookkeeping) |
| 5a1 Notify step and single close in `correr()` | 5.1–5.3, 5.8 (base) | `ch14/5a1-planificador-notifica` (base 4c `dfca3a4`) | `3f019eb` |
| 5a2 Send failures: throw caught, log, duration, hang | 5.4–5.7, 5.9, 5.8 (complete) | `ch14/5a2-planificador-fallos` (base 5a1) | `53c6cbc`, `271b430` (bookkeeping) |
| 5b Server wiring and T2 delivery | 5.10–5.12 | `ch14/5b-servidor-t2` (base 5a2 `271b430`) | `770df6f`, `e3fa12a`, this bookkeeping |

Remaining: Phases 6–7. Unit 6 stacks on `ch14/5b-servidor-t2`.

## Task 1.2 Findings (for the PR body)

| Item | Finding |
|---|---|
| `npm view nodemailer version` | `10.0.12` (matches explore), `engines.node >=20.0.0`, ESM + CJS `exports` |
| Bundled types | Yes: `types: ./dist/cjs/nodemailer.d.ts`, and `dist/esm/*.d.ts` exist. `@types/nodemailer` (8.0.2) is **not** added |
| Error `code` set | Present in `dist/`: `ECONNECTION`, `ESOCKET`, `EDNS`, `ETLS`, `EPROXY`, `ETIMEDOUT`, `EAUTH`, `ENOAUTH`, `EENVELOPE`, `EMESSAGE`, `EPROTOCOL`, `ESTREAM`. Also present and not in the design table (they fall to `error-desconocido`): `EREQUIRETLS`, `EURLACCESS`, `EFILEACCESS`, `EFETCH`, `EMAXLIMIT`, `ECONFIG`, `ESENDMAIL`, `ESES` |
| Options | `disableFileAccess`, `disableUrlAccess` (`mailer/index.d.ts`), `jsonTransport: true`, `connectionTimeout`/`greetingTimeout`/`socketTimeout` (`smtp-connection/index.d.ts`), `responseCode?: number` on the error type |
| Mailpit tag | Local `axllent/mailpit:latest` image reports `mailpit v1.31.2` (built 2026-09-19); pinned as `axllent/mailpit:v1.31.2`. Not cross-checked against Docker Hub (no registry query made) |

## Unit 1 Evidence

| Evidence | Value |
|---|---|
| Focused test command | `npx tsx --test src/config.test.ts`: 33 tests, 33 pass, 0 fail |
| RED observed | 1.5: the file failed to load (no export `DEFAULT_SMTP_TIMEOUT_MS`). The "never its value" assertion was also proven against the old message (`got: ${valor}` restored temporarily): 4 fail, then restored: 33 pass |
| Safety net | `src/config.test.ts` 25/25 before edits; full suite 536/536 on `master` before edits |
| Full suite | `TEST_DB_PORT=5434 npm test`: 544 tests, 544 pass, 0 fail, 0 skipped (536 baseline + 8 new) |
| Runtime harness | `npx prisma validate`: valid. `prisma migrate deploy` against `localhost:5434`: `20260929000000_notificacion` applied; `migrate diff --from-config-datasource --to-schema` afterwards: empty. `docker compose config --quiet`: OK (services `db`, `app`). `docker compose --profile correo config --quiet`: OK (services `db`, `app`, `mailpit`; image `axllent/mailpit:v1.31.2`; ports `127.0.0.1:1026->1025`, `127.0.0.1:8026->8025`). With `--env-file .env.example`, every `SMTP_*` in `app` resolves to `''` |
| Rollback boundary | `ALTER TABLE "Ejecucion" DROP COLUMN "notificacion"; ALTER TABLE "Automatizacion" DROP COLUMN "destinatario";`; revert `b208e00`..`b05d60e`. The planning commit `ce5bea5` stays |

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | — | — | N/A (docs) | ➖ Docs only | ➖ | ➖ | ➖ |
| 1.2 | — | — | N/A (research) | ➖ Findings above | ➖ | ➖ | ➖ |
| 1.3 | — | — | 536/536 | ➖ Dependency pin, structural | ✅ `npm install` exit 0 | ➖ Skipped: one possible output | ➖ |
| 1.4 | `src/planificador.test.ts` (existing 4.6 column-set test) | Integration (live PG) | 536/536 | ⚠️ Structural; the existing column-set test went red after the migration (1 fail) | ✅ 10/10 after adding `notificacion` to `COLUMNAS_EJECUCION` | ➖ Skipped: structural column add | ➖ None needed |
| 1.5/1.6 | `src/config.test.ts` | Unit | ✅ 25/25 | ✅ Written (import failed; value-leak cases proven red against the old message) | ✅ 33/33 | ✅ default, empty, override, 4 invalid values, SMTP settings off `AppConfig` | ✅ None needed |
| 1.7/1.8 | — | Config | N/A | ➖ Structural (compose/env) | ✅ `docker compose config` both profiles | ➖ Skipped: config files | ➖ |
| 1.9 | — | Checkpoint | — | — | ✅ all checks above | — | — |

### Test Summary

- Total tests written: 8 (config), 1 existing expectation updated (planificador column set)
- Total tests passing: 544/544
- Layers used: Unit (8), Integration (1 updated)
- Approval tests: the existing `COLUMNAS_EJECUCION` pin acted as one; updated for the spec'd column
- Pure functions created: 0

## Deviations

1. **Mailpit host ports.** Tasks 1.7 said ports 1025/8025. The host already has an unrelated Mailpit
   on 1025/8025, so the compose service maps `127.0.0.1:${MAILPIT_SMTP_PORT:-1026}:1025` and
   `127.0.0.1:${MAILPIT_UI_PORT:-8026}:8025`. Container ports stay 1025/8025; inside Compose the app
   uses `SMTP_HOST=mailpit`, `SMTP_PORT=1025`. Both variables are documented in `.env.example`.
2. **`enteroPositivoOpcional` message.** To satisfy "names the variable, never its value" for
   `SMTP_TIMEOUT_MS` while reusing `enteroPositivoOpcional` (task 1.6), its error message dropped
   `got: ${valor}` for every caller (`CONNECTION_TEST_TIMEOUT_MS`, `QUERY_TIMEOUT_MS`,
   `MAX_FILAS_CONSULTA`, `SMTP_TIMEOUT_MS`). No existing test asserted the value in the message.
   `APP_PORT` and `ZONA_HORARIA_AUTOMATIZACIONES` still quote their value (untouched).
3. **Extra commit `b05d60e`.** The migration broke the CH-13 planificador test that pins the exact
   `Ejecucion` column set; it was updated in a separate commit (no interactive rebase available).
   Commit `975c7aa` alone leaves that one test red; the branch head is green.

## Unit 2 Evidence (split into 2a/2b per the tasks.md contingency)

The single slice measured 687 authored lines (`src/correo.ts` 322, `src/correo.test.ts` 365),
over the 400 budget, so the planned 2a/2b split was applied. Both are pure-function slices with no
consumer yet.

| Evidence | 2a | 2b |
|---|---|---|
| Diff | `git diff --shortstat ch14/1-esquema-config..ch14/2a-correo-auxiliares`: 2 files, 331 insertions | `git diff --shortstat ch14/2a-correo-auxiliares..b45c111`: 2 files, 356 insertions (the bookkeeping commit adds only `openspec/` lines) |
| Focused test command | `npx tsx --test src/correo.test.ts`: 12 tests, 12 pass, 0 fail | `npx tsx --test src/correo.test.ts`: 25 tests, 25 pass, 0 fail |
| Full suite | `TEST_DB_PORT=5434 npm test`: 556 tests, 556 pass, 0 fail, 0 skipped | `TEST_DB_PORT=5434 npm test`: 569 tests, 569 pass, 0 fail, 0 skipped (544 baseline + 25 new) |
| Typecheck | `npx tsc --noEmit`: exit 0 | `npx tsc --noEmit`: exit 0 |
| Runtime harness | N/A — pure functions, no I/O boundary | N/A — pure functions, no I/O boundary |
| Rollback boundary | Delete `src/correo.ts` and `src/correo.test.ts`; nothing imports them | Revert `b45c111` (removes the composition section and its tests); 2a stays intact |

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 2.1 | `src/correo.test.ts` | Unit | N/A (new); suite 544/544 | ✅ Written; file failed to load (no `./correo.js`) | ✅ 3/3 | ✅ 4 accepted, 11 injection/separator, 19 malformed cases | ✅ None needed |
| 2.2 | `src/correo.test.ts` | Unit | N/A (new) | ✅ Written; load failed (no `textoDeCelda`/`componerCorreo` export) | ✅ 8/8 | ✅ 6 empty values, numbers/bigint/text, bool/date/invalid date/bytes/object/cycle/function, 500 cap both sides, padding row, zero row with tag balance | ✅ Cap folded into `textoDeCelda` |
| 2.3 | `src/correo.test.ts` | Unit | 8/8 | ✅ Written; load failed (no `escaparHtml` export) | ✅ 10/10 | ✅ all five characters; cell, column name and template name; identity on plain text | ✅ None needed |
| 2.4 | `src/correo.test.ts` | Unit | 10/10 | ✅ Written; 3 of 4 failed (truncation, empty-cell, zero-column notices) | ✅ 14/14 | ✅ positive notice cases plus the complete-result negative case | ✅ Notices extracted to `avisosDe` |
| 2.5 | `src/correo.test.ts` | Unit | 14/14 | ✅ Written; 5 of 5 failed. After the split refactor, the subject cases were repointed at `asuntoCorreo` and failed to load (no export) before it was exported | ✅ 19/19, then 25/25 after the refactor | ✅ 3 known labels, 4 unknown labels (`constructor`, `__proto__`, empty), `+` count, control characters, 200 cap | ✅ Subject extracted to exported `asuntoCorreo`; theme `Map` lookup |
| 2.6 | `src/correo.test.ts` | Unit | 19/19 | ✅ Written; 2 of 4 failed (CR/LF in text part, date in zone). Text parity and the no-internals guard already held from 2.4/2.5 and act as triangulation | ✅ 23/23 | ✅ UTC vs Buenos Aires; CR, LF, CRLF in cells and column names; extra SQL/param/host/recipient fields ignored | ✅ `textoDe`/`htmlDe`/`ESTILO` extraction |
| 2.7 | `src/correo.test.ts` | Unit | — | ➖ Covered by 2.1–2.6 RED | ✅ 25/25 | ➖ Covered above | ✅ |
| 2.8 | — | Checkpoint | — | — | ✅ `tsc` clean, 25/25, full suite 569/569 | — | ✅ 2a/2b split applied |

### Test Summary

- Total tests written: 25 (12 in 2a, 13 in 2b)
- Total tests passing: 569/569 on the 2b tip
- Layers used: Unit (25)
- Approval tests: none (no refactoring of existing code)
- Pure functions created: `direccionValida`, `textoDeCelda`, `escaparHtml`, `asuntoCorreo`, `componerCorreo` (exported) plus private helpers

### Unit 2 Deviations

1. **2a/2b split.** Applied as tasks.md foresaw. The subject needed the label map for its emoji, so
   the whole closed theme map (accent and emoji) lives in 2a with the subject; 2b only reads the
   accent. tasks.md had listed the accent map under 2b.
2. **Extra export `asuntoCorreo`.** Design lists `Correo`, `componerCorreo`, `direccionValida`,
   `escaparHtml`, `textoDeCelda`. `asuntoCorreo` is also exported so 2a can be reviewed and tested on
   its own. `componerCorreo` still returns the subject, so later units need nothing new.
3. **`direccionValida` does not trim.** Design says "trimmed"; tasks 2.1 says "rejects whitespace".
   The function refuses leading/trailing whitespace instead of trimming it, so the value checked is
   always the value stored. Unit 6 (routes) may trim the request value before calling it if the
   console should accept surrounding spaces; that is a route choice, not a renderer change.
4. **Date line format.** Design only says "formatted in `zonaHoraria`". Chosen:
   `Ejecución del YYYY-MM-DD HH:mm ({zona})`, built from `Intl.DateTimeFormat#formatToParts`, so it
   does not depend on the ICU locale data of the host.
5. **Cell cap.** 500 characters total, the last one being `…` (499 kept + ellipsis).
6. **Subject cap.** 200 code points; the name is cut (with `…`) so the `({n}{+})` count always
   survives. Control characters, including U+2028/U+2029, become one space.

## Unit 3 Evidence

| Evidence | Value |
|---|---|
| Diff | `git diff --shortstat ch14/2b-correo-composicion..HEAD`: 2 files, 372 insertions, 9 deletions (381 changed; code and tests only). `568a6eb` 110 lines, `6ac0ea8` 271 lines |
| Focused test command | `npx tsx --test src/automatizaciones.test.ts`: 38 tests, 38 pass, 0 fail (24 before) |
| Full suite | `TEST_DB_PORT=5434 npm test`: 583 tests, 583 pass, 0 fail, 0 skipped (569 baseline + 14 new) |
| Typecheck | `npx tsc --noEmit`: exit 0, at `568a6eb` and at `6ac0ea8` |
| Runtime harness | N/A — pure functions, no I/O boundary; nothing consumes them until unit 5a |
| Rollback boundary | Revert `6ac0ea8` (type widening, `cierreConNotificacion`, `PATRON_CODIGO_SMTP`), then `568a6eb` (`decidirNotificacion`). No other file imports them |
| 3.5 fallout | No site needed a fix. `planificador.ts` spreads the close into `ejecucion.update` and logs `fase`/`error`/`codigoError`; `automatizaciones-rutas.ts` imports only `cronValido`; routes and console read `fase` as a DB string |

### Unit 3 budget

Code and tests alone are 381 changed lines. With this file and the six `tasks.md` checkboxes,
the unit exceeds the 400-line cap. It was delivered as the split below, with the bookkeeping
committed on 3b (`c4cfc84`): **3a** = `568a6eb` (task 3.1, 110 lines) plus its
bookkeeping; **3b** = `6ac0ea8` (tasks 3.2–3.6, 271 lines) plus its bookkeeping. Each fits the
budget.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 3.1 | `src/automatizaciones.test.ts` | Unit | ✅ 24/24 | ✅ Written; load failed (no `decidirNotificacion` export) | ✅ 29/29 | ✅ 5 non-ok results; zero rows with and without recipient/SMTP; missing recipient with SMTP set and unset; 2 recipients | ➖ None needed |
| 3.2 | `src/automatizaciones.test.ts` | Unit | ✅ 29/29 | ✅ Written; load failed (no `cierreConNotificacion` export) | ✅ 34/34 | ✅ enviada; 3 omissions; 2 send failures (with and without cut/code); a throw; a failed query with `null` and with a stray send verdict | ➖ None needed |
| 3.3 | `src/automatizaciones.test.ts` | Unit | ✅ 34/34 | ✅ Written; 2 of 4 failed (code gating, category re-gate). The no-spread case already held from 3.2 and acts as triangulation | ✅ 38/38 | ✅ 6 kept codes; 13 refused (Node codes, SQLSTATE, out of range, trailing LF, leading space, fullwidth digits, SMTP and AUTH text); unknown category | ➖ None needed |
| 3.4 | `src/automatizaciones.ts` | — | — | ➖ Covered by 3.1–3.3 RED | ✅ 38/38 | ➖ Covered above | ➖ |
| 3.5 | — | Typecheck | — | — | ✅ `tsc` exit 0, no fix needed | — | — |
| 3.6 | — | Checkpoint | — | — | ✅ `tsc` clean, 38/38, full suite 583/583 | — | — |

### Unit 3 Deviations

1. **Throw in the notify step handled in the mapping.** The design table says a throw closes as
   `fallo`/`notificacion`/`error-interno`, but its interface gave the new variant `error:
   CategoriaEnvio`. The variant is `error: CategoriaEnvio | 'error-interno'`, and
   `cierreConNotificacion` accepts `FalloInesperado` (its value is never read). Unit 5a only
   catches the throw and hands `{ resultado: 'excepcion', error }` in (task 5.5).
2. **Existing failure variant kept exact.** Widening `FaseCierre`/`CategoriaCierre` would also have
   widened the query-failure variant. It now uses `Exclude<FaseCierre, 'notificacion'> | null` and
   the unexported pre-CH-14 union `CategoriaCorrida`, so only the new variant can carry
   `fase='notificacion'` or a send category. The query and send sets overlap by name
   (`tiempo-agotado`, `credenciales-invalidas`, `error-desconocido`), so `fase` still tells them apart.
3. **Shared SMTP code pattern.** `PATRON_CODIGO_SMTP` (`/^[2-5][0-9][0-9]$/`, equivalent to the
   design's `\d` form) is exported from `automatizaciones.ts`; unit 4's `codigoSmtp` should import it
   rather than repeat it. The category is also re-gated to the closed set (`error-desconocido`
   otherwise), which the design did not list.
4. **Extra exported types.** `OmisionNotificacion`, `DecisionNotificacion` (`{enviar:false,
   notificacion}` or `{enviar:true, para}`), `SalidaNotificacion`, `CierreNotificado`.

## Unit 4 Evidence (split into 4a/4b/4c)

The slice measured about 830 changed lines (code 239, unit tests 426, live test 107, plus
bookkeeping), so two sub-branches of at most 400 lines each could not hold it. It was cut into
three stacked sub-branches along its natural seams: configuration, sending, time limit and wiring.

| Evidence | 4a | 4b | 4c |
|---|---|---|---|
| Diff vs previous branch | 2 files, +173 | 2 files, +335 −4 | 3 code files +269 −6, plus this bookkeeping |
| Focused test | `npx tsx --test src/notificador.test.ts`: 5/5 | 13/13 | 19/19; `src/notificador-mailpit.test.ts` skipped when Mailpit is down |
| Full suite (`TEST_DB_PORT=5434 npm test`) | 588/588 | 596/596 | 602/602, 0 fail (583 baseline + 19) |
| Typecheck | `npx tsc --noEmit`: exit 0 | exit 0 | exit 0 |
| Runtime harness | N/A — pure parsing | nodemailer `jsonTransport` (real library, no network) | Local TCP servers on 127.0.0.1 (closed port, silent server); live Mailpit via `docker compose --profile correo up -d mailpit` on 1026/8026: 1 pass, Mailpit reported `SMTPAccepted: 1`, message deleted; container stopped afterwards |
| Rollback boundary | Delete `src/notificador.ts` and its test | Revert `576f0c5` | Revert `f34c976`, `9fffc22`; nothing imports the notifier until unit 5b |

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 4.1 | `src/notificador.test.ts` | Unit | N/A (new); suite 583/583 | ✅ Written; load failed (no `./notificador.js`) | ✅ 5/5 | ✅ absent/empty host with stray values; defaults; secure port; explicit port; credentials | ➖ None needed |
| 4.2 | `src/notificador.test.ts` | Unit | N/A (new) | ✅ Written with 4.1; value-leak check proven red by putting `got: ${v}` in the port message (1 fail), then restored | ✅ 5/5 | ✅ 16 invalid cases over five variables | ➖ None needed |
| 4.3 | `src/notificador.test.ts` | Unit (real `jsonTransport`) | ✅ 5/5 | ✅ Written; load failed (no `notificadorDesdeTransporte`) | ✅ 7/7 | ✅ two senders and recipients | ➖ None needed |
| 4.4 | `src/notificador.test.ts` | Unit (fake transport) | ✅ 7/7 | ✅ Written; load failed (no `codigoSmtp`) | ✅ 11/11 | ✅ 13 codes; bare 550/421; code with 535; EPROTOCOL with 554; 250; non-Error; synchronous throw; 12 refused `codigoSmtp` values | ➖ None needed |
| 4.5 | `src/notificador.test.ts` | Unit (real `jsonTransport`) | ✅ 11/11 | ✅ Written; load failed (no `opcionesTransporte`); with both flags flipped to `false` the two cases fail | ✅ 13/13 | ✅ with and without credentials; literal file/URL text; `path` and `href` refused | ➖ None needed |
| 4.6 | `src/notificador.test.ts` | Unit (fake transport) | ✅ 13/13 | ✅ Written; 2 of 3 failed (hang timed out, late rejection) | ✅ 16/16 | ✅ never answers; answers inside the budget; throwing `close()` with a late rejection | ✅ `mensaje` extracted; closed-transport note |
| 4.7 | `src/notificador.test.ts` | Integration (local sockets) | ✅ 16/16 | ✅ Written; load failed (no `crearNotificadorSmtp`) | ✅ 19/19 | ✅ unset; invalid; closed port; silent server | ➖ None needed |
| 4.8 | `src/notificador-mailpit.test.ts` | Live (Mailpit) | — | ➖ Harness after 4.7 | ✅ 1/1 live; skipped when down | ➖ Single scenario | ➖ |
| 4.9 | — | Checkpoint | — | — | ✅ `tsc` clean; 19/19; 602/602 | — | — |

### Unit 4 Deviations

1. **Three sub-branches, not two.** See the budget note above.
2. **`Transporte` instead of nodemailer's `Transporter`.** `notificadorDesdeTransporte` takes the
   two methods it uses (`sendMail`, `close`); a nodemailer transporter fits it, and fakes need no cast.
3. **Extra exports.** `ConfigSmtp`, `EntornoSmtp` and `opcionesTransporte` (the hardening and the
   three socket timeouts are asserted on it, and a JSON transport built from it proves the flags work).
4. **`SMTP_PORT` range.** It must also be at most 65535.
5. **Reply-code rule.** A listed `code` decides the category first; a 4xx/5xx `responseCode` means
   `envio-rechazado` only when the code is absent or unlisted (so `EREQUIRETLS` with no reply code
   stays `error-desconocido`). `codigoSmtp` accepts only an integer `responseCode`.
6. **Live test ports.** Task 4.8 says 1025/8025. The test reads `MAILPIT_SMTP_PORT`/`MAILPIT_UI_PORT`
   (1026/8026 by default) and skips when the port is 1025, so it cannot deliver into another catcher.
7. **Outer-limit close.** nodemailer's SMTP `close()` does not abort a connection in flight; the three
   socket timeouts end it. The transport is not pooled, so it still sends the next message.

## Unit 5a Evidence (split into 5a1/5a2)

The slice measured 378 changed lines of code and tests (`src/planificador.ts` +100 −16,
`src/planificador.test.ts` +257 −5, across both commits); with the `tasks.md` and apply-progress
bookkeeping it passed 400, so it was cut into two stacked sub-branches. The cut is not the
planned "RED/GREEN boundary of 5.7" (that would leave a red branch): 5a1 holds the notify step
without the throw guard and the precedence tests; 5a2 holds the throw guard and the failure tests.

| Evidence | 5a1 | 5a2 |
|---|---|---|
| Diff vs previous branch | `git diff --shortstat ch14/4c-notificador-limite..ch14/5a1-planificador-notifica`: 2 files, +210 −19 | `git diff --shortstat ch14/5a1-planificador-notifica..53c6cbc`: 2 files, +162 −17, plus this bookkeeping |
| Focused test | `TEST_DB_PORT=5434 npx tsx --test src/planificador.test.ts`: 13/13 | 17/17 |
| Full suite (`TEST_DB_PORT=5434 npm test`) | 605/605, 0 fail, 0 skipped | 609/609, 0 fail, 0 skipped (602 baseline + 7) |
| Typecheck | `npx tsc --noEmit`: exit 0 | exit 0 |
| Runtime harness | Live PostgreSQL on 5434 (read-only role `ch13_lector` runs the real pipeline) + fake `Notificador` + fake `Reloj` | Same, plus the real `notificadorDesdeTransporte` over a transport that never answers (50 ms outer limit) and pino JSON lines captured through a Fastify logger stream |
| Rollback boundary | Revert `3f019eb`: runs record `notificacion` null again; nothing injects a notifier until 5b | Revert `53c6cbc`: a throwing notifier would leave its row `en-curso` again; 5a1 stays |

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 5.1 | `src/planificador.test.ts` | Integration (live PG, fake notifier) | ✅ 10/10 | ✅ Written; 1 fail (`notificacion` null, expected `omitida-sin-filas`) | ✅ 11/11 | ✅ 0 rows vs 1 row in one tick; subject carries the template name and count | ✅ `columnas()` helper replaced hand-built objects |
| 5.2 | same | Integration | ✅ 11/11 | ⚠️ Passed on first run (precedence already in `decidirNotificacion`, unit 3a). Mutation: passing `configurado=true` always makes it fail | ✅ 17/17 | ✅ enviada / absent notifier / `null` notifier, with and without recipient | ➖ |
| 5.3 | same | Integration | ✅ | ⚠️ Passed on first run (triangulation of 5.1) | ✅ | ✅ query failure (`conexion`) and gate refusal (`preparacion`) | ➖ |
| 5.4 | same | Integration | ✅ | ⚠️ Passed on first run (mapping from unit 3b). Mutation: dropping `destinatario` from the select fails 5.1, 5.2, 5.4, 5.7, 5.9 | ✅ | ✅ failing run and a sibling that sends in the same tick | ➖ |
| 5.5 | same | Integration | ✅ 16/16 | ✅ Written; 1 fail (row left `en-curso`); re-proven red on the 5a1 commit | ✅ 17/17 | ✅ synchronous throw (the harder case); error name logged, message absent | ✅ unreachable guard moved inside the `try` so even it closes the row |
| 5.6 | same (merged with 5.4) | Integration (pino lines) | ✅ | ⚠️ Passed on first run. Mutation: adding the recipient to `log.warn` makes it fail | ✅ | ✅ recipient, a marker cell (`fila-secreta`, proven present in the message) and SMTP text in the verdict all absent from every line | ➖ |
| 5.7 | same | Integration (fake clock advanced by the send) | ✅ | ⚠️ Passed on first run. Mutation: reading `finalizadaEn` before the send makes it fail | ✅ | ✅ row still `en-curso` during the send; `duracionMs` = 5000 exactly | ➖ |
| 5.8 | `src/planificador.ts` | — | — | ➖ Covered by 5.1–5.7 | ✅ | ➖ | ✅ `esExcepcion` names the pipeline or notify throw for the log |
| 5.9 | same | Integration (real notifier, hanging transport) | ✅ | ⚠️ Passed on first run (outer limit from unit 4c) | ✅ | ➖ Single scenario; a regression would hang the tick and the test | ➖ |

### Unit 5a Deviations

1. **Split 5a1/5a2 at a different seam** than the forecast's "RED/GREEN boundary of 5.7", so both
   branches are green (see above). 5a1 alone lets a throwing notifier leave its row `en-curso`;
   the contract says `enviar` never throws and nothing injects a notifier before 5b.
2. **Template read moved into `correr()`.** `resultadoDeCorrida` now receives the template, so the
   notify step has its `nombre` and `automatizacion` label. The read, its select and its comment
   are otherwise unchanged; a throw from it still closes as `error-interno`.
3. **Many tasks were already satisfied.** 5.2–5.4, 5.6, 5.7 and 5.9 passed on their first run,
   because precedence, mapping and the outer limit were built and unit-tested in units 3 and 4.
   Each was proven to detect a regression by a mutation of `planificador.ts` (table above).
4. **"Single `ejecucion.update`"** is shown by behaviour, not by counting calls: the row is still
   `en-curso` with `finalizadaEn` and `notificacion` null while the send is in flight, and closed
   with all of them afterwards.
5. **Existing tests unchanged.** No CH-13 expectation needed an update: the rows they assert either
   fail before the notify step (`notificacion` null) or are not asserted on `notificacion`.
6. **Tests run under ticks that also re-run earlier tests' automations**, so each CH-14 test uses its
   own recipient and reads only its own messages (`notificadorFalso().a(para)`).

## Unit 5b Evidence

| Evidence | Value |
|---|---|
| Diff | `git diff --shortstat ch14/5a2-planificador-fallos..e3fa12a`: 3 files, +303 −1, plus this bookkeeping |
| Focused test | `TEST_DB_PORT=5434 npx tsx --test src/planificador.test.ts src/aislamiento.test.ts src/server.test.ts`: 72/72 |
| Full suite (`TEST_DB_PORT=5434 npm test`) | 613/613, 0 fail, 0 skipped (609 baseline + 4) |
| Typecheck | `npx tsc --noEmit`: exit 0 |
| Runtime harness | `src/server.test.ts` boots `src/server.ts` as a child process (`node --import tsx`), database on a closed port so no tick can touch live rows: SMTP unset listens and logs `no-configurado`; valid SMTP logs `configurado` with no host or sender printed; invalid `SMTP_PORT` exits non-zero naming the variable, not its value. T2 runs the real pipeline on live PostgreSQL as role `ch14_t2_lector` with a recording fake notifier |
| Rollback boundary | Revert `e3fa12a` (T2 case only); revert `770df6f` (server builds no notifier, every run records `no-configurada` again) |

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 5.10 | `src/server.test.ts` | Process (child boot) | N/A (new); no prior server test | ✅ Written; 3/3 failed (no `correo` line; invalid port still listened) | ✅ 3/3 | ✅ empty host with stray port; valid config; invalid port | ➖ None needed |
| 5.11 | `src/aislamiento.test.ts` | Integration (live PG, fake notifier) | ✅ 51/51 | ⚠️ Passed on first run (5a built delivery). Mutations of `planificador.ts`: `destinatario ?? process.env.SMTP_TO` fails it; sending every message to the tick's first recipient fails it | ✅ 52/52 | ✅ two tenants with recipients plus one automation without a recipient under four recipient-like variables | ✅ Extra views deleted in `finally` (later cases count each tenant's views) |
| 5.12 | — | Checkpoint | — | — | ✅ `tsc` clean; 72/72; 613/613 | — | — |

### Unit 5b Deviations

1. **Marker per tenant view, not a template parameter.** Task 5.11 says "a marker parameter per
   tenant". Each tenant gets its own read-only connection and `producto` view returning its marker,
   under one shared template, so the rows come from that tenant's own target.
2. **New `src/server.test.ts`.** 5.10 listed no test; strict TDD needed one, and the entry point is
   only testable as a process. It is the suite's first child-process test.
3. **Log message.** The boot line is `{ correo: 'configurado' | 'no-configurado' }` with message
   `email notifications`.

## Notes for Later Units

- Unit 5b wires `crearNotificadorSmtp({ timeoutMs: config.smtpTimeoutMs })` (default env
  `process.env`); it throws on an invalid `SMTP_*`, so call it before `listen`.
- Unit 5a calls `componerCorreo({ nombre, automatizacion, columnas, filas, hayMas, fecha, zona })`
  with `fecha` = the run's `iniciadaEn` and `zona` = `zonaHoraria`, then adds `para` itself; the
  renderer never sees the recipient.
- Unit 6 validates `destinatario` with `direccionValida`, which rejects (does not trim) surrounding
  whitespace.
- Unit 5b: `crearPlanificador({ ..., notificador })` accepts `Notificador | null`; the T2 test can
  reuse the fake-notifier pattern (record every `Correo`, filter by `para`).
- Unit 5a flow (done): `d = decidirNotificacion(resultado, automatizacion.destinatario, notificador !== null)`;
  when `d.enviar`, send to `d.para` and pass the verdict (or `{resultado:'excepcion', error}` on a
  throw) to `cierreConNotificacion`; otherwise pass `d.notificacion`. Spread the returned
  `CierreNotificado` into the single `ejecucion.update`.
