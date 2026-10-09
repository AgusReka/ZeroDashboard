# Exploration: CH-28 — Panel users managed from the console (proposed 2026-10-09)

Status: **proposed**, not started. Store: openspec. This exploration decides nothing: the architecture decisions below are the owner's (`AGENTS.md`) and must be registered in `docs/01-decisiones.md` before any code.

## Why

CH-22a built the client login (T3) but **nothing creates the users who log in**. The only way a client administrator (P2) can exist today is a hand-written insert: during the CH-23 visual check a throwaway script had to create one. A real engagement, and the recorded demo, need P1 to provision the client's access.

## What exists (verified)

| Piece | State |
|---|---|
| Model | `Usuario`: `id`, `tenantId`, `correo` (**globally unique**), `claveHash`, `nombre?`, `activo`, timestamps; sessions in `SesionPanel`. |
| Hashing | `hashearClave` / `verificarClave` in `src/crypto-auth.ts` (scrypt, versioned envelope). No password policy anywhere. |
| Login | `usuario.buscarPorCorreo(correo)` finds the user by the unique email across tenants (the credentials name no tenant, rule 2). |
| Deactivation | `Usuario.activo` exists and the session hook refuses an inactive user on every request, but no route flips it. |
| Creation, listing, reset | **None**: no route, no screen, no seed (`prisma/seed.ts` does not create users). |
| DEC-133 | "No hay recuperación de contraseñas ni autenticación multifactor en este release (R2)." |

## Decisions that are not mine to take

1. **How the first password is set.** (a) The operator types it. (b) The system generates one and shows it **once**, like the agent token (DEC-121). (c) An invitation by email: SMTP is optional in this project, so it cannot be the only path.
2. **Changing or recovering a password.** (a) P1 resets it from the console (generates a new one, shown once). (b) P2 changes their own, which needs a panel screen. (c) Neither, recorded as a limit of the artifact.
3. **Email uniqueness.** It is global because login resolves the tenant from the email. Keep it (a person cannot belong to two tenants) or change the login to ask for the tenant (rule 2 says the credentials must not name one).
4. **Password policy.** Minimum length and nothing more, or none for a prototype. Never logged, never echoed back.
5. **Deactivation semantics.** Whether deactivating also deletes the user's open sessions or only refuses them on the next request (already the case).

## Risks and order

- **Do not build this before CH-29.** Creating client credentials from a console that anyone can reach lets anyone mint a login that opens a customer's panel. The routes must sit behind the operator guard.
- Rule 2: the routes are console-only and tenant-scoped by the header (DEC-15); the panel never calls them. Two-tenant tests on every route, and a user of tenant B must be invisible to a request for tenant A.
- A deactivated tenant is frozen (DEC-14): it must not accept new users.
- Password material never in logs, responses after creation, or error text.

## Proposed shape once decided (not final)

- `src/usuarios-panel.ts` (pure: policy, generated password) and routes `POST /usuarios`, `GET /usuarios`, `POST /usuarios/:id/desactivar`, `POST /usuarios/:id/clave`, each under the tenant header.
- Console screen designed in CH-30; until then the API is enough for the demo script.
- Size: roughly 300 production lines, so two PRs (rules and creation; deactivation and reset).

## Next

CH-29 first. Then decide 1 to 5, register them as DEC, and propose, spec, design, tasks.
