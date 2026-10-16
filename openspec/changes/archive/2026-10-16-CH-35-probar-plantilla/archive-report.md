# Archive Report: CH-35

**Change**: CH-35 — Testing a template against a connection from the console (audit of 2026-10-13, §3.2, phase F3)
**Archived at**: 2026-10-16, after PR #185 was merged (`4042963`)
**Destination**: `openspec/changes/archive/2026-10-16-CH-35-probar-plantilla/`

**Main spec synced**:
- `query-console`, "Templates Screen", was replaced in place. It now covers:
  - the «Probar en el tenant activo» block: a connection, one input per declared parameter, and «Probar» through `POST /plantillas/:id/prueba`;
  - the answer table;
  - the no-tenant and no-connection guards;
  - clearing the result on another template, on close and on a tenant switch.
- It still says the screen offers no way to create, change or save a template as a query.
- Scenarios go from 131 to 135. There are still 47 requirements.

## Artifacts

exploration.md, proposal.md, specs (query-console), design.md, tasks.md, verify-report.md, archive-report.md.

## Decisions

- **DEC-177**, taken by the user on 2026-10-16 in phase F3. The option chosen was (a): the console tests the template against a connection of the active tenant, and the template does not become a query.
- Three options were rejected for now:
  - copying the composed statement into the query pop-up;
  - a third query kind over the canonical views;
  - leaving it as future work.

## Verify summary

PASS (see `verify-report.md`):
- `tsc --noEmit` is clean.
- `consola.test.ts`: 297 of 297, with 14 new CH-35 tests.
- `npm run test:db`: 1469 of 1473. The 4 failures are the known `conexiones` false positives.
- `gentle-ai review assess`: medium. Receipt-driven development is off.

## Final state

- The template side panel tests the template on a connection of the active tenant and shows the first page of the result as text.
- Refusals are written as legible text. An unapproved view names its entities and points to Mapeo y validación.
- A late answer is dropped once the panel has moved on.
- No route, migration or engine change.

## Open items

- From the audit's F3: the CH-30e screens (Auditoría has a route; Tiempos de alta does not, only `scripts/marcas-alta.sql`).
- Starting a saved query from a template, if it is ever needed, requires a new decision between DEC-177's options (b) and (c).
