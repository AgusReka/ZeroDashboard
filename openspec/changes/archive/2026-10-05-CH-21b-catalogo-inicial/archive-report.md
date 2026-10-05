# Archive Report: CH-21b — Initial Template Catalog

**Archive Date**: 2026-10-05  
**Change Name**: CH-21b-catalogo-inicial  
**Status**: COMPLETE  
**Final Commits on Master**: #87 (PR1a, `src/catalogo-inicial.ts`, unit tests, seed), #88 (PR1b, live tests and smoke)

## Executive Summary

CH-21b successfully implemented a seeded initial template catalog by adding two fixed-entry templates (`stock-fisico` and `stock-producible`) with create-if-absent semantics (DEC-125), provisional tolerances (DEC-128), and verified SQL. The catalog is seeded on every boot through `prisma/seed.ts`, independent of tenant seeding. All PRs merged to master. Implementation is complete. Verification is complete: type checks pass (`npx tsc --noEmit` and `npm run build`), all 10 focused catalog tests pass, 856/856 full suite tests pass on the second run, and smoke test confirms both templates list without tenant header after container restart.

## Merged Artifacts

### Spec Artifacts

| Spec | Action | Location | Notes |
|------|--------|----------|-------|
| initial-template-catalog | Created (new) | `openspec/specs/initial-template-catalog/spec.md` | Full spec created from delta spec. Seeded catalog content, create-if-absent by fixed id, idempotency, SQL composition and execution, recipe exclusion (DEC-127), producible-units threshold (DEC-128), provisional tolerances, no schema/API/engine change. 11 requirements, 30+ scenarios. |

### Change Folder

**Archived to**: `openspec/changes/archive/2026-10-05-CH-21b-catalogo-inicial/`

**Contents**:
- `proposal.md` — Intent (D3 on fresh install), scope, capabilities, approach, affected areas, risks, rollback plan, workload forecast
- `design.md` — Technical approach (one code PR, split to PR1a/PR1b), architecture decisions (fixed ids, names, delegates, validation, tolerances, column aliases, numeric cast, `ORDER BY` nesting), interfaces, SQL contents with delta notes, boot sequence, testing strategy, threat matrix, migration/rollout
- `exploration.md` — Context discovery of D3 gap, prior template SQL verification, existing constraints
- `apply-progress.md` — Work unit evidence, commit history, boot-environment verification, spec scenario coverage, deviations from design, line-count analysis and split rationale
- `tasks.md` — Work breakdown (module, seed, tests, smoke), task status, verify checklist, line-count checkpoints, rollback boundaries
- `specs/` — Delta spec (initial-template-catalog)

## Implementation Summary

### Approach

DEC-125 (a): create-if-absent seeding by fixed id, no overwrite or update. One code PR split to two chained PRs to fit the 400-line budget:

| PR | Branch | Content | Lines | Status |
|---|---|---|---|---|
| PR0 #86 | ch21b/exploracion | DEC-125..128 and exploration (committed) | ~100 + planning docs | ✓ Merged |
| PR1a #87 | ch21b/semilla-modulo | Module `src/catalogo-inicial.ts`, unit tests U1-U5, seed wiring | 305 authored | ✓ Merged |
| PR1b #88 | ch21b/catalogo-semilla | Live tests L1-L4 and C1-C2, smoke check, full suite run | 170 authored | ✓ Merged to master |

**Total authored lines**: 305 (PR1a) + 170 (PR1b) = 475 across two merged PRs; original single-PR count was 473 (forecast ~386, budget 400).

### Key Features

1. **Closed seeded catalog** (`src/catalogo-inicial.ts`): Two fixed entries with literal UUIDs (`21b00000-0000-4000-8000-000000000001`, `21b00000-0000-4000-8000-000000000002`), `stock-fisico` and `stock-producible`, with business-readable Spanish names and column aliases.
2. **Create-if-absent seeding** (`sembrarCatalogoInicial`): One `createMany({ data, skipDuplicates: true })` statement per boot, producing `INSERT ... ON CONFLICT DO NOTHING`. No read, update or delete. A single race-safe write.
3. **Runtime validation**: Each entry passes the same `rechazoDeEntrada` checks as `POST /plantillas`: strict body keys, enum values, CH-11 parameter rules, no hand-written `$n`, `v_<entidad>` aliases only. Broken entries throw before any write.
4. **Boot-sequence independence**: Catalog seeding runs after tenant seeding on every boot, independent of the tenant early-return. Tenant behavior unchanged.
5. **SQL verification retained**: `stock-fisico` keeps the verified `NOT EXISTS` exclusion of products with recipes (CH-16d `11_`). `stock-producible` carries the verified canonical query (CH-16b `04_`) with parameterized `HAVING ... <= :umbral` threshold.
6. **Provisional tolerances** (DEC-128): `stock-fisico` stores 60 minutes, `stock-producible` stores 120 minutes, with no execution effect (enforcement belongs to CH-24).
7. **No schema/API/engine change**: Zero migrations, zero route changes, zero engine changes (rule 6). `automation-templates` and `domain-data-model` requirements unchanged.

## Verification Status

### Passing (Green)

- **TypeScript**: `npx tsc --noEmit` clean; `npm run build` clean; U5 signature pin proves `sembrarCatalogoInicial(p.plantilla)` satisfies the `DelegadoSiembra` delegate interface
- **Unit tests** (U1-U5): 4/4 pass
  - U1: Closed list, 2 entries, fixed ids, names, tolerances, no `reporte-diario`, key-set parity, no forbidden SQL keywords, `v_<entidad>` coverage, entities declared
  - U2: POST parity — each entry 201 through real route; broken copies (bad SQL, unknown entity) rejected by both paths with same envelope; seeder throws before write
  - U3: Delegate mock — one `createMany` call, correct `skipDuplicates`, ids in order, no duplicates within the list
  - U4: Composition and execution — sample `umbral` binds through placeholders, not literals; DEC-71 gate for `stock-fisico` maps entities correctly; empty `receta_componente` view passes
  - U5: TypeScript signature pin
- **Live tests** (L1-L4, C1, C2): 6/6 pass against Compose PostgreSQL at `localhost:5434`
  - L1: Idempotent seed — first run returns 2, second returns 0, rows unchanged
  - L2: Edit survives seed — `PUT` changes a row, seed again, row deep-equals the `PUT` response; unrelated `stock-fisico` template (different id, POST-created) unchanged
  - L3: Deleted row recreated — delete one test id, seed, row comes back with exact content; other row unchanged; `GET /plantillas/:id` returns each row 200
  - C1: `stock-fisico` execution — fixture with products above/below threshold; `umbral: 5` excludes inactive and products with recipes; empty `receta_componente` view allows execution
  - C2: `stock-producible` execution — fixture with Empanada (3 units at `umbral: 5`) and Fugazza (6 units); rows return with correct aggregate; numeric binds work
  - L4: Order through nesting — `sentenciaPaginada` with `LIMIT 2` returns the 2 lowest-stock rows in order; observes PostgreSQL planner behavior (total `ORDER BY`)
- **Full test suite**: `npm test` — 856/856 pass on run 2 (run 1: one unrelated `aislamiento` CH-14 test failed under parallel load, passes alone)
- **Smoke test** (`bash scripts/smoke.sh`): PASSED — 37 OK lines
  - Both catalog ids (`21b00000-0000-4000-8000-000000000001`, `21b00000-0000-4000-8000-000000000002`) listed headerless in `GET /plantillas`
  - Catalog step ran even though tenant step skipped (existing tenant)
  - `Seed: template catalog, 2 of 2 created` logged
- **Boot environment**: Dry import with only `DATABASE_URL` set loads `dist/catalogo-inicial.js` without environment issues; failure path exits with code 1 (not swallowed)

### Documented Findings

1. **Live-test environment port conflict** (inherited): `TEST_DB_*` defaults to `localhost:5432`. Where another PostgreSQL (Saleor) runs, tests fail with `P1000` (authentication). Workaround: set `TEST_DB_PORT=5434` explicitly. Nothing was written to the unrelated server.
2. **Smoke suggestions recorded, not applied**:
   - Fixed `/tmp` files in smoke script
   - Tolerance assertion (C1) only; tolerance has no effect elsewhere (DEC-128)
   - Compact JSON grep in the headerless list check
3. **ORDER BY planner behavior** (L4 verified, documented in module header): Nesting through `SELECT * FROM (<sql>) AS _plantilla` does not break `ORDER BY` under PostgreSQL's Subquery Scan node. This is observed behavior, not a documented SQL guarantee. Fallback if broken: document "order not guaranteed" as an artifact limit (no engine change).
4. **SQL deltas vs. verified originals** (DEC-127 semantics preserved):
   - `::numeric` cast on `stock-fisico` comparison: changes literal type of `$1`, not the row set (integer columns still match)
   - `ins.id` tiebreaker in `ARRAY_AGG` on `stock-producible`: fixes which ingredient is reported, no row-set effect
   - `nombre`, `id` tiebreakers in final `ORDER BY`: total order, no row-set effect
   - Column aliases and dropped `id` projection: email headers are Spanish and readable; row set unchanged
   - Interpretation: verified **semantics** (row exclusion, threshold, product list) preserved; literal text not kept. User may object.
5. **Seeded rows are editable** (pre-existing, DEC-125 accepts): Anyone with API access can `PUT` the seeded rows. Seed never re-applies its own content; rows persist if edited and are not replaced on next boot.
6. **Nested composition fixture is miniature**: C1 and C2 use `VALUES` view definitions (no real Food Store data). Live test coverage of nesting and row filtering is confirmed; real-data scaling not verified.

### Verification Authorship

**Independent verifiers** (per apply-progress):
- Design verification: PASS WITH WARNINGS (corrected; SQL delta reading clarified as semantics preservation)
- PR1 attempt: PASS WITH WARNINGS — 0 CRITICAL
  - W1: Live-test port default inherited from prior suites (set `TEST_DB_PORT`)
  - W2: Smoke suggestions recorded (fixed paths, compaction)
  - W3: Nested composition on miniature fixture (real-data scaling unverified)
  - W4: Seeded rows editable by API; later fixes to seeded SQL do not propagate

### Test Counts

| Phase | Total Tests | Passed | Failed | Command |
|---|---|---|---|---|
| Focused unit + live (CH-21b only) | 10 | 10 | 0 | `TEST_DB_PORT=5434 npx tsx --test src/catalogo-inicial.test.ts` |
| Full suite (run 1) | 856 | 855 | 1 | `npm test` — one unrelated CH-14 parallel-load fail |
| Full suite (run 2) | 856 | 856 | 0 | `npm test` — all pass |
| Smoke | 37 | 37 | 0 | `bash scripts/smoke.sh` on Compose stack |

## Final-State Authority Notes

The following claims outrank intermediate snapshots per the archive final-state authority:

| Claim | Source | Ranking |
|---|---|---|
| PR1 split and both PRs merged to master on 2026-10-05 | Launch prompt final-state facts | Explicit; 305 (PR1a) + 170 (PR1b) authored lines, no split exception needed |
| PR1 verification and smoke test PASSED | Launch prompt final-state facts | Explicit; confirms delivery |
| DEC-125..128 firm decisions, committed in PR0 | Launch prompt final-state facts | Explicit; design grounded in locked decisions |
| SQL deltas treated as DEC-127 semantics preservation | Launch prompt final-state facts | Explicit; user may object; no new DEC entered before apply |
| Nested composition L4 verified on exact executed text; planner behavior observed | Launch prompt final-state facts | Explicit; documented as open point for fallback if PostgreSQL changes |
| Smoke run and full test suite 856/856 on second run | Launch prompt final-state facts | Explicit; terminal verification state |

No contradictions between launch facts and higher-ranked artifact sources. All implementation tasks complete; 0 CRITICAL issues.

## Rollback Plan

**Confirmed per design.md**:
1. To remove PR1b: revert commit #88 (restores plain PR1a, removes live tests and smoke check)
2. To remove PR1a: revert commit #87 (removes module, unit tests, seed wiring, source feature)
3. To remove PR0: revert commit #86 (removes DEC-125..128, exploration, proposal; not necessary for functional rollback)
4. Seeded rows persist (no delete route, DEC-68). Remove only after PR1 revert. Query: `SELECT count(*) FROM "Automatizacion" WHERE "plantillaId" IN ('21b00000-0000-4000-8000-000000000001','21b00000-0000-4000-8000-000000000002')`. If 0, run `DELETE FROM "Plantilla" WHERE id IN (...)`. FK is `RESTRICT`.
5. No schema, env, or dependency changes; rollback is clean.

## Traceability

**Spec requirements → Implementation → Tests**:

| Spec Requirement | Implemented In | Tested By |
|---|---|---|
| Catalog Contains Exactly Two Initial Templates | `src/catalogo-inicial.ts` (CATALOGO_INICIAL array, 2 entries) | U1 (content, no `reporte-diario`), L1 (2 rows created), L3 (GET /plantillas) |
| Seeding Is Create-If-Absent by Fixed Id | `src/catalogo-inicial.ts` (createMany skipDuplicates), `prisma/seed.ts` (caller) | L1 (idempotent), L2 (edit survives), L3 (recreate), U3 (one call) |
| Catalog Seeding Is Independent of Tenant Seed | `prisma/seed.ts` (two sequential functions, both called) | Smoke (both log lines present with existing tenant) |
| Every Entry Passes POST /plantillas Checks | `rechazoDeEntrada` (key set, enum values, CH-11 rules) | U2 (201 parity, 400 parity on broken copies), U1 (SQL scans) |
| Entries Compose and Execute Read-Only | `componerSentencia`, `prepararSentencia`, `sentenciaPaginada` (existing functions) | U4 (composition), C1, C2 (execution on fixture), L4 (nesting) |
| stock-fisico Keeps Recipe Exclusion and Declares receta_componente | `sql` in CATALOGO_INICIAL, DEC-127 entidades | C1 (Empanada excluded), U4 (DEC-71 gate), L3 (GET returns entity list) |
| stock-producible Carries Threshold in HAVING | `sql` in CATALOGO_INICIAL, DEC-128 entidades | C2 (HAVING filters correctly), U1 (declared tolerance) |
| Provisional Tolerances Are Stored and Never Enforced | `toleranciaFrescuraMinutos` in catalog entries | U1 (stored values), C1 (tolerance 0 copy identical result), U2 (no execution checks) |
| Entries Use Only v_<entidad> Aliases, No Concatenation, No Personal Data | `sql` scanned in U1, AJV checks in rechazoDeEntrada | U1 (aliases, no forbidden keywords, no personal data terms), U4 (placeholders only) |
| Catalog Is Global and Holds No Tenant Data | No `tenantId` field in entries, seeder takes no tenant input | U1 (key set), U3 (data shape), L1 (no tenant arg), smoke (no header) |
| No Schema, API or Engine Change | No migration, no route, no engine files modified | `git diff` confirms; U2 proves route unmodified |

**PR delivery evidence**:
- PR1a (#87): U1-U5 pass; `npm run build` clean; seed wiring complete; 305 authored lines
- PR1b (#88): L1-L4 and C1-C2 pass; smoke test passes; full suite 856/856 on run 2; 170 authored lines; combined 475 lines

## Known Issues (Design-Accepted or Inherited)

1. **Live-test port conflict** (inherited from prior tests): `TEST_DB_*` defaults to `localhost:5432`. If another PostgreSQL holds that port, tests skip with P1000. Unrelated to this change; set `TEST_DB_PORT` explicitly.
2. **Nested composition verified on miniature fixture**: C1 and C2 use `VALUES` definitions, not real Food Store data. Row filtering and aggregation logic verified on representative data; real-data scaling not tested.
3. **ORDER BY behavior documented, not guaranteed**: L4 confirms PostgreSQL planner preserves order through `SELECT * FROM (<sql>) AS _plantilla`. Fallback if future version breaks: document "order not guaranteed" as artifact limit.
4. **Seeded rows are mutable and not re-synced**: Anyone with API access can `PUT` the seeded rows. Later changes to catalog SQL in the code do not propagate to existing rows (DEC-125 accepts). Operator must manually update or delete and let seed recreate.

## Archive Integrity

- **Initial-template-catalog spec**: Created mechanically by copying delta spec from change folder (no Read/Write model conversion)
- **Change folder**: Moved via `git mv` to `openspec/changes/archive/2026-10-05-CH-21b-catalogo-inicial/`
- **Diff verification**: Confirmed folder move by checking destination exists and source removed
- **Source removed**: `openspec/changes/CH-21b-catalogo-inicial/` no longer exists

## SDD Cycle Closure

**All phases complete**:
- ✓ Exploration (ch21b/exploracion)
- ✓ Proposal (PR0 #86)
- ✓ Spec (delta spec in change folder, now main spec `openspec/specs/initial-template-catalog/spec.md`)
- ✓ Design (two-PR approach, interfaces, SQL with deltas, boot sequence, test strategy)
- ✓ Tasks (work breakdown, checkpoints, rollback)
- ✓ Apply (two commits merged, 475 authored lines split to fit budget)
- ✓ Verify (type checks, unit tests 4/4, live tests 6/6, full suite 856/856, smoke 37/37)
- ✓ Archive (spec created, folder archived, report written)

**Change is closed.** Ready for the next change (CH-21c or CH-22).
