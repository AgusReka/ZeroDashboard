# Exploration: CH-25 — Versioning of saved queries (B4; screen C-05)

Store: openspec. Pace: automatic. Delivery: decided at the tasks guard (400-line budget).
Explored inline: the Claude Code hook refuses sub-agent SDD dispatch.
`docs/02-mapa-de-changes.md` lists CH-25 in R3 and outside the recordable-demo path.

## The story

- **B4** (P1, R3): "versionar los cambios de una consulta guardada". Acceptance: "historial con fecha; se puede volver atrás".
- **C-05** (design skill, mockup: a side panel in Consultas → Versiones): per version `version` (integer), `fecha`, `autor`, `nota`, `es_actual`; states loading, "Esta es la versión inicial", error; actions **Comparar con la actual** and **Restaurar** (asks for confirmation).
- The design README lists a side-by-side comparison of query versions as "noted, not designed": the visual diff has no design.

## What exists

| Piece | State |
|---|---|
| Saved query model | `ConsultaGuardada`: `id`, `tenantId`, `nombre`, `descripcion`, `sql`, `parametros`, `creadaEn`, `actualizadaEn @updatedAt` (`prisma/schema.prisma:65`). Tenant-scoped (DEC-13). |
| Routes | `POST /consultas-guardadas`, `GET /consultas-guardadas`, `GET /consultas-guardadas/:id` (`src/consultas-guardadas.ts`). **No update, no delete** (DEC-10). |
| Validation at save time | `sanearSql` as a predicate, `validarDeclaracion` and `analizarSentencia` (DEC-49, 56, 57, 59); the SQL is stored verbatim. |
| Why there is no edit | DEC-10: "actualizar se solapa con B4 (CH-25)"; today a mistaken query is fixed by saving another. |
| Console | A "Consultas guardadas" section that saves the editor's statement and lists saved queries; its help text says a saved query cannot be edited (`src/consola.ts`, to be rewritten). |
| Coupling | Automations do not reference saved queries (templates own their SQL, DEC-85, DEC-130): versioning only touches the console. |
| Identity | The console has no user or session (DEC-15: the tenant is explicit per request), so **there is no source for `autor`**. |
| Precedent | DEC-34 made canonical views replaceable in place "with no trace" and left the history to B4/CH-25. B4 itself speaks only of saved queries. |

## Decisions that are not mine to take (AGENTS.md: register first)

1. **Where does the history live?** (a) Keep the current content on `ConsultaGuardada` and append the previous state to a new tenant-scoped table on every update; existing rows stay valid with no backfill and the current read shapes do not move. (b) Make `ConsultaGuardada` a stable identity and keep all content in versions; cleaner, but it rewrites every read and needs a backfill.
2. **What does "volver atrás" do?** (a) Restore creates a **new** version with the old content: nothing is deleted and the history only grows. (b) Move a pointer or discard the newer versions: destructive.
3. **`autor` and `nota`.** There is no identity to fill `autor`. Options: omit `autor` and add an optional `nota` typed by the operator; or let the operator type `autor` too.
4. **"Comparar con la actual".** The visual diff has no design. Options: show the two statements side by side as plain text with no diff algorithm; or leave comparison out and record it as a limit.
5. **The edit surface.** Updating needs a write route (`PUT /consultas-guardadas/:id`, same validations as the create), which amends DEC-10 for the update only; deleting stays out.

## Proposed shape once decided (not final)

- Migration: `ConsultaGuardadaVersion` (tenant column, `consultaGuardadaId`, `version`, copy of `nombre`, `descripcion`, `sql`, `parametros`, `nota`, `creadaEn`) plus `ConsultaGuardada.version Int @default(1)`; registered in the isolation extension and in the two-tenant sweep (T2).
- Routes (console-only, header-scoped): `PUT /consultas-guardadas/:id`, `GET /consultas-guardadas/:id/versiones`, `POST /consultas-guardadas/:id/versiones/:version/restaurar`.
- A pure module for the version rules and the body validation; the update runs in one transaction (append previous state, then update).
- Console: a "Versiones" panel next to the saved-query list, with the confirmation for Restaurar.

## Risks

- Rule 2: the new table and three routes need the isolation extension and a two-tenant test; a version of another tenant's query must answer 404 like an unknown one.
- Atomicity: appending a version and updating the row must be one transaction, or a crash leaves a gap in the history.
- The stored SQL is verbatim (DEC-10 note): a restore must copy it byte for byte.
- Unbounded history per query: the listing needs the usual cap (`LIMITE_LISTADO`).

## Size

Without the compare view: roughly 300-400 production lines plus a migration, tests x1.7, so three or four chained PRs (server, restore, console). The tasks phase will forecast it.

## Next

Decide 1 to 5, register them in `docs/01-decisiones.md`, then propose, spec, design, tasks.
