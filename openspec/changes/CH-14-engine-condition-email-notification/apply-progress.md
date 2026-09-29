# Apply Progress: CH-14 — Engine: Condition and Email Notification

Mode: Strict TDD (orchestrator-injected; `openspec/config.yaml` still says `strict_tdd: false`).
Delivery: auto-chain, stacked-to-main. Test command: `TEST_DB_PORT=5434 npm test` (live PostgreSQL
container `zd-ch09-testdb` on `localhost:5434`).

## Completed

| Unit | Tasks | Branch | Commits |
|---|---|---|---|
| 1 Planning, schema, migration, `smtpTimeoutMs`, pin, compose, `.env.example` | 1.1–1.9 | `ch14/1-esquema-config` (base `master` `a4d78db`) | `ce5bea5` (planning, docs only), `b208e00`, `975c7aa`, `6c4e046`, `c1130c2`, `b05d60e`, `f40d93c` (bookkeeping) |
| 2a Pure helpers: `direccionValida`, `textoDeCelda`, `escaparHtml`, `asuntoCorreo` | 2.1, 2.2 (cell rules), 2.3 (`escaparHtml`), 2.5 (subject) | `ch14/2a-correo-auxiliares` (base `ch14/1-esquema-config` `f40d93c`) | `3b1043b` |
| 2b Composition: `componerCorreo`, HTML/text parts, notices, accent, date | 2.2 (in-message), 2.3 (in-message), 2.4, 2.5 (accent), 2.6, 2.7, 2.8 | `ch14/2b-correo-composicion` (base `ch14/2a-correo-auxiliares`) | `b45c111`, then the bookkeeping commit for this file |

Remaining: Phases 3–7 (units 3, 4, 5a, 5b, 6, 7). Unit 3 (`ch14/3-mapeo-notificacion`) now stacks on
`ch14/2b-correo-composicion`.

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

## Notes for Later Units

- Task 4.8 (live Mailpit test) targets `localhost:1025`/`8025`. On this machine those ports belong to
  another project's Mailpit; the live test should read the host ports from `MAILPIT_SMTP_PORT` /
  `MAILPIT_UI_PORT` (defaults 1026/8026) instead, or it will deliver into the wrong catcher.
- `EREQUIRETLS`, `EFILEACCESS`, `EURLACCESS` and the other extra codes map to `error-desconocido`
  unless unit 4 decides otherwise within the design table.
- Unit 5a calls `componerCorreo({ nombre, automatizacion, columnas, filas, hayMas, fecha, zona })`
  with `fecha` = the run's `iniciadaEn` and `zona` = `zonaHoraria`, then adds `para` itself; the
  renderer never sees the recipient.
- Unit 6 validates `destinatario` with `direccionValida`, which rejects (does not trim) surrounding
  whitespace.
