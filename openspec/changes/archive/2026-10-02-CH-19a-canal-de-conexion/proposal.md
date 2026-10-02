# Proposal: CH-19a — Connection Channel Seam and Protocol Types (C1, slice 1)

**Status**: ready for spec and design. Inputs: `CH-19-conectividad-definitiva/exploration.md`, DEC-112..DEC-120 (firm, 2026-10-02). DEC-115 pending point (direct mode in production) does not affect this slice.

## Intent

- C1: the engine must reach tenant databases through an outbound agent (DEC-94, DEC-112). All tenant traffic enters `iniciarConexion` (`src/db-probe.ts`), which only dials TCP.
- Prove, before any route or agent exists, that `pg.Client` over an injected stream keeps every read-only guarantee.

## Scope

### In Scope
- `src/agente-protocolo.ts`: types only for what DEC-113/114/117/118 fix (control vs per-session data channel, session open, closed agent error code, heartbeat). Not wired.
- Optional `canal` on `DestinoPostgres`; when present, `iniciarConexion` passes pg a `stream` factory; when absent, the client config stays byte-identical. `ssl` stays off (DEC-113).
- Thread `canal` through the five `destinoDeConexion` callers (`conexiones.ts`, `consultas.ts`, `plantilla-prueba.ts`, `validacion-mapeo-rutas.ts`, `planificador.ts`). `destinoDeConexion` still never returns one.
- Spike test: in-memory fake duplex relaying bytes to the live test PostgreSQL. Proves `ejecutarConsulta`, DEC-08 privilege check, connect budget (`PRESUPUESTO_AGOTADO`), DEC-111 `'error'` listener on a dropped channel, and `cerrarCliente` without hanging.

### Out of Scope
- `Agente` model/migration, tokens (19b); WebSocket routes, session registry, `destinoDeConexion` returning a channel (19c1); agent process, Docker (19c2); heartbeat, states, `agente-desconectado` category (19d); C3 (19e).
- Any new failure category, env var, dependency (`ws`), or engine capability (rule 6).

## Capabilities

### New Capabilities
- `agent-channel`: protocol type catalog and the optional channel seam contract (absent means direct dial).

### Modified Capabilities
- `query-execution`: a session carried over an injected channel keeps the read-only transaction, DEC-08 check, single statement and budgets unchanged.

## Approach

- One branch inside `iniciarConexion`; no second `new pg.Client`. Callers pass the field through without inspecting it.
- Live PostgreSQL tests; existing suites unchanged.

## Affected Areas

| Area | Impact |
|------|--------|
| `src/agente-protocolo.ts` | New |
| `src/db-probe.ts` (+ spike test) | Modified |
| `src/consulta-ejecucion.ts` | Modified (input type) |
| Five caller files above | Modified (threading) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Spike refutes the stream seam | Low | Stop; DEC-112 reopens with the user, not the agent |
| Fake `end()` hangs on connecting channel | Med | Spike asserts budget-bound close |
| Types drift before consumers exist | Med | Minimal catalog; 19c1/19d amend via delta |
| Channel leaks bytes to logs (rule 5) | Low | Seam never logs or buffers |
| Size over budget | Med | Hard cap 400 lines |

## Rollback Plan

Revert the PR. No schema, env or dependency change; `canal` is optional and no production path sets it, so direct mode is unaffected.

## Dependencies

- DEC-112..DEC-120 committed on `ch19/conectividad-definitiva` before the PR.

## Review Workload Forecast

- ~280-380 changed lines; `400-line budget risk: Medium`; `Chained PRs recommended: No` (this slice is one link of the CH-19 chain); `Decision needed before apply: No`.

## Success Criteria

- [ ] Without `canal`, client config is identical and all existing tests pass.
- [ ] `ejecutarConsulta` over the fake channel returns rows and still blocks a write-privileged role.
- [ ] A silent channel fails `tiempo-agotado` within budget; a dropped channel does not crash the process.
- [ ] No production path supplies a channel.
