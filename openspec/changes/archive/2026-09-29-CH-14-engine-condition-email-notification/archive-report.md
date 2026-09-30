# Archive Report: CH-14-engine-condition-email-notification

**Change**: CH-14 — Engine: Condition and Email Notification (X3, N1, N2)
**Archived**: 2026-09-29
**Store**: openspec
**Status**: PASS WITH WARNINGS (effective at close)

## Cycle Summary

The CH-14 change introduced email notification for automation runs, integrating email delivery with the execution engine. After a run's query completes and while rows are in memory, the system evaluates a notification condition and sends the result by email to one validated recipient, bounded by a configured timeout. The implementation spans 7 slices with 46 tasks: phases 1–6 completed all 42 behavioral and infrastructure tasks; phases 7.1–7.3 (documentation, full-suite verification, and verification report) were completed after apply-progress, and phase 7.4 (this archive) finalizes the cycle.

## Verification Status

**Final Verdict**: PASS WITH WARNINGS (0 CRITICAL, 4 WARNING, 4 SUGGESTION)

The `verify-report.md` initially reported FAIL with one CRITICAL (C-1: task 7.1 bitácora missing). This was resolved in commit 7f72c00 by writing `docs/bitacora/CH-14-motor-condicion-y-notificacion.md` and ticking task 7.1. Per the Final-State Authority section of the archive skill, the orchestrator's explicit close facts outrank the intermediate snapshot's verdict.

**Evidence**:
- `npx tsc --noEmit`: clean (no output)
- `npx prisma validate`: valid
- `npm test`: 620 tests passed / 0 failed (621 with live Mailpit profile)
- `docker compose config`: both default and `--profile correo` configurations parse correctly
- All 42 implementation tasks (1.1–6.7) checked and complete
- All 4 documentation tasks (7.1–7.4) complete

## Specs Merged and Archived

All delta specs were merged into main specs before archiving. The email-notification domain is new; five existing domains received ADDED/MODIFIED requirements.

| Domain | Action | Added Req. | Modified Req. | Removed Req. | Ref. |
|--------|--------|-----------|---|---|---|
| email-notification | Created (new domain) | 11 | 0 | 0 | 11 requirements, 21 scenarios |
| automation-scheduling | Merged | 1 | 2 | 0 | +3 requirements: `destinatario` field, create-only lifecycle, notify step |
| execution-log | Merged | 0 | 3 | 0 | +3 requirements: notificacion outcomes, failure classification, T2 isolation |
| project-environment | Merged | 0 | 3 | 0 | +3 requirements: optional SMTP config, Mailpit profile, secrets handling |
| query-console | Merged | 0 | 2 | 0 | +2 requirements: recipient input, notification column |
| tenant-isolation | Merged | 0 | 1 | 0 | +1 requirement: per-tenant notification isolation |

**Total Requirement Counts (merged into main specs)**:
- Created: 11 (email-notification)
- Added across existing: 1 (automation-scheduling) + 0 + 0 + 0 + 0 = 1
- Modified across existing: 2 + 3 + 3 + 2 + 1 = 11
- Scenarios added/modified: 21 (email-notification) + 3 + 3 + 0 + 1 + 1 = 29 new/updated scenarios

## Archive Contents

✓ All artifacts moved to `openspec/changes/archive/2026-09-29-CH-14-engine-condition-email-notification/`:

- `proposal.md`: Change intent, scope, approach, and rollback strategy
- `specs/`: 6 domain specifications (automation-scheduling, email-notification, execution-log, project-environment, query-console, tenant-isolation)
- `design.md`: Technical approach, architecture decisions, interfaces, and threat matrix
- `tasks.md`: 46 tasks, all marked complete (1.1–7.4)
- `verify-report.md`: Verification results at verify time; FAIL with C-1; effective verdict at close is PASS WITH WARNINGS
- `exploration.md`, `research.md`: Pre-proposal artifacts (from earlier phases)

## Source of Truth Updated

The following main specs in `openspec/specs/` now reflect the new behavior:

- `openspec/specs/email-notification/spec.md` — created
- `openspec/specs/automation-scheduling/spec.md` — merged (destinatario, notify step)
- `openspec/specs/execution-log/spec.md` — merged (notificacion outcomes, failure classification)
- `openspec/specs/project-environment/spec.md` — merged (SMTP optional config)
- `openspec/specs/query-console/spec.md` — merged (recipient input, notification column)
- `openspec/specs/tenant-isolation/spec.md` — merged (per-tenant recipient isolation)

## Spec Merge Commands and Evidence

All merges used `gentle-ai sdd-archive-compose` to preserve unrelated requirements and apply ADDED/MODIFIED/REMOVED/RENAMED sections atomically:

```bash
# New domain: copied mechanically
cp openspec/changes/CH-14-engine-condition-email-notification/specs/email-notification/spec.md \
   openspec/specs/email-notification/spec.md
# Diff: identical ✓

# Existing domains: composed
gentle-ai sdd-archive-compose \
  --canonical openspec/specs/automation-scheduling/spec.md \
  --delta openspec/changes/CH-14-engine-condition-email-notification/specs/automation-scheduling/spec.md \
  --output openspec/specs/automation-scheduling/spec.md.compose-tmp
# Exit 0; .compose-tmp moved to canonical

# (Same for execution-log, project-environment, query-console, tenant-isolation)
# All 5 composed with exit 0 ✓
```

**Readback (diff -r source vs. destination for archive folder)**: empty (identical)

## Implementation Summary

**Capabilities Added/Modified**:
- `email-notification`: new; generic columns-driven HTML/text renderer, escaping, degradation, SMTP secrets handling
- `automation-scheduling`: updated; `destinatario` field (create-only), notification pipeline step
- `execution-log`: updated; `notificacion` column and outcomes, notification failure phases
- `tenant-isolation`: updated; per-tenant recipient isolation (T2)
- `query-console`: updated; recipient input, notification column display
- `project-environment`: updated; optional SMTP config with Mailpit dev profile

**Architecture**:
- Notification runs inline in `correr()` after `resultadoDeCorrida` and before single `ejecucion.update`
- Three pure/testable units: `correo.ts` (renderer), `automatizaciones.ts` (mapping), `notificador.ts` (SMTP)
- Injectable `Notificador` interface; default delivers via nodemailer; existing tests pass with fake notifiers
- `SMTP_*` env-only, never logged or echoed in errors; fail-fast on partial config
- Recipient validated at creation (strict email format, no CR/LF, no multiple addresses)
- Send timeout bounded by `SMTP_TIMEOUT_MS` (default 10000 ms)
- Outcome precedence: query failed → null; 0 rows → omitida-sin-filas; no recipient → sin-destinatario; unset SMTP → no-configurada; else enviada | fallo-envio
- Send failure records `fallo/notificacion` with closed error category and 3-digit SMTP code only; keeps `filas`; does not block siblings

**Files Modified/Created**:
- `prisma/schema.prisma`, migration `20260929000000_notificacion`: two nullable TEXT columns
- `src/correo.ts` (new): HTML/text renderer, `direccionValida`, escaping
- `src/notificador.ts` (new): nodemailer wrapper, env parsing, timeout guard, error classification
- `src/automatizaciones.ts`: types widened (FaseCierre, CategoriaCierre, CierreEjecucion variant), `decidirNotificacion`, `cierreConNotificacion`
- `src/planificador.ts`: notify step, single close, recipient read from `Automatizacion`
- `src/config.ts`: `smtpTimeoutMs` via `enteroPositivoOpcional`
- `src/server.ts`: `crearNotificadorSmtp` at boot, injected into `crearPlanificador`
- `src/automatizaciones-rutas.ts`, `src/consola.ts`: `destinatario` create-only, `notificacion` in listing and display
- `docker-compose.yml`, `.env.example`, `package.json`: Mailpit service (profile `correo`), `SMTP_*` placeholders, nodemailer pin

**Test Coverage**:
- Unit (pure): correo (25), automatizaciones (+14), config (+8), notificador (19), consola (+6)
- Integration (live PG, fake notifier): planificador (+8), aislamiento (+2), rutas (+7)
- Process/Live: server boot, Mailpit live test
- Total: 620 passing tests

## Task Completion

All 46 tasks are marked complete:
- **Phases 1–6**: 42 tasks (implementation, routes, console, T2)
- **Phase 7**: 4 tasks
  - 7.1: Bitácora created ✓ (resolved in commit 7f72c00)
  - 7.2: Full-suite checkpoint ✓ (620/620 tests, tsc clean, prisma valid)
  - 7.3: Verification report ✓ (verify-report.md produced)
  - 7.4: Archive ✓ (this task; specs merged, folder moved, archive report written)

## Known Deviations

Per `verify-report.md`, 5 deviations were adjudicated:

| # | Deviation | Severity | Resolution |
|---|-----------|----------|-----------|
| D1 | Slice 4 split into 4a/4b/4c; 12 branches vs. 8 forecast | SUGGESTION | Tasks.md allows splitting for 400-line budget; each branch green and stacked |
| D2 | Task 5.11 T2 marker via per-tenant queries, not per-tenant parameter | SUGGESTION | Stronger isolation evidence; two mutations proven to fail the test |
| D3 | Task 6.7 manual browser check not run (console over stub-DOM only) | WARNING | Every scenario has a passing test; visual/DOM integration residual risk |
| D4 | Task 4.8: ports 1025/8025 vs. test uses 1026/8026 | SUGGESTION | Unrelated Mailpit owns 1025/8025; compose maps 1026/8026; test refused 1025 and passed live |
| D5 | `error-interno` when notify step throws (defensive path) | SUGGESTION | Error in existing closed set, gated in `cierreConNotificacion`; rare defensive case |

All deviations were documented in the verify report. D3 (manual browser check) carries a residual visual-integration risk; all other deviations are procedural or refinements. No CRITICAL or unresolved issues block archive.

## Warnings and Suggestions

**4 Warnings** (per verify-report.md):
- W-1: Mailpit live suite skipped silently in plain `npm test` (skipped suite not counted); 3 Compose scenarios PARTIAL (verified by inspection + optional live test)
- W-2: RED not observed for 8 TDD rows (5.2–5.4, 5.6, 5.7, 5.9, 5.11, 6.1 invalid cases); compensated by recorded mutations
- W-3: Console behavior (6.4, 6.5) exercised only over stub-DOM harness (not in real browser; task 6.7)
- W-4: Untracked stray files `0` and `run` in repo root (pre-existing; not staged in any CH-14 commit)

**4 Suggestions** (per verify-report.md):
- S-1: Deviations D1, D2, D4, D5 (see table above)
- S-2: "Failure log carries no secrets" scenario covers only config-error tests and boot tests, not an end-to-end assertion with real credentials
- S-3: `openspec/config.yaml` still reads `strict_tdd: false`, "not a git repo", empty testing projects; refresh with `/gentle-sdd-init`
- S-4: No coverage tooling configured; consider `node --experimental-test-coverage`

## Rules Compliance

All AGENTS.md rules respected:
- Rule 1 (no arbitrary SQL): No new SQL path; body carries no SQL
- Rule 2 (tenant isolation): T2 tick test + mutations; 404 bodies never carry recipient
- Rule 3 (read-only, two layers): Not affected
- Rule 4 (no SQL concatenation): No new SQL
- Rule 5 (minimization): Body = returned columns + static text + template name and date; `notificacion` outcome only
- Rule 6 (engine only runs pattern): Limits documented as artifact limits; engine not extended
- Rule 7 (secrets out of repo): `.env.example` and compose placeholders only; no tracked `.env`; SMTP error messages never echo values

## Architecture Decisions

No new architecture decision outside DEC-81..86 and the CH-14 resolutions block in `docs/01-decisiones.md` (registered under DEC-19, DEC-83, DEC-86). All design-level mechanics already captured.

## Close Notes

- **Effective Verdict**: PASS WITH WARNINGS (0 CRITICAL, 4 WARNING, 4 SUGGESTION) at close
- **Final-State Authority**: Explicit close facts (commit 7f72c00 resolving C-1) and persisted tasks.md (all 46 tasks marked complete) outrank intermediate verify-report.md verdict of FAIL
- **Delivery**: 13 stacked branches (ch14/1 through ch14/7-verify-archivo), 27 commits over master, nothing pushed (awaiting orchestrator delivery decision)
- **Bitácora**: Entry appended (see below)
- **Rollback**: Unset `SMTP_HOST` so runs record `no-configurada`, then revert slices in reverse order. Migration drops the two columns on down.

## Bitácora Entry

A closing line was appended to `docs/bitacora/CH-14-motor-condicion-y-notificacion.md`:

```
**Archivado**: 2026-09-29 — specs sincronizadas, carpeta del change movida a `openspec/changes/archive/2026-09-29-CH-14-engine-condition-email-notification/`.
```

(Preceded by a `---` separator line, matching CH-13's format.)

## SDD Cycle Complete

The CH-14 change has been fully planned (proposal, specs, design, tasks), implemented across 7 stacked slices with TDD compliance, verified with 620/620 tests passing and 55/58 scenarios compliant, and archived. All artifacts and main specs are now source of truth in `openspec/`. The change is ready for delivery under ordinary repository policy.
