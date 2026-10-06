# Design: CH-22a — Panel Authentication, Client User, Session and Strict Tenant Derivation (T3)

## Technical Approach

CH-22a introduces the authentication infrastructure for P2, cleanly separated from the P1 console (DEC-04, DEC-136).

### 1. Data Model & Migration
- Add `Usuario` to `prisma/schema.prisma`:
  ```prisma
  model Usuario {
    id            String        @id @default(uuid())
    tenantId      String
    tenant        Tenant        @relation(fields: [tenantId], references: [id])
    correo        String        @unique
    claveHash     String
    nombre        String?
    activo        Boolean       @default(true)
    creadoEn      DateTime      @default(now())
    actualizadoEn DateTime      @updatedAt
    sesiones      SesionPanel[]

    @@index([tenantId])
  }

  model SesionPanel {
    id        String   @id @default(uuid())
    tokenHash String   @unique
    usuarioId String
    usuario   Usuario  @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
    tenantId  String
    tenant    Tenant   @relation(fields: [tenantId], references: [id])
    expiraEn  DateTime
    creadaEn  DateTime @default(now())

    @@index([tenantId])
    @@index([tokenHash])
  }
  ```
- Update `Tenant` model with reverse relations: `usuarios Usuario[]` and `sesionesPanel SesionPanel[]`.
- `MODELOS_AISLADOS` in `src/contexto-tenant.ts` adds `Usuario` and `SesionPanel`.
- Additive migration for PostgreSQL.

### 2. Password Hashing Module (`src/crypto-auth.ts`)
- `hashearClave(clavePlana: string): Promise<string>`:
  - Generates 16 random bytes salt via `crypto.randomBytes(16)`.
  - Derives key with `crypto.scrypt(clavePlana, salt, 64)`.
  - Serializes as `s1:<saltHex>:<keyHex>`.
- `verificarClave(clavePlana: string, hashAlmacenado: string): Promise<boolean>`:
  - Parses version, salt, and expected key.
  - Computes scrypt key and uses `crypto.timingSafeEqual` to avoid timing attacks.
- `generarTokenSesion()`:
  - Generates 32 random bytes raw token (sent in cookie).
  - Returns `{ tokenPlano, tokenHash: crypto.createHash('sha256').update(tokenPlano).digest('hex') }`.

### 3. Session & Route Handlers (`src/panel-auth.ts`)
- **Cookie name**: `zd_panel_session`.
- **Options**: `HttpOnly`, `SameSite=Lax`, `Path=/`, `MaxAge=2592000` (30 days).
- **Public endpoints** (exempt from tenant context header):
  - `POST /api/panel/auth/ingresar`: Validates body `{ correo, clave }`. Queries `Usuario` by email (unscoped lookup or scoped with explicit lookup), verifies `activo` and tenant `activo`, verifies password hash. Creates `SesionPanel` with 30-day expiration, sets cookie, returns `{ usuario: { id, correo, nombre }, tenant: { id, nombre } }`.
  - `POST /api/panel/auth/salir`: Reads cookie, finds `SesionPanel` by token hash and deletes it, clears cookie.
  - `GET /api/panel/auth/sesion`: Reads cookie, finds session, returns active session info.
- **Hook for panel routes**:
  - Pre-handler reads session cookie, validates against `SesionPanel`, sets `request.usuario` and `request.tenantId`, and executes the handler inside `entrarContextoTenant(sesion.tenantId)`.

### 4. Panel UI Module (`src/panel.ts`)
- `GET /panel`: Serves HTML linking `/ui/styles.css`.
- If no active session, renders ScreenIngreso (P-01).
- If active session, renders PanelShell with the tenant name.

### 5. Review Workload Forecast & PR Strategy
- Single change partitioned into chained PRs (budget <= 400 lines each):
  - **PR0**: Docs & OpenSpec artifacts (this PR).
  - **PR1**: Schema, migration, `Usuario`/`SesionPanel` models, `src/crypto-auth.ts` + unit tests.
  - **PR2**: Route module `src/panel-auth.ts`, session hook, auth endpoints, and isolation tests (two-tenant verification).
  - **PR3**: Panel page `src/panel.ts`, login form & shell UI, and integration tests.
