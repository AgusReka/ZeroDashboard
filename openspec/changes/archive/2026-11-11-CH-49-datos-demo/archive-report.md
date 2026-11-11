# Archive Report: CH-49

**Change**: CH-49 — Demo data: second tenant, every-minute automations, Telegram link, seeded reports and dashboards, and an opt-in demo agent (DEC-206, DEC-207)
**Archived at**: 2026-11-11, on branch `ch49/archivo` from `master` (`464ccf6`), after the five chained PRs were merged: #259 (a, replica), #260 (b1, second tenant), #261 (b2, reports and dashboards), #262 (c, Telegram and every-minute automations) and #263 (d, agent, merge commit `7b08afb`), plus #264 (`.env.example` lines). The decisions went first in #258.
**Destination**: `openspec/changes/archive/2026-11-11-CH-49-datos-demo/`

**Main specs synced** (composed by script from the delta; every MODIFIED requirement matched a main requirement by its title without the DEC list, since the delta adds DEC-206 to two of them; each title checked to appear exactly once afterwards; existing requirements and scenarios kept; added requirements appended at the end; line endings preserved):
- `project-environment`: 3 modified ("Demo Replica Under an Opt-In Compose Profile", now DEC-170 and DEC-206; "Opt-In Demo Seed", now DEC-171 and DEC-206; "Demo Variables Ship Only as Placeholders") and 4 added ("Seeded Demo Reports and Dashboards", "Seeded Every-Minute Automations and Telegram Link", "Old Replica Volume Fails Loudly", "Seeded Demo Agent Under an Opt-In Profile"). The spec now has 22 requirements.

The specs `report-catalog`, `tenant-dashboard`, `telegram-link` and `agent-registration` needed no delta: the seed writes through their existing checks.

**Final state**:
- Tasks 26/26 complete (c.3 and d.3 closed with #264, z.2 on 2026-11-11).
- Verify report: PASS WITH WARNINGS, 0 critical, 3 warnings, 1 suggestion, 7/7 requirements, 22/22 scenarios.
- `npm run build`: exit 0. `npm run test:db`: 2305/2309; the four failures are the known ones in `src/conexiones/conexiones.test.ts` (5.1, 5.3, 5.4, CH-07).

**Archive gate**: the native validator does not admit the verify envelope while `test_exit_code` is 1, caused only by the known environmental failures. The archive is manual, as in CH-40 to CH-48. No value in any report was changed to pass the gate.

**Follow-ups** (not scheduled):
1. DEC-117 says `agente-desconectado`; the code uses `error-desconocido` with `ESINAGENTE` (S1).
2. Repair the 4 failing `conexiones.test.ts` cases, so the suite exits 0 and the archive gate passes. This gate has now blocked ten archives.
3. The runtime scenarios rest on apply-time isolated-stack checks (W1); a scripted smoke run of the demo stack would make them repeatable.

**Map**: the CH-49 row of `docs/02-mapa-de-changes.md` already carries the five PRs.
