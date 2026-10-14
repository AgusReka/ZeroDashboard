# Tasks: CH-32b — Create forms in a pop-up, and the audit's F2 items

Branch base: `master` (after #178). Tests first, `npx tsx --test src/consola.test.ts` while working and `npm run test:db` for the full suite.

## Review Workload Forecast
- Estimated changed lines: ~900 code and tests (consola.ts ~370, consola.test.ts ~530) plus ~200 of planning docs
- 400-line budget risk: High
- Chained PRs recommended: Yes (slices 1–3 of design §7, each under 400)
- Decision needed before apply: Yes — the session's delivery strategy is single PR: split into the three slices, or one PR with `size:exception`
- **Decided by the user (2026-10-14): one PR with `size:exception`** (branch `ch32b/formularios`); the PR sections below are commit groups, not separate PRs.

## PR0 — Planning
- [x] 0.1 Exploration, proposal, spec, design and tasks; the CH-32b row in `docs/02-mapa-de-changes.md`.

## PR1 — Pop-up factory, tenant and user
- [x] 1.1 RED: test helpers of design §6 (`abrirDialogo`, `dialogoAbierto`, per-pop-up `FORMAS_DE_CANCELAR`); new ids in `IDS`, `IDS_OCULTOS`.
- [x] 1.2 GREEN: `crearDialogo`, `dialogos`, `cerrarDialogos`, `avisarEnDialogo`/`llevarBannerA`; Consultas rebuilt on them; CH-32a tests pass unchanged.
- [x] 1.3 RED → GREEN: «Nuevo tenant» pop-up, «Crear tenant» / «Crear y elegir», empty name inside.
- [x] 1.4 RED → GREEN: «Nuevo usuario» pop-up; 409 inside; secret on the page.
- [x] 1.5 RED → GREEN: «Reponer clave» inline confirmation; existing test 3379 adapted.
- [x] 1.6 Shared pop-up tests (markup, focus, Cancelar/Escape, discard, tenant switch) for tenant and user.

## PR2 — Connection pop-up
- [x] 2.1 RED: connection pop-up tests (design §6); `conexion-panel`, `titulo-conexion-nueva`, `cx-cerrar` to `IDS_RETIRADOS`.
- [x] 2.2 GREEN: markup and `crearDialogo` wiring; save closes and reports in `conexiones-aviso`; 400 inside; «Vía» unchanged.
- [x] 2.3 Existing connection and agent-route tests adapted to open the pop-up.

## PR3 — Wizard pop-up and automations list
- [x] 3.1 RED: `respuestasAutomatizaciones` helper adopted by every scenario that loads the screen; list tests (name, words + cron, custom cron, unknown connection, connections failure).
- [x] 3.2 GREEN: `cargarNombresConexiones`, `horarioEnPalabras`, Conexión and Horario cells.
- [x] 3.3 RED → GREEN: `#auto-alta` as backdrop, `#auto-nueva` in the header, `auto-cancelar-2`, `auto-dialogo-aviso`, Cancelar/Escape with discard; 400 inside.
- [x] 3.4 Existing CH-13/CH-21c wizard tests still pass (only the `#auto-nueva` hidden checks and banner-on-400 checks change).

## Close
- [x] 4.1 `npm run test:db`, `tsc --noEmit`, `npm run build`.
- [ ] 4.2 Verify, archive, sync `query-console`, mark CH-32b in `docs/02-mapa-de-changes.md`; note C-05 of the design guide as superseded by DEC-173.
