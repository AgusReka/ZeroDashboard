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
- [ ] 1.6 Manual visual pass of Consultas at 360 px and 1280 px, light and dark (human).

## Close
- [ ] 2.1 `npm run test:db`, `tsc --noEmit`, `npm run build`.
- [ ] 2.2 Verify, archive, sync `query-console` (replace "Saving the Current Statement From the Console" keeping its scenario; append "New Query Action" and "Connection Picker"), mark CH-32a in `docs/02-mapa-de-changes.md`.
