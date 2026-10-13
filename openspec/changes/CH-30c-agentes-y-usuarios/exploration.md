# Exploration: CH-30c — Agents and panel users screens

Status: explored 2026-10-13. Store: openspec. Third cut of CH-30 (DEC-166). No new architecture decision is needed: both screens sit on existing, decided APIs (DEC-121 for agents, DEC-155 to DEC-158 for panel users) and in the navigation DEC-165 fixed.

## What exists (verified)

| Piece | State |
|---|---|
| Agents | One agent per tenant (`Agente.tenantId` unique), **no name**. `POST /agentes` emits a token (201) or re-issues it in place for a revoked agent (200), answering `{ agente, token }` once with `no-store`; `409 agente-existente` if one is live. `GET /agentes`: zero or one entry (`id`, `creadoEn`, `tokenEmitidoEn`, `revocadoEn`). `POST /agentes/:id/revocar`: soft revocation, `409 agente-revocado` if already revoked. |
| Agent-bound connections | `POST /conexiones` accepts an optional `agenteId` of the same tenant (`404 agente-no-encontrado` otherwise); CH-30b's panel does not offer it yet. |
| Panel users | CH-28: `POST /usuarios` (generated password once), `GET /usuarios`, `POST /usuarios/:id/clave`, `/desactivar`, `/reactivar`. |
| Design guide | C-05 "Agentes" tab (token shown once with "Copiar", revoke with confirmation explaining the impact); connectivity columns are CH-19d1, not built. No design for panel users: built with the same components (DEC-165). |

## Shape

- **Agentes** (`#agentes`, Puesta en marcha): the tenant's agent, if any, with its state (active / revoked), creation and last token emission dates. "Crear agente" (none yet) or "Emitir un token nuevo" (revoked) → the token appears once in a banner with "Copiar" and "Ya lo guardé", which clears it; "Revocar" with an inline confirmation that says the agent's connections stop working until a new token is emitted.
- **Conexiones**: the new-connection panel gains "Cómo llega" — direct, or through the tenant's agent when it has an active one (`agenteId`).
- **Usuarios del panel** (`#usuarios`, Puesta en marcha): list (email, name, state, created); "Nuevo usuario" (email, optional name) → the generated password appears once with "Copiar" and "Ya la guardé"; per row "Reponer clave" (password shown once), "Desactivar" (inline confirmation) or "Reactivar".
- A secret shown once is cleared when the operator presses "Ya lo guardé", leaves the screen or switches tenant; it is never written anywhere else.

## Risks
- A token or password lingering on screen or in a node after it was dismissed: clear the node's text; tests scan every node.
- Clipboard: `navigator.clipboard.writeText` may be unavailable; "Copiar" then says to select and copy by hand.

## Size
~850 lines with tests: two PRs (Agentes with the connection option; Usuarios del panel).
