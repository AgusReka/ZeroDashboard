# Design: CH-19b — Agent Model and Agent Token

## Technical Approach

This change applies DEC-114, DEC-115, DEC-116 and DEC-121. It takes no new architecture decision.

- The `Agente` model joins `MODELOS_AISLADOS`. Every route access goes through the scoped client.
- One typed lookup, `agente.buscarPorTokenHash`, lives inside `extenderConAislamiento`. It is the single audited unscoped read, and it runs on the raw client that the module already holds.
- The `/agentes` routes are scoped by `X-Tenant-Id`. They are not exempt: the closed exemption list in `contexto-tenant.ts` stays unchanged.
- Unit 2 adds an optional `agenteId` to `POST /conexiones`, with a scoped ownership check.

**Operator authentication.** None exists. Anyone with a valid tenant id can issue, list or revoke that tenant's token, the same as on every other admin route. DEC-121 accepted this explicitly under "Se resigna". This change does not add operator authentication.

## Architecture Decisions (design-level, under DEC-121)

| Topic | Choice | Rejected | Rationale |
|---|---|---|---|
| Lookup mechanism | A `model.agente.buscarPorTokenHash(tokenHash)` method in the same `$extends` call as the query extension. Its body calls `findUnique` on the raw client argument (closure) | `Prisma.getExtensionContext(this)` | The context client would pass through `$allOperations` and fail closed with no tenant |
| Lookup result | `{ id, tenantId, tenantActivo }`, or `null` when the hash is unknown or the agent is revoked. Input is the hash, never the token | Returning the row; filtering out inactive tenants inside the lookup | DEC-121 fixes the minimum set. 19c1 refuses a token when `tenantActivo` is false |
| Fallback | If test L2 fails: the same signature, with the body changed to a `$queryRaw` tagged template (`JOIN "Tenant"`, `"revocadoEn" IS NULL`) | Reopening DEC-121 | DEC-121 (c). The tagged template binds driver parameters (rule 4) |
| Token module | `src/agente-token.ts`: `generarTokenAgente()` returns `'zda_' + randomBytes(32).toString('base64url')`. `hashTokenAgente(t)` returns SHA-256 hex | Adding runtime values to `agente-protocolo.ts` | DEC-120 keeps that file types-only. 19c1 imports the hash function from this module |
| Re-issue race | `updateMany({ where: { id, revocadoEn: { not: null } } })`. A `count` of 0 returns 409 | Read-then-`update` | Of two concurrent re-issues, only one wins. `updateMany` is already scoped (`OPERACIONES_FILTRO`) |
| Create race | `P2002` on create returns 409 `agente-existente` (the `esViolacionDeUnicidad` pattern) | Locking | `Agente_tenantId_key` makes the database the arbiter |
| Explicit `onDelete: Restrict` | Set on both relations | Using the default | An optional relation defaults to `SetNull`. Writing it explicitly means a later change between optional and required cannot change the behavior silently |

## Schema and Migration

```prisma
model Agente {
  id             String     @id @default(uuid())
  tenantId       String     @unique
  tenant         Tenant     @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  tokenHash      String     @unique
  creadoEn       DateTime   @default(now())
  tokenEmitidoEn DateTime   @default(now())
  revocadoEn     DateTime?
  conexiones     Conexion[]
}
// Tenant: + agente Agente?
// Conexion: + agenteId String?
//           + agente   Agente? @relation(fields: [agenteId], references: [id], onDelete: Restrict)
```

Migration `prisma/migrations/20261003000000_agente/migration.sql`. Generate it with `--create-only`, then add the header by hand:

```sql
-- CH-19b: one agent per tenant and its token hash (DEC-114, DEC-115, DEC-121). Additive.
-- Rollback (after reverting units 2 and 1):
--   ALTER TABLE "Conexion" DROP CONSTRAINT "Conexion_agenteId_fkey";
--   ALTER TABLE "Conexion" DROP COLUMN "agenteId";
--   DROP TABLE "Agente";
CREATE TABLE "Agente" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "tokenHash" TEXT NOT NULL,
  "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tokenEmitidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revocadoEn" TIMESTAMP(3), CONSTRAINT "Agente_pkey" PRIMARY KEY ("id"));
ALTER TABLE "Conexion" ADD COLUMN "agenteId" TEXT;
CREATE UNIQUE INDEX "Agente_tenantId_key" ON "Agente"("tenantId");
CREATE UNIQUE INDEX "Agente_tokenHash_key" ON "Agente"("tokenHash");
ALTER TABLE "Agente" ADD CONSTRAINT "Agente_tenantId_fkey" FOREIGN KEY ("tenantId")
  REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Conexion" ADD CONSTRAINT "Conexion_agenteId_fkey" FOREIGN KEY ("agenteId")
  REFERENCES "Agente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

`Agente_tenantId_key` is a full index, not a partial one (DEC-111).

## Routes (`src/agentes-rutas.ts`, `registerAgenteRoutes(app, prisma)`)

`AgentePublico = { id, creadoEn, tokenEmitidoEn, revocadoEn }`. It never includes `tokenHash`, `tenantId` or the token. In `src/`, `tokenHash` appears only in the lookup, the create, and the re-issue `updateMany`.

| Route | Outcomes |
|---|---|
| `POST /agentes`. Body schema: `type: object`, `additionalProperties: false`, `propertyNames: { enum: [] }`. If AJV rejects an empty enum, use `propertyNames: false` instead | 201 `{agente, token}` on create. 200 `{agente, token}` on re-issue (same `id`, new hash, `tokenEmitidoEn` = now, `revocadoEn` = null). 409 `agente-existente`. 400 `solicitud-invalida` with `campos`. Both token responses send `Cache-Control: no-store` |
| `GET /agentes` | 200 `{ agentes: AgentePublico[] }` (0 or 1 entries), ordered by `creadoEn` and `id` |
| `POST /agentes/:id/revocar` | Scoped `findUnique`, then 404 `agente-no-encontrado`, 409 `agente-revocado`, or a guarded `updateMany` (`revocadoEn: null`, count 0 returns 409) with a read-back. Success returns 200 `{agente}` |

The header hooks answer before any of these routes: 400 `tenant-no-indicado`, 404 `tenant-no-encontrado`, 409 `tenant-desactivado`. 19c1 must keep its exemption slash-terminated (`/agente/`), so that it never matches `/agentes`.

```
operator -> hooks: X-Tenant-Id -> TenantActivo
hooks -> POST /agentes: schema OK -> generarTokenAgente, hashTokenAgente
POST -> agente.findFirst (scoped) -> null      -> create(conTenantInyectado({tokenHash})) -> 201 (P2002 -> 409)
                                  -> active    -> 409 agente-existente
                                  -> revoked   -> updateMany guard -> count 1 -> read back -> 200
reply: { agente: AgentePublico, token } + Cache-Control: no-store   (the token is never stored or logged)
```

## Unit 2: `src/conexiones.ts`

Add `agenteId?: string` to the body interface. Add it to the `propertyNames` enum and to `properties` (`minLength: 1`), keeping the two lists in step. Before the create, a scoped `prisma.agente.findUnique({ where: { id }, select: { id: true } })` runs. A `null` result returns 404 `agente-no-encontrado`, and the check does not look at `revocadoEn`. The create writes `agenteId: body.agenteId ?? null`. `ConexionPublica` gains `agenteId: true`: it is used only on the create response, and it is not a personal field.

## Testing Strategy (`node:test`, live PG skipped when absent, `npx tsc --noEmit`)

| Id | File | Case |
|---|---|---|
| L0 | `aislamiento.test.ts` | The model list adds `Agente` |
| L1 | same, closed port | Outside any context, `agente.findMany`, `create` and `updateMany` reject with `ErrorSinTenantActivo` |
| L2 (**first apply task**) | same, own tenants and cleanup | On `extenderConAislamiento(db)` with no context: the result has exactly the keys `{id, tenantId, tenantActivo}`. Unknown and revoked tokens give `null`. A deactivated tenant gives `tenantActivo: false`. Inside tenant B's context, A's hash still resolves to A. `findMany` on the same client still rejects |
| K1 | `agente-token.test.ts` (no PG) | The token matches `^zda_[A-Za-z0-9_-]{43}$`. Two calls give different tokens. The hash is 64 hex characters and is deterministic |
| R1-R8 | same, tenants A and B, cleanup in FK order (Conexion, Agente, Tenant) | R1: A creates and gets 201 with `no-store`. The `agente` has exactly the four keys. The raw row's hash equals `sha256(token)` and differs from the token. R2: a repeat gives 409 and the hash is unchanged. R3: a body with `{tenantId}` gives 400 `['/tenantId']`. R4: B's list is empty and A's has one entry. R5: B revoking A's id gives 404 and A stays active. A's revocation gives 200, and a repeat gives 409. R6: A's revoked hash looks up `null`. R7: re-issue gives the same id and a new token. The old token gives `null`, the new one resolves to A, and `creadoEn` is unchanged. R8: B's token resolves only to B |
| C1-C5 (unit 2) | same file, plus `registerConexionRoutes` | Own agent: 201, with `agenteId` stored. B's agent: 404 and no marker row written. Unknown id: 404. Own revoked agent: 201. Without `agenteId`: 201 and `null`. `''` gives 400 |

Tests use generated tokens only (rule 7) and assert on markers, never on table totals.

## File Changes and Delivery

| Unit | File | Est. ± lines |
|---|---|---|
| 1 | `prisma/schema.prisma` | 20 |
| 1 | `prisma/migrations/20261003000000_agente/migration.sql` | 35 |
| 1 | `src/aislamiento-prisma.ts` (set entry, lookup, docs) | 28 |
| 1 | `src/agente-token.ts` (Create) | 20 |
| 1 | `src/agentes-rutas.ts` (Create) | 115 |
| 1 | `src/server.ts` (register) | 3 |
| 1 | `src/aislamiento.test.ts` (base 51 ×1.7) | 87 |
| 1 | `src/agente-token.test.ts` (Create; base 12 ×1.7, K1) | 20 |
| 1 | `src/agentes-rutas.test.ts` (Create; base 115 ×1.7, R1-R8) | 196 |
| | **Unit 1 total** | **~524** |
| 2 | `src/conexiones.ts` | 20 |
| 2 | `src/agentes-rutas.test.ts` (base 55 ×1.7) | 94 |
| | **Unit 2 total** | **~114** |

Unit 1 exceeds 400. The proposal's ~360 was optimistic. There is a clean cut: **1a** (schema, migration, isolation, lookup, token module, L0-L2, K1; ~210) and **1b** (routes, wiring, R1-R8; ~314). Each slice is autonomous and each is under 400. Changing the two-PR plan in `docs/02-mapa-de-changes.md` is a delivery decision, not an architecture one.

## Threat Matrix

N/A: no VCS/PR automation, shell, subprocess, executable-file classification or process integration. The tenant boundary of the HTTP routes is covered by R1-R8 and C1-C5.

## Migration / Rollout

One additive migration in unit 1 (1a). The rollback SQL is in its header. No token consumer exists before 19c1.

## Open Questions

- [ ] (delivery, orchestrator) Three chained slices (1a, 1b, 2), or `size:exception` for unit 1?
- [ ] (spec, orchestrator) The `domain-data-model` delta must list `Agente`.
