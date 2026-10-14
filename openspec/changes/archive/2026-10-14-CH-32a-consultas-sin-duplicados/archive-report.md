# Archive Report: CH-32a

**Change**: CH-32a — Saved queries without duplicates, a connection picker, and the query pop-up (audit of 2026-10-13, F1; stories B1, B2, B4)
**Archived at**: 2026-10-14
**Destination**: `openspec/changes/archive/2026-10-14-CH-32a-consultas-sin-duplicados/`

**Main specs synced** (`openspec/specs/query-console/spec.md`):
- **Replaced**, keeping every scenario:
  - "Saving the Current Statement From the Console": one scenario became three;
  - "Result Next to the Execute Button": it is now inside the pop-up;
  - "Save as a New Version": «Guardar como versión N+1», behind the test gate.
- **Appended**: "Create and Edit Forms Open in a Pop-up", "Query Screen and Query Pop-up" and "Connection Picker".
- **Scenarios**: 103 → 111.

## Artifacts

exploration.md, proposal.md, specs/query-console/spec.md, design.md, tasks.md, verify-report.md, archive-report.md.

## Decisions

- **DEC-172:** with a saved query loaded, it is saved only as a new version.
- **DEC-173:** create and edit forms open in a pop-up holding every field, for the whole console. It was first taken as "side panel" and corrected to "pop-up" by the user the same day.

## Verify summary

PASS with warnings (see `verify-report.md`):
- `tsc` clean, build ok.
- The console passes 199 of 199, and the full suite 1351 of 1355 (the four known `conexiones` false positives).
- The verify found two CH-25 and CH-30a requirements contradicted by the pop-up and added them to the delta as MODIFIED before the sync.

## Final state

**`src/consola.ts`, the Consultas screen:**
- «Nueva consulta» and the saved-queries list, each entry with «Abrir» and «Versiones».
- **The query pop-up** (`#consulta-dialogo`) holds name, description, connection (picker with name and short id, plus its loading, empty, truncated and error states), SQL, parameters, rows per page and, when editing, the version note.
- **«Probar»** shows the result inside the pop-up.
- **Saving:**
  - the save control is enabled only after an ok test of the current content, and a line explains why when it is not;
  - a loaded query is saved only as «Guardar como versión N+1»;
  - a successful save closes the pop-up.
- **«Cancelar» and Escape** ask «Descartar cambios» when something changed.
- **The version history** opens in a wide side panel.
- No backend change.

## Open items

- **CH-32b:** apply DEC-173 to «Nueva conexión», Tenants, Usuarios del panel and the automation wizard.
- The pop-up's look can be refined: the user found it works but could be nicer.
