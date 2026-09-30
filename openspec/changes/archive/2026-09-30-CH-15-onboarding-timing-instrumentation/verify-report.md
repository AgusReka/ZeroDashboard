```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:c97c2df86b38a6420115986afecc8261ae83ea6ad966d7dcf4ff75f62b168944
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 8/8
scenarios: 12/12
test_command: TEST_DB_PORT=5434 npm test
test_exit_code: 0
test_output_hash: sha256:957610c81f40f938857c38f59e4a14540085905953f9bbb117c2aac5559a9b8e
build_command: npx tsc --noEmit
build_exit_code: 0
build_output_hash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

# Verification Report: CH-15-onboarding-timing-instrumentation

Mode: Standard (strict_tdd false). Store: openspec. Nothing committed; branch ch15/1-instrumentacion-de-tiempos-de-alta.

## Completeness

Tasks: 12/13 checked. Open: 3.4 (this verify, then archive), which is expected. No core task is incomplete.

## Execution evidence

| Command | Result |
|---|---|
| TEST_DB_PORT=5434 npx tsx --test src/marcas-alta.test.ts | 13 tests, 13 pass, 0 fail, 0 skipped |
| TEST_DB_PORT=5434 npm test | exit 0; 633 tests, 93 suites, 633 pass, 0 fail (see WARNING 2) |
| npx tsc --noEmit | exit 0, empty output |
| TEST_DB_PORT=5999 focused run (unreachable DB) | 4 static tests pass; live suite skipped, 0 fail |

Port 5432 was never targeted (it belongs to another project DB).

## Spec compliance matrix

| Requirement / Scenario | Covering test | Result |
|---|---|---|
| One Row per Conexion / Two connections | "one row per connection; both connections of a tenant carry its start mark" | COMPLIANT |
| Mark Sources / Failed run then ok run | "failed run then ok run..." (first run fallo/preparacion, first ok apart) | COMPLIANT |
| Mark Sources / Re-validation (second result invalida) | "re-validation: latest validation and its state, including invalida" | COMPLIANT |
| Null / No runs yet | "deactivated tenant..." (B1 has a mapping and automation, no runs: all three run marks null, row present) | COMPLIANT |
| Null / Never validated (cleared) | same B1 case: validacion_ultima and estado null | COMPLIANT (single-view case, see WARNING 1) |
| Limits / Limits recorded | Not a test; bitacora inspected: all limits present, dated block under "Consultas ejecutadas" | COMPLIANT (manual, documentary) |
| Limits / Clock mix | Fixture has validation earlier than mapeo_fin; no assertion compares marks | COMPLIANT |
| Read-Only / Read-only content | static test "one read-only statement" plus live run in BEGIN READ ONLY under a column-grant role | COMPLIANT |
| Read-Only / Bound filter | No test: there is no filter (DEC-90 chose no parameter; script has no placeholder, asserted) | N/A by decision (see SUGGESTION 2) |
| Tenant id / No route exposure | static test "no application module in src/ references the script"; grep confirms only the test file matches | COMPLIANT |
| Fixture Test / Database unreachable | Run with an unreachable port: live suite skipped, no failure (manual run; no in-suite assertion) | COMPLIANT |
| No Schema/Route/Engine / Diff surface | git status and git diff --name-only: only docs/01-decisiones.md modified; no prisma/, src/server.ts, engine or scheduler change | COMPLIANT |

## Correctness checks

| Check | Finding |
|---|---|
| One row per Conexion | Base table is Conexion; all other sources are per-connection CTEs LEFT JOINed; no row multiplication |
| DEC-89 marks and column names | All 14 columns present and match design and spec; unreached stages null, never omitted or zero-filled |
| First execution vs first ok | primera (DISTINCT ON, iniciadaEn, id) and primera_ok (min where estado=ok) are separate; asserted |
| SELECT-only, no parameters, no concatenation | One WITH ... SELECT statement, no $n, no backslash, no write keyword (static test); test builds no SQL from input, only fixed role/grant setup |
| Script not referenced by app | Only src/marcas-alta.test.ts mentions it |
| Migration/route/engine/prisma | None in diff |
| Tests run the file unchanged | readFile of the checked-in path, sent as a named query (extended protocol; a second statement is rejected with 42601, asserted) |

## AGENTS.md rules 1-7

1. No arbitrary SQL from P2: no panel surface. OK.
2. Tenant id never from a request: no route, no request input; DEC-90 records the deliberate cross-tenant P4 tool. OK.
3. Read-only: DEC-92 registered; test uses a SELECT-only role plus READ ONLY; manual run uses default_transaction_read_only=on. One DB layer in manual runs is an accepted, registered limit. OK.
4. No concatenation: none in the script. OK.
5. Data minimization: output is ids, timestamps and closed state strings; credencial, host, sql are never read (proved by the 42501 test). OK.
6. Engine untouched. OK.
7. No secrets: the fixture password is for a throwaway test role, same convention as other suites. OK.

Architecture decisions DEC-87..92 were registered before implementation, as AGENTS.md requires.

## Design coherence

Follows design: CTEs plus DISTINCT ON, tie-breaks (validation: validadaEn DESC, entidad, id; first run: iniciadaEn, id), run connection via Automatizacion.conexionId, scripts/ location (DEC-91), named query, column-grant role, UTC parser for OID 1114, FK-order cleanup. Only deviation: the validation semantics in WARNING 1. The template path correction (docs/_plantilla.md) is right.

## validacion_ultima behaviour (flagged by apply)

Implementation: the most recent non-null validadaEn across the connection views, with the state of that same view; null only when no view has a validation. The spec says "a mapping" validated twice and "a connection whose mapping was re-registered (validation cleared)" yields null. Both scenarios are single-view and pass. The spec and DEC-89 do not define the multi-view case. The implementation is consistent with the spec as written and with DEC-89: an interpretation, not a contradiction. It is documented in the script header and the bitacora limits table. Classified WARNING (spec gap), not a deviation.

## Issues

### CRITICAL
None.

### WARNING
1. Spec gap on multi-view semantics: with several views, a re-registered (cleared) view does not null the connection mark while another view remains validated. The fixture covers multi-view only for latest-wins (A1) and the clear case only with a single view (B1); the mixed case is not pinned by a test. Recommend one spec sentence at archive and optionally a fixture case.
2. Test-count instability: one npm test run during this verification reported 625 tests (0 fail); two others reported 633. Not reproduced on rerun; every run had 0 fail. Probably environmental, but unexplained.
3. No citable real capture (accepted by the user): the own DB zerodashboard-db-1 has 2/8 migrations; the bitacora keeps the dated error block plus a labeled control run (0 rows on the test DB). Real marks come at the R1 closing alta (DEC-87). The scenario "a dated run output appears" is met literally, without data.
4. Bitacora commit reference reads "pendiente", and the closing date and time invested are placeholders; fill before archive or at commit time.
5. Task 1.1 deviation: planning artifacts were not committed first (user said no commits); stray 0 and run remain untracked and untouched.

### SUGGESTION
1. Size accepted: about 586 authored lines plus 98 lines of DEC text against a 400 budget; the user approved size:exception for a single PR. Recorded, not a blocker. The tasks forecast (250-350) was too low.
2. The "Bound filter" scenario is vacuous because DEC-90 chose no tenant parameter; amend the spec at archive to match DEC-90 and close the "PENDING DESIGN" text in the tenant identifier requirement.
3. The "Database unreachable" skip has no in-suite assertion; it was confirmed by a manual run against an unreachable port. Acceptable under the convention of the other live suites.

## Verdict

PASS WITH WARNINGS. 0 CRITICAL, 5 WARNING, 3 SUGGESTION. The 8 requirements and 12 scenarios are compliant; the size exception and missing real capture are recorded as accepted. Next: sdd-archive.
