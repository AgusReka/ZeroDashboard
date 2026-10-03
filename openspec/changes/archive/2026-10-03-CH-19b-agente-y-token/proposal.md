# Proposal: CH-19b — Agent Model and Agent Token

**Status**: ready for spec and design. Inputs: `exploration.md`, DEC-112..DEC-121 (firm; DEC-121 decided by the user 2026-10-03), AGENTS.md rules 1-7.

## Intent

- DEC-114/115: each tenant's agent authenticates with its own token; the tenant comes only from the token row. Neither exists yet.
- 19c1 must resolve a token before tenant context exists, without a fail-open model (DEC-121).

## Scope

### In Scope
- One additive migration: `Agente` (`tenantId` unique full index, `tokenHash` unique, `creadoEn`, `tokenEmitidoEn`, `revocadoEn`) and nullable `Conexion.agenteId`, FK `RESTRICT` explicit.
- `Agente` in `MODELOS_AISLADOS`; one typed lookup by `tokenHash` in `extenderConAislamiento` (non-revoked only; returns `id`, `tenantId`, tenant state).
- `/agentes` scoped by `X-Tenant-Id`: create, in-place re-issue, 409 `agente-existente`, list, soft revoke. Token shown once, `Cache-Control: no-store`.
- Optional `agenteId` on `POST /conexiones`, scoped check, 404 `agente-no-encontrado`.

### Out of Scope
- `/agente/*` exemption, WebSocket (19c1); agent process (19c2); heartbeat/state columns (19d1); categories (19d2); runbook (19e).
- Console UI, token history, rotation overlap, `PATCH /conexiones`, `ws`, runtime values in `agente-protocolo.ts`.

## Capabilities

### New Capabilities
- `agent-registration`: `Agente` model; token emit, re-issue, list, revoke; typed lookup by hash.

### Modified Capabilities
- `tenant-isolation`: `Agente` joins `MODELOS_AISLADOS`; the lookup is the single audited unscoped read.
- `connection-registration`: optional `agenteId` with tenant-scoped ownership check.
- `domain-data-model`: the permitted-model list in "No Premature Modeling" admits `Agente`.

## Approach

- Reuse `tenants.ts`, `automatizaciones-rutas.ts`, `conexiones.ts`, `cripto-credencial.ts` patterns. Body never accepts `tenantId`.
- An early test proves the extension on the chained client; on failure, parametrized raw SQL (DEC-121, no reopen).

## Affected Areas

| Area | Impact |
|------|--------|
| `prisma/schema.prisma`, new migration folder | New/Modified |
| `src/aislamiento-prisma.ts`, `src/aislamiento.test.ts` | Modified |
| `src/agentes-rutas.ts` (+ tests), app wiring | New/Modified |
| `src/conexiones.ts` (+ tests) | Modified (unit 2) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Token resolves to another or deactivated tenant (rule 2) | Low | Lookup returns tenant state; two-tenant test |
| Token, hash or `tenantId` leaks (rules 5, 7) | Med | Projection without them; generated test tokens |
| Extension fails on chained client | Med | Early test; raw SQL fallback |
| `domain-data-model` enumerates permitted models without `Agente` | High | Orchestrator to add that delta |
| Parallel suites collide | Med | FK-order cleanup, marker assertions |

## Rollback Plan

- Unit 2: revert the PR; no schema change.
- Unit 1: revert unit 2, then unit 1, then run the SQL carried in the migration header:
  `ALTER TABLE "Conexion" DROP CONSTRAINT "Conexion_agenteId_fkey"; ALTER TABLE "Conexion" DROP COLUMN "agenteId"; DROP TABLE "Agente";`
- No token consumer exists before 19c1.

## Dependencies

- DEC-121 and map update committed before PR 1.

## Review Workload Forecast

- ~610 lines (~220 code, ~390 tests); one PR would exceed 400. Chained: unit 1 ~360, unit 2 ~140 stacked on it.
- `400-line budget risk: Medium` (per unit); `Chained PRs recommended: Yes`; `Decision needed before apply: No` (chained, not `size:exception`).

## Success Criteria

- [ ] Unscoped `Agente` access is filtered; the pin test lists `Agente`.
- [ ] Token returned once, stored only as hash; revoked token fails lookup.
- [ ] A second tenant cannot list, revoke or bind another tenant's agent.
- [ ] Migration header carries rollback SQL; existing suites pass.
