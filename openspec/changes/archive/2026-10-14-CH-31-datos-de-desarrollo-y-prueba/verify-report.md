# Verify Report: CH-31 — Development and test data

**Date**: 2026-10-14. **Branches**: `ch31/exploracion`, `ch31/test-db`, `ch31/semilla-demo` (PRs #169, #170 and #171, stacked, merged). Verified on `master` at `797037c`.
**Verdict**: PASS with warnings. No blockers, no critical findings.
Verified inline by the orchestrator: the Claude Code hook refuses `sdd-*` sub-agent dispatch. PR2 was written by one delegated writer. The review assessment of PR2 was medium risk (`docker-compose.yml`), so the writer's self-verification plus the parent's spot check (`tsc`) and end-to-end run stand; no independent verifier ran. Receipt-driven review is off.

## Commands

| Command | Result |
|---|---|
| `npx tsc -p tsconfig.json --noEmit` | exit 0, no output |
| `npm run build` | ok |
| `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db`, with the Docker `app` running | 1312 tests, 1308 pass, 4 fail: the known `conexiones` false positives (W1). Dev database tenants: 1 before, 1 after |
| `TEST_DB_NAME=zerodashboard npm run test:db` | exits 1 naming the variable; no test runs |
| `docker compose config --services` (no profile) | `db` and `app` only |
| `replica-demo` on an empty volume | the five `v_*` views answer (9, 14, 26, 99 and 194 rows); an `INSERT` by `lector_zerodashboard` is refused |
| End to end, isolated project `-p zd-demo` with `--profile demo` and `SEED_DEMO=1` | the seed created 11 rows; the real probe judged the five entities valid; operator `demo` signs in; "Probar" answers ok; the saved query returns rows; the template test runs; the automation is active; the audit holds the seed's `validacion-mapeo` row by `demo`; the panel user signs in and sees the automation; a restart logs "demo already present" and creates nothing |

## Spec coverage

### `project-environment` (delta)

| Requirement / scenario | Evidence |
|---|---|
| Tests run against their own database: untouched dev database, first run, refusal | the `test:db` run above (tenant count 1 → 1; "created zerodashboard_test" on the first run) and the refusal command |
| Demo replica under an opt-in profile: demo start, default start | the `replica-demo` checks and `docker compose config --services` |
| Opt-in demo seed: fresh demo, restart keeps edits, missing variable, demo off | `semilla-demo.test.ts`: "the first run creates every row with its fixed id, validates the five views and audits once"; "a second run creates nothing, never probes, and keeps the owner's edit"; "a missing … throws naming it"; the end-to-end run. Without `SEED_DEMO` the path of `prisma/seed.ts` is unchanged and the full suite passes |
| The seed fails naming the cause | "a probe that does not answer throws naming the cause, creates no automation and can be retried"; "an entity that is not valid after the probe throws naming it, and nothing depends on it" |
| Demo variables ship only as placeholders | `.env.example`: every demo variable empty, `SEED_DEMO` off |

### `execution-audit` (delta)

| Requirement / scenario | Evidence |
|---|---|
| The demo seed's validation is audited | "the first run … audits once" (one row, operator `demo`, `origen` `validacion-mapeo`) and the end-to-end `GET /auditoria` |

## Warnings

- **W1** — Pre-existing: with `POSTGRES_PASSWORD=postgres` four `conexiones` tests fail.
- **W2** — `RegistroEjecucion` refuses `DELETE` (DEC-162): the seed's tests count added rows instead of cleaning them, so audit rows of the fixed demo tenant accumulate in `zerodashboard_test`. Harmless; the test database can be dropped.
- **W3** — On an existing development volume the demo adds a second tenant named "Food Store" (the demo's, by fixed id). A clean demo needs an empty volume.
- **W4** — Both SDD runtime attempts settled `passed` over their changed-line budget (2384 with the generated dump, and 816), recorded as `size:exception` in #170 and #171. A further attempt on this change would need a maintainer reset.
