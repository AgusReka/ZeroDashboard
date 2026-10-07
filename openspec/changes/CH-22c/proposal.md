# Proposal: CH-22c — Panel "My Automations" with Failure State (P3h)

**Status**: ready for spec and design. Inputs: exploration.md, docs/02-mapa-de-changes.md (CH-22c, P3h), design skill P-03 (Aviso de falla en lenguaje de negocio).

## Intent
- Show the client (P2) when an active automation had its last finished run fail, with a visible business-language banner in the panel (story **P3h**).
- Keep the panel read-only, tenant-scoped from session (Rule 2), free of SQL and technical terms (Rule 1).
- Do not add a new email notification in this change; limit to visible state only.

## Scope

### In Scope
- **API**: extend `GET /api/panel/automatizaciones` response for `activas` items to include a derived `estado` that can be `con_falla` when the automation is active and its latest finished execution has `resultado === 'no-realizada'` (i.e. `fallo` or `omitida`). Also render an inline failure aviso/banner in the panel.
- **Derivation rule**: `estado = 'con_falla'` only if `activo === true` and `ultimaEjecucion !== null` and `ultimaEjecucion.resultado === 'no-realizada'`. `pausada` means `activo === false` (never `con_falla`). Active with successful last run remains `activa`.
- **Panel page (P-02)**: when `estado === 'con_falla'`, show an inline error banner inside the automation card in business language (no technical terms, no codes). Keep existing states (loading/empty/error/session-expired). No actions added.
- **Business copy**: neutral banner title/body per P-03 spirit ("No pudimos completar esta automatización esta vez" / short explanation that next run will retry). Exact text pinned by tests.
- **Wiring**: same route registration and `RUTAS_PANEL_PUBLICAS` exemption (already present). No schema/migration changes.

### Out of Scope
- Email notification for failures (separates from "visible state"; document as follow-up if needed).
- Changing how `ultimaEjecucion` is computed (still latest finished execution; `omitida` counts as finished and maps to `no-realizada`).
- Write actions (CH-23). Adjust/Activate controls.
- New models, migrations, template columns.
- Console changes.

## Capabilities

### Modified Capabilities
- `client-panel-automations`: adds derived failure state `con_falla` and failure banner in the panel for active automations whose last finished run failed.

## Approach
Extend the pure projection in `src/panel-automatizaciones.ts` to compute `estado` with the `con_falla` case. Keep the projection allow-listed; the banner copy lives in the page (`src/panel.ts`) using the panel's business language, not returned verbatim from API unless necessary. Better to derive state in API (consistent) and render banner in page. The design skill shows inline banner in the card - page-side rendering is fine.

Alternatively return an `avisos` field; but `estado: 'con_falla'` matches P-03 ("estado (activa / con_falla / pausada)") and is straightforward. Since CH-22b explicitly excluded it, CH-22c redefines that part of the contract.

## Affected Areas
- `src/panel-automatizaciones.ts` (projection logic + types)
- `src/panel-automatizaciones.test.ts` (pure and route tests)
- `src/panel.ts` (render failure banner)
- `src/panel.test.ts` (assert banner text presence, no glossary leaks)
- Possibly `src/aislamiento-panel.test.ts` (no behavior change expected, but can add a case if useful)
- `openspec/changes/CH-22c/*` (docs)

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Changing `estado` enum breaks assumptions | Low | CH-22c is the change that introduces it; page and tests updated together. |
| Showing banner when not appropriate (paused) | Low | Rule: only when `activo === true` and last finished run is `no-realizada`. |
| Glossary leak in banner copy | Low | Pin exact strings and extend glossary scan in page tests. |

## Review Workload Forecast (chained)
- PR0: docs only (exploration/proposal/specs/design/tasks) — ~minimal
- PR1: pure layer + unit tests — ~230-260 lines (add derivation + tests)
- PR2: route + wiring + isolation — ~150-200 lines (route tests updates; isolation minimal)
- PR3: page + page tests — ~120-160 lines (banner rendering + tests)
Total ~500-600, split into chained PRs (stacked-to-main) per instruction.
