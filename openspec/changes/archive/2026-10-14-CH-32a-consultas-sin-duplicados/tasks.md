# Tasks: CH-32a — Saved queries without duplicates, and a connection picker

Branch base: `master` (after #174). Tests first, against `npm run test:db` for the full suite and `npx tsx --test src/consola.test.ts` while working.

## Review Workload Forecast
- Estimated changed lines: ~360 (consola.ts ~140, consola.test.ts ~180, spec ~40)
- 400-line budget risk: Medium
- Chained PRs recommended: No
- Decision needed before apply: No
- **Actual after apply (2026-10-14): ~605 changed lines** (consola.test.ts 416, consola.ts 189), over the 400-line budget. A split was possible (picker / saving and "Consulta nueva") but both touch the same two files interleaved. **Decided by the user: one PR with `size:exception`.**

## PR0 — Planning
- [x] 0.1 DEC-172, exploration, proposal, spec, design and tasks (`ch32a/exploracion`); the change map row.

## PR1 — Saving, "Consulta nueva" and the connection picker
- [x] 1.1 RED: the `CH-32a` tests of design §5 (picker, saving with a loaded query, "Consulta nueva"); new ids in `IDS`.
- [x] 1.2 GREEN: `#guardar` follows `recordarConsultaCargada` / `olvidarConsultaCargada`; `guardar()` guard; help text of `#guardado`.
- [x] 1.3 GREEN: "Consulta nueva" with the inline «Descartar cambios» confirmation.
- [x] 1.4 GREEN: `select#conexion` with `cargarConexionesConsulta()` (loading, empty, truncated, error with «Reintentar», generation token); `ejecutar()` with no connection.
- [x] 1.5 Existing `consola.test.ts` scenarios still pass; add the `GET /conexiones` answer where a scenario needs the select populated.

## PR2 — Query pop-up (DEC-173 as corrected: pop-up, not side panel)
- [x] 2.0 First version (strip + save side panel, commit 6e048aa), replaced at the user's request before merge.
- [x] 2.1 RED: the tests of design §7; new ids (`consulta-dialogo`, `consulta-dialogo-titulo`, `consulta-cancelar`, `version-campos`) in `IDS`, hidden ones in `IDS_OCULTOS`; the ids of the first version removed.
- [x] 2.2 GREEN: header «Nueva consulta», list «Abrir», the pop-up with every field, «Probar» with the result inside, the save gate, «Cancelar»/Escape with «Descartar cambios», versions in a wide side panel.
- [x] 2.3 Existing suites still pass (tests that save run an ok «Probar» first).

## Close
- [x] 3.1 `npm run test:db`, `tsc --noEmit`, `npm run build`.
- [x] 3.2 Verify, archive, sync `query-console` (replace "Saving the Current Statement From the Console" keeping its scenario; append "Create and Edit Forms Open in a Pop-up", "Query Screen and Query Pop-up" and "Connection Picker"), mark CH-32a in `docs/02-mapa-de-changes.md`.
