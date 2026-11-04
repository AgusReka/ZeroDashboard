```yaml
schema: gentle-ai.verify-result/v1
verdict: pass-with-warnings
blockers: 0
critical_findings: 0
warnings: 2
suggestions: 3
requirements: 18/18 (16 fully evidenced; 2 carry a GAP, 1 of the 16 also carries a manual leg)
scenarios: 33 (30 covered, 3 covered by the manual check 10.2, 0 GAP)
test_command: TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db
test_exit_code: 1 (only the 4 known environmental failures)
build_command: npm run build
build_exit_code: 0
```

# Verify report: CH-43 — Telegram link

**Verdict: PASS WITH WARNINGS** (0 CRITICAL, 2 WARNING, 3 SUGGESTION). Date: 2026-11-04. Branch `ch43/panel-telegram`. CH-43a (`0f021d3`, with the planning artifacts in `6241c34`) and CH-43b (`ccc5703`) are committed; CH-43c (the panel card, its docs and this report) is in the working tree. Base `master`. DEC-196 is on `v2/dec-196` (`99eccd8`).

The warnings are the two scenarios that no automated test or manual step asserts (see "Gaps"). Task 13.2 is left unchecked in `tasks.md` because of them. The suite exits non-zero only because of the 4 known environmental failures. This verification ran in the same session as the apply, not in an independent one.

## Commands
| Command | Result |
|---|---|
| `npm run build` | exit 0 |
| `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db` (DB container `zerodashboard-db-1` up and healthy on 5434) | 1783 tests, 1779 pass, 4 fail, 0 cancelled, 0 skipped. The 4 failures are the known false positives in `src/conexiones/conexiones.test.ts` (5.1, 5.3, 5.4, CH-07: "the registration response must not echo the submitted credential"). No other failure. |

## Tasks
| Task | State | Evidence |
|---|---|---|
| 0.1 | done | DEC-196 on `v2/dec-196` before any code |
| 1.1–2.3 | done | Models, migration, isolation set, `buscarPorHash`, `conTenantActivo` comment; `aislamiento.test.ts` |
| 3.1, 3.3 | done | `telegram-config.ts`, `codigo-vinculo.ts`; `config.test.ts`, `codigo-vinculo.test.ts` |
| **3.2** | **open** | Compose forwards `TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN:-}` (`docker-compose.yml:52`) and the README table describes it. The example env file still lacks `TELEGRAM_BOT_TOKEN=`: the agent's permissions block it, the user adds it by hand. |
| 4.1–4.4, 5.1, 5.2 | done | `panel-telegram.ts`, rows in `RUTAS_PANEL_PUBLICAS`, `panel-telegram-rutas.test.ts`, `aislamiento-panel.test.ts` |
| 6.1–9.1, 10.1 | done | Client, `vincular`, poller, wiring in `server.ts` (`sondeo?.iniciar()` after `listen`, `detener()` in `onClose`) |
| **10.2** | done (manual, 2026-11-04) | Real bot linked from the card (`vinculado`); made-up token: `/health` 200, `rechazada` with backoff, no token or chat id logged; no token: `no-configurado`, `/health` 200 |
| 11.1, 11.2 | done | Card in `panel.ts`; three `CH-43 P-07` cases in `panel.test.ts` |
| 12.1–12.3 | done | `pantallas.md` P-07 in both copies; guide 06 and README; map row (PR numbers pending, see "Open items") |
| 13.1 | done | The two commands above |
| **13.2** | done | Every scenario maps to a test or to 10.2 (both GAPs closed on 2026-11-04) |

## Spec scenarios → evidence

Abbreviations (all under `src/`): CT `telegram/cliente-telegram.test.ts`, CV `telegram/codigo-vinculo.test.ts`, VR `telegram/vincular-rutas.test.ts` (DB), ST `telegram/sondeo-telegram.test.ts`, PTR `panel/panel-telegram-rutas.test.ts` (DB), PN `panel/panel.test.ts`, AI `aislamiento/aislamiento.test.ts`, AIP `aislamiento/aislamiento-panel.test.ts`, CF `compartido/config.test.ts`. Where a scenario's GIVEN/WHEN stores data and its THEN also names a bot answer, the storage half is asserted against the real database (VR) and the answer half in ST against a fake `vincular`; both are cited.

### telegram-link (16)
| Scenario | Test | Status |
|---|---|---|
| A chat id above 32 bits is kept exactly | VR "a chat id above 32 bits is kept exactly, and only the link columns are stored" (`-1001234567890123n` read back equal); CT "updates are parsed to the minimum, a chat id above 32 bits exactly…" | COVERED |
| No personal data is stored | CT parse case (the update carries `from: { username }`, the parsed update keeps only `updateId`, `chatId`, `texto`); VR same test asserts the stored row's keys are exactly `chatId`, `id`, `tenantId`, `vinculadoEn` | COVERED |
| A new code replaces the previous one | PTR "POST returns the code once, stores only its hash, and replaces a previous code" (one row, the second hash, none for the first); VR "a replaced code is not valid" | COVERED |
| A code typed loosely still matches | CV "a code typed loosely normalizes to the same code"; VR "a code typed loosely hashes to the stored one"; ST "/start@bot and a loosely typed code still match" | COVERED |
| An expired code does not link | VR "an expired code does not link and leaves the existing link alone"; ST "a wrong or malformed code gets the "not valid" answer…" (exact text) | COVERED |
| A valid code links the chat | VR "a valid code links the chat, deletes the code, and a reused code is not valid"; ST "a valid code links and gets the success answer with the tenant name" (exact text) | COVERED |
| Relinking replaces the chat | VR "relinking replaces the chat, with still one link for the tenant" | COVERED |
| One chat for two tenants | VR "one chat links two tenants" | COVERED |
| Other messages are ignored | ST "other messages are ignored with no lookup and no answer" (`hola`, `/start`, `/ayuda …`, no text, no chat id) | COVERED |
| The answer failing keeps the link | ST "a failed answer keeps the link and is logged by category only" (the link result is logged before the failed answer, the failure is logged as `telegram-respuesta`/`red`). The link itself is committed by `vincular`, which ST fakes; VR covers its transaction. | COVERED |
| The sixth attempt is ignored | ST "the sixth attempt in 10 minutes is ignored until the oldest failure ages out"; "the cap map is pruned…" | COVERED |
| Handled updates are confirmed by the next offset | ST "handled updates are confirmed by the next offset, malformed ones included" (updates 10 and 11, next offset 12) | COVERED |
| Shutdown does not wait for the long poll | ST "detener aborts the open long poll and resolves at once, with nothing armed after it"; "detener before the first request cancels the pending timer". The fake aborts on signal; no real 25 s wait is measured. | COVERED |
| No token, no requests | The decision is `server.ts` (`configTelegram === null ? null : crearSondeoTelegram(…)`), which no test boots. CF "unset or empty gives null, and the boot still loads" covers `leerTelegram`. Task 10.2 ("Without a token, the app starts and logs `no-configurado`") covers the start; "no request" is not observed there either, only by reading the wiring. | MANUAL (10.2) |
| Repeated conflicts back off | ST "backoff stays within [1 s, 60 s], grows on repeated conflicts and resets on success" (waits 1000, 2000, 4000, then 0 after a success); CT "every failure maps to its closed category" (409 → `conflicto`) | COVERED |
| The token never reaches a log | ST "no log line carries the token, a chat id, the code or the message text" (real client, failures embedding the URL); CT "the token never appears in a result, whatever the failure carries" | COVERED |

### client-panel-telegram (9)
| Scenario | Test | Status |
|---|---|---|
| No session | PTR "401 sesion-invalida with no cookie, and nothing is written" (all three routes) | COVERED |
| Linked tenant | PTR "vinculado with the date and no chat id; venceEn only while a replacement code is live" | COVERED |
| An expired code reads as no code | PTR "sin-vincular with no link and no code, and with only an expired code" | COVERED |
| Code created | PTR "POST returns the code once, stores only its hash, and replaces a previous code" (201, 8 chars, `enlace`, `venceEn` +10 min, only the hash stored) | COVERED |
| Bot not available | PTR "POST answers 409 telegram-no-disponible and stores nothing when the bot is not available" (no port and bot not known) | COVERED |
| Unlink keeps other tenants | AIP "CH-43 A's new code leaves B's code unchanged, and A's unlink leaves B's link unchanged" (A and B both hold chat 42; A's `DELETE` leaves B's row deep-equal); PTR "DELETE removes the link, keeps a live code, and is idempotent" | COVERED |
| Linking from the card | PN "CH-43 P-07: creating a code shows it through textContent, a 409 repaints as unavailable, and unlinking asks first" (code, «Abrir Telegram» href, expiry `13:10`); "…the card sits above the list, with its fixed blocks and copy" | COVERED |
| Unlinking asks first | same PN test (no `DELETE` after «Desvincular», `DELETE` only after confirming) | COVERED |
| The card fails without breaking the list | PN "CH-43 P-07: a failing card shows its own error with «Reintentar» and the list still loads" | COVERED |

### tenant-isolation (5)
| Scenario | Test | Status |
|---|---|---|
| No context, no read | AI "CH-43 VinculoTelegram and CodigoVinculoTelegram reads and writes with no active tenant throw ErrorSinTenantActivo"; "every other unscoped CodigoVinculoTelegram operation still rejects" | COVERED |
| Lookup works without context | AI "with no context the lookup returns exactly tenantId, tenantNombre, tenantActivo and venceEn" (exact key set) | COVERED |
| A code never links a deactivated tenant | VR "a deactivated tenant is never linked"; AI "an unknown hash gives null; a deactivated tenant is reported, not filtered"; ST "not valid" answer as above | COVERED |
| A code from tenant A links only A | VR "A's code links only A: B is neither linked nor has its code changed" | COVERED |
| Two tenants, two cards | AIP "CH-43 two tenants, two cards: each reads its own state and dates, whatever X-Tenant-Id says" | COVERED |

### project-environment (3)
| Scenario | Test | Status |
|---|---|---|
| Application starts with the token unset | CF "unset or empty gives null, and the boot still loads" and "the token never reaches AppConfig"; PTR "no-disponible when the token is unset or the bot is not known yet". The `no-configurado` log line and the absence of any request live in `server.ts`, which no test boots. Task 10.2 no-token leg. | MANUAL (10.2) |
| A wrong token does not stop the application | Asserted in part: ST "getMe is called until it answers…" (backoff after a failed `getMe`, category `red`) and the ST log-redaction test. **Not asserted:** that the app keeps serving requests with the poller failing (nothing boots `server.ts`), and the `rechazada` category on `getMe` (401). Covered by the 10.2 wrong-token leg (2026-11-04): `/health` answered 200 while `telegram-sondeo` logged `rechazada` with growing waits, and no log line carried the token. | MANUAL (10.2, done) |
| Inspecting the example file and Compose definition | Compose (`docker-compose.yml:52`) and README (table row) are right by inspection. The example env file carries `TELEGRAM_BOT_TOKEN=` with an empty value since 2026-11-04 (task 3.2, added by the user). No test reads these files. | COVERED (inspection) |

## Gaps
1. **A wrong token does not stop the application** (project-environment). Closed on 2026-11-04 by the 10.2 wrong-token leg; kept here for the record. Two of three THEN clauses are asserted; "it serves requests" is not. Cheapest close: add a wrong-token step to 10.2 (start the app with a made-up token, read `/` or the panel, confirm the log carries no token), or a server-level test. The poller is started by a timer after `listen`, so the risk is low, but no assertion exists.
2. **Inspecting the example file and Compose definition** (project-environment). Closes when the user adds `TELEGRAM_BOT_TOKEN=` to the example env file (task 3.2); no automated check exists for these files.

## Rules and decisions
- **Rule 2.** The tenant id reaches a context only from `buscarPorHash` (VR "A's code links only A"; AI lookup cases). Nothing in `ActualizacionTelegram` carries a tenant id (CT parse case).
- **Rule 5.** Neither table stores username, name, text or the plain code (VR column check, PTR hash-only check).
- **Rule 7.** The token is never in `AppConfig` (CF) nor in any log or result (ST, CT).
- **DEC-185 / DEC-196.** No webhook, no inbound port; fixed answers match the spec text byte for byte (ST asserts both constants).

## Open items
1. **3.2**: the user adds `TELEGRAM_BOT_TOKEN=` to the example env file by hand.
2. **10.2**: the real-bot check, with the user's go-ahead and a test token in their own `.env`; consider adding the wrong-token step (Gap 1).
3. **PR numbers**: `docs/02-mapa-de-changes.md` says `PRs #pendiente` for CH-43; fill the three numbers when the PRs open.
4. **PR #227 must merge before the archive.** Do not archive CH-43 earlier.
5. **13.2** stays unchecked until Gaps 1 and 2 close.

## Suggestions
1. **Boot test for the no-token path.** A small test that builds the app wiring with `TELEGRAM_BOT_TOKEN` unset and a spy transport would turn two MANUAL scenarios and Gap 1 into COVERED, but `server.ts` runs on import today and would need its wiring extracted first.
2. **Real-clock check of `detener()`.** ST asserts the abort with a fake that listens to the signal; the 25 s bound itself is only demonstrated by 10.2.
3. **Skip guard names.** `panel-telegram-rutas.test.ts` and `vincular-rutas.test.ts` skip without a reachable database, as the other DB suites do; a CI run without `TEST_DB_*` would pass them silently. Not new to CH-43.
