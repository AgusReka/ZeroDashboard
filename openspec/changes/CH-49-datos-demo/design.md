# Design: CH-49 — Demo data

**Status**: ready for tasks. Inputs: proposal.md, specs/project-environment/spec.md, DEC-206, DEC-207. The DEC-207 network spike passed on 2026-11-10 (Docker Desktop for Windows): a container built from the `agente` target with `network_mode: "service:app"` and the agent hardening resolved `replica-demo`, opened `replica-demo:5432` and reached the app at `http://localhost:${APP_PORT}/`. DEC-207 needs no amendment.

## Technical Approach
The replica gains init files that run after the dump and change its data in place, plus a second database. The dump itself is not edited. The seed keeps its entry point (`sembrarDemo`, `leerEntornoDemo`, `IDS_DEMO` in `src/semillas/semilla-demo.ts`, imported by `prisma/seed.ts` from `dist/`). Its body is split into modules under `src/semillas/demo/`, and the single-tenant constants become a tenant descriptor, so the same steps seed both tenants. Every new row uses `crearSiFalta` with a fixed id. Every check is the product's own: the mapping probe, `rechazoDeReporte`, `cronValido`, the recipients limit and the agent token format.

## Architecture Decisions

### Decision: Relative dates by shifting the dump, not by regenerating it
**Choice**: A new init file `03-datos-recientes.sql` (runs on `food_store` after `01` and `02`) shifts every `pedido.created_at`/`updated_at` and every `detalle_pedido.created_at`/`updated_at` by `now()::date - DATE '2026-09-16'` days. The newest order lands on the load day and the 99 orders cover the last 30 days.
**Alternatives considered**: regenerate the dump with relative expressions; generate new orders.
**Rationale**: a 2,229-line dump stays byte-identical and reviewable; one `UPDATE` per table is easy to read and to check. The 7-, 30- and 90-day windows all have rows on load day.

### Decision: Items for orders 73 to 99 are generated deterministically
**Choice**: The same file inserts two `detalle_pedido` rows per order 73 to 99 (ids from 195 up). The products are `(pedido_id % 9) + 1` and `((pedido_id * 4) % 9) + 1`; when both are equal the second is the next product. The quantity is `1 + pedido_id % 3`, the price is `product.base_price`, and `subtotal` is quantity times price. Then the sequence is set with `setval`.
**Alternatives considered**: leave the gap; copy items from earlier orders.
**Rationale**: no `random()` (spec), every order has items, and «Lo más vendido» covers the whole month. `pedido.total` is not recomputed: a mismatch between an order's total and its items is invisible in the four reports and keeps the dump's totals.

### Decision: Stock and automation numbers
**Choice**: `03-datos-recientes.sql` sets the stock of products 7, 8 and 9 (the only ones without a recipe, so the only ones `stock-fisico` reads) to **18, 9 and 4**. The automations use:

| Automation | `umbral` | `minimoFilas` | Rows on a fresh volume | Effect |
|---|---|---|---|---|
| Daily (existing, kept) | 5 | 1 (default) | 1 (Brownie, 4) | Now sends at 09:00 |
| Every minute, email | 10 | 2 | 2 (9 and 4) | Sends every minute |
| Every minute, Telegram (only with a link) | 10 | 1 | 2 | Sends every minute |

From the panel, raising the email one's threshold to 20 adds a third row (18). Lowering it to 5 leaves one row, under the minimum of 2, so the run is `omitida-bajo-minimo`. These numbers are pinned in the README and in a documented data query (`SELECT … FROM v_producto` in the README's check step).
**Alternatives considered**: a higher threshold over the original stock (40 or more).
**Rationale**: small, distinct numbers make each threshold change visible, and the daily automation stops being dead.

### Decision: `cafe_demo` is created by a shell init file that runs a SQL file from a subfolder
**Choice**: `04-cafe-demo.sh` creates the database `cafe_demo`, revokes `CONNECT` from `PUBLIC` on it, creates the role `lector_cafe_demo` with `REPLICA_DEMO_PASSWORD`, grants it `CONNECT`, then runs `cafe/esquema-y-datos.sql` with `psql --dbname cafe_demo` and grants `USAGE` and `SELECT`. `02-lector.sh` adds `REVOKE CONNECT ON DATABASE food_store FROM PUBLIC`.
**Alternatives considered**: a `.sql` with `\connect`; a second container.
**Rationale**: the image runs only top-level files, alphabetically, so the subfolder keeps the data file from running on `food_store`. A shell file can pass the password as a `psql` variable, as `02` already does.

**`cafe_demo` schema** (deliberately different names, so the mapping per client is visible):
- `items(id, title, stock_units, enabled, deleted)` maps to `v_producto`;
- `supplies(id, label, units_left, unit)` maps to `v_insumo`;
- `recipes(item_id, supply_id, qty)` maps to `v_receta_componente`;
- `sales(id, sold_at timestamptz, status, amount)` maps to `v_pedido`, with `status = 'anulada'` mapped to `'cancelado'`;
- `sale_lines(id, sale_id, item_id, units, unit_price)` maps to `v_item_pedido`.

Data: 8 items (café, medialuna, tostado and so on), 6 supplies, recipes for 5 items, and 90 days of sales. Each day has 2 to 4 sales, a function of the day number. One sale in 15 is `anulada`. Lines are 1 to 3 per sale. All of it comes from `generate_series` over `now()`. The five views expose exactly the canonical columns and types, and ids are cast to `text`.

### Decision: The seed is split into a tenant descriptor plus steps
**Choice**:
- `src/semillas/demo/comun.ts` holds `crearSiFalta`, `motivoInvalida`, and `validarVistas(prisma, operador, tenant, sondear)`. The latter is parameterized by a `TenantDemo` descriptor: ids, name, replica database, role, connection name.
- `demo/tenant.ts` creates one tenant's tenant row, connection, views, panel user and daily automation from a descriptor.
- `demo/reportes.ts` holds the four reports and `rechazoDeEntradaReporte`.
- `demo/tableros.ts`, `demo/canales.ts` (Telegram link and every-minute automations) and `demo/agente.ts` hold the other steps.
- `semilla-demo.ts` keeps the env reading, the two descriptors and the order of steps.

`ClienteSemilla` adds `reporte`, `tablero`, `vinculoTelegram` and `agente`.
**Alternatives considered**: grow the single file.
**Rationale**: the existing tests keep their entry point. Each module is reviewable, and the second tenant reuses the same code path, which is the best evidence that isolation is real.

**Order**: operator; Food Store (agent first if configured, so its connection is created bound); Café del Puerto (pre-check, then rows); reports; dashboards; Telegram link; every-minute automations.

### Decision: Ids
**Choice**: Food Store keeps `31d00000-…-0000000000NN`. Every new row uses `49d00000-0000-4000-8000-0000000000NN`:

| NN | Row | NN | Row |
|---|---|---|---|
| 01 | tenant Café del Puerto | 41 to 44 | reports (número, barras, línea, tabla) |
| 02 | its connection | 51 | Food Store every-minute email automation |
| 11 to 15 | its views (contract order) | 52 | Food Store every-minute Telegram automation |
| 22 | its panel user | 61 | Food Store Telegram link |
| 23 | its daily automation | 71 | Food Store agent |
| 31, 32 | dashboards of Food Store and Café del Puerto | | |

### Decision: Café del Puerto's panel user is derived, not configured
**Choice**: its email is `DEMO_PANEL_CORREO` with a `+cafe` tag before the `@`, and its password is `DEMO_PANEL_CLAVE`. No new variable.
**Alternatives considered**: `DEMO_PANEL2_CORREO`/`DEMO_PANEL2_CLAVE`.
**Rationale**: the five required variables stay five. A tagged address is a distinct `correo` (globally unique) that reaches the same inbox or the mail catcher.

### Decision: Old volume pre-check before any second-tenant row
**Choice**: before creating Café del Puerto's rows, the seed probes `cafe_demo` with the same `sondear` and an in-memory destination. If the probe fails with `categoria: 'base-inexistente'`, the seed throws `replica-demo has no database cafe_demo: recreate the volume with docker compose down -v`. Any other failure keeps the existing message. When the tenant already exists, the pre-check is skipped.
**Rationale**: fail loud (DEC-171) with a closed text and no half-created tenant (spec).

### Decision: Seeded reports
**Choice**: `rechazoDeEntradaReporte` restates the route's AJV half (allowed and required keys, types, enums of `ENTIDADES_CANONICAS`, `VISUALIZACIONES`, `ROLES`), as `rechazoDeEntrada` does for templates. It then calls `rechazoDeReporte(detalles or undefined, cuerpo, { exigirColumnas: true })` with `columnasPrueba` equal to the assigned column names. Rows are written with `datosDeReporte(cuerpo)` and a fixed id. The period is `{ parametro: 'desde', dias: [...] }`.

| id | `nombre` / `titulo` | SQL (shape) | Period | Columns |
|---|---|---|---|---|
| 41 | Ventas del período / «Ventas» | `SUM(p.total)::numeric AS ventas` from `v_pedido p` where not `cancelado` and `"fechaCreacion" >= :desde` | 7, 30, 90 | `valor` ventas «Ventas» |
| 42 | Productos más vendidos / «Lo más vendido» | `pr.nombre AS producto, SUM(i.cantidad)::numeric AS unidades`, joining items, orders and products, top 8 | 7, 30, 90 | `etiqueta` producto «Producto», `valor` unidades «Unidades» |
| 43 | Ventas por día / «Ventas por día» | `to_char("fechaCreacion"::date, 'YYYY-MM-DD') AS dia, SUM(total)::numeric AS ventas`, grouped and ordered by day | 30, 60 | `etiqueta` dia «Día», `valor` ventas «Ventas» |
| 44 | Stock de productos / «Stock de tus productos» | `nombre AS producto, "stockDisponible"::numeric AS stock` from active products | none | `columna` producto «Producto», `columna` stock «Stock» |

Dashboards: Food Store has 41, 42, 43, 44; Café del Puerto has 41, 42, 43. Each is created with `tablero.create` only when `findUnique({ where: { tenantId } })` is null, and only after that tenant's views exist.

### Decision: Telegram and every-minute automations
**Choice**:
- **Chat id:** `DEMO_TELEGRAM_CHAT_ID` must match `^-?\d{1,19}$` and fit in a signed 64-bit integer. Otherwise the seed fails with `Invalid environment variable: DEMO_TELEGRAM_CHAT_ID must be a Telegram chat id`, without the value.
- **Link:** `vinculoTelegram.create({ id, tenantId, chatId: BigInt(v) })` when the tenant has no link. `crearVincular` is not used, because it needs a one-time code and a tenant context.
- **Email automation:** `stock-fisico`, `* * * * *`, `{ umbral: 10 }`, `minimoFilas: 2`, `canal: 'correo'`, with three recipients: `DEMO_PANEL_CORREO`, `encargado@food-store.example`, `compras@food-store.example`. They pass the route's `destinatariosDe` rules, and `.example` never delivers.
- **Telegram automation:** the same template, `{ umbral: 10 }`, `minimoFilas: 1`, `canal: 'telegram'`, no recipients. It is created only when Food Store has a link after the link step.

### Decision: Demo agent
**Choice**:
- **Token check:** `DEMO_AGENTE_TOKEN` is checked with a copy of `^zda_[A-Za-z0-9_-]{43}$`, re-declared in `demo/agente.ts` with a comment naming `agente-proceso/limites.ts`, because agent files must not share engine imports.
- **Agent row:** `agente.create({ id, tenantId, tokenHash: hashTokenAgente(token) })` when the tenant has no agent.
- **Connection:** Food Store's connection is created with `agenteId` when the agent exists. Its host and port stay `replica-demo:5432`, as the agent sees them. The probe stays direct.
- **Compose service:** `agente`, `profiles: ["agente"]`, `build: { context: ., target: agente }`, `network_mode: "service:app"`, `depends_on: [app]`, `restart: unless-stopped`, `read_only`, `cap_drop: [ALL]`, `no-new-privileges`, `init`.
- **Agent environment:** `AGENT_SERVER_URL=ws://localhost:${APP_PORT}`, `AGENT_TOKEN=${DEMO_AGENTE_TOKEN:?…}`, `AGENT_ALLOWED_TARGETS=replica-demo:5432`.
**Note from the spike**: the service shares the app container's network namespace. Recreating `app` (for example after `--build`) requires recreating `agente`; the README says so.

## Data Flow

    up (demo [+correo] [+agente])
      replica-demo initdb: 01 dump -> 02 role + REVOKE -> 03 recent dates, items, stock -> 04 cafe_demo
      app entrypoint: migrate -> seed
        catalog -> sembrarDemo:
          operator -> [agent] -> Food Store (tenant, connection, views + probe, query, user, daily)
          -> Café del Puerto (pre-check -> tenant, connection, views + probe, user, daily)
          -> reports (gate) -> dashboards -> [Telegram link] -> every-minute automations
      server listens -> [agente connects over loopback]

## File Changes
| File | Action | Description |
|------|--------|-------------|
| `docker/replica-demo/02-lector.sh` | Modify | `REVOKE CONNECT … FROM PUBLIC` on `food_store` |
| `docker/replica-demo/03-datos-recientes.sql` | Create | date shift, items for orders 73 to 99, stock 18/9/4 |
| `docker/replica-demo/04-cafe-demo.sh` | Create | database, role, grants, runs the data file |
| `docker/replica-demo/cafe/esquema-y-datos.sql` | Create | tables, generated data, five views |
| `src/semillas/semilla-demo.ts` | Modify | env and ids; order of steps over the modules |
| `src/semillas/demo/comun.ts`, `tenant.ts`, `reportes.ts`, `tableros.ts`, `canales.ts`, `agente.ts` | Create | steps described above |
| `src/semillas/semilla-demo.test.ts` | Modify | two tenants, ids, counts, cleanup of new tables |
| `src/semillas/demo/*.test.ts` | Create | reports gate, columns over literal views, channels, agent |
| `docker-compose.yml` | Modify | forward `DEMO_TELEGRAM_CHAT_ID`, `DEMO_AGENTE_TOKEN`; `agente` service |
| `.env.example` | Modify | the two names, empty, and the `agente` profile |
| `README.md` | Modify | «Probar la demo completa» rewritten |
| `docs/02-mapa-de-changes.md` | Modify | the CH-49 row |

## Interfaces / Contracts

```ts
interface TenantDemo {
  ids: { tenant: string; conexion: string; vistas: Record<EntidadCanonica, string>; usuario: string; automatizacion: string };
  nombre: string;                       // 'Food Store' | 'Café del Puerto'
  replica: { host: 'replica-demo'; puerto: 5432; baseDatos: string; usuario: string; nombreConexion: string };
  correoPanel: string;                  // derived for Café del Puerto
  conConsulta: boolean;                 // only Food Store keeps the saved query
}
interface EntornoDemo { /* existing four */ telegramChatId: bigint | null; agenteToken: string | null }
```

## Testing Strategy
| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (no DB) | env: chat id valid, malformed, out of range, not echoed; token format, not echoed; derived email | extend the no-DB `describe` |
| Unit (no DB) | report gate: four entries pass; extra key, wrong role, empty title, glossary term rejected | `rechazoDeEntradaReporte` |
| DB | fresh seed with both tenants: counts, ids, both dashboards, automation shapes; second run creates nothing; existing dashboard, link and agent untouched; Telegram automation only with a link; old volume message on `base-inexistente`, and no Café rows left | existing fake probes; `limpiar()` deletes `tablero`, `vinculoTelegram`, `agente`, the seeded reports by id, and new automations |
| DB | each seeded report's columns | views over `VALUES` literals (technique of `reporte-prueba.test.ts`), run through `ejecutarReporte` with a period date, compare column names |
| Manual (documented) | replica: views per database, cross-database refusal, recent rows, the stock query; agent run and `stop agente` | README check step, run once during apply |

The replica is never dialled by the suite (DEC-170).

## Migration / Rollout
No Prisma migration. An existing `replica-demo-data` volume does not get the new init files: the seed fails with the `down -v` message. The only clean start is `docker compose --profile demo --profile correo [--profile agente] down -v`, then `up -d --build`.

## Open Questions
- None blocking. The exact `cafe_demo` item names and per-day formula are content, chosen during apply within the shape above.
