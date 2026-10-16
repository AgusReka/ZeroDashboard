# Archive Report: CH-30e1

**Change**: CH-30e1 — Audit screen in the console (A5; first cut of CH-30e, DEC-178)
**Archived at**: 2026-10-16, after PR #187 was merged (`77e4424`)
**Destination**: `openspec/changes/archive/2026-10-16-CH-30e1-pantalla-auditoria/`

**Main spec synced**:
- `query-console`, "Navigation by Hash", was replaced in place: "Trabajo diario" ends with `#auditoria`.
- `query-console` gains "Audit Screen": filters by local day and result, the read-only table, and the no-tenant, inverted-dates, empty, cut and failure states.
- Requirements go from 47 to 48, scenarios from 135 to 141.

## Artifacts

proposal.md, specs (query-console), design.md, tasks.md, verify-report.md, archive-report.md. The exploration is shared with CH-30e2 and stays in `openspec/changes/CH-30e-auditoria-y-tiempos-de-alta/`.

## Decisions

- **DEC-178**, taken by the user on 2026-10-16: Tiempos de alta is read through a new route of the active tenant, `GET /tiempos-alta`, amending DEC-87; CH-30e is cut into CH-30e1 and CH-30e2.

## Verify summary

PASS (see `verify-report.md`):
- `tsc --noEmit` is clean.
- `consola.test.ts`: 308 of 308, with 11 new CH-30e1 tests.
- `npm run test:db`: 1480 of 1484. The 4 failures are the known `conexiones` false positives.
- `gentle-ai review assess`: medium. Receipt-driven development is off.

## Final state

- The console has an Auditoría screen for the active tenant over `GET /auditoria`, read-only, newest first, with local-day and result filters.
- A late answer is dropped once a newer load has started.
- No route, migration or engine change.

## Open items

- CH-30e2: `GET /tiempos-alta` and the Tiempos de alta screen (DEC-178). The CH-30 umbrella stays open until it is archived.
