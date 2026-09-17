# Proposal: CH-05 — Saved Queries

## Source

- `docs/02-mapa-de-changes.md`, release R0, CH-05: "Consultas guardadas — nombre, descripción, persistencia en base propia."
- `docs/mapa-historias.md`, story B2 (criterion: "Persistencia en la base propia"); R0 closure: "escribir una consulta, guardarla y ejecutarla."
- `docs/01-decisiones.md`: DEC-10, DEC-11, DEC-12 (firm, user-decided 2026-09-16 — cited, not re-opened).
- Engram `sdd/CH-05-saved-queries/explore` (obs #50).

## Why

CH-04 executes queries but nothing survives a reload, and `ConsultaGuardada` has sat unwired in the schema since CH-02. CH-05 is R0's last change and the one that makes its closure narrative literally true.

## What Changes

- New module `src/consulta-guardada.ts`, registered through the existing `register<X>Routes(app, prisma)` pattern in `src/server.ts` (precedent: `src/conexiones.ts`).
- Three routes only (DEC-10): create, list, get-by-id. No update, no delete.
- No migration (DEC-11): CH-02's model fits as-is, with no `conexionId`. The connection stays an independent execution-time parameter of `POST /consultas/ejecutar`.
- Tenant resolved server-side via `prisma.tenant.findFirst({ orderBy: { creadoEn: 'asc' } })`, `503 tenant-no-inicializado` when absent; the client never supplies `tenantId`.
- Validation mirrors `conexiones.ts`: JSON Schema, `additionalProperties:false`, `attachValidation:true`, shared `camposInvalidos()` → `400 {error:'solicitud-invalida', campos:[…]}`. `nombre` and `sql` required non-empty, `descripcion` optional/nullable.
- Console (DEC-12): `src/consola.ts` gains save-current-statement, saved list, and load-into-editor. Stays one self-contained document, `textContent`-only rendering, no new dependency.
- New `src/consulta-guardada.test.ts`: `node:test` + `app.inject()` against live Postgres, skipping when unreachable.

## Design-Level Scoping Decisions (carry into `sdd-design`)

1. **List payload and bounding** — whether the list carries each row's `sql` or metadata only (making load a second get-by-id), plus ordering and any row cap.
2. **Duplicate `nombre`** — no precedent exists (`Conexion.nombre` is unenforced). Design MUST state the behavior; a uniqueness constraint would be a migration and needs a new decision first.

## Out of Scope

- Update and delete (DEC-10); B4 versioning → CH-25.
- Binding to a `Conexion` (DEC-11); no schema change at all.
- B3 parameters → CH-11; A2 encryption → CH-07; T1/T2/T4 → CH-06.
- Persisting execution results (gate D-1 stays open).

## Non-Negotiable Rules in Effect (`docs/00-contexto.md` §5)

- **Rule 2**: `tenantId` is resolved server-side, never read from the request.
- **Rule 4**: stored `sql` is persisted text; this change builds no SQL by concatenation.
- **Rule 7**: no credential or raw driver error crosses a boundary; the console keeps `textContent`-only rendering.

## Rollback Plan

No migration and no schema change. Revert the commit: the new module and test, its registration line in `src/server.ts`, and the `src/consola.ts` edits. Rows written here are orphaned but harmless in a table that predates this change; CH-01–CH-04 behavior is untouched.

## Impact

### New Capabilities

- `saved-queries`: persisting a named, optionally described SQL text for the tenant, and retrieving it by list or by id.

### Modified Capabilities

- `query-console`: gains saving the current statement, listing saved queries, and loading one back into the editor.

## Success Criteria

- [ ] A saved query persists with `nombre`/`descripcion`/`sql` for the seeded tenant and appears in the list.
- [ ] Get-by-id returns the stored statement; an unknown id returns a legible 404.
- [ ] A create missing `nombre` or `sql`, or carrying an unknown property, returns `400 solicitud-invalida` with field paths.
- [ ] A request cannot set `tenantId`.
- [ ] In the console, a statement is saved, appears in the list, and loads back into the editor ready to execute.
