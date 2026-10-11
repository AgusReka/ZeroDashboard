# Design: CH-28 — Panel users managed from the console

Inputs: proposal.md, specs (`panel-user-management`, `client-panel-auth` delta), DEC-155 to DEC-158. Mirrors the agent-token routes (`src/agentes-rutas.ts`, DEC-121).

## 1. Modules

| File | Role |
|---|---|
| `src/usuarios-panel.ts` (new) | Pure: `generarClavePanel`, `normalizarCorreo`, `correoValido`, the body schema, the public projection. Routes: `registerUsuarioPanelRoutes(app, prisma)` |
| `src/rutas.ts` | Registers the routes after the agent routes |
| `src/panel-auth.ts` | `ingresar` looks the user up by `normalizarCorreo(correo)` |
| `scripts/smoke.sh` | A CH-28 section after the CH-29 login |

No schema change and no migration: `Usuario` (`correo @unique`, `activo`) and `SesionPanel` (cascade on the user) already have every column.

## 2. Pure layer

- `generarClavePanel()`: `randomBytes(18).toString('base64url')`, 24 characters, 144 bits. No prefix (unlike the agent token, a person types it).
- `normalizarCorreo(texto)`: `texto.trim().toLowerCase()`. Shared with the panel login, so creation and login can never normalize differently.
- `correoValido(correo)`: after normalizing, 3 to 254 characters, exactly one `@`, not first nor last, no whitespace. Deliberately not a full RFC check: the email is an identifier here, nothing is sent to it.
- `UsuarioPublico = { id, correo, nombre, activo, creadoEn }` as the only `select` any response reads, so `claveHash` and `tenantId` are absent by construction.
- Body schema of `POST /usuarios`: `additionalProperties: false`, `propertyNames: { enum: ['correo', 'nombre'] }`, `correo` string 1–300 (the real rule is `correoValido` after trimming, reported as `campos: ['/correo']`), `nombre` string up to 200 before trimming.

## 3. Routes (`src/usuarios-panel.ts`)

All tenant-scoped by the header and behind the operator guard; none is exempt.

- `POST /usuarios`: validate; `prisma.usuario.create({ data: conTenantInyectado({ correo, nombre, claveHash: await hashearClave(clave), activo: true }), select: UsuarioPublico })`. A `P2002` on `correo` is `409 correo-en-uso`: the scoped client cannot see another tenant's row, so the database's unique index is the arbiter, and the answer is the same whatever tenant holds the email. 201 `{ usuario, clave }`, `no-store`.
- `GET /usuarios`: `findMany` ordered by `correo` then `id`, `take: LIMITE_LISTADO + 1`, `truncado` when more.
- `POST /usuarios/:id/clave`: `$transaction`: scoped `findUnique` (404 if null), `update` the hash, `sesionPanel.deleteMany({ where: { usuarioId } })`. 200 `{ usuario, clave }`, `no-store`. The hash is computed before the transaction opens, so the `scrypt` cost does not hold the transaction.
- `POST /usuarios/:id/desactivar`: `$transaction`: `updateMany({ where: { id, activo: true }, data: { activo: false } })`; `count === 0` → re-read: null is 404, otherwise 409 `usuario-inactivo`; then `sesionPanel.deleteMany`. The guarded write makes a concurrent double deactivation report one transition.
- `POST /usuarios/:id/reactivar`: `updateMany({ where: { id, activo: false }, data: { activo: true } })`, same 404/409 split with `usuario-activo`. Sessions are untouched (there are none).
- A deactivated tenant is already refused with `409 tenant-desactivado` by the header hooks (DEC-14), so it cannot get new users.

## 4. Panel login

`src/panel-auth.ts`: `prisma.usuario.buscarPorCorreo(normalizarCorreo(correo))`. Everything else in the login is unchanged.

## 5. Tests

| File | Covers |
|---|---|
| `src/usuarios-panel.test.ts` | Pure: generator length, alphabet and uniqueness; `normalizarCorreo`; `correoValido` edge cases |
| `src/usuarios-panel-rutas.test.ts` (live DB) | Create (201, normalized email, hash not the password, panel login works with the answer), strict body, `correo-en-uso` across tenants with no tenant in the body, list (only the tenant's, no hash, cap), the password never in the list or an error body |
| `src/usuarios-panel-estado.test.ts` (live DB) | Reset (old password and session refused, new one logs in, inactive stays inactive), deactivate (sessions deleted, login refused, 409 twice), reactivate (same password logs in, 409 twice), two-tenant 404 on all three with the other tenant unchanged |
| `src/panel-auth.test.ts` | Mixed-case and padded email logs in |
| `src/rutas.test.ts` | Unchanged; it already proves the new routes are guarded |

The live tests build an app with `registrarGuardOperador` left out on purpose (it is proven by `rutas.test.ts`) plus `registrarContextoTenant`, `registerUsuarioPanelRoutes` and `registerPanelAuthRoutes`, so a test can create a user and log into the panel in the same app.

## 6. Trade-offs
- **A generated password travels once in a response body.** That is the point (DEC-155); `no-store` keeps it out of caches, and the console client will have to show it once and drop it (CH-30).
- **The 409 confirms an email exists somewhere.** Accepted in DEC-157: the operator already operates every tenant.
- **No UI in this change.** The proposal keeps the screen for CH-30; the smoke script is the end-to-end proof.

## 7. Size forecast
PR1 ~420 (pure module, create and list, login normalization, tests) · PR2 ~380 (reset, deactivate, reactivate, tests, smoke). Total ~800.
