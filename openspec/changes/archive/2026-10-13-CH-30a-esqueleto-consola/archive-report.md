# Archive Report: CH-30a

**Change**: CH-30a — Console shell and `#` navigation over the existing screens (first cut of CH-30)
**Archived at**: 2026-10-13
**Destination**: `openspec/changes/archive/2026-10-13-CH-30a-esqueleto-consola/`
**Main specs synced**: `openspec/specs/query-console/spec.md` (three ADDED requirements appended: shell and screens, navigation by hash, result next to the execute button)

## Artifacts

proposal.md, specs/query-console/spec.md, design.md, tasks.md, verify-report.md, archive-report.md. The umbrella exploration stays in `openspec/changes/CH-30-rediseno-de-la-consola/` for CH-30b to CH-30e.

## Decisions registered (`docs/01-decisiones.md`)

- DEC-164: the console stays one document with `#` navigation; ids are moved, never renamed.
- DEC-165: the design guide's navigation plus "Usuarios del panel".
- DEC-166: CH-30 is delivered in five changes, CH-30a to CH-30e.

## Verify summary

Verdict PASS with warnings (see `verify-report.md`): `tsc` clean, build ok, 1258 of 1262 tests pass and the other four are the known `conexiones` false positives; every spec scenario has an automated test; the user did the visual pass on 2026-10-13.

## Final state

- `public/ui/components/components.css` byte-identical to the skill again (shell, side navigation, page header, scope tag, `.zd-operator`).
- `src/consola.ts`: the tenant bar, then `.zd-shell` with the side navigation and three screens (`pantalla-consultas`, `pantalla-automatizaciones`, `pantalla-frescura`); the result block right after the query form; `mostrarPantalla()` on load and on `hashchange`.
- No change in any route or in the client panel.

## Open items

- CH-30b (Tenants and Connections) is next; its Tenants screen enables the "dado de baja" state of the bar.
