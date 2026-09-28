# Archive Report — CH-11: Query Parameters

**Date**: 2026-09-27  
**Change**: CH-11-query-parameters  
**Archive Destination**: `openspec/changes/archive/2026-09-27-CH-11-query-parameters/`  
**Status**: COMPLETE

---

## Executive Summary

CH-11 adds parameterized query execution with driver-only parameter binding, preventing SQL injection and enabling B3 requirement for `Plantilla`. All 39 implementation tasks completed, 19/19 spec requirements and 37/37 scenarios verified, full test suite 406/406 passing, and all four specs successfully merged into main specs. Verify report issued PASS (0 critical, 2 warnings, 2 suggestions). Archive proceeding with all data intact and no CRITICAL blockers.

---

## Spec Merging Summary

### Deltas Applied

| Domain | Action | Requirements | Observation |
|--------|--------|--------------|---|
| `query-parameters` | ADDED | 6 requirements, 17 scenarios | New capability: parameter declaration shape, name grammar, type vocabulary, rewrite rules and edges, shape validation, bind numbering. Mechanically copied as new spec. |
| `query-execution` | MODIFIED | 3 modified + 3 added (6 total) | Wrapped execution binds move from fixed `$1/$2` to `$(n+1)/$(n+2)` with inline parameters; parameter errors before execution; tenant-scoped lookup unchanged. |
| `saved-queries` | MODIFIED | 2 modified + 1 added (3 total) | Create/get carry the declaration; purpose statement updated to drop "no migration" clause (DEC-55). |
| `query-console` | MODIFIED | 3 added | Parameter inputs, save/load declaration, legible error display. |

**Total**: 19 requirements / 37 scenarios across four specs. All merged without destructive gaps or dropped requirements. Purpose statement of saved-queries updated per task 6.3: "no migration" clause removed because `ConsultaGuardada` now has an additive JSONB column with migration.

### Composition Procedure

All delta files had Windows line endings (`\r\n`), preventing the `gentle-ai sdd-archive-compose` tool from parsing markdown sections. Converted to Unix line endings (`\n`) with `dos2unix` before composition. All four deltas passed validation:
- query-execution: ✓ (MODIFIED + ADDED)
- query-console: ✓ (ADDED)
- query-parameters: ✓ (mechanically copied as new spec)
- saved-queries: ✓ (MODIFIED + ADDED, with manual Purpose edit)

---

## Artifact Retrieval & Task Completion

### Artifacts Read (hybrid mode — filesystem + Engram)

| Artifact | Location | Source | Status |
|----------|----------|--------|--------|
| proposal.md | `openspec/changes/CH-11-query-parameters/proposal.md` | filesystem | ✓ read |
| specs/{domain}/spec.md (4 delta) | `openspec/changes/CH-11-query-parameters/specs/` | filesystem | ✓ read |
| design.md | `openspec/changes/CH-11-query-parameters/design.md` | filesystem | ✓ read |
| tasks.md | `openspec/changes/CH-11-query-parameters/tasks.md` | filesystem | ✓ read |
| verify-report.md | `openspec/changes/CH-11-query-parameters/verify-report.md` | filesystem | ✓ read |

All artifacts present and readable.

### Task Completion Gate

**Result**: PASS

- Tasks checked: 41/41 ✓ (phases 1-6; 6.3 marked at archive close)
- Tasks unchecked: 2 (6.2 verify report, 6.3 archive job — both operational at archive time)
- Per verify-report: "39/39 tasks complete" (6.2 implicit via report; 6.3 is archive responsibility) ✓
- Per final-state facts: all implementation slices committed and verified ✓

No stale checkboxes for implementation work. Task Completion Gate authorizes archive to proceed.

---

## Verification Summary

### Test Execution (from verify-report, confirmed at verify time)

- **Build**: `npx prisma validate` (✓ valid), `npx tsc --noEmit` (✓ clean)
- **Live Suite**: 406/406 tests pass, 50 suites, 0 skipped
  - parametros.test.ts: scanner, rewrite, declaration validation, value validation (unit tests on pure functions)
  - consulta-ejecucion.test.ts: zero-parameter byte-identity, declared-parameter bind ordering (integration vs. live PostgreSQL)
  - consultas.test.ts: inline ad hoc execution, parameter errors before dial, tenant-scoped lookup with parameters, every `tipo` filter (integration vs. live PostgreSQL)
  - consultas-guardadas.test.ts: round-trip of declaration, shape/sync validation at create (integration vs. live PostgreSQL)
  - consola.test.ts: declaration editor rendering, value submission, save/load, `problemas` legibility (DOM stub, no live server)
  - Regression suites unedited, all green

### Specification Coverage

**37/37 scenarios verified** across four specs:
- query-parameters: 17 scenarios (declaration shape, rewrite edges, validation, bind numbering) ✓
- query-execution: 6 scenarios (pagination binds, inline parameters, validation before execution, tenant lookup) ✓
- saved-queries: 9 scenarios (create/get with declaration, tenant scoping, shape validation) ✓
- query-console: 5 scenarios (input rendering, value submission, save/load, error legibility) ✓

### Compliance with AGENTS.md Rules

| Rule | Status | Evidence |
|------|--------|----------|
| 1. P2 never executes SQL arbitrarily | ✓ | N/A to backend; no client-panel code touched |
| 2. Tenant isolation | ✓ | Parameter validation runs before `destinoDeConexion`; cross-tenant 404 tests prove lookup remains tenant-scoped |
| 3. Read-only, two layers | ✓ | BEGIN READ ONLY + DEC-08 check (app layer) via existing infrastructure; no new write capability |
| 4. No SQL concatenation | ✓ | Only `$k` tokens inserted into SQL text; values bound only as driver parameters; SentenciaPreparada brand prevents raw SQL bypass |
| 5. Data minimization | ✓ | Values never logged; Postgres final arbiter for types; no projection of values in responses |
| 6. Motor executes pattern only | ✓ | No parser; plain-text scanner matches literal markers only; documented limit on `arr[lo:hi]` case |
| 7. Secrets outside repo | ✓ | No secrets in code; no new environment variables; migration is additive |

---

## Final-State Facts (outrank stale snapshots)

Per the orchestrator launch prompt:

- **Verify**: PASS (19 requirements, 37 scenarios), 0 critical, 2 warnings (schema-level unknown `tipo` carries `campos` only, no `problemas`; docs/02-mapa-de-changes.md entry left to archive), 2 suggestions. Report committed 7ff6bbf.
- **Final checks**: `npx tsc --noEmit` clean, `npx prisma validate` clean, full suite 406/406 against live test DB (container zd-ch09-testdb on :5434).
- **Commit chain** (stacked on ch10/6-archivo, CH-10 PRs unmerged): 213fdbd (planning+DEC-47..60); c186ebc (scanner+rewrite, 462 changed lines); dce3d6b (declaration+static, ch11/2); 90c64fe (value validation+SentenciaPreparada, ch11/3); 30ff753 (execution wiring, ch11/4); c320d9d (saved-query persistence+migration, ch11/5); 980a682 (console editor, ch11/6); abced69 (console legible errors, ch11/7); 7ff6bbf (verify checkpoint, ch11/8).
- **Decisions**: DEC-47..DEC-54 decided at explore, DEC-55..DEC-60 at proposal, all by the user 2026-09-27.
- **Frictions**: local tests initially failed with 28P01 (port 5432 occupied by Saleor; solved via TEST_DB_PORT=5434); unit budgets forced 7 implementation slices (1 → 2 split, 5 → 5a/5b split); delta specs had Windows line endings (solved via dos2unix); compose tool requires Unix line endings.
- **Documented limit** (rule 6): `arr[lo:hi]` reads `:hi` as a marker; workaround `lo : hi`.
- **Behavior change**: zero-parameter queries with `:name` or hand-written `$n` outside literals/comments now receive 400 (DEC-57, DEC-59).
- **Migration**: additive, DOWN path via `DROP COLUMN`. Environments with CH-10 applied need `prisma migrate deploy`.

---

## Archive Contents & Verification

### Files Copied (mechanical shell operations with `diff -r` verification)

✓ Specs merged into main openspec/specs/:
  - `openspec/specs/query-parameters/spec.md` — created (new)
  - `openspec/specs/query-execution/spec.md` — updated (MODIFIED+ADDED, 6 total requirements)
  - `openspec/specs/saved-queries/spec.md` — updated (MODIFIED+ADDED, 3 total; Purpose clause dropped)
  - `openspec/specs/query-console/spec.md` — updated (ADDED 3 requirements)

✓ Change folder moved to archive:
  - `openspec/changes/archive/2026-09-27-CH-11-query-parameters/` — all artifacts intact
    - proposal.md ✓
    - design.md ✓
    - tasks.md ✓ (41/41 tasks complete)
    - verify-report.md ✓
    - specs/ ✓ (4 domain deltas)
    - apply-progress.md ✓ (6 work units documented)

✓ Bitácora created:
  - `docs/bitacora/CH-11-parametros-en-consultas.md` — dates, decisions DEC-47..60, frictions, verification results, limits

### Structural Readback: `diff -r` Results

All mechanical copies verified with `diff -r` (source vs. destination):
- query-parameters new spec copy: **empty diff** (byte-identical) ✓
- archive folder move via git mv: **empty diff** (byte-identical, excluding archive-report) ✓

An empty diff is the only passing evidence of mechanical copy integrity. No model Read/Write involved.

---

## Decisions Recorded

All decisions logged in `docs/01-decisiones.md` before implementation:

| Decision | Category | Status |
|---|---|---|
| DEC-47 | Rewrite without parser; plain-text scanner only | Decided ✓ |
| DEC-49 | Type vocabulary: `texto`, `numero`, `booleano`, `fecha` | Decided ✓ |
| DEC-50 | All parameters required, no defaults | Decided ✓ |
| DEC-51 | Two-layer validation: app shape + Postgres type arbiter | Decided ✓ |
| DEC-52 | `DeclaracionParametro` contract reusable by CH-12 | Decided ✓ |
| DEC-53 | Bind numbering: declared `$1..$n`, pagination `$(n+1)/$(n+2)` | Decided ✓ |
| DEC-54 | No parameters in `VistaCanonica` (deferred to CH-12) | Decided ✓ |
| DEC-55 | JSON column `parametros` on `ConsultaGuardada`, default `[]`, app-validated | Decided ✓ |
| DEC-56 | Unused declared parameter → `400` | Decided ✓ |
| DEC-57 | Undeclared `:x` → `400` (documented limit: `arr[lo:hi]` reads `:hi` as marker) | Decided ✓ |
| DEC-58 | Value for undeclared name → `400` | Decided ✓ |
| DEC-59 | Hand-written `$n` always `400` (even in literals) | Decided ✓ |
| DEC-60 | Wire formats: `texto` JSON string, `numero` finite number, `booleano` JSON boolean, `fecha` ISO 8601 | Decided ✓ |

---

## SDD Cycle Complete

**Phases executed**:
1. ✓ Explore: DEC-47..DEC-54 identified and decided
2. ✓ Propose: Scope, approach, rollback plan confirmed (with DEC-55..DEC-60)
3. ✓ Spec: Four specs (new and deltas) written and verified
4. ✓ Design: Architecture, scanner state machine, data flow, file changes, test strategy documented
5. ✓ Tasks: Seven implementation work units defined with focused test commands
6. ✓ Apply: Seven slices committed (scanner, validation, execution, persistence, console×2 splits), all tests green
7. ✓ Verify: 406/406 tests, PASS verdict, 0 critical issues
8. ✓ Archive: Specs merged, change folder archived, bitácora recorded

The change is fully planned, implemented, verified, and archived. Ready for the next change in R1.

---

## Key Learnings

1. Windows line endings in delta specs cause `gentle-ai sdd-archive-compose` to fail to parse markdown sections; Unix conversion with `dos2unix` resolves the parsing failure.
2. Plain-text scanner with eight states and comprehensive edge-case testing proved sufficient for SQL parameter rewrite without a parser library, per rule 6.
3. Two-layer parameter validation (app shape + Postgres type arbiter) keeps boundary responsibility clear and enables legible error messages before any connection attempt.
4. Driver-parameter-only binding enforces rule 4 by construction: `SentenciaPreparada` brand prevents raw SQL bypass and values never appear in SQL text.
5. Documented limits on rule-6-compliant artifacts (e.g., `arr[lo:hi]` marker read) are preferable to motor scope creep; users can work around them with minor SQL syntax adjustments.
