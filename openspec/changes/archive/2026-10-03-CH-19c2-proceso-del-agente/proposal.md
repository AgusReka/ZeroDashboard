# Proposal: CH-19c2 — Agent Process

**Status**: ready for spec and design. Inputs: `exploration.md`, DEC-112..DEC-123 (firm), AGENTS.md rules 1-7.

## Intent

- 19c1 ships the engine endpoint; no agent dials it, so no customer replica is reachable.

## Scope

### In Scope
- `src/agente-proceso/`: config (errors name the variable only), TLS rule, literal allowlist, limits parity.
- JSON-lines logger; binary bridge with backpressure; 16-session cap.
- Backoff, control loop, exit classification, ping watchdog.
- `main`, shutdown, exit codes 0-3, boundary test.
- `tsconfig.agente.json`, `agente` stage, `docker-compose.agente.yml`, `.env.agente.example`, `build:agente`, quoted test glob.
- End-to-end matrix with a real agent.

### Out of Scope
- 19d1 heartbeat/reachability, 19d2 category, 19e runbook and image distribution.
- Queue, session retry, health port, wildcards, new control messages, engine wiring.

## Capabilities

### New Capabilities
- `agent-process`: configuration, TLS, allowlist, reconnect, control loop, bridge, session cap, shutdown, exit codes, logging, packaging, engine-code boundary.

### Modified Capabilities
- None. `project-environment` requirements (default bring-up, env vars, placeholder secrets) are untouched: the separate Compose file leaves `docker compose up` unchanged; tsconfig, glob and stage order are build mechanics. Agent packaging goes in `agent-process`.
- `agent-channel` unchanged, no conflict: agent cap 16 sits above engine cap 8; `ECONNREFUSED` and `EHOSTUNREACH` are existing codes.

## Approach

- `iniciarAgente({ config, log, programar, aleatorio })` returns `{ terminado, detener() }`; `main.ts` maps the reason to an exit code.
- URL validated before `new WebSocket`; `maxPayload`, `perMessageDeflate: false`, `rejectUnauthorized: true` explicit.

## Affected Areas

| Area | Impact |
|------|--------|
| `src/agente-proceso/` (+ tests), `tsconfig.agente.json`, `docker-compose.agente.yml`, `.env.agente.example` | New |
| `Dockerfile`, `package.json`, `.gitignore`, `.dockerignore` | Modified |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Secrets or targets in logs (rules 5, 7) | Med | Closed events; stdout test |
| Byte inspection (rule 1) | Low | Boundary test forbids `pg`, Prisma |
| Allowlist bypass (rule 6) | Med | Exact normalized match |
| Real TLS untested end to end | Med | Policy and options tests; check `NODE_TLS_REJECT_UNAUTHORIZED=0` at apply |
| Quoted glob drops tests | Low | Compare test count |
| PRs 1-3 exceed 400 | High | Stop; move extras forward |

## Rollback Plan

- Nothing wired into the engine, no migration: revert PRs 5 to 1.
- Equivalent: delete the new files; revert `Dockerfile`, `package.json` and ignore-file edits. Engine image and default Compose unaffected.

## Dependencies

- 19c1 merged; DEC-123 committed (`a15850d`).

## Review Workload Forecast

- ~1.6k lines, five chained PRs: 1) config, TLS, allowlist, limits ~320; 2) logger, bridge ~340; 3) backoff, loop, 401/403/4001/4002, watchdog ~355; 4) main, shutdown, boundary, build files ~300; 5) e2e ~300.
- `400-line budget risk: High`; `Chained PRs recommended: Yes`; `Decision needed before apply: No`.

## Success Criteria

- [ ] Probe runs through a real agent; unlisted target gets zero accepts.
- [ ] 401/4002 exit 2; 4001 exits 3; cut reconnects.
- [ ] 1 MB result crosses frames; stdout has no secrets.
- [ ] Engine image, default Compose and test count unchanged.
