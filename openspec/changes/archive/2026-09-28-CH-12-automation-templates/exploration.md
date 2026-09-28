# Exploration: CH-12 — Automation Templates (D1)

> Mirror of Engram `sdd/CH-12-automation-templates/explore` (obs #164), hybrid store.

## Current State

- **Canonical contract (CH-08, DEC-21)**: `src/contrato.ts` is a static, code-only, tenant-agnostic array (`CONTRATO_CANONICO`) of 5 entities (`producto`, `pedido`, `item_pedido`, `insumo`, `receta_componente`) with typed fields and an `automatizaciones` tag per field. `AUTOMATIZACIONES` = `{STOCK_FISICO, STOCK_PRODUCIBLE, REPORTE_DIARIO}` are free-text labels with no real entity behind them yet — DEC-22 defers reconciling them to "when `Plantilla` (CH-12) exists."
- **Canonical views (CH-09/CH-10)**: `VistaCanonica` stores one operator-authored SQL text per `Conexion` × canonical entity (unique pair, `@@index([tenantId])`, in `MODELOS_AISLADOS`). Pure persistence — DEC-31: "El armado de los `WITH` en tiempo de ejecución se construye en CH-12, donde se consume." `src/vistas-canonicas.ts` never opens a `pg` connection except CH-10's `LIMIT 0` probe (`sondearEstructura`).
- **Parameters (CH-11)**: `src/parametros.ts` exports `DeclaracionParametro {nombre, tipo}` (`texto|numero|booleano|fecha`), a plain-text `:nombre → $k` scanner/rewriter, and `prepararSentencia(sql, declaracion, valores)`. DEC-52 reserves it as CH-12's reusable primitive, without CH-12 fields.
- **Saved queries**: `ConsultaGuardada` — tenant-scoped, create+list+get-by-id only, no update (DEC-10), JSON `parametros` column (DEC-55).
- **Execution engine**: `src/consulta-ejecucion.ts` (`ejecutarConsulta`) is the single read-only pipeline (`BEGIN TRANSACTION READ ONLY`, DEC-08 privilege check, `LIMIT/OFFSET` wrapper); it accepts only a branded `SentenciaPreparada`.
- **Domain entities (`docs/00-contexto.md` §8)**: `plantilla` and `automatizacion` (instancia de plantilla en un tenant) are distinct. Instantiation is D2/D3 in CH-21 (R2): "elegir plantilla, completar parámetros".
- **Real canonical SQL today** (experiment artifacts, not wired in): `openspec/changes/CH-16d-segunda-automatizacion-y-with/sql/13_stock_producible_con_with_foodstore.sql` (WITH-composed) and `11_consulta_canonica_stock_fisico.sql` (hardcoded `<= 20` threshold). No `reporte-diario` canonical query exists (DEC-29).
- No code models "condición", "formato" or "tolerancia de frescura" — story vocabulary only (D1, X3, N1–N3, F1–F2), no prior DEC.
- **Tenant-agnostic route precedent**: `GET /contrato` is exempt from `x-tenant-id` (DEC-24); it holds no Prisma client.
- `src/consola.ts` was only extended by CH-04/05/11; D1 names no UI element.

## Affected Areas

- `prisma/schema.prisma` — new `Plantilla` model + additive migration (shape depends on OQ-1).
- New `src/plantillas.ts` (+ test) — routes, one-name-across-model/route/module convention.
- `src/parametros.ts` — imported only (DEC-52).
- `src/vistas-canonicas.ts` / `VistaCanonica` — read access to build the `WITH` prefix (DEC-31); likely a new pure composition function.
- `src/aislamiento-prisma.ts` (`MODELOS_AISLADOS`) — only if tenant-scoped.
- `src/contexto-tenant.ts` (`esExenta`) — only if global and exempt from `x-tenant-id`.
- `src/contrato.ts` (`AUTOMATIZACIONES`) — candidate touch point to close DEC-22.
- `src/server.ts` — route registration.
- Spec deltas: `domain-data-model`, `tenant-schema-mapping`, `query-parameters`, `canonical-contract`.
- `docs/01-decisiones.md` — new DECs required before design.

## Approaches

1. **Global catalog Plantilla + WITH-composition primitive + optional preview endpoint.** Matches the plantilla/automatizacion split, fulfills DEC-31, lets P1 verify a template before CH-13, closes DEC-22. Cons: new class of tenant-agnostic DB-backed model; largest surface. Effort: Medium-High.
2. **Minimal persistence-only Plantilla.** Smallest diff; leaves DEC-31 unmet and reopens it at CH-13. Effort: Low-Medium.
3. **Tenant-scoped Plantilla** mirroring `ConsultaGuardada`/`VistaCanonica`. Lowest structural risk; contradicts the domain split, likely redesign at CH-21. Effort: Low.

## Recommendation

Approach 1, scoped narrowly; condición/formato/frescura as the smallest fields that satisfy D1's wording without pre-building CH-14/CH-21/CH-24. Subject to OQ-1..OQ-9.

## Risks

- Scope creep into CH-13/CH-14/CH-21/CH-24.
- DEC-22 reconciliation debt becomes permanent if unaddressed.
- Only 2 of 3 validated automations have canonical SQL; `reporte-diario` has none.
- `WITH`-composition failure modes (missing view for the connection, alias collision) are undesigned; they need a legible verdict (M4 style), not a raw Postgres error.
- A global Plantilla becomes the first DB-backed exception to "every model except `Tenant` is isolated".
- AGENTS.md lists D-1, D-2, D-4, D-5 as open gates, but `docs/01-decisiones.md` shows D-4/D-5 closed (DEC-25/26) and D-6 open. Stale doc; does not block CH-12 (R1).

## Open Architecture Questions

- **OQ-1** Tenant-scoped vs global catalog vs code-only. Rec: global catalog, persisted.
- **OQ-2** Pure composition only vs also a preview endpoint vs full execution wiring. Rec: preview endpoint.
- **OQ-3** Explicit `entidades` list vs inferred from SQL vs always all five. Rec: explicit list.
- **OQ-4** Condición: nothing new vs structured `{campo, operador, valor}` vs free text. Rec: nothing new.
- **OQ-5** Formato: none vs fixed enum placeholder vs real N3 templating. Rec: fixed enum.
- **OQ-6** Tolerancia de frescura: unenforced scalar minutes vs none vs ISO-8601. Rec: scalar minutes.
- **OQ-7** Close DEC-22 via enum link to `AUTOMATIZACIONES` vs leave unlinked vs closed one-per-label catalog. Rec: enum link.
- **OQ-8** Update semantics: no update vs in-place replace vs full CRUD. Rec: leaning in-place replace (product call).
- **OQ-9** Write missing `reporte-diario` canonical query: out of scope vs in scope. Rec: out of scope.

## Ready for Proposal

No — OQ-1..OQ-9 must be decided by the user and registered in `docs/01-decisiones.md` first.
