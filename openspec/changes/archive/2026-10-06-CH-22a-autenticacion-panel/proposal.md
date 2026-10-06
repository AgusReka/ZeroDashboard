# Proposal: CH-22a — Panel Authentication, Client User, Session and Strict Tenant Derivation (T3)

**Status**: ready for spec and design. Inputs: `exploration.md`, DEC-133 to DEC-136 (firm, 2026-10-06).

## Intent

- Provide authentication for the client panel (P2, business administrator), fulfilling story **T3** and enforcing **Rule 2**.
- Establish the data models for client users (`Usuario`) and server sessions (`SesionPanel`).
- Expose dedicated panel authentication endpoints and serve the initial panel UI (`/panel`).
- Ensure all panel operations derive tenant identity exclusively from the verified session.

## Scope

### In Scope
- **Data Model & Migrations**:
  - `Usuario` model in `prisma/schema.prisma` (`id`, `tenantId`, `correo`, `claveHash`, `creadoEn`, `actualizadoEn`, `activo`).
  - `SesionPanel` model (`id`, `tokenHash`, `usuarioId`, `tenantId`, `expiraEn`, `creadaEn`).
  - Additive migration for PostgreSQL.
  - Model scoping: `Usuario` and `SesionPanel` registered in `MODELOS_AISLADOS` for tenant-scoped operations, with explicit audited token lookup for session validation.
- **Crypto & Auth Logic**:
  - Password hashing & verification module using native `node:crypto.scrypt` (DEC-133).
  - Secure session token generator using `node:crypto.randomBytes` (DEC-134).
- **Server Routes & Hooks**:
  - `POST /api/panel/auth/ingresar`: Validates credentials, creates `SesionPanel`, sets `HttpOnly` cookie.
  - `POST /api/panel/auth/salir`: Revokes `SesionPanel`, clears cookie.
  - `GET /api/panel/auth/sesion`: Returns active user info and business/tenant name.
  - Fastify session resolution hook for `/api/panel/*` routes entering `AsyncLocalStorage` tenant context (DEC-135).
- **Panel HTML & UI**:
  - `GET /panel`: Serves the panel page matching the visual system tokens (`styles.css`). If unauthenticated, displays the login form (P-01); if authenticated, displays the initial panel shell.
- **Automated Tests**:
  - Unit tests for password hashing, salt verification, and session token generation.
  - Route tests for login, logout, session status, invalid credentials, deactivated tenant/user.
  - Two-tenant isolation test (T2/T3) proving tenant identity is locked to the session and `X-Tenant-Id` has no effect on panel routes.

### Out of Scope
- Panel automations listing and management (CH-22b, CH-22c, CH-23).
- User password recovery / email reset flows (R2 boundary).
- User self-registration (client users are provisioned with the tenant or by the implementer).

## Capabilities

### New Capabilities
- `client-panel-auth`: Client user authentication, credential validation, session cookie handling, logout, and authenticated session state endpoint.

### Modified Capabilities
- `domain-data-model`: ADDED `Usuario` and `SesionPanel` entities with foreign keys to `Tenant`.
- `tenant-isolation`: MODIFIED "Cross-Tenant Isolation Is Proven by an Automated Test (T2)" (sweep and dedicated tests cover panel authentication and session-derived tenant isolation under Rule 2).

## Approach

DEC-133 (scrypt hashing), DEC-134 (HttpOnly cookie + SesionPanel), DEC-135 (Strict session tenant derivation), DEC-136 (Separated panel routes).

## Affected Areas

| Area | Impact |
|------|--------|
| `prisma/schema.prisma`, `prisma/migrations/` | Added `Usuario`, `SesionPanel` models |
| `src/crypto-auth.ts`, `src/crypto-auth.test.ts` | New auth crypto module |
| `src/panel-auth.ts`, `src/panel-auth.test.ts` | New panel auth route and session module |
| `src/panel.ts`, `src/panel.test.ts` | New panel UI servable module |
| `src/aislamiento.ts`, `src/aislamiento.test.ts` | Model list pin and two-tenant panel isolation test |
| `src/contexto-tenant.ts` | Updated exemption allowlist for public panel routes (`/panel`, `/api/panel/auth/ingresar`) |
| `docs/01-decisiones.md` | Recorded DEC-133..136 |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `scrypt` synchronous blocking event loop | Low | Use asynchronous `promisify(crypto.scrypt)` |
| Cookie handling across browsers (SameSite/Secure) | Low | Standard `SameSite=Lax`, `Path=/`, `HttpOnly` attributes |
| Session token collision / predictability | Low | 32 bytes from `crypto.randomBytes` with SHA-256 token hash |
| Tenant leakage via client-supplied headers | Low | Explicitly ignore `X-Tenant-Id` in panel hooks; derive tenant solely from session |
| Model scoping bypass | Low | Add `Usuario` and `SesionPanel` to `MODELOS_AISLADOS` with pin test |

## Rollback Plan

Revert PRs in reverse order. The migration is strictly additive (new tables `Usuario` and `SesionPanel`). Reverting code leaves existing tables untouched.
