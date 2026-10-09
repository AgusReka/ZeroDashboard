# Tasks: CH-23 — Panel threshold and schedule adjustment

Branch base `master`. Strict order inside each PR: tests first where the repo does (see CH-22b/22c apply-progress).

## Review Workload Forecast
- Estimated changed lines: ~750 (PR1 ~250, PR2 ~280, PR3 ~220)
- 400-line budget risk: High
- Chained PRs recommended: Yes
- Decision needed before apply: Yes (session strategy `single-pr`: split into chained PRs or accept `size:exception`)

## PR1 — Pure layer (no I/O)
- [x] 1.1 Export `DIAS_PRESET` (and `horarioPresetDeCron`) from `src/panel-automatizaciones.ts`; make `frecuenciaDeCron` derive from it (no behavior change; existing tests stay green).
- [x] 1.2 Add `id` to `FilaAutomatizacion`, `ItemActiva` and `proyectarActiva`; extend its unit tests (id present, nothing else new).
- [x] 1.3 `src/panel-ajustes.ts`: `cronDeHorario`, `proyectarAjustes`, `resolverAjustes` (the preset-to-parts reader is `horarioPresetDeCron`, shared with the frequency text).
- [x] 1.4 `src/panel-ajustes.test.ts` (pure): preset vectors copied from `VECTORES_HORARIO`, hour bounds, partial updates, every `campos` and 409 branch, `valores` merge keeps other declared keys (DEC-58), projection has no extra keys.

## PR2 — Routes and isolation
- [ ] 2.1 Q1 `select` of the list gains `id`; list route test asserts it.
- [ ] 2.2 `registerPanelAjustesRoutes` (`GET`/`PUT`), strict schema, scoped `update`, P2025 to 404.
- [ ] 2.3 Add `GET` and `PUT /api/panel/automatizaciones/:id/ajustes` to `RUTAS_PANEL_PUBLICAS`; extend `src/contexto-tenant.test.ts`.
- [ ] 2.4 Register in `src/server.ts`.
- [ ] 2.5 Route tests (200/400/401/404/409, stored values, forbidden keys) and the two-tenant test in `src/aislamiento-panel.test.ts` (GET and PUT by foreign id; header ignored). Add rows to the T2 sweep if it lists routes.

## PR3 — Form (P-04)
- [ ] 3.1 Load `zerodashboard-design`; build "Ajustar" and the inline form in `src/panel.ts` with nodes and `textContent`.
- [ ] 3.2 States: loading values, per-field errors, success banner "Se aplican desde la próxima revisión", session/network errors.
- [ ] 3.3 `src/panel.test.ts`: form strings present, glossary scan (no cron, SQL, tenant, id) extended.
- [ ] 3.4 Manual check at 375 px and desktop in the running app.

## Close
- [ ] 4.1 Update `docs/02-mapa-de-changes.md` (CH-23 state) and the design skill's P-04 status in `guidelines/pantallas.md` (both copies).
- [ ] 4.2 Verify against the spec, then archive (merge delta into `openspec/specs/client-panel-automations/spec.md`).
