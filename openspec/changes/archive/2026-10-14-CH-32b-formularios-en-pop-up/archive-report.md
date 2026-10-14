# Archive Report: CH-32b

**Change**: CH-32b — Create forms in a pop-up, and the audit's F2 items (audit of 2026-10-13, observations 9–12)
**Archived at**: 2026-10-14
**Destination**: `openspec/changes/archive/2026-10-14-CH-32b-formularios-en-pop-up/`

**Main specs synced** (`openspec/specs/query-console/spec.md`), each requirement replaced in place, keeping every scenario that still holds:
- "Console Displays Automations and Supports Creating One (DEC-78)": the wizard is a pop-up; the list shows the connection's name and the schedule in words plus the cron.
- "Automation Views Respect the Active-Tenant Indicator (T4, DEC-15)": the tenant load's five requests (added by the verify, W2).
- "Tenants Screen": «Crear tenant» and «Crear y elegir» in a pop-up.
- "Connections Screen" and "Connection Through the Agent": the pop-up replaces the side panel; the result goes to the screen's notice.
- "Panel Users Screen": «Nuevo usuario» in a pop-up; «Reponer clave» confirmed inline.
- "Create and Edit Forms Open in a Pop-up (DEC-173)": covers the five pop-ups, opener in the header, focus, tenant switch.
- **Scenarios**: 111 → 120. Requirements: 46 (unchanged).

## Artifacts

exploration.md, proposal.md, specs/query-console/spec.md, design.md, tasks.md, verify-report.md, archive-report.md.

## Decisions

- **D1:** a tenant is chosen as it is created through a second action, «Crear y elegir».
- **D2:** the Horario column shows the words and the cron in monospace (guide C-09), the cron alone for a custom expression.
- **D3:** «Nueva conexión» closes after «Guardar y probar» and reports in the screen's notice, also when the test fails.
- One PR with `size:exception` instead of three slices (user's choice).

## Verify summary

PASS with warnings (see `verify-report.md`): `tsc` clean, build ok, the console 262 of 262, the full suite 1414 of 1418 (the four known `conexiones` false positives).

## Final state

- `crearDialogo` builds every create pop-up of the console: Consultas, «Nuevo tenant», «Nueva conexión», «Nuevo usuario» and the automation wizard. «Cancelar» and Escape ask «Descartar cambios» when something was typed; a tenant switch closes them.
- Tenants: «Crear y elegir». Usuarios del panel: «Reponer clave» asks «Reponer clave de {correo}» first.
- Automations list: connection name (short id as fallback) and schedule in words plus the cron.
- No backend change.

## Open items

- The design guide's C-05 still describes «Nueva conexión» as a side panel (proposal to the guide).
- From the audit, F3: editing automations in the console, and typed confirmation of a tenant's baja.
