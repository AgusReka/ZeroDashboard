# Archive Report: CH-30c

**Change**: CH-30c — Agents and panel users screens (third cut of CH-30; stories C1, T3)
**Archived at**: 2026-10-13
**Destination**: `openspec/changes/archive/2026-10-13-CH-30c-agentes-y-usuarios/`
**Main specs synced**: `openspec/specs/query-console/spec.md` ("Navigation by Hash" replaced, all three scenarios kept; "Secrets Are Shown Once", "Agents Screen", "Connection Through the Agent" and "Panel Users Screen" appended)

## Artifacts

exploration.md, proposal.md, specs/query-console/spec.md, design.md, tasks.md, verify-report.md, archive-report.md.

## Decisions

No new decision: the screens use APIs decided in DEC-121 (agents) and DEC-155 to DEC-158 (panel users), and the navigation of DEC-165.

## Verify summary

Verdict PASS with warnings (see `verify-report.md`): `tsc` clean, build ok, 1285 of 1289 tests pass and the other four are the known `conexiones` false positives; one run hit the documented intermittent cleanup error of `panel-automatizaciones.test.ts`, which passes alone; every spec scenario has an automated test; the user did the visual pass on 2026-10-13.

## Final state

- `src/consola.ts`: "Agentes" and "Usuarios del panel" in Puesta en marcha; the Agentes screen (create, re-issue, revoke with inline confirmation); the connection panel's "Cómo llega" (direct or through the active agent); the Usuarios del panel screen (create, reset, deactivate with inline confirmation, reactivate); `mostrarSecreto`, `olvidarSecretos` and `copiarSecreto` for secrets shown once.
- No backend change.

## Open items

- CH-30d (Mapeo y validación, Plantillas, Contrato) is next.
