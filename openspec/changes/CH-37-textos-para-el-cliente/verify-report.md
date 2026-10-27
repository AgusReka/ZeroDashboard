```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:661395a523cc5f54a839c58cdb2cf44ea61a647508edda2f9a66d61225350f50
verdict: pass
blockers: 0
critical_findings: 0
requirements: 6/6
scenarios: 22/22
test_command: TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres TEST_DB_NAME=zerodashboard_test DATABASE_URL=postgresql://zerodashboard:postgres@localhost:5434/zerodashboard_test npx tsx --test src/compartido/glosario-panel.test.ts src/panel/panel-automatizaciones.test.ts src/plantillas/plantillas-rutas.test.ts src/plantillas/catalogo-inicial.test.ts src/plantillas/migracion-textos-cliente.test.ts src/aislamiento/aislamiento-panel.test.ts src/aislamiento/aislamiento.test.ts
test_exit_code: 0
test_output_hash: sha256:ba4689c672cabc2d1d58ccda0a8f501775597f800a6c5e416e87e73a151b033c
build_command: npx tsc --noEmit
build_exit_code: 0
build_output_hash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

# Verify report: CH-37 — Client-facing title and description on the template

**Verdict: PASS.** Date: 2026-10-27. Branch: `ch37/textos-cliente`, PR #211 (`size:exception`). An independent read-only review first gave PASS WITH WARNINGS. Its two warnings and one suggestion are test gaps, fixed in this pass (see "Findings").

## Commands
| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db` | 1515 / 1519. The 4 failures are the known false positives in `conexiones.test.ts` (the `postgres` password). The first run also caught the exact `Plantilla` column list in `aislamiento.test.ts`, which was then updated. |
| The three test files touched by the fixes, on `zerodashboard_test` | 77 / 77 pass, none skipped |
| The seven CH-37 test files (envelope `test_command`), on `zerodashboard_test` | 164 / 164 pass, none skipped, exit 0 |

## Spec scenarios → evidence
Test files are under `src/`. `PA` is `panel/panel-automatizaciones.test.ts`, `PR` is `plantillas/plantillas-rutas.test.ts`, `CI` is `plantillas/catalogo-inicial.test.ts` and `MIG` is `plantillas/migracion-textos-cliente.test.ts`.

### client-panel-automations
| Scenario | Evidence |
|---|---|
| Active template not available | PA unit 1.7, and route 2.7 with an active automation |
| Paused-only is available | PA unit 1.7, route 2.7 |
| Template without a client text is hidden | PA unit (null/null, title only, blank), route 2.7 |
| New title beside an active seeded twin | PA 1.8 |
| Another tenant's automation does not hide a template | `aislamiento/aislamiento-panel.test.ts` 2.14 |
| Same title listed once, hidden together, lowest id wins | PA 1.8. The case-and-space test now fails if the sort used the raw title. |
| Order by title | PA unit (the two seeded titles in Spanish order from reversed input), route 2.1 |
| Template with a client text | PA `textoDe` and `proyectarActiva` (trimmed), route 2.1 |
| Template without text on an existing automation | PA unit, plus route 2.7 (neutral texts, `nombre` absent) |
| Half-filled template | PA unit: title only, description only and blank title each give the neutral pair |

### initial-template-catalog
| Scenario | Evidence |
|---|---|
| Fresh install | CI U1 (exact texts), CI L1 (persisted rows) |
| Seeded texts are clean | CI glossary-and-caps unit test |
| Seeded install before CH-37 | MIG: two `stock-fisico` rows (seed and operator twin) and one `stock-producible` get their texts; `reporte-diario` stays null; everything rolls back |
| Seeding after the migration changes nothing | CI L1/L2 (create-if-absent, a second seed writes nothing) |
| Existing summary shape unchanged | PR 3.3, now on a template that has client texts |

### automation-templates
| Scenario | Evidence |
|---|---|
| Create with texts, trimmed echo | PR (padded input, trimmed echo, get-by-id equal) |
| Create without texts | PR (`null` echo), PR 3.1 headerless create |
| Forbidden term refused | PR without DB (`campos`, `terminos`, case-insensitive), PR with DB (nothing written on POST or PUT) |
| Text over its cap refused | PR (81 / 201, padding not counted; 80 / 200 accepted) |
| Blank stored as null | PR (`'   '`, `'\t'`, JSON `null`) |
| Replacing without the texts clears them | PR 4.1 (response and row) |
| Summary list unchanged | PR 3.3 |

## Tasks
All 14 are checked in `tasks.md`.

## Design conformance and deviations
- In the migration, `descripcion` comes before `titulo` in the `ALTER`. That is the order `prisma migrate diff` prints (Prisma 7.10), and task 1.2 requires the migration to match it. It has no effect on behavior.
- The seed test's persisted copies carry the per-file title tag, so L1 checks the title as seed title plus tag and the description exactly.
- `MIG` also has a non-DB check that the migration file holds exactly two `UPDATE` statements, one per slug.

No deviation changes specified behavior.

## Rules
- **Rule 2:**
  - The tenant comes only from the panel session.
  - Q4 reads the global catalog with `id`, `titulo` and `descripcion` only.
  - The active set is subtracted in code from the scoped Q5.
  - Test 2.15 shows a foreign header or query parameter changes nothing.
- **Rule 4:**
  - The production code adds no SQL.
  - The migration `UPDATE`s are static literals.
  - The migration test narrows them with bound `$n` parameters.
- **Rule 1 and glossary:**
  - The seeded texts and the neutral fallback are checked against the shared list.
  - `POST`, `PUT` and the seed run the same save-time check.
- **Rule 5:** Q1 no longer reads the slug. Test 2.10 shows no technical field reaches the client.
- **Rule 6:** no engine or execution file changed.

## Findings
- **W1 (fixed).** The 1.8 "lowest id wins" test passed even with a raw-title sort. Its fixture now gives the lower id the title that sorts later.
- **W2 (fixed).** The migration test lacked the operator twin of the scenario. A second `stock-fisico` row now gets the texts too.
- **S2 (fixed).** The summary-shape test now uses a template with client texts.
- **S1 (open, not a defect of this change).** The glossary check is a case-insensitive substring match over the 10 terms the spec fixes. Plurals such as "ejecuciones" pass. Words such as "sincronización" are refused, because they contain "cron". `lenguaje.md` forbids more terms than these 10. Widening the list is a decision on DEC-04, and is left as a follow-up.
