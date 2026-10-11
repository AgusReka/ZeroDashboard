# Verify Report: CH-20 — Query execution audit

**Date**: 2026-10-11. **Branches**: `ch20/registro`, `ch20/listado`, `ch20/registro-rutas`, `ch20/registro-sondeos`, `ch20/consulta-guardada`, stacked on `ch20/exploracion` (PRs #147 to #152). Verified at `e8fe8b0`.
**Verdict**: PASS with warnings. No blockers, no critical findings.
Verified inline by the orchestrator: the Claude Code hook refuses `sdd-*` sub-agent dispatch. An independent read-only verifier (general-purpose agent) reviewed the whole implementation during apply; its two should-fix findings are fixed in `e8fe8b0` (see #152).

## Commands

| Command | Result |
|---|---|
| `npx tsc -p tsconfig.json --noEmit` | exit 0, no output |
| `npm run build` | ok |
| `npm test` against the dev database (`TEST_DB_PORT=5434`, password `postgres`) | 1256 tests, 1252 pass, 4 fail: the known `conexiones` false positives (W2). No suite skipped by the reachability probe |
| `scripts/smoke.sh` | not run: CH-20 does not change the smoke script, and every audited path is covered by live-database tests |
| Applied migration | `20261011000000_registro_ejecucion` applied to the dev database; table drift none (the trigger is outside Prisma's model, by design) |

## Spec coverage — `specs/execution-audit/spec.md`

| Requirement / scenario | Evidence |
|---|---|
| Audit record: columns, no values nor rows | migration and schema; `auditoria.test.ts` (`veredictoDeEjecucion`, `filaDeAuditoria`); `auditoria-registro.test.ts` "an ad hoc query writes one row with the operator, the statement and the row count", "bound values never reach the row" |
| Every audited path records its execution | `auditoria-registro.test.ts`: ad hoc query, "the template test records the composed statement and the template id", "the mapping validation records every probe statement", "the connection probe records its fixed statement" |
| A read-only rejection is recorded as a failure | "a read-only rejection is recorded as a failure with its phase and category" |
| A refused request records nothing | "a request refused before the engine writes nothing" (404 and 400) |
| Recording never breaks an execution | "a failed audit write keeps the answer and logs an error without the statement"; "a failing saved query lookup keeps the answer and records the run as ad hoc" |
| The record cannot be changed | `auditoria-tabla.test.ts`: update, delete, raw `DELETE` and `TRUNCATE` refused by the trigger; "deleting the tenant works and leaves its audit rows in place" |
| List the audit: tenant only, order, filters, cap, 400 | `auditoria-rutas.test.ts` (five cases); `auditoria.test.ts` filter parsing (impossible dates, offsets, date-only `hasta` covering the day); `rutas.test.ts` proves the route is behind the operator guard |
| No operator | "a request without an operator records nothing and logs an error" |

## Spec coverage — `specs/query-execution/spec.md` (delta)

| Requirement / scenario | Evidence (`auditoria-registro.test.ts`) |
|---|---|
| The loaded query runs unchanged | "the loaded query run unchanged is recorded with its id, version and name"; "a past version run with its own text is recorded with that version" |
| Edited text, unknown version, another tenant's query | "an edited text, an unknown version or another tenant query is recorded as ad hoc, and answers as usual" |
| Both fields or neither | "one reference field without the other is a 400 and records nothing"; "a version beyond a 32-bit integer is a 400 and records nothing" |

## Spec coverage — `specs/query-console/spec.md` (delta)

| Requirement / scenario | Evidence (`consola.test.ts`, prefix `CH-20`) |
|---|---|
| Running the loaded query | "running the loaded query unchanged sends its id and version"; "after saving a new version, running the saved text sends the new version" |
| Running after an edit, or with nothing loaded | "running after an edit sends neither field"; "running with no query loaded sends neither field" |

## Design deviations (accepted)

- The saved query cases live in `auditoria-registro.test.ts` instead of a separate `consultas-auditoria.test.ts`: that suite already holds the tenant, the connection, the read-only role and the operator.
- `registrarEjecucion` skips (and logs `error`) a request with no operator, which only a guard-less test app has.
- PRs split beyond the plan to stay within 400 lines: PR1a/1b and PR2a/2b.

## Warnings

- **W1** — Known details kept as they are (#152): on a mapping-validation session failure the row lists the probe statements although none ran (its `fase` says so); the ad hoc `sql` omits the engine's pagination wrapper; the audit write has no timeout of its own; no test covers `credencial-ilegible` or the "nothing mapped" path writing no row.
- **W2** — Pre-existing, not caused by CH-20: with `POSTGRES_PASSWORD=postgres` four `conexiones` tests fail.
- **W3** — Audit rows written by the test suites accumulate in the development database: the trigger forbids deleting them (DEC-162).
- **W4** — TDD exception: the trigger was written in the migration before its test, which passed at once.
- **W5** — No screen: C-12 belongs to CH-30 (DEC-163).
