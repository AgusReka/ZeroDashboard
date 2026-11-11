```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:8c22ae19ef6e4d693428e58c9d3b37f0870d699dbeb33c32872b9c12027d3e08
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 7/7
scenarios: 22/22
test_command: TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db
test_exit_code: 1
test_output_hash: sha256:589c70f581a1c8f0232f95cc48f774583f253126c43c9c9336406084d67362a3
build_command: npm run build
build_exit_code: 0
build_output_hash: sha256:7c1e2620b9496a46f07127dae7af97f0979ae3e93a9468ec51b53dca56bfd382
```

# Verify report: CH-49 — Demo data

**Verdict: PASS WITH WARNINGS** (0 CRITICAL, 3 WARNING, 1 SUGGESTION). Verified 2026-11-11 on `master` at `464ccf6`, after the five chained PRs were merged: #259 (a, replica), #260 (b1, second tenant), #261 (b2, reports and dashboards), #262 (c, Telegram and every-minute automations), #263 (d, agent), plus #264 (`.env.example` lines, tasks c.3 and d.3). The DEC PR #258 (DEC-206, DEC-207) went first. Mode: Standard (`strict_tdd: false`). Run inline by the orchestrator, without the `sdd-attempt` ledger (user decision, 2026-11-10). Counts follow native status (`### Requirement:` and `#### Scenario:` headings) over the one delta spec, `project-environment`: 3 modified and 4 added requirements, 22 scenarios. `evidence_revision` is the SHA-256 of `git diff 81a71bd..7b08afb` (241,116 bytes; `81a71bd` is the merge before #259 and `7b08afb` the merge of #263, so the range holds only CH-49). `test_output_hash` and `build_output_hash` are the SHA-256 of the captured stdout and stderr of each command.

## Commands
| Command | Result |
|---|---|
| `npm run build` | exit 0 (`tsc -p tsconfig.json`, no diagnostics) |
| `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db` | exit 1; 2309 tests, 2305 pass, 4 fail, 0 cancelled, 0 skipped. The 4 failures are `conexiones.test.ts` 5.1, 5.3, 5.4 and CH-07, the known test-password false positives (the response contains `"motor":"postgres"`). No other failure. |

## Completeness
| Metric | Value |
|---|---|
| Tasks total | 26 (0.1-0.2; a.1-a.4; b1.1-b1.5; b2.1-b2.3; c.1-c.5; d.1-d.5; z.1-z.2) |
| Tasks complete | 26 |
| Tasks incomplete | 0 |

## Spec compliance
| Requirement | Scenarios | Evidence |
|---|---|---|
| Demo Replica Under an Opt-In Compose Profile (modified) | 4/4 | `docker-compose.yml` `replica-demo` with `profiles: ["demo"]` and the init files mounted read-only. Views, cross-database refusal, `INSERT` refusal and recent dates: isolated-stack check at apply (task a.4). The default `up` is unchanged (`required: false` on the dependency). |
| Opt-In Demo Seed (modified) | 4/4 | `semilla-demo.test.ts`: first run with fixed ids and the probe, Café del Puerto seeded, second run creates nothing and keeps the owner's edit, a missing variable throws naming it. `prisma/seed.ts` gates on `SEED_DEMO === '1'` (unchanged since CH-31). |
| Demo Variables Ship Only as Placeholders (modified) | 1/1 | Compose forwards `DEMO_TELEGRAM_CHAT_ID` and `DEMO_AGENTE_TOKEN` as `${VAR:-}` (empty, no usable default). `.env.example` lines added by the owner in #264 (see W2). |
| Seeded Demo Reports and Dashboards (added) | 4/4 | `demo/reportes.test.ts`: the four entries pass the gate, extra key, wrong role, empty title and glossary term are refused, each report returns its declared columns over `VALUES` views. `semilla-demo.test.ts`: an existing dashboard is untouched. Different numbers per tenant: isolated-stack check at apply. |
| Seeded Every-Minute Automations and Telegram Link (added) | 5/5 | `semilla-demo.test.ts` lines 577-645 and `demo/canales.test.ts`: no chat id, linked from the environment, an existing link kept, the id not logged; a malformed id refused without echo (lines 176+). The email arriving in Mailpit: isolated-stack check at apply (unit c). |
| Old Replica Volume Fails Loudly (added) | 1/1 | `semilla-demo.test.ts`: the old volume fails with the `down -v` message and leaves no Café rows; any other failure keeps the closed probe message. |
| Seeded Demo Agent Under an Opt-In Profile (added) | 3/3 | `semilla-demo.test.ts` lines 667-757: only the hash stored, the connection bound, the token never logged, no token gives a direct connection, an existing agent or direct connection untouched. Compose `agente` service: `profiles: ["agente"]`, `network_mode: "service:app"`, `read_only`, `cap_drop: [ALL]`, `no-new-privileges`, `init`, `AGENT_ALLOWED_TARGETS: replica-demo:5432`. The provoked `ESINAGENTE` failure: isolated-stack check at apply (task d.5). |

## Findings
- **W1 (WARNING)**: eight scenarios rest on the isolated-stack checks done at apply time (the four replica scenarios, the email arriving, different numbers per tenant, a run through the agent and the provoked failure). They were not re-run during this verification. DEC-170 keeps the replica out of the automated suite.
- **W2 (WARNING)**: `.env.example` was not read by the verifier, because the user's Claude Code settings deny reading `.env.*`. The owner added the two lines in #264; their exact names were not checked by the verifier.
- **W3 (WARNING)**: `test_exit_code` is 1 only because of the 4 known `conexiones.test.ts` false positives. The native validator requires exit 0 for a passing verdict, so the archive is manual, as in CH-40 to CH-48. No value here was changed to pass the gate.
- **S1 (SUGGESTION)**: DEC-117 names the agent-down code `agente-desconectado`, while the code uses `error-desconocido` with `ESINAGENTE`. Align the decision text or the code.
