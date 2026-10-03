# Proposal: CH-19c1 — Engine Side of the Agent Channel

**Status**: ready for spec and design. Inputs: `exploration.md`, DEC-112..DEC-122 (firm; DEC-122 amends DEC-116), AGENTS.md rules 1-7.

## Intent

- The 19a seam and 19b token exist; no server, registry or production channel does. 19c2 needs a live endpoint.

## Scope

### In Scope
- `ws`; `sesion-fallida` in the catalog.
- `CanalAgente` honoring the 19a Fake Duplex Contract (inert factory, lazy session, async failures, backpressure).
- In-memory registry: control replacement (4001), agent-bound session ids, constant limits.
- `noServer` upgrade: header-only auth before 101, ping, close in `onClose`.
- Revoke and tenant baja close sockets (4002).
- `destinoDeConexion` returns a channel; registry threaded to five callers; fail-closed default; at-use tenant check.

### Out of Scope
- 19c2, 19d1, 19d2, 19e work; proxy/TLS, operator auth, env vars; queue, wait or direct-dial fallback.

## Capabilities

### New Capabilities
- None. The registry has no contract outside the channel.

### Modified Capabilities
- `agent-channel`: catalog and caller-threading requirements MODIFIED; ADDED registry, upgrade authentication, limits and ping, no-control-channel failure.
- `agent-registration`: ADDED revoke and baja close live sockets.

## Approach

- Extend the 19a seam; `CanalFalso` stays test-private; tests on a real ephemeral port. No-control-channel code named in design.

## Affected Areas

| Area | Impact |
|------|--------|
| `package.json`, `src/agente-protocolo.ts`, `src/server.ts` | Modified |
| Channel, registry, upgrade modules (+ tests) | New |
| `src/agentes-rutas.ts`, `src/tenants.ts`, `src/conexion-destino.ts`, five callers | Modified |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Cross-tenant session (rule 2) | Low | Token-row tenant; at-use check; two-tenant test |
| Frame leak (rule 5) | Med | No content logs; deflate off |
| Engine widened (rule 6) | Med | No queue, wait, direct dial |
| Crash or `app.close()` hang | Med | Early `'error'` listener; terminate in `onClose` |
| Slice 3 exceeds 400 | High | Checkpoint; stop for decision |

## Rollback Plan

- No migration: revert PRs 4 to 1.
- Reverting 4 restores the no-channel path; no agent exists before 19c2.

## Dependencies

- 19b merged; DEC-122 committed (`278d8f8`).

## Review Workload Forecast

- ~1,000 lines, four chained PRs: 1) `ws`, catalog, `CanalAgente`, contract tests ~305; 2) registry ~190; 3) upgrade, auth, ping, `onClose`, revoke/baja ~370; 4) `destinoDeConexion`, callers, end-to-end ~150-210.
- `400-line budget risk: High`; `Chained PRs recommended: Yes`; `Decision needed before apply: No`.

## Success Criteria

- [ ] `CanalAgente` passes the 19a contract table.
- [ ] Upgrade answers 401/403/404 before 101.
- [ ] Agent query runs end-to-end; no control socket fails asynchronously, unretried.
- [ ] Tenant B cannot use A's session; revoke/baja close with 4002.
- [ ] `app.close()` returns; existing suites pass.
