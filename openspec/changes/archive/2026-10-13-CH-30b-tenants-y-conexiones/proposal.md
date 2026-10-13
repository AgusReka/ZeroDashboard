# Proposal: CH-30b — Tenants and Connections screens

**Status**: ready for spec and design. Inputs: exploration.md, DEC-164 to DEC-168, the design guide (C-02, C-05), CH-30a's shell.

## Intent
- P1 creates and deactivates tenants (T1) and registers and tests a tenant's connections (A1) from the console, without outside tools.
- Follow the onboarding path of the design guide: Tenants first, then Conexiones.

## Scope

### In Scope
- `GET /conexiones` answers the public connection fields (`ConexionPublica`), never the credential (DEC-167).
- Navigation: a "Global" group with **Tenants** (`#tenants`) above the existing "Trabajo diario" group, and a "Puesta en marcha" group with **Conexiones** (`#conexiones`) (DEC-165 order).
- **Tenants** screen (global): list of every tenant (`GET /tenants?incluirInactivos=true`) with name, short id, state and creation date; "Nuevo tenant" (name) → `POST /tenants`, then the tenant selector reloads; per active tenant "Elegir como activo" and "Dar de baja" with an inline confirmation «Dar de baja {nombre}» → `POST /tenants/:id/baja`. A deactivated tenant is listed as "Dado de baja" with no action (DEC-168). Deactivating the active tenant returns the console to "ningún tenant" with a notice.
- **Conexiones** screen (active tenant): list with name, engine, host:port, database, user; "Nueva conexión" side panel (`.zd-drawer`): name, host, port, database, user, password → "Guardar y probar" registers, then tests and shows the result in the panel; "Probar" per row with the result next to the button (ok with duration, or failure with category and code). The password is never shown back ("Guardada cifrada · no se muestra").

### Out of Scope
- Agents and agent-bound connections (CH-30c); deleting or editing a connection; reactivating a tenant (DEC-14).
- The stored last test, the date of baja and per-tenant counts (DEC-167); the frozen bar state (DEC-168).

## Capabilities

### Modified Capabilities
- `connection-registration`: the listing answers the public fields.
- `query-console`: navigation adds Tenants and Conexiones; the two screens.

## Approach
Same pattern as CH-30a and the existing sections: static markup with ids the script fills through `textContent` and toggles through `hidden`; no `zd-*` class from the script (G3'). Global routes are called with `fetch` and the 401 check, tenant routes through `pedir()`.

## Affected Areas
- `src/conexiones.ts` and its listing tests
- `src/consola.ts`, `src/consola.test.ts`

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| The password reaches the page after registering | Low | The create and list answers never carry it (existing tests); the script clears the field after sending |
| A deactivated active tenant keeps being used | Low | After a baja of the active tenant the script resets to no tenant, as it does on `409 tenant-desactivado` |
| Script grows past what one PR can review | Medium | Two PRs: Tenants (+ navigation groups), then Conexiones (+ API widening) |

## Review Workload Forecast
- PR1: navigation groups and the Tenants screen with tests: ~330 lines
- PR2: `GET /conexiones` widening and the Conexiones screen with tests: ~370 lines
Total ~700; **400-line budget risk: High; Chained PRs recommended: Yes; Decision needed before apply: Yes** (session strategy `single-pr`).
