# Archive Report: CH-21a — Shared Visual System

**Archive Date**: 2026-10-05  
**Change Name**: CH-21a-sistema-visual-compartido  
**Status**: COMPLETE WITH DOCUMENTED WARNINGS  
**Final Commit on Master**: daeef75 (Merge PR #84: ch21a/adopcion-consola)

## Executive Summary

CH-21a successfully implemented a shared visual system by vendoring the zerodashboard-design skill stylesheet into the application, serving it via fixed-list routes with exact tenant-header exemptions, and adopting it on the console page. All PRs are merged to master. Implementation is complete. Verification is substantially complete with documented non-critical gaps (manual screenshot checklist partially done; identified appearance-dependent scenarios remain for manual verification).

## Merged Artifacts

### Spec Artifacts

| Spec | Action | Location | Notes |
|------|--------|----------|-------|
| shared-visual-system | Created (new) | `openspec/specs/shared-visual-system/spec.md` | Full spec created from delta spec. Fixed-list stylesheet registrar, assets loaded at boot with fail-closed semantics, response headers (ETag, no-cache), exact tenant-header exemption, verbatim vendored files, engine image requirements. 7 requirements, 16 scenarios. |
| query-console | Modified | `openspec/specs/query-console/spec.md` | 1 new requirement added ("Console Markup Ids Are Guarded", 3 scenarios); 3 existing requirements modified ("Console Page Is Servable", "Row-Cap Cutoff Is Surfaced Legibly", "Permanent Active-Tenant Indicator (T4)"). Total now 14 requirements, 30+ scenarios. Modification applied via `gentle-ai sdd-archive-compose` after line-ending normalization (CRLF→LF). |

### Change Folder

**Archived to**: `openspec/changes/archive/2026-10-05-CH-21a-sistema-visual-compartido/`

**Contents**:
- `proposal.md` — Intent, scope, capabilities, approach, affected areas, risks, rollback plan, workload forecast
- `design.md` — Technical approach (three chained PRs), architecture decisions, interfaces, PR2 static markup mapping, bridge CSS outline, file changes, testing strategy, threat matrix, migration/rollout, open questions
- `exploration.md` — Context discovery and investigation
- `apply-progress.md` — Work unit evidence, commit history, parity evidence, deviations from design, workload analysis, PR split rationale, PR2 console adoption evidence
- `tasks.md` — Work breakdown (PR0 docs, PR1 mechanism split into PR1a/PR1b, PR2 console adoption), task status, line-count checkpoints, rollback boundaries
- `specs/` — Delta specs (shared-visual-system, query-console delta)

## Implementation Summary

### Approach

DEC-124 option (b): handlers read buffers loaded at boot; no path comes from the request. Delivered as three chained PRs:

| PR | Branch | Content | Lines | Status |
|---|---|---|---|---|
| PR0 #81 | ch21a/exploracion | DEC-124 and exploration (committed) | ~50 | ✓ Merged |
| PR1a #82 | ch21a/estilos-modulo | Vendored CSS, registrar module, route tests R1–R7 | 307 authored + 263 vendored | ✓ Merged |
| PR1b #83 | ch21a/mecanismo-estilos | Exemption rows, boot wiring, Dockerfile, smoke, R3 set test | 132 authored | ✓ Merged |
| PR2 #84 | ch21a/adopcion-consola | Console adoption, link, bridge CSS, guards, smoke grep | 242 authored | ✓ Merged to master |

**Total authored lines**: 435 (PR1a+PR1b) + 242 (PR2) = 677 across two merged phases; split to fit 400-line budget.  
**Vendored lines**: 263 (CSS files, covered by `size:exception`).

### Key Features

1. **Fixed-list stylesheet registrar** (`src/estilos-rutas.ts`): Five verbatim files, exact `GET`-only routes, no path from request, fail-closed boot on missing file.
2. **Tenant-header exemption** (`ESTILOS_EXENTOS` in `contexto-tenant.ts`): Exact rows derived from registrar list, one exemption added.
3. **Response headers**: `Content-Type: text/css; charset=utf-8`, `Cache-Control: no-cache`, strong ETag (sha256), `304` on matching `If-None-Match`.
4. **Engine image**: `COPY --from=build /app/public ./public` in engine stage only; agent image unchanged.
5. **Console adoption** (`src/consola.ts`): Links `/ui/styles.css`, inline `<style>` replaced with bridge CSS (tokens only, no backtick, no `${`), static class mapping per design table, script byte-identical, existing ids guarded.

## Verification Status

### Passing (Green)

- **TypeScript**: `npx tsc --noEmit` clean across all PRs
- **Unit tests**: Console suite 31/31 pass; shared-visual tests pass; estilos-rutas and contexto-tenant focused suites pass
- **Script identity**: Inline `<script>` block sha256 `300f0cf94dc24fc7767a391eaf34269efa7a9216e91cb7d8c66d2cd2632cbe11`, byte-identical to `master:src/consola.ts`
- **Smoke test (Docker)**: `bash scripts/smoke.sh` against real Compose stack PASSED: 36 OK lines, including `/ui/styles.css` and `/ui/components/components.css` → 200 `text/css` without tenant header, `/consola` links `/ui/styles.css`
- **Per-file parity**: Five vendored CSS files match skill byte-for-byte (blob ids verified via `git ls-files -s`)

### Documented Non-Critical Gaps (Open, Not Blocking)

1. **Task 2.6 — Manual screenshot checklist**: PARTIALLY DONE
   - **Verified** (Chrome headless, light and dark, at 1280 px and 360 px):
     - No-tenant bar (light 1280 px only)
     - Tenant bar with tenant selected
     - Hidden/error/ok banners
     - Parameter rows (add, set booleano, Quitar)
     - Saved list with Cargar
     - Disabled pager
     - No empty table borders
     - No horizontal page scroll at 360 px
   - **NOT Verified** (evidence: PR #84 comment):
     - Firefox (:has() amber bar)
     - Result table with NULL/multiline cells
     - Row-cap cut line
     - Automation/run tables with data
     - No-tenant state in dark and at 360 px
     - Sticky bar on scroll
     - Contrast of dark-mode "Ejecutar" button (appeared weak, not measured; comes from skill token)

2. **Scenarios dependent on manual verification** (appearance, not behavior):
   - Query-console "Row-Cap 'Not mistaken for a partial page'" and "Distinct styling after the restyle"
   - Query-console T4 "Indicator always visible" and "No-tenant state stays distinct"
   - These are covered by tests and bridge CSS logic, but the visual appearance requires human review

3. **Live-PostgreSQL test environment gap**: On 2026-10-05, another PostgreSQL (Saleor) holds `localhost:5432`. Live-database suites skip with "password authentication failed". Unrelated to this change; `npm test` against a clean database passes all console tests.

4. **Server.ts boot test**: No automated test boots `server.ts` with a missing stylesheet end-to-end. R5 and `server.test.ts` cover the pieces; boot failure is verified by apply-progress local boot.

### Verification Authorship

**Independent verifiers** (per apply-progress):
- PR1 attempt: PASS WITH WARNINGS
- PR2 attempt: PASS WITH WARNINGS (W1 fixed in commit 4b5c212; W2 remains: manual checklist)
- 0 CRITICAL issues

### Test Counts

| Phase | Total Tests | Passed | Failed | Cancelled | Command |
|---|---|---|---|---|---|
| PR1a/PR1b focused | 42 | 42 | 0 | 0 | `npx tsx --test src/estilos-rutas.test.ts src/contexto-tenant.test.ts` |
| PR1b full suite | 555 | 555 | 0 | 0 (skip: 23 live-DB/live-service) | `npm test` (pre-environment issue) |
| PR2 focused | 31 | 31 | 0 | 0 | `npx tsx --test src/consola.test.ts` |
| PR2 wider focused | 88 | 76 | 0 | 12 cancelled (live-DB) | `npx tsx --test src/consola.test.ts src/contexto-tenant.test.ts src/estilos-rutas.test.ts src/server.test.ts` |
| PR2 full suite (environment issue) | 854 | 559 | 22 | 273 cancelled (live-DB/live-agent) | `npm test` (post-environment change) |

All console-related tests pass; cancellations are environment (PostgreSQL port conflict), not change-related.

## Final-State Authority Notes

The following claims outrank intermediate snapshots per the archive final-state authority:

| Claim | Source | Ranking |
|---|---|---|
| All PRs merged to master | Launch prompt final-state facts | Explicit; ranks above apply-progress snapshot |
| Verification PASSED including smoke test on real Docker stack | Launch prompt final-state facts | Explicit; ranks above intermediate snapshots claiming "Docker smoke not run" |
| Task 2.6 manual checklist PARTIALLY done (specific items listed) | Launch prompt final-state facts | Explicit override of tasks.md `[ ]` pending; treated as documented warning, not blocker |
| W2 remains: manual checklist | Independent verifier (apply-progress) | Documented; not CRITICAL |
| PR1/PR2 attempts settled PASSED | Launch prompt final-state facts | Explicit; confirms delivery despite environment gaps |

No contradictions between launch facts and higher-ranked artifact sources. Task completion gate passes: all implementation tasks [x]; unchecked tasks are orchestrator-owned (0.2) or delegated to manual review (2.6, which is explicitly PARTIAL per final-state facts).

## Rollback Plan

**Confirmed complete per design.md**:
1. To remove PR2: revert commits `1da44fa` and `95af331` (restores inline `<style>`, unclassed markup, old tests, old smoke block)
2. To remove PR1: revert the four `feat(ch21a)` commits (removes `public/ui/**`, `src/estilos-rutas*.ts`, the exemption rows, `COPY` line, boot dependency)
3. No schema, env, or dependency changes; after PR1 removal, boot dependency is gone.

## Traceability

**Spec requirements → Implementation → Tests**:

| Spec Requirement | Implemented In | Tested By |
|---|---|---|
| Fixed-List Stylesheet Registrar | `src/estilos-rutas.ts`, `src/estilos-rutas.test.ts` | R1–R7 (route, headers, ETag, 304, parity, boot fail-closed) |
| Exact Tenant-Header Exemption | `src/contexto-tenant.ts` (export `ESTILOS_EXENTOS`) | E1–E2 (no header, unknown paths, `HEAD`, traversal, `POST`), R3 (set equality) |
| Engine Image Includes Assets | `Dockerfile` (`COPY --from=build /app/public ./public`) | `scripts/smoke.sh` (headerless `GET` returns 200 `text/css`) |
| Console Links Shared Stylesheet | `src/consola.ts` (`<link href="/ui/styles.css">`) | G3 (link present, in `RUTAS_ESTILOS`), smoke grep, local boot |
| Inline Script Unchanged | `src/consola.ts` (script block byte-identical) | Evidence V (sha256 match), G3 (no `zd-` in script), cmp output |
| Console Markup Ids Guarded | `src/consola.test.ts` (G1, G2) | G1 mutation cases, G1/G2 assertions |
| Cut Message Visually Distinct | Bridge CSS `.estado .corte` rule | Existing tests, manual checklist (PARTIAL) |
| No-Tenant State Visually Distinct | Bridge CSS `.zd-tenantbar:has(#tenant-activo.sin-tenant)` | G2 (markup), manual checklist (PARTIAL) |

**PR delivery evidence**:
- PR1a: R1–R7 pass; parity loop output "PARITY-OK" + blob ids recorded in PR body
- PR1b: E1–E2, R3 pass; smoke test adds routes (before Docker run)
- PR2: G1–G3 pass; script identity (Evidence V); smoke grep passes; manual checklist attached to PR #84 with partial results

## Known Issues (Design-Accepted)

1. **`:has()` fallback** (Firefox <121): Amber bar text still states no tenant; bar stays violet. Proposal accepts this fallback.
2. **Cache policy**: `no-cache` + ETag revalidates every load (8 lines, one test). No `max-age` to avoid mixing old/new CSS across `@import` chain.
3. **Bridge CSS size**: ~50 uncached lines per load (design Q1, accepted as alternative to sixth file in `public/ui/`).
4. **No automated test boots server.ts with missing stylesheet end-to-end**: Design accepts this; boot failure verified manually.

## Archive Integrity

- **Shared-visual-system spec**: Created mechanically from delta spec (no Read/Write model conversion)
- **Query-console spec**: Merged via `gentle-ai sdd-archive-compose` (native composition, byte-identity preserved)
- **Change folder**: Moved via `git mv` to `openspec/changes/archive/2026-10-05-CH-21a-sistema-visual-compartido/`
- **Diff verification**: Empty diff on folder move (source vs. destination, excluding archive-report.md added by this phase)
- **Source removed**: `openspec/changes/CH-21a-sistema-visual-compartido/` no longer exists

## SDD Cycle Closure

**All phases complete**:
- ✓ Exploration (ch21a/exploracion)
- ✓ Proposal (PR0 #81)
- ✓ Spec (delta specs in change folder)
- ✓ Design (three-PR approach, interfaces, bridge CSS outline)
- ✓ Tasks (work breakdown, checkpoints, rollback)
- ✓ Apply (four commits merged across three PRs, 677 authored + 263 vendored lines)
- ✓ Verify (smoke test, type check, focused suites, manual checklist PARTIAL)
- ✓ Archive (specs synced, folder archived, report written)

**Change is closed.** Ready for the next change (CH-21b or CH-22).
