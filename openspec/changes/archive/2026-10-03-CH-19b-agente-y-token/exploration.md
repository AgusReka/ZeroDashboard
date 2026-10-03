# Exploration: CH-19b Agente model, Conexion.agenteId, agent token create/list/revoke

Date: 2026-10-03. Decision registered: DEC-121 in `docs/01-decisiones.md` (user chose the recommended options).

## Current state

- No `Agente` model exists. `Conexion` has no `agenteId`. Latest migration: `20261001000000_ejecucion_intentos`; migrations are additive, one folder each, header comment with rollback SQL.
- `src/aislamiento-prisma.ts:29-35` `MODELOS_AISLADOS`: Conexion, ConsultaGuardada, VistaCanonica, Automatizacion, Ejecucion. An unlisted model passes unfiltered (`:131`). `extenderConAislamiento(prisma)` is the only place holding the raw client. `upsert` is rejected.
- `src/aislamiento.test.ts:1232` pins `Object.values(Prisma.ModelName)` exactly; adding `Agente` breaks it on purpose.
- `src/contexto-tenant.ts:116-145`: closed exemption list. The `/agente/*` exemption is 19c1, slash-terminated like `/tenants/`.
- Templates: `src/tenants.ts` (baja semantics: read, 404, 409), `src/automatizaciones-rutas.ts` (strict body schema, `*Resumen`, scoped ownership lookup, `LIMITE_LISTADO`), `src/conexiones.ts` (`ConexionPublica`, `registroConexionSchema` with two lists in step), `src/cripto-credencial.ts` (constant-message errors, secrets never returned), `src/conexion-destino.ts` (grep-checkable `credencial: true` once).
- `src/agente-protocolo.ts` is types-only, zero imports (DEC-120): 19b must not add runtime values to it.
- Optional Prisma relations default to `onDelete: SetNull`; the schema promises RESTRICT everywhere, so set it explicitly.

## Decisions (DEC-121)

| Point | Decision |
|---|---|
| Token lookup before tenant context | `Agente` in `MODELOS_AISLADOS` plus one typed lookup by `tokenHash` inside `extenderConAislamiento`; returns `id`, `tenantId`, tenant state only. Fallback: parametrized raw SQL |
| Model | One `Agente` row per tenant (`tenantId` unique, full index), `tokenHash` unique, soft revoke, in-place re-issue, no token history |
| `Conexion.agenteId` | Optional on `POST /conexiones`, scoped ownership check, 404 `agente-no-encontrado`, FK RESTRICT |

Design-level (not architecture): token `zda_` + `randomBytes(32)` base64url, SHA-256 hex, shown once with `Cache-Control: no-store`; public projection without hash, tenantId or token; routes `/agentes` scoped by `X-Tenant-Id`, no exemption.

## Scope

- In 19b: schema + migration, scoped model, lookup with tests, create/re-issue, list, revoke, `agenteId` wiring, model-list test update.
- Out: WebSocket routes and `/agente/*` exemption (19c1), agent process (19c2), state columns and heartbeat (19d1), categories (19d2), runbook (19e), any console UI, rotation overlap, `PATCH /conexiones`.

## Estimate and delivery

~220 code lines + ~230 base test lines x1.7 = ~390 test lines, about 610 total. Delivered as one change in two chained PRs: unit 1 (~360) and unit 2 (`agenteId`, ~140).

## Anti-scope risks

- Rule 2 (main): tenant only from header or token row; the create body must never accept `tenantId`; a forgotten `MODELOS_AISLADOS` entry fails open; the lookup must return the minimum; a token must never resolve to a deactivated tenant.
- Rule 5: no token, hash or `tenantId` in projections, logs or errors.
- Rule 6: no heartbeat columns, no token history, no `ws` dependency, no extra routes.
- Rule 7: tests use generated tokens, never literals.
- Tests run in parallel suites on one database: clean fixtures in FK order, assert on markers.
- The `model` extension on a chained client must be proved by an early test.
