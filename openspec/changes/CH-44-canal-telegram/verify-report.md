```yaml
schema: gentle-ai.verify-result/v1
verdict: pass-with-warnings
blockers: 0
critical_findings: 0
warnings: 2
suggestions: 2
requirements: 25/25 (each covered by tests, or by inspection where listed under "Gaps")
scenarios: 106 (5 by inspection or an indirect test, listed under "Gaps"; the rest by tests)
test_command: TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db
test_exit_code: 1 (only the 4 known environmental failures)
build_command: npm run build
build_exit_code: 0
```

# Verify report: CH-44 — Telegram channel

**Verdict: PASS WITH WARNINGS** (0 CRITICAL, 2 WARNING, 2 SUGGESTION). Verified 2026-11-05 on branch `ch44/canal-telegram`. The phase ran inline, because the hook refuses `sdd-*` sub-agents, so the same session wrote and verified the change: this is not an independent review.

## Commands
| Command | Result |
|---|---|
| `npm run build` | exit 0 |
| `npm run build:agente` | exit 0 |
| `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db` | 1866 tests, 1862 pass, 4 fail, 0 cancelled, 0 skipped |
| `npx prisma migrate status` against `zerodashboard_test` | 21 migrations, schema up to date |

The 4 failures are `conexiones.test.ts` 5.1, 5.3 and 5.4 and CH-07. Each fails with «the registration response must not echo the submitted credential», which matches the false positive recorded for the test password `postgres` (the response holds `"motor":"postgres"`). They were not rerun without this change.

## Tasks
All 34 are done. Task 8.2 changed: the scoped read is proven by the two-tenant case in `panel-automatizaciones.test.ts`, not in `aislamiento-panel.test.ts`.

## Spec coverage
| Capability | Requirements | Scenarios | Main evidence |
|---|---|---|---|
| `telegram-notification` | 7 | 32 | `automatizaciones.test.ts`, `planificador.test.ts`, `mensaje-telegram.test.ts`, `notificador-telegram.test.ts`, `cliente-telegram.test.ts`, `vista-previa.test.ts` |
| `email-notification` | 2 | 3 | `vista-previa.test.ts`, `planificador.test.ts` |
| `automation-scheduling` | 3 | 8 | `automatizaciones-rutas.test.ts`, `planificador.test.ts`, `vista-previa.test.ts` |
| `execution-log` | 3 | 15 | `planificador.test.ts`, `automatizaciones-rutas.test.ts` |
| `domain-data-model` | 1 | 1 | The migration, applied by `test:db` |
| `query-console` | 3 | 10 | `consola.test.ts`, run against the fake DOM |
| `client-panel-automations` | 6 | 37 | `panel-ajustes.test.ts`, `panel-ajustes-rutas.test.ts`, `panel-automatizaciones.test.ts`, `panel.test.ts` |
| `telegram-link` | Purpose only | — | The delta |

## Gaps
Scenarios with no direct assertion:
1. **"Correo runs do not read the link"** and **"A gate refusal on the Telegram channel dials nothing"**: by inspection. The read sits behind the `canal` branch in `planificador.ts`, and after every refusal in `vista-previa.ts`. The tests show the outcome, but do not count reads.
2. **"Migrating existing rows"** and **"Existing rows"**: indirect. The default is tested on new rows and the migration is additive; no test migrates rows written earlier.
3. **"A failed choice names the field"**: the route's 400 and the `canal` text are tested, but no case runs that answer through the form.

## Warnings
1. **No message has reached real Telegram.** Every test uses a fake transport, so the `link_preview_options` body and real rejections are checked only against the documented API. CH-43 closed this with a manual check using a real bot; this change has none, and it needs `TELEGRAM_BOT_TOKEN`, which this session did not use.
2. **The wiring in `src/server.ts` has no test.** The shared client and the notifier passed to the scheduler are checked by the build and by inspection, as CH-43's wiring was.

## Rules and decisions
- **Rule 2.** The chat comes from a scoped read of the running tenant's link; two-tenant cases cover the run and the panel.
- **Rule 5.** No chat id in a run row, log line, console answer or panel answer, asserted on raw bodies and on the row.
- **Rule 6.** One channel per automation, one message per run, no retry. The poller is unchanged, and its `sendMessage` body is pinned.
- **Rule 7.** Only closed categories leave the client; a test feeds failures carrying the token.
- **DEC-197** is on PR #233, separate from this branch, as DEC-194 to DEC-196 were.

## Open items
- The burst limit and group migration are documented limits in `docs/guia/06-automatizaciones.md`, with no handling by design (DEC-185).

## Suggestions
1. Run the manual check with a real bot before CH-49 builds the demo on this channel: one notice to a chat, one with the bot blocked, and one long result.
2. Add a form case for the 400 on `canal` in `panel.test.ts` if the harness grows.
