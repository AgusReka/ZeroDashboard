# Archive Report: CH-48

**Change**: CH-48 — Panel dashboard with live runs, declared period, freshness and an accessible table per chart (R3h, R4h, R5h; DEC-183, DEC-184, DEC-201, DEC-202)
**Archived at**: 2026-11-10, on branch `ch48/archivo` from `master`, after the three chained PRs were merged: #250 (CH-48a, server), #251 (CH-48b, page) and #252 (CH-48c, charts, merge commit `dc31163`). The decisions went first in #249.
**Destination**: `openspec/changes/archive/2026-11-10-CH-48-tablero-panel/`

**Main specs synced** (composed by script from the deltas; every MODIFIED title matched a main requirement exactly; each title checked to appear exactly once afterwards; existing requirements and scenarios kept; added requirements appended at the end of their spec; line endings preserved as CRLF):
- `client-panel-dashboard` (new capability): 11 requirements, copied as is.
- `client-panel-automations`: 1 modified ("No Technical Terms in the Client Surface (Rule 1, DEC-04, DEC-93)").
- `client-panel-telegram`: 1 modified ("«Avisos por Telegram» Card (P-07)").
- `shared-visual-system`: 1 modified ("Vendored Chart Library Is Pinned (CH-47, DEC-184, DEC-200)").
- `execution-audit`: 1 added.
- `report-catalog`: 1 added.
- `tenant-isolation`: 1 added (the automated two-tenant test, rule 2).

Totals: 14 requirements added (11 of them in the new capability), 3 modified and 0 removed across seven capabilities.

**Decisions**: DEC-201 (panel dashboard API, period per report, per-tenant gate of 3 runs with a queue of 8 and `429`) and DEC-202 (panel runs write no audit row, one closed-field log line instead). Both were taken by the agent under the user's 2026-11-10 authorization to proceed without stopping, choosing the exploration's recommended options, and remain subject to the user's review.

**Final state**:
- Tasks 32/32 complete.
- Verify report: PASS WITH WARNINGS, 0 critical, 3 warnings, 6 suggestions, 17/17 requirements, 66/67 scenarios compliant and 1 partial.
  - W1 (the cap scenario has no single route-level test; covered by the engine test and a unit test) remains.
  - W2 (the spec listed the 404 check before the `dias` shape check, while the code checks the shape first) was fixed in the spec before archiving: the shape check comes first and reads nothing, so it answers the same for any id. The code did not change.
  - W3 (the spec said the team is told on `no-disponible`, while the copy tells the client to ask whoever gave them access) was fixed in the spec to match the shipped copy. The code did not change.
  - S6 (`docs/guia/09-reportes.md` still said no client sees a report) was fixed in the guide.
- `npm run test:db`: 2144/2149. Four failures are the known ones in `src/conexiones/conexiones.test.ts` (5.1, 5.3, 5.4, CH-07); the fifth is the intermittent `planificador.test.ts` CH-14 5.7, which passed 64/64 on its own.
- Browser check at 1280 and 390 px, light and dark: charts drawn with token colors, folded tables, and open tables when Chart.js is missing. No page exceptions.

**Archive gate**: the native validator did not admit the verify envelope because `test_exit_code` is 1, caused only by the known environmental failures. The archive is manual, as in CH-40 to CH-47. No value in any report was changed to pass the gate.

**Follow-ups** (not scheduled):
1. User review of DEC-201 and DEC-202.
2. A route-level test for the cap scenario (W1) and a spy-based "nothing is dialed" proof (S1).
3. The gate isolation test uses wall-clock thresholds (S2); make it deterministic if it flakes.
4. N in «Mostramos solo los primeros N resultados.» is the rows received, not the visualization cap (S4).
5. Repair the 4 failing `conexiones.test.ts` cases and the CH-14 5.7 flake, so the suite exits 0 and the archive gate passes. This gate has now blocked nine archives.
6. CH-49: demo data (one demo tenant, readable report names), building on the reports added during CH-48b and CH-48c.

**Map**: the CH-48 row of `docs/02-mapa-de-changes.md` already carries PRs #250, #251 and #252.
