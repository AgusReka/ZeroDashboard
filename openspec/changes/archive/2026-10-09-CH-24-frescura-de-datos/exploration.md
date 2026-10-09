# Exploration: CH-24 — Data freshness per tenant and per template (F1, F2; screen C-22)

Store: openspec. Pace: automatic. Delivery: single PR by the session preflight, split if the tasks forecast exceeds 400 lines.
Explored inline: the Claude Code hook refuses sub-agent SDD dispatch.
`docs/02-mapa-de-changes.md` lists CH-24 outside the recordable-demo path.

## The stories

- **F1** (P1): declare how often a tenant's replica is regenerated. Acceptance: "ventana de desactualización registrada por tenant".
- **F2** (P1): each template declares the age it tolerates. Acceptance: "atributo de la plantilla, no del tenant".
- **F3** (P2, CH-26, R3): warn the client on activation. Out of scope here.
- **C-22** (design skill, no mockup): per tenant `ultima_actualizacion` (relative) and `ventana_desactualizacion`; per template `tolerancia` (minutes); badge `desactualizada` when window > tolerance.

## What exists

| Piece | State |
|---|---|
| F2 attribute | **Done.** `Plantilla.toleranciaFrescuraMinutos` (`prisma/schema.prisma:132`), required integer >= 0 on `POST`/`PUT /plantillas` (`src/plantillas-rutas.ts:98`), seeded 60 and 120 minutes in the initial catalog (`src/catalogo-inicial.ts:52,76`). DEC-66: "stored, not applied until CH-24". |
| F1 attribute | **Missing.** `Tenant` has only `id`, `nombre`, `activo`, `creadoEn` (`prisma/schema.prisma:18`). No route edits a tenant besides `POST /tenants/:id/baja` (`src/tenants.ts:121`). |
| Applying the tolerance | **Nothing reads it.** The scheduler never looks at it (`src/planificador.ts`). |
| A last-refresh timestamp | **Does not exist anywhere.** The system never learns when a replica was last regenerated. |
| A gate precedent | `planificador.ts:230` records a `rechazo` with a `categoria` (`vista-canonica-no-aprobada`) when canonical views are not approved; a freshness check could follow that pattern. |
| Console surface | C-22 has no mockup; the console is a TypeScript string (`src/consola.ts`). |

## Decisions that are not mine to take (AGENTS.md: register first)

1. **What does "apply" mean?** DEC-66 says F1/F2 "apply the freshness". Options:
   - (a) Declare and show only: a window per tenant, the tolerance per template, and the `desactualizada` badge when window > tolerance. No engine change.
   - (b) (a) plus an engine gate: a run is recorded as `rechazo` with a new `categoria` (for instance `datos-desactualizados`) when the tenant's window exceeds the template's tolerance. Touches the engine and the closed set of categories (rule 6, anti-scope).
   - (c) (a) plus the client-facing warning: that is CH-26 (F3), not this change.
2. **Where does `ultima_actualizacion` come from?** The system has no source for it. Options: a value the implementer types in (a column next to the window), or drop it from C-22 and show only window vs tolerance. Inferring it from the agent heartbeat is CH-19d1 and is not built.
3. **Where does the window live?** F1 says per tenant; `Conexion` is where the mapping lives (DEC-33) and a tenant may have several replicas. A column on `Tenant` follows the story literally.
4. **How is it edited?** There is no tenant edit route; a new write path on `/tenants/:id` is needed (console only, never the panel: rule 2).

## Proposed shape once decided

- Migration: `Tenant.ventanaDesactualizacionMinutos Int?` (nullable: undeclared means unknown, never "fresh").
- `PUT /tenants/:id/frescura` (or equivalent) with a strict body; console fields on the tenant bar/screen; templates screen shows the tolerance already stored.
- A pure helper `estaDesactualizada(ventana, tolerancia)` with `null` window meaning "sin declarar" (not stale, not fresh).
- Tests: pure helper, route with two tenants (rule 2), console strings.

## Size

Without a gate: roughly 250-350 production lines plus a migration, tests x1.7, so probably two PRs. With a gate: add the planner change and its categories, several more tests.

## Next

Decide 1 to 4, register them in `docs/01-decisiones.md`, then propose, spec, design, tasks.
