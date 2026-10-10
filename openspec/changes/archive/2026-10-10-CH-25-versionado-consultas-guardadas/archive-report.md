# Archive Report: CH-25

**Change**: CH-25 — Saved-query versioning (B4; console screen C-08, versions)
**Archived at**: 2026-10-10
**Destination**: `openspec/changes/archive/2026-10-10-CH-25-versionado-consultas-guardadas/`
**Main specs synced**: `openspec/specs/saved-queries/spec.md` (purpose amended, ADDED requirements appended) and `openspec/specs/query-console/spec.md` (ADDED requirements appended)

## Artifacts

exploration.md, proposal.md, specs/saved-queries/spec.md, specs/query-console/spec.md, design.md, tasks.md, verify-report.md, archive-report.md.

## Decisions registered (`docs/01-decisiones.md`)

- DEC-146: the row keeps the current content; the history lives in a separate table.
- DEC-147: restoring a version creates a new version; the history only grows.
- DEC-148: versions carry an optional note and no author.
- DEC-149: "Comparar con la actual" shows both statements side by side as plain text.
- DEC-150: full edit of a saved query and the contract of the version routes (amends DEC-10 for the edit; still no delete).

## Verify summary

Verdict PASS with warnings (see `verify-report.md`): `tsc` clean; with the app container stopped, 1136 of 1140 tests pass and the other four are the known `conexiones` false positives caused by the database password; every spec scenario has an automated test; the user did the visual pass on 2026-10-10.

## Final state

- Migration `20261009000000_consulta_guardada_versiones`: `ConsultaGuardada.version` (default 1) and `nota`; table `ConsultaGuardadaVersion`, unique per `(consultaGuardadaId, version)`, registered in `MODELOS_AISLADOS`.
- `src/consultas-versiones.ts` (pure rules), `src/consultas-guardadas.ts` (`PUT /:id`, `GET /:id/versiones`, `GET /:id/versiones/:version`, `POST /:id/versiones/:version/restaurar`).
- `src/consola.ts`: versions panel, compare, restore with confirmation, save the editor as a new version.
- No change in `planificador.ts` or in the client panel.

## Open items

- `ch25/edicion` (~472 lines) exceeds the 400-line budget: `size:exception` or split before opening it.
- `docs/02-mapa-de-changes.md` still lists CH-25 as pending.
- Next in the suggested order: CH-29 (operator identity), then CH-28 and CH-30.

## Delivery branches (stacked, local, not pushed)

`ch24/archivo` -> `ch25/exploracion` -> `ch25/esquema` -> `ch25/reglas-puras` -> `ch25/edicion` -> `ch25/historial` -> `ch25/restaurar` -> `ch25/panel-versiones` -> `ch25/comparar-restaurar` -> `ch25/guardar-version` -> `ch25/archivo`.
