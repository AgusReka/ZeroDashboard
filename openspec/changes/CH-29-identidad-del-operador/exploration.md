# Exploration: CH-29 — Operator identity in the console (proposed 2026-10-09)

Status: **proposed**, not started. Store: openspec. This exploration decides nothing: the architecture decisions below are the owner's (`AGENTS.md`) and must be registered in `docs/01-decisiones.md` before any code.

## Why

- **A5** (P1, R2): "auditoría de qué se ejecutó, cuándo, contra qué tenant **y por quién**". CH-20 builds the audit, but the console has no notion of *who* operates, so the last part of A5 cannot be met.
- DEC-15 chose "tenant explicit per request, no server session" because "P1 es el único operador de la consola" and the project had no session infrastructure. That reasoning predates CH-22a, which built exactly that infrastructure for the panel.
- Today anyone who can reach `/consola` can operate **every tenant**. For a thesis prototype on a local machine that is a conscious trade-off; for anything shown to a third party it is the first thing they will ask about.

## What exists (verified)

| Piece | State |
|---|---|
| Console routes | No authentication anywhere: `src/server.ts` has no auth hook; `GET /consola` and `/tenants` are exempt from the tenant header, and every other console route only needs `X-Tenant-Id`. |
| Panel session machinery | `SesionPanel` + cookie `zd_panel_session` (`HttpOnly`, `SameSite=Lax`, `Secure`), scrypt (`src/crypto-auth.ts`), hook `levantarSesionPanel`. **Tenant-bound**: `Usuario.tenantId` and `SesionPanel.tenantId` are required, so it cannot represent an operator that spans tenants. |
| Agents | Authenticate by their own token on a WebSocket upgrade; must keep working untouched. |
| Tests and smoke | About a thousand tests call routes with `app.inject` and only `x-tenant-id`; `scripts/smoke.sh` uses `curl` with no credentials. |

## Decisions that are not mine to take

1. **Who is an operator, and where does it live?**
   - (a) New `Operador` and `SesionConsola` tables, reusing scrypt and the cookie pattern. Supports several named operators.
   - (b) Reuse `Usuario` with a nullable tenant and a role. Fewer tables, but it mixes the two surfaces DEC-04 keeps apart.
   - (c) One operator credential from an environment variable (rule 7) behind a cookie session; identity is a configured name. Smallest, but "por quién" can only ever name one person.
   - (d) Leave authentication to the infrastructure (reverse proxy, VPN) and record an identity header. No code, but the trust boundary moves outside the repository.
2. **Mandatory or opt-in?** A guard that is always on forces every test and the smoke script to authenticate. An injected guard (on in `server.ts`, off in `app.inject` suites that do not test it) keeps the suite cheap but means the production path is tested separately.
3. **First operator.** How the first credential is created (environment variable, one-off command): there is nobody to log in as before it exists.
4. **Scope of "identity" in this change.** Only `request.operador` for the routes, or also the login screen. The audit table itself is CH-20.

## Risks

- **Blast radius.** The guard must cover every console route and exempt, exactly and by a closed list as `esExenta` does today: `/health`, `/ui/*`, `/panel` and `/api/panel/*`, the agent upgrade, `GET /contrato` and the global template reads. A missed exemption breaks the panel or the agents; a missed route leaves a hole.
- **CSRF.** A cookie session on state-changing JSON routes needs the same `SameSite` plus content-type reasoning the panel used.
- **Lock-out.** A mistake in the bootstrap leaves nobody able to log in.
- **Two cookies on one host.** `/consola` and `/panel` share an origin; the names and paths must not collide.

## Proposed shape once decided (not final)

- Pure module for the credential check; hook `levantarOperador` mirroring `levantarSesionPanel`; `POST /consola/ingresar`, `POST /consola/salir`; a closed list of exemptions with its own test (every registered route is either guarded or listed).
- Header of the console shows the operator (the slot `docs/design/prompt-claude-design-consola.md` reserves).
- Size: roughly 400-500 production lines, so two or three chained PRs.

## Next

Decide 1 to 4, register them as DEC, then propose, spec, design, tasks. CH-20 and CH-28 wait for this.
