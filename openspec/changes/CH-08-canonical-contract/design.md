# Design: CH-08 — Canonical Contract

## Technical Approach

Two new modules and two one-line edits. `src/contrato.ts` holds the catalog as a frozen literal plus its types (DEC-21); `src/contrato-rutas.ts` exposes `registerContratoRoutes(app)` serving `GET /contrato`, projecting the constant verbatim so the endpoint cannot drift from the module. `src/server.ts` gains an import and a registration line; `src/contexto-tenant.ts` gains `/contrato` in `esExenta` (DEC-24). No Prisma model, no migration, no `MODELOS_AISLADOS` entry. Implements spec `canonical-contract`.

## Architecture Decisions

### Decision: Two independent optionality dimensions, one shared union

**Choice**: one `Obligatoriedad = 'obligatorio' | 'opcional'` union applied at **both** `EntidadCanonica.obligatoriedad` and `CampoCanonico.obligatoriedad`, with no propagation between them. An optional entity still carries required fields (`insumo.nombre`); a required entity still carries optional fields (`producto.sku`).
**Alternatives considered**: a single `requerido: boolean` per field, with entity optionality expressed by marking all its fields optional.
**Rationale**: the alternative destroys M4's signal. Entity-level optionality is what CH-10 reads to report `stock-producible` *inapplicable* (proposal rationale 1); collapsed into field flags, "the tenant has no insumos at all" becomes indistinguishable from "the tenant has insumos but no `codigo`". Field optionality is read only *after* the entity is present.

### Decision: Automation labels as exported constants, never inline literals

**Choice**: a single `AUTOMATIZACIONES` object `as const` in `src/contrato.ts`, with `Automatizacion` derived from its values; catalog entries reference `AUTOMATIZACIONES.STOCK_FISICO`, never `'stock-fisico'`.
**Alternatives considered**: inline string literals typed as a hand-written union; a plain `string[]`.
**Rationale**: DEC-22's conceded risk is drift against CH-12's real `Plantilla` names. Deriving the type from the object makes a literal typo a compile error and makes CH-12's reconciliation a single-object edit. A hand-written union would need updating in two places.

### Decision: Field naming — Spanish, camelCase; entity naming — Spanish, snake_case

**Choice**: stated once and permanently. Field identifiers are Spanish camelCase (`stockDisponible`, `fechaCreacion`, `precioUnitario`, `unidadMedida`, `cantidadPorUnidad`); cross-entity references use `<entidad>Id` (`pedidoId`, `productoId`). Entity identifiers stay lowercase snake_case as written in the proposal (`item_pedido`, `receta_componente`).
**Alternatives considered**: English names; camelCase entity names.
**Rationale**: camelCase Spanish matches the codebase (`consultaGuardada`, `baseDeDatos`). The asymmetry is deliberate: entity names denote *a tenant replica's tables*, which are conventionally snake_case, while field names are read back as TS/JSON identifiers. CH-09's mapeo keys off these exact strings permanently, so they are fixed here rather than negotiated per-change.

### Decision: Route signature takes `app` only

**Choice**: `registerContratoRoutes(app: FastifyInstance): void`, matching `registerConsolaRoute(app)`.
**Alternatives considered**: `(app, prisma)` for symmetry with the other four registrars.
**Rationale**: omitting the client is the structural proof that the handler reads no database — the property DEC-24's exemption rests on. Symmetry would hand the route a capability it must never use.

## Data Flow

    src/contrato.ts  ──import──▶  src/contrato-rutas.ts
    (AUTOMATIZACIONES,            GET /contrato ──▶ 200 { contrato: { entidades } }
     CONTRATO_CANONICO)                  ▲
                                         │ registerContratoRoutes(app)
                                   src/server.ts
                                         │
    src/contexto-tenant.ts: esExenta('GET','/contrato') → true
      → hook 2 returns early: no header read, no prisma.tenant lookup, no store write

## File Changes

| File | Action | Description |
|---|---|---|
| `src/contrato.ts` | Create | `AUTOMATIZACIONES`, `Automatizacion`, `Obligatoriedad`, `CampoCanonico`, `EntidadCanonica`, `CONTRATO_CANONICO` |
| `src/contrato-rutas.ts` | Create | `registerContratoRoutes(app)`, `GET /contrato` |
| `src/contrato.test.ts` | Create | Catalog invariants; personal-field absence sweep |
| `src/contrato-rutas.test.ts` | Create | Route shape; header-independence |
| `src/server.ts` | Modify | One import + `registerContratoRoutes(app);` after `registerConsolaRoute(app);` |
| `src/contexto-tenant.ts` | Modify | `esExenta` + its doc comment (below) |
| `src/contexto-tenant.test.ts` | Modify | One allowlist case for `GET /contrato` |
| `prisma/schema.prisma`, `src/aislamiento-prisma.ts` | None | Unchanged by construction |
| `docs/01-decisiones.md` | None | DEC-24 already registered |

## Interfaces / Contracts

```ts
export const AUTOMATIZACIONES = {
  STOCK_FISICO: 'stock-fisico',
  STOCK_PRODUCIBLE: 'stock-producible',
  REPORTE_DIARIO: 'reporte-diario',
} as const;
export type Automatizacion = (typeof AUTOMATIZACIONES)[keyof typeof AUTOMATIZACIONES];

export type Obligatoriedad = 'obligatorio' | 'opcional';

export interface CampoCanonico {
  readonly nombre: string;
  readonly obligatoriedad: Obligatoriedad;      // independent of the entity's
  readonly automatizaciones: readonly [Automatizacion, ...Automatizacion[]]; // never empty
}

export interface EntidadCanonica {
  readonly nombre: string;
  readonly obligatoriedad: Obligatoriedad;      // presence of the entity itself
  readonly campos: readonly CampoCanonico[];
}

export const CONTRATO_CANONICO: readonly EntidadCanonica[] = [ /* 5 entities */ ] as const;
```

`GET /contrato` → `200`, single named top-level key, matching `{ consultaGuardada }` / `{ consultasGuardadas, truncado }`:

```json
{ "contrato": { "entidades": [
  { "nombre": "producto", "obligatoriedad": "obligatorio", "campos": [
    { "nombre": "stockDisponible", "obligatoriedad": "obligatorio",
      "automatizaciones": ["stock-fisico", "stock-producible", "reporte-diario"] }
  ] }
] } }
```

Handler body is `reply.code(200).send({ contrato: { entidades: CONTRATO_CANONICO } })` — no per-request reshaping. The `entidades` envelope (not a bare array) leaves room for CH-12 metadata without breaking the shape. No body/params schema: there is nothing to validate. No `truncado`: the catalog is static and uncapped.

Exact `esExenta` edit (`src/contexto-tenant.ts`), replacing the `/health || /consola` condition:

```ts
  if (
    metodo === 'GET' &&
    (patron === '/health' || patron === '/consola' || patron === '/contrato')
  ) {
    return true;
  }
```

The doc comment above `esExenta` enumerates the exempt routes and MUST be updated in the same edit: "Only `GET` is exempt for `/health`, `/consola` and `/contrato`", adding that the contract is tenant-agnostic by construction and its handler holds no Prisma client.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Exactly 5 entities with the decided entity-level marks; every field marked; every field names ≥1 automation; every label is an `AUTOMATIZACIONES` value | `node:test` over `CONTRATO_CANONICO` |
| Unit | Personal-field absence: sweep every entity and field name for domicilio/teléfono/correo variants and for a customer entity | `node:test` regex sweep (spec requirement 3 — automated, not by reading) |
| Integration | `GET /contrato` returns the full projection at `200` | Fastify `inject()` on the real route |
| Integration | Identical body with no header, and with a header naming a nonexistent tenant | `inject()` against an app with `registrarContextoTenant` registered first |
| Integration | `POST /contrato` is not routed (`404`), and non-`GET` stays non-exempt | `inject()` |

## Threat Matrix

Routing boundary only; the reference matrix's rows are VCS/shell boundaries and are `N/A` here.

| Boundary | Adversarial case | Applicability | Design response | Planned RED test |
|---|---|---|---|---|
| Route-pattern spoofing | `/contrato-falso`, `/contrato/x` | Applicable | `esExenta` matches `request.routeOptions.url` exactly; no prefix match | Unmatched URL with no header is refused before `404` |
| Method widening | `POST`/`DELETE /contrato` | Applicable | Condition is `metodo === 'GET'`; only `app.get` is registered | Non-`GET` `/contrato` is not exempt |
| Tenant leakage through the exemption | Handler touching a scoped model | Applicable | Registrar takes no `PrismaAislado`, so no handle exists | Module exports no prisma-typed parameter |
| Documentation-like paths / Git selection / Commit state / Push state / PR commands | — | N/A: no shell, subprocess, VCS, PR automation, or file classification in this change | — | — |

## Migration / Rollout

No migration required. No persisted state; revert is total (proposal's rollback plan).

## Open Questions

- [ ] None blocking. CH-12 must reconcile `AUTOMATIZACIONES` values against real `Plantilla` names (DEC-22, accepted).
