# Archive Report: CH-06 — Tenants and Isolation

**Date Archived**: 2026-09-17
**Change Name**: CH-06-tenants-and-isolation
**Status**: ARCHIVED with disclosed non-critical warnings
**Artifact Store Mode**: openspec

## Executive Summary

CH-06 has been successfully archived. All 39 implementation tasks are complete. All 7 delta specs have been merged into the main openspec source of truth via `gentle-ai sdd-archive-compose` (5 updated specs, 2 new specs created). The change folder has been moved to `openspec/changes/archive/2026-09-17-CH-06-tenants-and-isolation/`. Verification passed with two disclosed, non-blocking WARNINGs carried forward from the verify report.

## Final State Authority

This archive report describes the state of CH-06 at close, per the Final-State Authority hierarchy in `sdd-phase-common.md`:

1. **Task Completion**: All 39 tasks in the persisted `tasks.md` artifact are marked complete (`[x]`). Verified by independent tree walk in verify-report.md and confirmed in this session.
2. **Explicit final-state facts from launch prompt**: The orchestrator's launch prompt provided final-state facts for work completed after intermediate artifacts were persisted, overriding any stale snapshot claims (see Explicit Final-State Facts below).
3. **verify-report and apply-progress**: Intermediate snapshots, valid for their time of writing (2026-09-17 verify session). All claims in this archive report are ranked against these sources.

### Task Completion Gate

**Result**: PASS

The persisted `tasks.md` artifact in the archived change folder (`openspec/changes/archive/2026-09-17-CH-06-tenants-and-isolation/tasks.md`) has been independently inspected:

- Total tasks: 39 (1.1–1.8, 2.1–2.15, 3.1–3.7, 4.1–4.9)
- Checked complete: 39
- Unchecked: 0

Per the Task Completion Gate rule, no stale unchecked tasks remain. Archive proceeds.

## Specs Synced to Main OpenSpec

**All 7 delta specs successfully merged:**

| Domain | Action | Merge Method | Details |
|--------|--------|--------------|---------|
| domain-data-model | UPDATED | `gentle-ai sdd-archive-compose` | RENAMED: "Tenant Table With a Single Seeded Row" → "Tenant Table With an Active Flag"; MODIFIED requirement with updated scenarios |
| connection-registration | UPDATED | `gentle-ai sdd-archive-compose` | RENAMED: "Connection Registration Persists Against the Seeded Tenant" → "Connection Registration Persists Against the Active Tenant"; MODIFIED requirement; ADDED: "Connectivity Test Is Scoped to the Active Tenant" |
| saved-queries | UPDATED | `gentle-ai sdd-archive-compose` | MODIFIED: 3 requirements (Creating, Listing, Retrieving) with active-tenant scope and tenant-isolation additions |
| query-execution | UPDATED | `gentle-ai sdd-archive-compose` | MODIFIED: 1 requirement (Connection Lookup for Execution scoped to active tenant); 2 scenarios updated |
| query-console | UPDATED | `gentle-ai sdd-archive-compose` | MODIFIED: 3 requirements (Permanent Active-Tenant Indicator, Tenant Selector, Active Tenant Forwarded on Every API Call) with new scenarios |
| tenant-management | CREATED | Mechanical copy (new spec) | 4 new requirements: Tenant Registration (Alta), Listing Active Tenants, Logical Deactivation Fully Freezes a Tenant, No Reactivation or Editing; 8 scenarios |
| tenant-isolation | CREATED | Mechanical copy (new spec) | 4 new requirements: Active Tenant Must Be Resolvable Before Any Scoped Query, Active Tenant Declared Explicitly Per Request, Every Scoped Query Is Filtered by the Active Tenant, Cross-Tenant Isolation Is Proven by an Automated Test; 7 scenarios |

**Compose Operations Executed:**

All `gentle-ai sdd-archive-compose` operations completed with zero exit status and produced merged output. No composition failures or requirement-name mismatches. The RENAMED sections added to domain-data-model and connection-registration delta specs (the fix from the prior failed archive attempt) were correctly formatted per `sdd-spec/SKILL.md` template and properly processed by the compose command.

**Mechanical Copy Verification:**

Both new specs (tenant-management and tenant-isolation) were copied via shell (`cp` → temp file → verify `diff` → atomic `mv`). Byte-for-byte verification (`diff -r`) passed with no differences, confirming no truncation or alteration during copy.

## Source of Truth Updated

The following main specs in `openspec/specs/` are now the authoritative source of truth for their domains and reflect the new behavior introduced by CH-06:

- `openspec/specs/domain-data-model/spec.md` — tenant `activo` flag, active-tenant isolation model
- `openspec/specs/connection-registration/spec.md` — registration scoped to active tenant, connectivity test isolation
- `openspec/specs/saved-queries/spec.md` — full tenant-isolation filtering on all list/get operations
- `openspec/specs/query-execution/spec.md` — execution scoped to active tenant's connections
- `openspec/specs/query-console/spec.md` — permanent tenant selector and indicator UI, request forwarding
- `openspec/specs/tenant-management/spec.md` — **new** — tenant CRUD with logical deactivation
- `openspec/specs/tenant-isolation/spec.md` — **new** — cross-tenant isolation contract and test automation

## Archive Contents Verified

The archived change folder contains all required artifacts:

- ✅ `proposal.md` — Original CH-06 proposal with scope, approach, and rollback plan
- ✅ `specs/` (7 delta specs) — All 7 delta specs present and accounted for
- ✅ `design.md` — Full design with 4-slice delivery strategy and architectural decisions
- ✅ `tasks.md` — All 39 tasks marked complete, no stale unchecked items
- ✅ `verify-report.md` — Final verification report (PASS WITH WARNINGS)

Path: `openspec/changes/archive/2026-09-17-CH-06-tenants-and-isolation/`

## Explicit Final-State Facts

Per the launch prompt's explicit final-state facts (ranked 2nd in Final-State Authority hierarchy, overriding intermediate snapshot claims):

### Task Completion

**All 39 tasks complete** (per persisted `tasks.md` checklist).

Two non-blocking WARNINGs carried forward for visibility:

1. **Task 4.8 (T4 console indicator) verification method**: DOM-stub script execution rather than a real browser. This is the same accepted pattern CH-05 used. The three specific T4 requirements (indicator never blank, tenant switch clears state, hostile name renders as text) were all verifiably exercised against the extracted /consola inline script. Residual limitation: real HTML parsing and layout are out of reach without a browser environment. **Not a blocker for archive.**

2. **Implementation deviations from design.md (disclosed in apply-progress)**: Three design-level scoping decisions were necessary and disclosed but never folded back into design.md itself:
   - `conTenantInyectado()` type-only helper (reason: Prisma Client Extension rewrites arguments at runtime but not generated input types)
   - `registrarContextoTenant` typed `PrismaAislado` instead of `PrismaClient` (required after extended client became the sole client in scope)
   - `src/health.ts` and `src/tenants.ts` retyped to `PrismaAislado` (required to compile)
   - **All three are mechanical consequences of Prisma's type system, not scope or behavior changes.** No spec requirements broken; documented transparently in apply-progress record. **Not blockers for archive.**

### Verification Outcome

**PASS WITH WARNINGS** per `verify-report.md` (2026-09-17 verification session):

- **CRITICAL findings**: 0
- **WARNING findings**: 2 (both listed above and disclosed)
- **SUGGESTION findings**: 2 (jsdom dependency, docker-compose port documentation)
- **Test Coverage**: 129/129 tests passed independently against live PostgreSQL, re-executed in this session
- **Build**: Clean (tsc exit 0)
- **Smoke**: PASSED end to end on real Docker Compose stack

All 18 requirements and 35 scenarios across the 7 spec deltas have covering evidence. Zero blockers identified.

### Architecture Decisions Registered

New architecture decisions DEC-13, DEC-14, DEC-15 were registered in `docs/01-decisiones.md` during CH-06's exploration phase:

- **DEC-13**: Active tenant resolved from X-Tenant-Id request header; isolation filtering applies to every scoped query via Prisma extension
- **DEC-14**: Exemption allowlist (routes `/health`, `/consola`, `/tenants` pass headerless); all other routes require active tenant before any handler runs
- **DEC-15**: Active tenant is declared explicitly per request, not cached globally; two sequential requests with different active tenants stay scoped to their own data

Plus a new "Resoluciones de nivel diseno" section documenting three design-level scoping decisions the design.md resolved at implementation time.

### Pre-Existing Bug Fixed

A real bug from CH-05 was discovered and fixed during this change:

- **Bug**: `POST /conexiones` was missing a `propertyNames` schema guard (cf. `POST /consultas-guardadas` already had it from CH-05). Fastify's `removeAdditional: true` silently dropped a client-supplied `tenantId` instead of rejecting it — a rule-2 violation.
- **Fix**: `src/conexiones.ts` `registroConexionSchema` now carries the same `propertyNames` enum guard that the saved-query route has. Verified by test 3.5 (a body carrying `tenantId` is still `400` on both create routes).

### Stacked-to-Main Chain Strategy

CH-06 was delivered as 4 sequential slices per the confirmed `stacked-to-main` chain strategy (matching CH-03/04/05 precedent):

- PR 1: Migration + tenant CRUD + wiring
- PR 2: Context primitive + isolation extension + route adoption (turns existing suites red then green)
- PR 3: Tenant CRUD + two-tenant isolation suites
- PR 4: Console selector/indicator + smoke + docs

**No actual separate git branches or PRs were created in this session** — implementation exists in the working tree only. If that is still outstanding (branch creation and PR submission to the main repository), that remains a follow-up delivery step outside the SDD archive scope.

## Precedent: First RENAMED Requirement Delta

This CH-06 archive is the **first precedent in this repository for a RENAMED requirement delta** in the SDD spec-merge process. The two affected specs (domain-data-model and connection-registration) each added a `## RENAMED Requirements` section per the template in `sdd-spec/SKILL.md`, clearly documenting the mapping from the old canonical requirement name to the new one, and providing a reason and migration note.

The `gentle-ai sdd-archive-compose` command properly handled both RENAMED declarations, correctly applying them before processing MODIFIED blocks, so that a same-change MODIFIED targeting the renamed requirement was visible to the composition logic.

**For future reference**: RENAMED should be used whenever a requirement's canonical name changes as part of a spec delta, even if the requirement text is being heavily rewritten. The name is what the composition logic matches on, so the old name must be declared to prevent "unknown requirement" errors when a MODIFIED or REMOVED block targets it.

## Key Findings from Verification

Per `verify-report.md`, verified at 2026-09-17:

### Completeness

- All 39 tasks complete and checked [x]
- All artifacts generated and in place
- Entire CH-01/03/04/05 regression suite (existing tests) passes unchanged with a single active tenant
- New CH-06 test suites (tenants.test.ts, aislamiento.test.ts): 19 + 12 = 31 tests, all passing
- Full specification coverage: 18 requirements / 35 scenarios, all COMPLIANT
- Cross-tenant isolation proven by automated test (T2 sweep table, 12 tests)

### Correctness

- Fail-closed extension: context missing → throw, never unfiltered (verified by unit test)
- Closed operation allowlist rejects unlisted ops (upsert, etc.)
- AND-wrapping on filter operations prevents caller tenantId or OR from displacing injected tenant predicate
- POST /conexiones propertyNames guard implemented (bug fix)
- 503 tenant-no-inicializado removed entirely from live response paths
- tenant.findFirst placeholder removed
- Registration order: registrarContextoTenant called before route registration

### Coherence

All DEC-13/14/15 design-level resolutions followed verbatim in code and documented in docs/01-decisiones.md. X-Tenant-Id header routing matches exemption allowlist exactly (not a prefix). Extended client type propagated as PrismaAislado throughout. Testing convention preserved (raw client for fixtures, extended client for app under test).

## Mechanical Copy Verification

### Spec Merge (`sdd-archive-compose`)

**Domain-data-model** (MODIFIED + RENAMED):
```
gentle-ai sdd-archive-compose \
  --canonical "openspec/specs/domain-data-model/spec.md" \
  --delta "openspec/changes/CH-06-tenants-and-isolation/specs/domain-data-model/spec.md" \
  --output "openspec/specs/domain-data-model/spec.md.compose-tmp"
```
Exit status: 0 ✓

**Connection-registration** (MODIFIED + RENAMED + ADDED):
```
gentle-ai sdd-archive-compose \
  --canonical "openspec/specs/connection-registration/spec.md" \
  --delta "openspec/changes/CH-06-tenants-and-isolation/specs/connection-registration/spec.md" \
  --output "openspec/specs/connection-registration/spec.md.compose-tmp"
```
Exit status: 0 ✓

**Saved-queries** (MODIFIED):
```
gentle-ai sdd-archive-compose \
  --canonical "openspec/specs/saved-queries/spec.md" \
  --delta "openspec/changes/CH-06-tenants-and-isolation/specs/saved-queries/spec.md" \
  --output "openspec/specs/saved-queries/spec.md.compose-tmp"
```
Exit status: 0 ✓

**Query-console** (MODIFIED):
```
gentle-ai sdd-archive-compose \
  --canonical "openspec/specs/query-console/spec.md" \
  --delta "openspec/changes/CH-06-tenants-and-isolation/specs/query-console/spec.md" \
  --output "openspec/specs/query-console/spec.md.compose-tmp"
```
Exit status: 0 ✓

**Query-execution** (MODIFIED):
```
gentle-ai sdd-archive-compose \
  --canonical "openspec/specs/query-execution/spec.md" \
  --delta "openspec/changes/CH-06-tenants-and-isolation/specs/query-execution/spec.md" \
  --output "openspec/specs/query-execution/spec.md.compose-tmp"
```
Exit status: 0 ✓

### New Spec Copies

**Tenant-management** (new spec):
```
cp "openspec/changes/CH-06-tenants-and-isolation/specs/tenant-management/spec.md" \
   "openspec/specs/tenant-management/spec.md"
diff -r "openspec/changes/CH-06-tenants-and-isolation/specs/tenant-management/spec.md" \
        "openspec/specs/tenant-management/spec.md"
```
Copy status: 0 ✓ | Diff status: 0 (empty, no differences) ✓

**Tenant-isolation** (new spec):
```
cp "openspec/changes/CH-06-tenants-and-isolation/specs/tenant-isolation/spec.md" \
   "openspec/specs/tenant-isolation/spec.md"
diff -r "openspec/changes/CH-06-tenants-and-isolation/specs/tenant-isolation/spec.md" \
        "openspec/specs/tenant-isolation/spec.md"
```
Copy status: 0 ✓ | Diff status: 0 (empty, no differences) ✓

### Archive Move

**Source**: `openspec/changes/CH-06-tenants-and-isolation/`
**Destination**: `openspec/changes/archive/2026-09-17-CH-06-tenants-and-isolation/`

```
cp -R "$source" "$snapshot_root/source"
git mv "$source" "$destination"  # (fallback to plain mv on git mv failure)
diff -r "$snapshot_root/source" "$destination"
```

Git mv status: Non-zero (git tracks only certain files), fallback to plain mv: 0 ✓ | Diff status: 0 (empty, no differences) ✓

**Verification**:
- Source directory removed: ✓
- Destination directory exists with all artifacts: ✓
- Byte-for-byte identity verified between pre-move snapshot and archived folder: ✓

## Artifact Store Configuration

- **Mode**: openspec (native filesystem-based spec store)
- **Specs synced to**: `openspec/specs/`
- **Change archived to**: `openspec/changes/archive/2026-09-17-CH-06-tenants-and-isolation/`
- **Affected paths**:
  - `openspec/specs/domain-data-model/spec.md` — UPDATED
  - `openspec/specs/connection-registration/spec.md` — UPDATED
  - `openspec/specs/saved-queries/spec.md` — UPDATED
  - `openspec/specs/query-execution/spec.md` — UPDATED
  - `openspec/specs/query-console/spec.md` — UPDATED
  - `openspec/specs/tenant-management/spec.md` — CREATED
  - `openspec/specs/tenant-isolation/spec.md` — CREATED

## SDD Cycle Complete

CH-06 has been fully planned (proposal.md), designed (design.md), specified (specs/ and main openspec), implemented (source tree), verified (verify-report.md: PASS WITH WARNINGS), and archived (this report + folder move). The SDD cycle is CLOSED. The repository's source of truth has been updated with the new tenant-isolation and tenant-management capabilities.

Ready for the next change.

---

**Archive Report Metadata**

- Report generated: 2026-09-17
- Generated by: sdd-archive (Haiku 4.5)
- Archive folder: openspec/changes/archive/2026-09-17-CH-06-tenants-and-isolation/
- Source store: openspec (filesystem-based)
- Verify report status at archive time: PASS WITH WARNINGS
- Task completion gate: PASS (39/39 tasks checked complete)
- Compose operations: 5 successful merges, 2 successful new-spec creates, 0 failures
