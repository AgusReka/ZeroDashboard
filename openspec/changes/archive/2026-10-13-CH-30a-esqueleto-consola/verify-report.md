# Verify Report: CH-30a — Console shell and `#` navigation

**Date**: 2026-10-13. **Branch**: `ch30a/esqueleto`, on `ch30a/exploracion` (PRs #154 and #155). Verified at `92479f9`.
**Verdict**: PASS with warnings. No blockers, no critical findings.
Verified inline by the orchestrator: the Claude Code hook refuses `sdd-*` sub-agent dispatch. The review assessment was medium risk, so no independent verifier ran.

## Commands

| Command | Result |
|---|---|
| `npx tsc -p tsconfig.json --noEmit` | exit 0, no output |
| `npm run build` | ok |
| `npm test` against the dev database (`TEST_DB_PORT=5434`, password `postgres`) | 1262 tests, 1258 pass, 4 fail: the known `conexiones` false positives (W1). No suite skipped by the reachability probe |
| Stylesheet parity | the five `public/ui/` files are byte-identical to the skill's (`cmp`) |
| Served page | the Docker app rebuilt from this branch serves `/consola` with `zd-shell`, `pantalla-consultas` and `nav-frescura`, and the served `components.css` carries `zd-sidenav` |
| Manual visual pass | done by the user on 2026-10-13 ("ya quedó") |
| `scripts/smoke.sh` | not run: its console page checks come after CH-03, where the pre-existing `postgres` false positive stops it (W1) |

## Spec coverage — `specs/query-console/spec.md` (delta)

| Requirement / scenario | Evidence (`consola.test.ts`, prefix `CH-30a`) |
|---|---|
| Console shell and screens; every guarded id survives | "the markup is a shell: navigation links, three screens, Consultas visible first"; guards G1 (every guarded id exactly once, the six new ids included), G2, G3, G3' unchanged and green |
| Navigation by hash: default, switching, unknown hash, current link | "with no hash, Consultas is the one visible screen and its link is current"; "the hash on load picks the screen"; "a hashchange switches the screen, and an unknown hash falls back to Consultas" |
| Result next to the execute button | "the result sits right below the execute button, before the saved queries, inside Consultas" |
| Banner above every screen | "the alert banner sits above every screen" |

## Warnings

- **W1** — Pre-existing, not caused by CH-30a: with `POSTGRES_PASSWORD=postgres` four `conexiones` tests fail and `scripts/smoke.sh` stops at CH-03, before its console page checks.
- **W2** — Out of scope by design: the "tenant dado de baja" state of the bar (needs CH-30b's listing), navigation icons, and the sub-views of Automatizaciones.
