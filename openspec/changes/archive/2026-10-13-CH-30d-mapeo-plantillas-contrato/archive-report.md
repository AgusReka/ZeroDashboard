# Archive Report: CH-30d

**Change**: CH-30d — Mapping and validation, Templates and Contract screens (fourth cut of CH-30; stories M1–M4)
**Archived at**: 2026-10-13
**Destination**: `openspec/changes/archive/2026-10-13-CH-30d-mapeo-plantillas-contrato/`
**Main specs synced**: `openspec/specs/query-console/spec.md` ("Navigation by Hash" replaced, all three scenarios kept; "Templates Screen", "Contract Screen" and "Mapping and Validation Screen" appended)

## Artifacts

exploration.md, proposal.md, specs/query-console/spec.md, design.md, tasks.md, verify-report.md, archive-report.md.

## Decisions

DEC-169 (one SQL per entity), taken in the planning PR #165.

## Verify summary

Verdict PASS with warnings (see `verify-report.md`): `tsc` clean, build ok, 1297 of 1301 tests pass and the other four are the known `conexiones` false positives; every spec scenario has an automated test; the user did the visual pass on 2026-10-13.

## Final state

- `src/consola.ts`: "Plantillas" and "Contrato" in Global, read-only; "Mapeo y validación" in Puesta en marcha, with one SQL editor per contract entity, its state and diagnostics, "Guardar" and "Validar", and the automations with their reasons.
- No backend change.

## Open items

- The `409 credencial-ilegible` seen on "Probar" and "Validar" (verify W2) goes to the audit of `docs/TODO-ZD-13-10.md`.
- CH-30e (Auditoría and Tiempos de alta) remains.
