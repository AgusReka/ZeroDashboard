# Archive Report: CH-33

**Change**: CH-33 — Adjusting an automation from the console, and a typed confirmation for a tenant's baja (audit of 2026-10-13, phase F3)
**Archived at**: 2026-10-16, after PR #181 was merged (`7908040`)
**Destination**: `openspec/changes/archive/2026-10-16-CH-33-ajuste-de-automatizaciones-y-baja-confirmada/`

**Main specs synced**, each requirement replaced in place:
- `automation-scheduling`, "Automation Lifecycle Is Create, List, Get, Deactivate — No Edit or Delete (DEC-78, DEC-79)": the requirement now includes `PUT /automatizaciones/:id/ajustes`. The scenario that said no `PUT` route may exist is replaced by the adjust scenarios. Scenarios 51 → 58; 21 requirements, unchanged.
- `tenant-management`, "Logical Deactivation Fully Freezes a Tenant (DEC-14)": the baja requires `{ nombre }`; a mismatch is `409 confirmacion-no-coincide`. Scenarios 8 → 10; 4 requirements, unchanged.
- `query-console`:
  - Added "Console Adjusts an Automation in Place (DEC-174)", right after "Console Supports Deactivating an Automation (DEC-79)".
  - Modified "Console Supports Deactivating an Automation (DEC-79)": it no longer forbids editing.
  - Modified "Tenants Screen": the baja is confirmed in a pop-up by typing the name.
  - Modified "Create and Edit Forms Open in a Pop-up (DEC-173)": it covers the adjust pop-up and the baja confirmation; an edit pop-up opens from its row.
  - Scenarios 120 → 127; requirements 46 → 47.

## Artifacts

exploration.md, proposal.md, specs (automation-scheduling, tenant-management, query-console), design.md, tasks.md, verify-report.md, archive-report.md.

## Decisions

- DEC-174 and DEC-175, both taken by the user on 2026-10-14 in phase F3 of the audit.
- **D1:** the console edits what the alta sets: every declared parameter, any valid cron and the recipient. It is validated with the alta's rules, not with the panel's `resolverAjustes`. This is written into DEC-174 as its CH-33 precision.
- **D2:** the recipient can be cleared (`null`); the automation then stops sending email.
- `valores` replaces the stored map as a whole.
- One PR with `size:exception` instead of three slices (user's choice).

## Verify summary

PASS with two notes (see `verify-report.md`):
- `tsc --noEmit` and `npm run build` are clean.
- The full suite gives 1444 of 1448; the 4 failures are the known `conexiones` false positives.
- In one of the two full runs the CH-22b panel suite was marked failed with no test failed; it passed alone and in the second run.
- The user also tested the change by hand in the Docker app.

## Final state

- **Adjust:** `PUT /automatizaciones/:id/ajustes` updates `valores`, `cron` and `destinatario` in place. Anything else in the body is a `400`; a deactivated automation is a `409`; an unknown or foreign id is a `404`. The route is in the isolation sweep. The console offers «Ajustar» on active rows, in a pop-up that sends only what changed.
- **Baja:** `POST /tenants/:id/baja` requires the exact name. The console confirms it in a pop-up with «Dar de baja {nombre}», disabled until the name matches.
- **Shared code:** `crearDialogo` accepts a pop-up without discard buttons. The wizard and the adjust share `actualizarHorarioDe`, `presetDeCron` and `construirValores`.

## Open items

- From the audit's F3: template → saved query (§3.2), and the CH-30e screens.
- CH-34 (proposed 2026-10-15): a step-by-step and an example SQL per entity on the Mapping screen.
- The apply attempt ledger counted 1320 changed lines against the 1200 declared at acquire, and is `blocked: maintainer_decision`. It is irrelevant once the change is archived.
