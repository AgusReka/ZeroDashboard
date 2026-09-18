# Archive Report: CH-07 — Credential Encryption and Query Limits

**Date Archived**: 2026-09-18
**Change Name**: CH-07-credential-encryption-and-query-limits
**Status**: ARCHIVED with disclosed non-critical warnings
**Artifact Store Mode**: hybrid (openspec + Engram)

## Executive Summary

CH-07 has been successfully archived. All 27 implementation tasks are complete. All 4 delta specs have been merged into the main openspec source of truth: 1 new spec (credential-encryption) was created, and 3 existing specs (connection-registration, query-execution, query-console) were merged via `gentle-ai sdd-archive-compose`. The change folder has been moved to `openspec/changes/archive/2026-09-18-CH-07-credential-encryption-and-query-limits/`. Verification passed with three disclosed, non-blocking WARNINGs.

## Final State Authority

This archive report describes the state of CH-07 at close, per the Final-State Authority hierarchy in `sdd-phase-common.md`:

1. **Task Completion**: All 27 tasks in the persisted `tasks.md` artifact are marked complete (`[x]`). Verified by independent inspection in this session.
2. **Explicit final-state facts from launch prompt**: The orchestrator's launch prompt explicitly confirmed that the verify session completed `npm run smoke` for the first time against the real Docker Compose stack, closing a gap the apply session had left open. This final-state fact overrides any stale snapshot claims.
3. **verify-report and apply-progress**: Intermediate snapshots, valid for their time of writing (2026-09-18 verify session). Verify report explicitly noted the gap was closed in this session.

### Task Completion Gate

**Result**: PASS

The persisted `tasks.md` artifact in the archived change folder has been independently inspected:

- Total tasks: 27 (1.1–1.7, 2.1–2.9, 3.1–3.7, 4.1–4.4)
- Checked complete: 27
- Unchecked: 0

Per the Task Completion Gate rule, no stale unchecked tasks remain. Archive proceeds.

## Specs Synced to Main OpenSpec

**All 4 delta specs successfully merged or created:**

| Domain | Action | Merge Method | Details |
|--------|--------|--------------|---------|
| credential-encryption | CREATED | Mechanical copy (new spec) | 5 new requirements: Versioned Authenticated Envelope Format, Credential Is Enciphered Before It Reaches Storage, Credential Is Deciphered Only in Memory at a Use Site, Fail-Closed Master Key Validation at Boot, Master Key and Deciphered Credential Never Exposed; 7 scenarios |
| connection-registration | UPDATED | `gentle-ai sdd-archive-compose` | MODIFIED requirement ("Connection Registration Persists Against the Active Tenant" now reflects tenant scoping from CH-06); ADDED: "Credential Value Never Exposed" scenarios for encrypted envelope storage and legacy plaintext rejection |
| query-execution | UPDATED | `gentle-ai sdd-archive-compose` | MODIFIED requirement ("Row Cap Sourced From Global Configuration, Reported as a Distinct Cutoff Verdict") with 3 new scenarios: execution within cap, execution stopped by cap, configurable cap without source change |
| query-console | UPDATED | `gentle-ai sdd-archive-compose` | MODIFIED requirement ("Row-Cap Cutoff Is Surfaced Legibly") with 2 new scenarios: viewing capped result, distinguishing cap cut from partial page |

**Compose Operations Executed:**

All `gentle-ai sdd-archive-compose` operations completed with zero exit status and produced merged output. No composition failures or requirement-name mismatches.

**Mechanical Copy Verification:**

The new credential-encryption spec was copied via shell (`cp` → atomic direct placement). Byte-for-byte verification (`diff`) passed with no differences, confirming no truncation or alteration during copy.

## Source of Truth Updated

The following specs in `openspec/specs/` are now the authoritative source of truth for their domains and reflect the new behavior introduced by CH-07:

- `openspec/specs/credential-encryption/spec.md` — **new** — credential encryption at rest with master key outside database, fail-closed boot validation, decipherment only at dial sites
- `openspec/specs/connection-registration/spec.md` — UPDATED — registration now stores enciphered credentials; connectivity test deciphers in memory only
- `openspec/specs/query-execution/spec.md` — UPDATED — row cap is configurable globally; capped execution reports distinct `tope-de-filas` verdict
- `openspec/specs/query-console/spec.md` — UPDATED — cap cutoff is legibly surfaced and distinguishable from pagination

## Archive Contents Verified

The archived change folder contains all required artifacts:

- ✅ `proposal.md` — Original CH-07 proposal with scope, approach, and rollback plan
- ✅ `specs/` (4 delta specs) — All 4 delta specs present: credential-encryption, connection-registration, query-execution, query-console
- ✅ `design.md` — Full design with 4-slice delivery strategy, 4 architectural decisions (DEC-16/17/18/20), and data flows
- ✅ `tasks.md` — All 27 tasks marked complete, no stale unchecked items
- ✅ `verify-report.md` — Final verification report (PASS WITH WARNINGS)

Path: `openspec/changes/archive/2026-09-18-CH-07-credential-encryption-and-query-limits/`

## Explicit Final-State Facts

Per the launch prompt's explicit final-state facts (ranked 2nd in Final-State Authority hierarchy, overriding intermediate snapshot claims):

### Task Completion

**All 27 tasks complete** (per persisted `tasks.md` checklist).

Three non-blocking WARNINGs carried forward for visibility (all disclosed in verify-report.md):

1. **Task 4.3 (console smoke coverage) implementation method**: Task 4.3 explicitly named `src/consola.test.ts`'s `inject()` suite as an allowed alternative to extending `scripts/smoke.sh`. That alternative was used instead. Docker-based smoke run (`npm run smoke`) was executed for the first time in the verify session and passed end to end, proving the encryption round trip and fail-closed boot over real HTTP/real Postgres, but it does not assert on row-cap-cutoff or credencial-ilegible-409 specifically -- those are covered by the node:test suite and DOM-stub console suite. **Not a blocker for archive; task explicitly allowed the alternative.**

2. **Query-console cap-legibility scenarios verified via DOM stub**: The two query-console cap-cutoff scenarios (legible cutoff message and distinguishability from pagination) are verified via a DOM-stub script execution against the real, verbatim-extracted /consola inline script, not a real browser. This is the same disclosed, previously-accepted limitation CH-05 and CH-06 both recorded. Marked PARTIAL rather than UNTESTED because real code (the actual /consola inline script, extracted verbatim via `inject()`) executes and the claims are verifiably true against the DOM stub. **Residual limitation without real browser environment. Not a blocker for archive.**

3. **Apply session gap: npm run smoke not run**: The apply session bitacora explicitly stated "npm run smoke was not run because Docker was unavailable in that session". This verify session closed that gap: `npm run smoke` was run for real and passed end to end, with the full CH-01/03/04/05/06 regression suite plus a genuine encipher-then-decipher-then-dial round trip over real HTTP. **Gap resolved in verify session; not a blocker for archive.**

### Verification Outcome

**PASS WITH WARNINGS** per `verify-report.md` (2026-09-18 verification session):

- **CRITICAL findings**: 0
- **WARNING findings**: 3 (all listed above and disclosed in verify-report)
- **SUGGESTION findings**: 2 (extend scripts/smoke.sh with CH-07-specific assertions in a future change; add jsdom for real HTML parsing)
- **Test Coverage**: 223/223 tests passed independently against live PostgreSQL, re-executed in this verify session
- **Build**: Clean (`tsc --noEmit` and `npm run build` both exit 0)
- **Smoke**: PASSED end to end on real Docker Compose stack with full CH-01/03/04/05/06 regression suite

All 10 requirements and 20 scenarios across the 4 spec deltas have covering evidence. Zero CRITICAL blockers identified.

### Architecture Decisions Registered

Four new architecture decisions (DEC-16, DEC-17, DEC-18, DEC-20) were registered in `docs/01-decisiones.md` during proposal/design phases:

- **DEC-16**: AES-256-GCM through built-in `node:crypto`; per-row random 12-byte IV; versioned envelope (`v1:iv:tag:ciphertext`, base64). Rationale: column-agnostic, no external key-management dependency.
- **DEC-17**: Master key from environment variable, fail-closed at boot via `loadConfig()` before `listen`. Rationale: no KMS integration needed (D-2 open); key held outside database per A2.
- **DEC-18**: Cap is enforced by application and reported as its own verdict (`tope-de-filas`), never conflated with `hayMas`. Rationale: `hayMas` invites a next page, which cap denies; verdict must be distinct.
- **DEC-20**: No backfill-encipher migration. Legacy plaintext rows answer `409 credencial-ilegible` until re-registered. Rationale: avoids the slice-2 rollback hazard (reverse migration + code revert stranding unreadable ciphertext).

Plus design-level implementation decisions for single-point encipher/decipher architecture (not Prisma extension), cap integration via existing `LIMIT`+1 probe row, and envelope-shape distinction between cap cut and timeout.

### Stacked-to-Main Chain Strategy

CH-07 was delivered as 4 sequential slices per the confirmed `stacked-to-main` chain strategy (matching CH-03/04/05/06 precedent):

- Slice 1: Crypto module + master-key boot validation + unit tests. No call site wired.
- Slice 2: `conexion-destino.ts` wiring, encipher on create, both read paths, `409 credencial-ilegible` mapping.
- Slice 3: `maxFilasPorConsulta`, `limiteEfectivo`/`corte`, schema `maximum: 200` removal.
- Slice 4: Console cap sentence, `credencial-ilegible` entry, smoke test.

**No actual separate git branches or PRs were created in this session** — implementation exists in 4 sequential commit slices on the working tree only (commits `47736b9`, `b004e14`, `b9be6ac`, `7788e9c`). If branch creation and PR submission to the main repository remain outstanding, that is a follow-up delivery step outside the SDD archive scope.

## Key Findings from Verification

Per `verify-report.md`, verified at 2026-09-18:

### Completeness

- All 27 tasks complete and checked `[x]`
- All 4 specs created/merged and verified
- All artifacts generated and in place
- Entire CH-01/03/04/05/06 regression suite (existing tests) passes unchanged
- New CH-07 test suites across cripto-credencial.test.ts, conexion-destino.test.ts, conexiones.test.ts, consultas.test.ts, consola.test.ts, and config.test.ts: 223/223 tests passing
- Full specification coverage: 10 requirements / 20 scenarios, all COMPLIANT
- Build: tsc exit 0, npm run build exit 0
- Smoke: npm run smoke passed end to end on real Docker Compose stack (first time run in this session, closing apply-session gap)

### Correctness (Static Evidence)

- Single-point credential read (`credencial: true` in exactly one file): `src/conexion-destino.ts:40`, grep-verified
- Master key never on AppConfig, never logged, never returned: module-scoped Buffer in cripto-credencial.ts only
- Rule 4, limits bound as driver parameters: `LIMIT/OFFSET` with values array in src/consulta-ejecucion.ts, no string interpolation
- Rule 7, no key/credential/plaintext in any response/error/log: app.log.warn passes only conexionId/categoria/fase/codigo/durationMs; ErrorCredencialIlegible carries fixed message; smoke session log-grep assertions passed
- corte reported outside Paginacion, never conflated with hayMas: `EjecucionExitosa.corte` is sibling of `paginacion`, both-conditions verdic (limiteSolicitado > topeFilas AND hayMas true)
- 409 credencial-ilegible mapping present on both call sites: src/conexiones.ts (prueba route) and src/consultas.ts (ejecutar route)
- No schema/migration change: prisma/schema.prisma unmodified by CH-07

### Coherence (Design)

All DEC-16/17/18/20 architectural decisions were followed verbatim in code:

- DEC-16 (AES-256-GCM, node:crypto, versioned envelope): Implemented in src/cripto-credencial.ts exactly as specified
- DEC-17 (one master key per deployment, env var, fail-closed boot): validarClaveMaestra() called from loadConfig(), itself called before listen
- DEC-18 (cap is its own verdict, not reused hayMas): corte field confirmed outside Paginacion; consultas.test.ts explicitly tests that corte lives outside paginacion where DEC-18 requires it
- DEC-20 (no backfill migration; legacy plaintext rows answer 409): No migration ships; descifrarCredencial treats legacy plaintext as unversioned envelope and throws ErrorCredencialIlegible
- Design: explicit calls behind one accessor, not Prisma extension: src/conexion-destino.ts is sole accessor; both routes call it
- Design: cap reuses existing LIMIT+1 probe row, no second ceiling: single LIMIT equal to limiteEfectivo plus 1; no second query
- Design: cap cut, timeout, pagination distinguished by envelope shape: cap cut is resultado ok with corte tope-de-filas; timeout is resultado fallo categoria tiempo-agotado

## Mechanical Copy Verification

### Spec Merge (`sdd-archive-compose`)

**Connection-registration** (MODIFIED):
```
gentle-ai sdd-archive-compose \
  --canonical "openspec/specs/connection-registration/spec.md" \
  --delta "openspec/changes/CH-07-credential-encryption-and-query-limits/specs/connection-registration/spec.md" \
  --output "openspec/specs/connection-registration/spec.md.compose-tmp"
```
Exit status: 0 ✓

**Query-execution** (MODIFIED):
```
gentle-ai sdd-archive-compose \
  --canonical "openspec/specs/query-execution/spec.md" \
  --delta "openspec/changes/CH-07-credential-encryption-and-query-limits/specs/query-execution/spec.md" \
  --output "openspec/specs/query-execution/spec.md.compose-tmp"
```
Exit status: 0 ✓

**Query-console** (MODIFIED):
```
gentle-ai sdd-archive-compose \
  --canonical "openspec/specs/query-console/spec.md" \
  --delta "openspec/changes/CH-07-credential-encryption-and-query-limits/specs/query-console/spec.md" \
  --output "openspec/specs/query-console/spec.md.compose-tmp"
```
Exit status: 0 ✓

### New Spec Copy

**Credential-encryption** (new spec):
```
cp "openspec/changes/CH-07-credential-encryption-and-query-limits/specs/credential-encryption/spec.md" \
   "openspec/specs/credential-encryption/spec.md"
diff "openspec/changes/CH-07-credential-encryption-and-query-limits/specs/credential-encryption/spec.md" \
     "openspec/specs/credential-encryption/spec.md"
```
Copy status: 0 ✓ | Diff status: 0 (empty, no differences) ✓

### Archive Move

**Source**: `openspec/changes/CH-07-credential-encryption-and-query-limits/`
**Destination**: `openspec/changes/archive/2026-09-18-CH-07-credential-encryption-and-query-limits/`

```
cp -R "$source" "$snapshot_root/source"
git mv "$source" "$destination"  # (fallback to plain mv on git mv failure)
diff -r "$snapshot_root/source" "$destination"
```

Git mv status: 0 ✓ | Diff status: 0 (empty, no differences) ✓

**Verification**:
- Source directory removed: ✓
- Destination directory exists with all artifacts: ✓
- Byte-for-byte identity verified between pre-move snapshot and archived folder: ✓

## Artifact Store Configuration

- **Mode**: hybrid (filesystem-based openspec + Engram persistent memory)
- **Specs synced to**: `openspec/specs/`
- **Change archived to**: `openspec/changes/archive/2026-09-18-CH-07-credential-encryption-and-query-limits/`
- **Archive report persisted to**: Engram topic key `sdd/CH-07/archive-report`
- **Affected paths**:
  - `openspec/specs/credential-encryption/spec.md` — CREATED
  - `openspec/specs/connection-registration/spec.md` — UPDATED
  - `openspec/specs/query-execution/spec.md` — UPDATED
  - `openspec/specs/query-console/spec.md` — UPDATED

## SDD Cycle Complete

CH-07 has been fully planned (proposal.md), designed (design.md), specified (specs/ and main openspec), implemented (4 sequential commit slices), verified (verify-report.md: PASS WITH WARNINGS), and archived (this report + folder move + Engram persistence). The SDD cycle is CLOSED. The repository's source of truth has been updated with the new credential-encryption capability and query-execution/query-console enhancements.

Ready for the next change.

---

**Archive Report Metadata**

- Report generated: 2026-09-18
- Generated by: sdd-archive (Haiku 4.5)
- Archive folder: openspec/changes/archive/2026-09-18-CH-07-credential-encryption-and-query-limits/
- Source store: hybrid (filesystem openspec + Engram)
- Verify report status at archive time: PASS WITH WARNINGS
- Task completion gate: PASS (27/27 tasks checked complete)
- Compose operations: 3 successful merges, 1 successful new-spec create, 0 failures
- No stale apply-progress.md file: Progress tracked via tasks.md checkboxes and Engram observation `sdd/CH-07/apply-progress`
