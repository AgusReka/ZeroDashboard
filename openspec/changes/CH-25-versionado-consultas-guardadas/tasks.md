# Tasks: CH-25 — Versioning of saved queries

Branch base: the current stack (`ch24/archivo`, PR #121). Strict order inside each PR: tests first where the repo does.

## Review Workload Forecast
- Estimated changed lines: ~1400 (PR1 ~300, PR2 ~420, PR3 ~250, PR4 ~450)
- 400-line budget risk: High
- Chained PRs recommended: Yes
- Decision needed before apply: Yes (session strategy `single-pr`: split into chained PRs or accept `size:exception`)

## PR1 — Schema, scoping and pure rules
- [ ] 1.1 `prisma/schema.prisma` + migration (`version`, `nota`, `ConsultaGuardadaVersion`, back-relation on `Tenant`), with its rollback in the header; `npm run prisma:generate`; apply to the dev database.
- [ ] 1.2 Register `ConsultaGuardadaVersion` in `MODELOS_AISLADOS`; test that it is scoped and that the scoping applies inside `$transaction` (a foreign id resolved through `tx` is `null`).
- [ ] 1.3 `src/consultas-versiones.ts`: `validarCuerpoConsulta` extracted from the create route (behaviour-preserving), `resolverNota`, `mismoContenido`, `analizarVersion`.
- [ ] 1.4 The create route calls `validarCuerpoConsulta`; the existing saved-query tests stay green unchanged.
- [ ] 1.5 `src/consultas-versiones.test.ts` (pure).

## PR2 — Edit and read the history
- [ ] 2.1 `PUT /consultas-guardadas/:id` in one interactive transaction (archive, update, bump), `409 sin-cambios`, `409 conflicto-de-edicion` on `P2002`.
- [ ] 2.2 `GET /consultas-guardadas/:id/versiones` and `GET /consultas-guardadas/:id/versiones/:version`.
- [ ] 2.3 Route tests on the live database, including the forced-conflict case and a two-tenant block on all three routes.

## PR3 — Restore
- [ ] 3.1 `POST /consultas-guardadas/:id/versiones/:version/restaurar` sharing the archive-and-update helper with the edit.
- [ ] 3.2 Tests: new version with the chosen content byte for byte, history keeps every entry, `409 version-vigente`, `404`s, two-tenant block.

## PR4 — Console
- [ ] 4.1 Load `zerodashboard-design`; "Versiones" panel with rows, "Vigente" state with icon and text, single-version text and error state.
- [ ] 4.2 Comparison as two plain-text blocks; restore with the inline confirmation; save-as-new-version with the note; help text; tenant switch clears the panel and the loaded query.
- [ ] 4.3 `src/consola.test.ts` (ids registered in `IDS`, scenarios of the `query-console` delta).
- [ ] 4.4 Manual check by the user in the running app (rebuild with `docker compose up -d --build app`; stop the `app` container while running the full suite).

## Close
- [ ] 5.1 Verify against the spec, merge the deltas into `openspec/specs/saved-queries/spec.md` and `openspec/specs/query-console/spec.md`, archive.
