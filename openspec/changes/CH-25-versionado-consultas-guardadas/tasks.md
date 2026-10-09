# Tasks: CH-25 — Versioning of saved queries

Branch base: the current stack (`ch24/archivo`, PR #121). Strict order inside each PR: tests first where the repo does.

## Review Workload Forecast
- Estimated changed lines: ~1400 (PR1 ~300, PR2 ~420, PR3 ~250, PR4 ~450). PR1 turned out at 610 and was split in two (251 + 359); the delivery strategy chosen is chained PRs, stacked-to-main.
- 400-line budget risk: High
- Chained PRs recommended: Yes
- Decision needed before apply: Yes (session strategy `single-pr`: split into chained PRs or accept `size:exception`)

## PR1a — Schema and scoping (251 lines; split from the planned PR1, which came out at 610)
- [x] 1.1 `prisma/schema.prisma` + migration `20261009000000_consulta_guardada_versiones` (generated with `prisma migrate diff`, rollback in the header, no drift after applying); client regenerated; applied to the dev database.
- [x] 1.2 `ConsultaGuardadaVersion` registered in `MODELOS_AISLADOS` and in the model-list test. `src/aislamiento-versiones.test.ts` proves the scoping applies **inside an interactive `$transaction`** (a foreign id is `null`, a create is stamped with the active tenant, a failure rolls everything back, the unique pair refuses a repeated version), which is the risk the design named.
## PR1b — Pure rules and the shared validation (359 lines)
- [x] 1.3 `src/consultas-versiones.ts`: `validarCuerpoConsulta` extracted from the create route (behaviour-preserving), `resolverNota`, `mismoContenido`, `analizarVersion`.
- [x] 1.4 The create route calls `validarCuerpoConsulta`; the existing saved-query tests stay green unchanged (parity proof).
- [x] 1.5 `src/consultas-versiones.test.ts` (pure).

## PR2a — Edit (split from the planned PR2, which came out at ~600 lines)
- [x] 2.1 `PUT /consultas-guardadas/:id` in one interactive transaction (archive, update, bump), `409 sin-cambios`, `409 conflicto-de-edicion` on `P2002`.
- [x] 2.3a `src/consultas-versiones-apoyo.ts` (shared test setup, as `canal-agente-apoyo.ts` is) and `src/consultas-versiones-rutas.test.ts`: every edit scenario on the live database, parity of the 400 bodies with the create, the forced-conflict case and the two-tenant block.

## PR2b — Read the history
- [x] 2.2 `GET /consultas-guardadas/:id/versiones` and `GET /consultas-guardadas/:id/versiones/:version`.
- [x] 2.3b `src/consultas-versiones-historial.test.ts`: list, cap, one version, unknown versions and the two-tenant block on both reads.

## PR3 — Restore
- [x] 3.1 `POST /consultas-guardadas/:id/versiones/:version/restaurar` sharing `archivarVersion` and the conflict mapping with the edit. A request with no body means "no note", which a body schema of type object cannot say (it answered `400 campos: ["/"]`, found by the live tests), so the route has no body schema and the pure `leerCuerpoRestauracion` is the strict check.
- [x] 3.2 `src/consultas-versiones-restaurar.test.ts` (10 cases on the live database) plus the pure cases in `consultas-versiones.test.ts`: new version with the chosen content byte for byte, history keeps every entry field by field, `409 version-vigente`, `404`s, forced conflict, two-tenant block.

## PR4 — Console
- [ ] 4.1 Load `zerodashboard-design`; "Versiones" panel with rows, "Vigente" state with icon and text, single-version text and error state.
- [ ] 4.2 Comparison as two plain-text blocks; restore with the inline confirmation; save-as-new-version with the note; help text; tenant switch clears the panel and the loaded query.
- [ ] 4.3 `src/consola.test.ts` (ids registered in `IDS`, scenarios of the `query-console` delta).
- [ ] 4.4 Manual check by the user in the running app (rebuild with `docker compose up -d --build app`; stop the `app` container while running the full suite).

## Close
- [ ] 5.1 Verify against the spec, merge the deltas into `openspec/specs/saved-queries/spec.md` and `openspec/specs/query-console/spec.md`, archive.
