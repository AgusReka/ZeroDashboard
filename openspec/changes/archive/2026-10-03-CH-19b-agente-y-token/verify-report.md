```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:5a72493cf499204ea948ce5e9cfd8bd6cec1f52763861b894c0365f3cd1a4e48
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 13/13
scenarios: 33/33
test_command: "TEST_DB_PORT=5434 npm test"
test_exit_code: 0
test_output_hash: sha256:269e354aef8aae713be24ea7cbc4ea86758fa1d0a9ff86004c8e7baae4332cba
build_command: "npx tsc --noEmit"
build_exit_code: 0
build_output_hash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

# Verification Report: CH-19b-agente-y-token

Mode: openspec, standard (strict_tdd false). HEAD 81dbb49, branch ch19b/agenteid-en-conexiones (units 1a, 1b, 2).

## Completeness

All 24 tasks (1.1-3.6) are checked and match the code state. Tasks 1.9, 2.7 and 3.5 (line counts) were recorded as within 400, with the 1b split documented in `tasks.md`.

## Execution evidence

| Command | Exit | Result |
|---|---|---|
| `npx tsc --noEmit` | 0 | no output |
| `TEST_DB_PORT=5434 npm test` (run 1) | 0 | tests 707, pass 707, fail 0, cancelled 0, skipped 0. Suite `automation routes - create, list, get, deactivate, runs` and two `plantilla test route` suites self-skipped (reachability probe), plus the Mailpit suite |
| `TEST_DB_PORT=5434 npm test` (run 2) | 0 | tests 717, pass 717, fail 0. Skipped suites: `automation routes - create, list...` and Mailpit |
| `npx tsx --test src/automatizaciones-rutas.test.ts` (alone) | 0 | tests 11, pass 11, fail 0, skipped 0 |
| Focused: aislamiento, agente-token, agentes-rutas, agentes-rutas-sin-db | 0 | tests 76, pass 76, fail 0, skipped 0 |

The total varies between runs (707, 717; the author saw 725) only because live-PostgreSQL suites outside this change self-skip when their 1-second probe fails under load. Every CH-19b test ran and passed in every run. The self-skipping suites are unrelated to this change and pass when run alone.

## Spec compliance matrix

| Spec | Scenario | Test | Result |
|---|---|---|---|
| agent-registration | Second agent for a tenant rejected by DB | aislamiento `1.5` | COMPLIANT |
| agent-registration | Shared token hash rejected | aislamiento `1.5` | COMPLIANT |
| agent-registration | Creating the first agent | R1 (201, no-store, four keys, stored hash = sha256) plus K1 | COMPLIANT |
| agent-registration | Body naming a tenant rejected | R3 (sin-db) | COMPLIANT |
| agent-registration | Re-issuing a revoked agent | R7 (both) | COMPLIANT |
| agent-registration | Creating over an active agent | R2 | COMPLIANT |
| agent-registration | Listing only own agent | R4 | COMPLIANT |
| agent-registration | Revoking another tenant's agent | R5 | COMPLIANT |
| agent-registration | Revoking keeps the row | R5 | COMPLIANT |
| agent-registration | List and revoke omit secrets | R4, R5 (`sinSecretos`) | COMPLIANT |
| agent-registration | Valid token resolves | L2 | COMPLIANT |
| agent-registration | Revoked or unknown fails | L2, R6 | COMPLIANT |
| agent-registration | Re-issued token supersedes | R7 | COMPLIANT |
| tenant-isolation | Reading another tenant's agent | R5, R4 | COMPLIANT |
| tenant-isolation | Listing only own rows | R4 | COMPLIANT |
| tenant-isolation | Agente outside a context fails closed | L1 | COMPLIANT |
| tenant-isolation | Model list pin includes Agente | domain-model pin test | COMPLIANT |
| tenant-isolation | Lookup works without context | L2 | COMPLIANT |
| tenant-isolation | Other unscoped operations fail | L2 `every other unscoped` | COMPLIANT |
| tenant-isolation | Deactivated tenant | L2 (`tenantActivo`) | COMPLIANT |
| tenant-isolation | Two tenants, two tokens | L2, R8 | COMPLIANT |
| connection-registration | Valid connection; incomplete; no tenant | existing connection suites, unchanged and passing | COMPLIANT |
| connection-registration | Registering with own agent | C1 | COMPLIANT |
| connection-registration | Another tenant's agent | C2/C3 | COMPLIANT |
| connection-registration | Nonexistent agent | C2/C3 | COMPLIANT |
| connection-registration | Revoked agent of same tenant | C4 | COMPLIANT |
| connection-registration | Deleting a bound agent | aislamiento `1.5` | COMPLIANT |
| domain-data-model | Schema inspection, Plantilla, Usuario forbidden, Agente tenant-scoped | domain-model pin test plus L1 | COMPLIANT |

Envelope totals count the `### Requirement:` and `#### Scenario:` headings in the four spec files: 13 and 33. Scenarios from the unchanged parts of the specs (connection, domain model) are covered by the existing suites that passed.

## Correctness checks

| Check | Result |
|---|---|
| `tokenHash` in production `src/` (non-test, non-generated) | Only the lookup (`aislamiento-prisma.ts:150,153`), the create (`agentes-rutas.ts:92`) and the re-issue (`agentes-rutas.ts:80`); the other hits are doc comments |
| Projections | `AgentePublico` has four keys, no `tokenHash` or `tenantId`; tests assert it. `ConexionPublica` adds only `agenteId` |
| Logs and error bodies | `agentes-rutas.ts` and `agente-token.ts` have no log call; error bodies are fixed strings. Fastify default logging does not log bodies. Not re-run end to end here; the author's smoke run reports 0 token lines in the log |
| `contexto-tenant.ts` | Unchanged (empty diff vs master) |
| `package.json`, lockfile, `.env.example`, `docker-compose.yml` | Unchanged |
| Migration | Additive, rollback SQL in the header, both FKs `ON DELETE RESTRICT`, full unique indexes on `tenantId` and `tokenHash`; schema also states `onDelete: Restrict` |
| `Agente` in `MODELOS_AISLADOS` | Yes; lookup runs on the closed-over raw client |
| Rule 1, 3, 4 | No SQL editor, no raw SQL, driver parameters only (Prisma) |
| Rule 2 | Tenant only from header/context; `agenteId` resolved on the scoped client, same 404 for foreign and unknown ids |
| Rule 5, 6, 7 | No personal fields exposed; engine not extended; no secrets in repo |
| New architecture decision | None found. Differences from the design are the documented fallbacks |
| Stray files | `git status` shows only the two pre-existing untracked items (`docs/design/`, `docs/verificacion-tesis-2026-10-01.md`). No stray file was created by this verification. Empty `200` and `prisma;C` at the repo root predate the change |

## Design coherence

Follows the design: single lookup in the isolation module, one row per tenant with in-place re-issue, guarded `updateMany` for concurrent writes, `no-store` only on the two token responses, scoped `findUnique` before the connection create. Known deviations accepted by the author: unit 1b split (no-PostgreSQL suite moved to unit 2), `propertyNames: false` instead of `enum: []` (design fallback), bodyless `POST /agentes` is 400.

## Issues

CRITICAL: none.

WARNING:
1. The full-suite total is not stable (707, 717, 725) because unrelated live-PostgreSQL suites self-skip under load. It is not a defect of this change, but a green `npm test` does not by itself prove those suites ran. They pass when run alone (`automatizaciones-rutas.test.ts` 11/11).
2. Bodyless `POST /agentes` returns 400 (callers must send `{}`). Accepted per design and recorded in the route comment; document it for 19c/operator callers.

SUGGESTION:
1. Add a test that captures the Fastify log output during emit and asserts it contains neither the token nor its hash. The current evidence for this is the author's manual smoke run.
2. Remove or ignore the empty root files `200` and `prisma;C`.

## Verdict

PASS WITH WARNINGS
