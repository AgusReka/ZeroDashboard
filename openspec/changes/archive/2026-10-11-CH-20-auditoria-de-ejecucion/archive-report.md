# Archive Report: CH-20

**Change**: CH-20 — Query execution audit (A5)
**Archived at**: 2026-10-11
**Destination**: `openspec/changes/archive/2026-10-11-CH-20-auditoria-de-ejecucion/`
**Main specs synced**: `openspec/specs/execution-audit/spec.md` (new capability), `openspec/specs/query-execution/spec.md` and `openspec/specs/query-console/spec.md` (one ADDED requirement appended to each)

## Artifacts

exploration.md, proposal.md, specs/execution-audit/spec.md, specs/query-execution/spec.md, specs/query-console/spec.md, design.md, tasks.md, verify-report.md, archive-report.md.

## Decisions registered (`docs/01-decisiones.md`)

- DEC-159: every console path that dials a client's database is audited; scheduled runs stay in `Ejecucion`.
- DEC-160: the record keeps the full statement, never parameter values nor rows.
- DEC-161: a saved query run from the editor is recorded with its id and version, only when the text matches that version.
- DEC-162: the record cannot be changed or deleted (database trigger, no foreign keys), and a failed write never breaks the execution.
- DEC-163: the change delivers the record and `GET /auditoria`; the C-12 screen belongs to CH-30.

## Verify summary

Verdict PASS with warnings (see `verify-report.md`): `tsc` clean, build ok, 1252 of 1256 tests pass and the other four are the known `conexiones` false positives; every spec scenario has an automated test. An independent read-only verifier found no blocker; its two should-fix findings (the saved query check could turn an executed query into a 500; a date-only `hasta` excluded its day) are fixed with failing tests first.

## Final state

- Migration `20261011000000_registro_ejecucion`: table `RegistroEjecucion`, index `(tenantId, creadoEn)`, function `registro_ejecucion_inmutable()` and triggers refusing UPDATE, DELETE and TRUNCATE; scoped in `MODELOS_AISLADOS`.
- `src/auditoria.ts`: verdict mapping, `registrarEjecucion`, `consultaGuardadaVerificada`, filters and `GET /auditoria`.
- Recording in `src/consultas.ts`, `src/plantilla-prueba.ts`, `src/validacion-mapeo-rutas.ts` and `src/conexiones.ts`; `sentenciaDeSondeo` (engine) and `SENTENCIA_PRUEBA` (probe) exported so the row holds what ran.
- `POST /consultas/ejecutar` accepts `consultaGuardadaId` and `version`; the console sends them while the editor holds the loaded text.
- No change in the scheduler, the engine's behaviour or the client panel.

## Open items

- The C-12 audit screen (CH-30).
- W1 details in `verify-report.md`.
- Audit rows from test suites accumulate in the development database by design.
