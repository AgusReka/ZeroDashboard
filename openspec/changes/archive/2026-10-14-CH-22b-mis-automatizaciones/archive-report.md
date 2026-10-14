# Archive Report: CH-22b

**Change**: CH-22b — "Mis automatizaciones" in the client panel (story P1h)
**Archived at**: 2026-10-14 (merged 2026-10-07, PRs #102 to #105)
**Destination**: `openspec/changes/archive/2026-10-14-CH-22b-mis-automatizaciones/`

## Main specs synced

- `openspec/specs/client-panel-automations/spec.md` — **composed**, not appended. The main spec held only CH-22c and CH-23, written as layers over a CH-22b text that had never been synced. It now reads as one spec:
  - CH-22b's twelve requirements, in order, as the base.
  - "Business Status Is Active or Paused" replaced by CH-22c's "Business Status Includes Failure", with a "Previously" line.
  - "Allow-List Projection" names the opaque `id` that CH-23 added to `activas` items.
  - "Available Automations Rule" gains the twin-template dedupe of DEC-137's amendment, and a scenario for it.
  - "Panel Page … Defined States" offers "Ajustar" (CH-23) and still no "Activar"; the scenario "No actions offered" became "Activation is not offered".
  - CH-22c's "Failure Banner Visible in Panel (UI)" and CH-23's five requirements follow, unchanged.
  - The three "(unchanged)" placeholders of CH-22c ("Allow-List and No Technical Fields", "Isolation and Auth", "Last Execution Semantics") are removed: the full CH-22b requirements they referred to are now present.
  - Scenarios: 41 (CH-22b) − 3 (status, replaced) + 1 (twins) + 18 (CH-22c and CH-23) = 57. None lost.
- `openspec/specs/client-panel-auth/spec.md` — "Panel Automations Route Resolves Tenant Only From the Session" appended.
- `openspec/specs/tenant-isolation/spec.md` — "Cross-Tenant Isolation Is Proven by an Automated Test (T2)" replaced by CH-22b's version: one sentence on the panel suite and the scenario "Panel automations route sweep row"; its four earlier scenarios kept.

## Artifacts

exploration.md, proposal.md, specs/client-panel-automations/spec.md, specs/client-panel-auth/spec.md, specs/tenant-isolation/spec.md, design.md, tasks.md, verify-report.md, archive-report.md.

## Decisions

DEC-137 (the read contract), taken in the planning commit `25ea1c6`, and its amendment of 2026-10-06 (twin templates).

## Verify summary

PASS with warnings (see `verify-report.md`): the panel suites pass 72 of 72, the full suite 1308 of 1312 (the four known `conexiones` false positives); three CH-22b scenarios are verified in the form CH-22c and CH-23 gave them.

## Final state

`src/panel-automatizaciones.ts` (`GET /api/panel/automatizaciones`, allow-list projection, copy map, available rule, next run and frequency) and the P-02 screen in `src/panel.ts`, as extended by CH-22c and CH-23.

## Open items

None from CH-22b. Next per the audit: CH-32a.
