# Archive Report: CH-23

**Change**: CH-23 — Panel threshold and schedule adjustment (P2h, P-04)
**Archived at**: 2026-10-08
**Destination**: `openspec/changes/archive/2026-10-08-CH-23-ajuste-umbrales-horarios/`
**Main spec synced**: `openspec/specs/client-panel-automations/spec.md` (CH-23 requirements appended as an "ADDED" section; title now cites CH-22c and CH-23)

## Artifacts

exploration.md, proposal.md, specs/client-panel-automations/spec.md, design.md, tasks.md, verify-report.md, archive-report.md.

## Decisions registered (`docs/01-decisiones.md`)

- DEC-138: in-place edit from the panel only; amends DEC-79 and DEC-82 for the panel surface.
- DEC-139: the list exposes an opaque `id`; the adjust route is addressed by it.
- DEC-140: P-04 edits umbral, hour, days and a single recipient.
- DEC-141: read/write contract of `.../ajustes`.

## Verify summary

Verdict PASS with warnings (see `verify-report.md`): `tsc` clean; every spec scenario has an automated test except the form's runtime behavior, covered by string-level checks plus the user's manual pass on 2026-10-08. Full suite: 1025/1031 with a colliding database password; with another password only the unrelated `2.16` of CH-22c fails.

## Final state

- `src/panel-ajustes.ts` (pure layer + `GET`/`PUT /api/panel/automatizaciones/:id/ajustes`), `src/panel-automatizaciones.ts` (`id`, shared `DIAS_PRESET`), `src/contexto-tenant.ts` (two exempt rows), `src/server.ts`, `src/panel.ts` (Ajustar form).
- No schema change, no migration, no engine change (`planificador.ts` untouched), no email.

## Open items

- PR1 (~430 lines) and PR2 (~549) exceed the 400-line budget: `size:exception` or split before opening them.
- `docs/02-mapa-de-changes.md` and the design skill (P-04 status, both copies) were not updated.
- Pre-existing: `aislamiento-panel.test.ts` "2.16" depends on test order (CH-22c).

## Delivery branches (stacked-to-main, local, not pushed)

`ch23/artefactos` -> `ch23/capa-pura` -> `ch23/rutas` -> `ch23/formulario` -> `ch23/archivo`.
