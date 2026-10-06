# Exploration: CH-22a — Panel Authentication, Client User, Session and Strict Tenant Derivation (T3)

## Context and Goal

Story **T3** states: *"Como P2, quiero ver únicamente mi información. Criterio de aceptación: Autenticación; el tenant nunca se toma de la petición del cliente (R2)"*.

Additionally, **Rule 2** (non-negotiable) mandates:
> **Aislamiento entre tenants.** Ninguna consulta originada en el panel puede devolver datos de otro tenant. El identificador de tenant nunca se toma de la petición del cliente.

Until now, ZeroDashboard only had a single operator surface: the implementer console (P1, DEC-04, DEC-15), which relies on `X-Tenant-Id` explicitly per request because P1 is a trusted multi-tenant operator. 

CH-22a is the foundational cut for the client panel (P2):
1. Persists client users (`Usuario`) tied to a specific `Tenant`.
2. Secure password hashing using native `node:crypto.scrypt` (DEC-133).
3. Session management via `HttpOnly`, `SameSite=Lax`, `Secure` cookies backed by `SesionPanel` (DEC-134).
4. Strict tenant isolation: panel endpoints extract `tenantId` strictly from the session, automatically entering `AsyncLocalStorage` context (`entrarContextoTenant`), ignoring/refusing `X-Tenant-Id` (DEC-135).
5. Dedicated panel endpoints (`/panel`, `/api/panel/auth/ingresar`, `/api/panel/auth/salir`, `/api/panel/auth/sesion`) keeping surfaces cleanly separated from the console (DEC-04, DEC-136).

## Technical Findings

1. **Password Hashing**: Node.js standard library `node:crypto.scrypt` with a 16-byte random salt and 64-byte key length provides robust brute-force resistance without adding binary C++ dependencies (like `bcrypt` or `argon2`) that complicate builds across platforms or Docker containers. Format: `scrypt:salt:derivedKey` (hex-encoded).
2. **Session Persistence**: Storing sessions in `SesionPanel` (`id`, `usuarioId`, `tenantId`, `tokenHash`, `expiraEn`, `creadaEn`) with a 32-byte cryptographically secure random token in the cookie allows instant revocation on logout, active session inspection, and strict TTL enforcement.
3. **Tenant Scoping Integration**: Fastify pre-handler hooks on `/api/panel/*` resolve the session cookie, verify the token hash and expiration in `SesionPanel`, load the active user and tenant, and wrap downstream execution in `entrarContextoTenant(sesion.tenantId)`. This directly leverages `AsyncLocalStorage` and Prisma model scoping from DEC-13.
4. **Surface Separation (DEC-04)**: Panel routes live under `/panel` and `/api/panel/*`. The console stays under `/consola` and `/conexiones`, `/consultas`, etc.
5. **Two-Tenant Verification (T2/T3)**: A dedicated suite tests two tenants with distinct users. It verifies that logging in as user A produces a session scoped only to Tenant A, that session cookies cannot be forged or cross-used to read Tenant B's data, and that attempting to inject `X-Tenant-Id` does not switch the tenant.
