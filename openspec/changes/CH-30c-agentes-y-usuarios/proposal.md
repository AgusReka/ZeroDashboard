# Proposal: CH-30c — Agents and panel users screens

**Status**: ready for spec and design. Inputs: exploration.md, DEC-121, DEC-155 to DEC-158, DEC-164 to DEC-166, the design guide (C-05 Agentes).

## Intent
- P1 emits, re-issues and revokes the tenant's agent token (C1) and connects through the agent, from the console.
- P1 gives a client administrator panel access, resets a password, and cuts or restores access (T3), from the console.
- Every secret (agent token, generated password) is shown once and then gone.

## Scope

### In Scope
- Navigation: "Agentes" and "Usuarios del panel" in "Puesta en marcha", after Conexiones (DEC-165).
- **Agentes** screen (`#agentes`): state of the tenant's one agent; create, re-issue, revoke with inline confirmation; the token shown once with "Copiar" and "Ya lo guardé".
- **Conexiones** panel: "Cómo llega" — direct or through the tenant's active agent (`agenteId`).
- **Usuarios del panel** screen (`#usuarios`): list; create (email, optional name) with the password shown once; per row reset the password (shown once), deactivate (inline confirmation) or reactivate.
- A shown secret is cleared on "Ya lo guardé", on leaving the screen and on switching tenant.

### Out of Scope
- Agent connectivity and "at risk" automations (CH-19d1, CH-19d2).
- An agent name (the model has none); several agents per tenant (DEC-121).
- Editing a user's email or name, deleting a user (DEC-158).

## Capabilities

### Modified Capabilities
- `query-console`: navigation adds two items; the Agentes and Usuarios del panel screens; the connection panel's agent option.

## Approach
Same pattern as CH-30b: static markup with ids, rows built by the script as text, no `zd-*` class from the script, tenant routes through `pedir()`. One small helper shows a secret once (`mostrarSecreto(nodo, texto)`) and one clears it (`olvidarSecreto(nodo)`), used by both screens.

## Affected Areas
- `src/consola.ts`, `src/consola.test.ts`

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| A secret stays in the page after it was dismissed | Low | One clear helper; tests scan every node after dismissing, leaving the screen and switching tenant |
| A revoked agent breaks connections without warning | Medium | The revoke confirmation says it, before sending |
| Clipboard unavailable (insecure context) | Medium | "Copiar" falls back to a message asking to copy by hand |

## Review Workload Forecast
- PR1: navigation, Agentes screen, the connection panel's agent option, tests: ~420 lines
- PR2: Usuarios del panel screen, tests: ~430 lines
Total ~850; **400-line budget risk: High; Chained PRs recommended: Yes; Decision needed before apply: Yes** (session strategy `single-pr`).
