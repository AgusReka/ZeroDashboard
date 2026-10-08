# Proposal: CH-23 — Panel threshold and schedule adjustment (P2h, P-04)

**Status**: ready for spec and design. Inputs: exploration.md, DEC-138 to DEC-141, `docs/02-mapa-de-changes.md` (CH-23), design skill P-04.

## Intent
- Let the client (P2) change the threshold, the time of day, the days and the recipient of one of their active automations from the panel (story **P2h**), in business language and without SQL or cron.
- The change applies from the next run; the scheduler already re-reads `cron` and `valores` on every tick.
- Enforce Rule 1 (no SQL from P2), Rule 2 (tenant only from the session) and Rule 6 (the engine is not extended).

## Scope

### In Scope
- `GET /api/panel/automatizaciones/:id/ajustes`: current editable values (DEC-141).
- `PUT /api/panel/automatizaciones/:id/ajustes`: strict body `{ umbral?, hora?, dias?, destinatario? }`; the server builds the cron, merges `umbral` into `valores`, validates, and performs one tenant-scoped `update`.
- `id` added to each `activas` item of `GET /api/panel/automatizaciones` (DEC-139).
- Panel form (P-04): "Ajustar" on active and failing cards, per-field validation, success banner "Se aplican desde la próxima revisión".
- Both new routes added to `RUTAS_PANEL_PUBLICAS`.
- Two-tenant isolation test covering read and write by foreign id.

### Out of Scope
- Console edit routes (DEC-79 still holds there), activation of paused automations, deactivation from the panel.
- Several recipients, free cron, any SQL field (DEC-130, Rule 6).
- Schema changes or migrations; email notification; freshness (CH-24).

## Capabilities

### Modified Capabilities
- `client-panel-automations`: list items carry `id`; adds the adjust read/write contract and the P-04 form.

## Approach
New module `src/panel-ajustes.ts` with a pure half (preset mapping between `{hora, dias}` and cron, projection of current values, body validation) and a route registrar, mirroring `src/panel-automatizaciones.ts`. The day-set table is shared with `frecuenciaDeCron` so the two never disagree. The form lives in the `src/panel.ts` shell script, built with nodes and `textContent` like the existing cards, styled with the `zd-*` classes of the `zerodashboard-design` skill.

## Affected Areas
- `src/panel-ajustes.ts` (new), `src/panel-ajustes.test.ts` (new)
- `src/panel-automatizaciones.ts` (`id` in the item, shared day table), its test
- `src/contexto-tenant.ts` (two exemption rows) and its test
- `src/server.ts` (register the routes)
- `src/panel.ts`, `src/panel.test.ts` (form)
- `src/aislamiento-panel.test.ts` (two-tenant write test)

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Cross-tenant write by foreign id | Low | Scoped `findUnique`/`update`; two-tenant test on GET and PUT (404 identical to unknown) |
| Client smuggles cron/SQL/`valores`/`tenantId` | Low | Strict schema with `propertyNames`; server rebuilds cron and `valores` |
| Silent overwrite of a custom cron | Medium | 409 `horario-no-editable`; form hides the schedule fields |
| Immediate extra run when saving inside a tick window | Low | Documented limit (DEC-95); no engine change |

## Review Workload Forecast
- PR1: pure layer + unit tests — ~250 lines
- PR2: routes + wiring + exemption + isolation test — ~280 lines
- PR3: form + page tests — ~220 lines
Total ~750 lines; **400-line budget risk: High; Chained PRs recommended: Yes; Decision needed before apply: Yes** (the session strategy is `single-pr`).
