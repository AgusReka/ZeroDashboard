# Apply Progress: CH-14 — Engine: Condition and Email Notification

Mode: Strict TDD (orchestrator-injected; `openspec/config.yaml` still says `strict_tdd: false`).
Delivery: auto-chain, stacked-to-main. Test command: `TEST_DB_PORT=5434 npm test` (live PostgreSQL
container `zd-ch09-testdb` on `localhost:5434`).

## Completed

| Unit | Tasks | Branch | Commits |
|---|---|---|---|
| 1 Planning, schema, migration, `smtpTimeoutMs`, pin, compose, `.env.example` | 1.1–1.9 | `ch14/1-esquema-config` (base `master` `a4d78db`) | `ce5bea5` (planning, docs only), `b208e00`, `975c7aa`, `6c4e046`, `c1130c2`, `b05d60e`, then the bookkeeping commit for this file |

Remaining: Phases 2–7 (units 2, 3, 4, 5a, 5b, 6, 7).

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

## Notes for Later Units

- Task 4.8 (live Mailpit test) targets `localhost:1025`/`8025`. On this machine those ports belong to
  another project's Mailpit; the live test should read the host ports from `MAILPIT_SMTP_PORT` /
  `MAILPIT_UI_PORT` (defaults 1026/8026) instead, or it will deliver into the wrong catcher.
- `EREQUIRETLS`, `EFILEACCESS`, `EURLACCESS` and the other extra codes map to `error-desconocido`
  unless unit 4 decides otherwise within the design table.
