# Archive Report: CH-21c — Two-Step Automation Creation (D2) and Template-Tied Email Format (N3)

**Archive Date**: 2026-10-06  
**Change Name**: CH-21c-alta-en-dos-pasos  
**Status**: COMPLETE  
**Final Commits on Master**:
- PR #90 (PR0): `docs(ch21c)` DEC-129 a DEC-132 y planificación del alta en dos pasos
- PR #91 (PR1): `feat(ch21c)` primera ejecución en el 201 y `GET /conexiones`
- PR #92 (PR2a): `feat(ch21c)` asistente de alta en dos pasos en la consola
- PR #93 (PR2b): `feat(ch21c)` desplegable de conexiones y guardas del asistente
- PR #94 (PR2c): `feat(ch21c)` selector de plantillas con tarjetas en el asistente
- PR #95 (PR3): `feat(ch21c)` horario con presets y primera ejecución en el asistente
- PR #96 (PR4): `feat(ch21c)` tarjetas de plantilla deshabilitadas con su motivo en el asistente
- PR #97 (PR5): `feat(ch21c)` vista previa del correo en el paso 2 del asistente

## Executive Summary

CH-21c successfully implemented two-step automation creation in the console (D2) and template-tied email formatting (N3) without schema, migration, dependency, or engine changes (rule 6). 

The creation flow replaced the former flat form with a two-step wizard:
1. **Paso 1**: Connection dropdown populated from the new `GET /conexiones` endpoint and template picker with interactive cards. Cards reflect advisory availability based on mapping validation (`sondearConexion`), disabling templates whose required canonical views are missing or invalid, with clear human-readable explanations.
2. **Paso 2**: Parameter value inputs, schedule frequency presets (`diaria`, `lun-vie`, `lun-sab`, `personalizado`) translating to cron, optional recipient input, and a read-only email preview reflecting server-side template themes and subjects.

All 8 PRs (PR0 through PR5) merged cleanly to `master`. Full test suite passes: 902/902 tests green (0 failures, 0 skips).

## Merged Artifacts

### Spec Artifacts

| Spec | Action | Location | Notes |
|------|--------|----------|-------|
| `automation-scheduling` | Modified | `openspec/specs/automation-scheduling/spec.md` | Added requirement: `POST /automatizaciones` 201 body reports `proximaEjecucion` and `zonaHoraria` (DEC-129). |
| `connection-registration` | Modified | `openspec/specs/connection-registration/spec.md` | Added requirement: `GET /conexiones` tenant-scoped listing with row cap (DEC-132). Updated credential exposure requirement to explicitly cover the listing endpoint. |
| `tenant-isolation` | Modified | `openspec/specs/tenant-isolation/spec.md` | Updated cross-tenant isolation automated test (T2) requirement and sweep scenario to include `GET /conexiones`. |
| `query-console` | Modified | `openspec/specs/query-console/spec.md` | Updated servable console page, two-step wizard automation creation (DEC-78), active-tenant isolation forwarding (T4), and guarded markup ids. Added requirements for schedule presets (DEC-129), advisory template availability (DEC-127), read-only email preview (DEC-131), and template card descriptions (DEC-131). |

### Change Folder

**Archived to**: `openspec/changes/archive/2026-10-06-CH-21c-alta-en-dos-pasos/`

**Contents**:
- `proposal.md` — Intent, capabilities, scope, approach, non-negotiable rules compliance, workload forecast
- `design.md` — Technical design, stacked PR strategy, architecture decisions DEC-129..132, data flows, UI state machine, testing strategy
- `exploration.md` — Discovery of console creation gap, schedule presets, connection listing, email preview feasibility
- `apply-progress.md` — Cumulative implementation progress, commits, test evidence, deviations, line-count checkpoints
- `tasks.md` — Work breakdown by PR, verification tasks, and closure checklist
- `archive-report.md` — This closeout summary
- `specs/` — Delta specs for the 4 affected areas

## Implementation Summary

### Chained PR Delivery

The change followed the project's stacked PR strategy to maintain review focus and stay within line-count budgets:

| PR | Branch | Scope | Authored Lines | Status |
|---|---|---|---|---|
| PR0 #90 | `ch21c/exploracion` | Docs: DEC-129..132, proposal, design, tasks | Docs | ✓ Merged |
| PR1 #91 | `ch21c/servidor-conexiones` | Server: `proximaEjecucion`, 201 response, `GET /conexiones`, isolation tests | 316 | ✓ Merged |
| PR2a #92 | `ch21c/asistente-base` | Console: Wizard shell, step navigation, stepper | 396 | ✓ Merged |
| PR2b #93 | `ch21c/asistente-conexion` | Console: Connection dropdown, Cancel button, guards | 299 | ✓ Merged |
| PR2c #94 | `ch21c/asistente-plantillas` | Console: Template cards radio group | 316 | ✓ Merged |
| PR3 #95 | `ch21c/asistente-horario` | Console: Step 2 schedule presets, next-run banner | 312 | ✓ Merged |
| PR4 #96 | `ch21c/asistente-disponibilidad` | Console: Disabled template cards with validation reasons | 345 | ✓ Merged |
| PR5 #97 | `ch21c/asistente-vista-previa` | Console: Email preview block, theme styling | 141 | ✓ Merged |

## Verification Status

- **Type Check**: `npx tsc --noEmit` clean
- **Build**: `npm run build` exit code 0
- **Automated Tests**:
  - Console tests: 60/60 passing
  - Full suite (`TEST_DB_PORT=5434 npm test`): 902/902 passing, 0 failures, 0 skipped
- **Smoke Tests**: `bash scripts/smoke.sh` verified on PR tips
- **Manual Visual Review**: Tasks 2a.7, 2b.4, 2c.4, 3.5, 4.5, 5.4 verified
