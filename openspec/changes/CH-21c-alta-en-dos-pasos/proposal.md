# Proposal: CH-21c — Two-Step Automation Creation in the Console (D2) and Template-Tied Email Format (N3)

**Status**: ready for spec and design. Inputs: `exploration.md`, DEC-129 to DEC-132 (firm, 2026-10-05).

## Intent

- Creating an automation today is one flat form: a template `<select>`, a free-text connection UUID, a raw cron, one optional recipient (`src/consola.ts:184-208`). It misses C-10 to C-13 and looks unfinished in the recorded demo.
- Deliver D2 as a two-step wizard and meet N3 with the label theme plus a read-only email preview. The POST body and the engine stay as they are.

## Scope

### In Scope
- Server: pure `proximaEjecucion(cron, creadaEn, zona)` in `src/automatizaciones.ts`. The `POST /automatizaciones` 201 body gains additive `proximaEjecucion` (ISO instant) and `zonaHoraria` (DEC-129).
- Server: scoped `GET /conexiones` returning `{id, nombre}` only, with a row cap, a two-tenant test and a T2 sweep row (DEC-132).
- Console: "Nueva automatización" reveals a static `.zd-steps` stepper. Step 1: connection dropdown above a card TemplatePicker with a description map keyed by the `automatizacion` label. Step 2: parameters, schedule presets, one recipient, read-only preview, Volver, Crear automatización.
- Schedule presets `diaria`, `lun-vie`, `lun-sab` plus hour, translated to cron in the script. `personalizado` reveals the raw cron field. The success banner shows the first run and the zone.
- Disabled-with-reason derived client-side from the template's own `entidades` against `GET /conexiones/:id/validacion-mapeo`, mirroring `evaluarVistas`. It is advisory: creation stays ungated (DEC-127).
- N3 preview built from DOM nodes and `textContent` (subject, title bar in the label's accent colour, note about columns). It uses a client `TEMAS` map with a parity test against `asuntoCorreo` (DEC-131).
- `Nodo` stubs (`setAttribute`/`removeAttribute`), replacement of G3, updated id guard, bridge CSS for the disabled card.

### Out of Scope
- Panel work (CH-22, CH-23). Tolerance display and enforcement (CH-24).
- `nombre`, saved-query link, recipient lists, optional parameters (DEC-130, artifact limits for Cap. 6).
- Configurable per-template email, icons, tolerance on cards (DEC-131).
- Per-field inline errors, editing automations, a pre-creation first-run endpoint, next run in list or GET routes.
- Moving HTML or JS out of `src/consola.ts` (DEC-124 A5). Any engine, schema, migration or dependency change (rule 6).

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `query-console`: MODIFIED "Console Page Is Servable" (drop the byte-identical-script clause; keep one `</script>`, no backtick, no markup-assigning properties). MODIFIED "Console Displays Automations and Supports Creating One (DEC-78)" (wizard, dropdown, presets, one recipient, first-run banner, unchanged body). MODIFIED "Automation Views Respect the Active-Tenant Indicator (T4)" (wizard state wiped, late responses discarded). MODIFIED "Console Markup Ids Are Guarded" (new id list). ADDED: schedule presets (DEC-129), advisory disabled template (DEC-127), read-only email preview (DEC-131).
- `automation-scheduling`: ADDED "Create Response Reports the First Scheduled Run" (`proximaEjecucion` from `creadaEn` in the deployment zone; a schedule, not a promise, DEC-95).
- `connection-registration`: ADDED "Listing the Active Tenant's Connections (DEC-132)". MODIFIED "Credential Value Never Exposed" (listing scenario).
- `tenant-isolation`: MODIFIED "Cross-Tenant Isolation Is Proven by an Automated Test (T2)" (sweep includes `GET /conexiones`).

## Approach

DEC-129 (b)+(P1), DEC-130 (a), DEC-131 (a), DEC-132 (a). The tenant travels as `X-Tenant-Id` through `pedir()`, so rule 2 holds. `GET /conexiones` goes through the structural extension and is fetched when the wizard opens, keeping the three-response tenant load. Rule 5: the preview shows no row content. Rule 6: `proximaEjecucion` is read-side only. Rule 7: no `credencial`. Rules 1, 3 and 4 are untouched.

## Affected Areas

| Area | Impact |
|------|--------|
| `src/automatizaciones.ts`, `src/automatizaciones-rutas.ts` + tests | Modified |
| `src/conexiones.ts`, `src/conexiones.test.ts`, `src/aislamiento.test.ts` | Modified |
| `src/consola.ts`, `src/consola.test.ts` | Modified |
| `docs/01-decisiones.md`, planning docs | Modified (PR0) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Gate drift from `evaluarVistas` | Med | Advisory only; run-time gate authoritative; shared test vectors |
| Stale async results (probe, template detail, connections) | Med | Generation token checked on every response |
| Wizard state survives tenant switch (T4) | Med | Extend `limpiarAutomatizaciones`; tenant-switch test |
| Strict `fetch` queue in tests | High | No new request on tenant load; lazy fetches |
| Template-literal hazards (backtick, `${`, `\d` cooks to `d`) | Med | Use `\\d` or string checks; existing no-backtick test |
| Zone defaults to UTC | High | Generic pre-creation copy; zone and first run in the banner |
| No catch-up (DEC-95) | Low | Banner wording frames it as a schedule |
| `setAttribute`/`aria-current` missing in `Nodo` | Med | Add stubs in PR2 |
| PR2 near 400 lines | Med | Move description map or id-guard edits to PR3 if exceeded |
| T2 sweep misses the new route | Low | Sweep row plus a dedicated two-tenant test in PR1 |

## Rollback Plan

Revert in reverse order. PR5 and PR4 are console-only and independent. Reverting PR3 restores the raw cron field. Reverting PR2 restores the flat form. Revert PR3 before PR1, because the banner reads `proximaEjecucion`. Reverting PR1 removes the route and the two additive fields. There is no schema, migration, env or dependency change (`cron-parser` already present). PR0 is documentation only.

## Dependencies

- Prerequisites: DEC-129 to DEC-132 (PR0), CH-21a `.zd-*` stylesheet, CH-21b seeded templates (`entidades`, labels).
- Downstream: CH-22b reuses `proximaEjecucion`, CH-23 reuses the preset translation vectors server-side, CH-24 owns tolerance.

## Review Workload Forecast

| PR | Content | Lines |
|----|---------|-------|
| PR0 | DEC-129..132, planning | ~100 |
| PR1 | `proximaEjecucion`, `GET /conexiones`, tests | ~160 |
| PR2 | Shell: stepper, panels, picker, dropdown, map, stubs, G3, spec delta | ~380 |
| PR3 | Schedule presets, first-run banner, reset | ~330 |
| PR4 | Disabled-with-reason | ~250-300 |
| PR5 | N3 preview, parity test | ~150-200 |

`Decision needed before apply: No`; `Chained PRs recommended: Yes`; `400-line budget risk: Medium`. Minimum demo: PR0 to PR3.

## Open Questions

- The wizard ids, and whether `auto-plantilla` is reused as the picker container or retired.
- The `GET /conexiones` cap value and ordering.
- Behaviour when the validation probe fails or the tenant has no connections.
- Whether "Siguiente" requires a template and a connection.
- The hour control (`type="time"` or selects).

## Success Criteria

- [ ] The 201 body carries `proximaEjecucion` equal to the next fire after `creadaEn` in the configured zone, plus `zonaHoraria`. Unit tests cover `1-5`/`1-6` across a weekend and a non-UTC zone. Existing 201 tests pass.
- [ ] `GET /conexiones` returns only `{id, nombre}` of the header's tenant and has no `credencial` key. The T2 sweep and the two-tenant test pass.
- [ ] Preset vectors pass (`diaria` 08:30 → `30 8 * * *`, `lun-vie` → `30 8 * * 1-5`, `lun-sab` → `30 8 * * 1-6`), and `personalizado` passes through unchanged. The POST body keys are unchanged.
- [ ] A template whose entity is not `valida` renders disabled with a reason. A late response is discarded.
- [ ] The preview uses `textContent` only, and the parity test matches `asuntoCorreo` for both labels.
- [ ] A tenant switch clears the wizard, and tenant load still issues three requests. The id guard and smoke pass. The page has no backtick, no `innerHTML` and one `</script>`. There is no engine-file diff and no migration.
