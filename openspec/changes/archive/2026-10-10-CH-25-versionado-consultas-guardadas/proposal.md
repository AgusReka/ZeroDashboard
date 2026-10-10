# Proposal: CH-25 — Versioning of saved queries (B4; screen C-05)

**Status**: ready for spec and design. Inputs: exploration.md, DEC-146 to DEC-150, `docs/02-mapa-de-changes.md` (CH-25), design skill C-05.

## Intent
- Let the implementer (P1) edit a saved query and keep every previous state, with date and an optional note, and go back to any of them (story **B4**).
- Going back is additive: restoring creates a new version, so the history only grows (DEC-147).
- Console only: automations do not reference saved queries, and the client panel never sees them (rule 2).

## Scope

### In Scope
- Migration and schema: `ConsultaGuardada.version` (default 1) and `ConsultaGuardada.nota` (the note of the current version), plus a new tenant-scoped table `ConsultaGuardadaVersion` for the previous states (DEC-146).
- `PUT /consultas-guardadas/:id`: full edit with the same validations as the create plus an optional `nota`; archives the previous state and bumps `version` in one transaction; `409 sin-cambios` when nothing changed (DEC-150).
- `GET /consultas-guardadas/:id/versiones` and `GET /consultas-guardadas/:id/versiones/:version`.
- `POST /consultas-guardadas/:id/versiones/:version/restaurar`.
- Console: a "Versiones" panel per saved query (list, plain-text side-by-side comparison, restore with an inline confirmation) and a way to save the editor's content as a new version of the loaded query (DEC-148, DEC-149).
- Registration of the new table in the isolation extension and a two-tenant proof on every new route.

### Out of Scope
- Deleting a saved query or any of its versions, pruning the history (DEC-147).
- An `autor` column (no identity in the console, DEC-148) and a real visual diff (DEC-149).
- Versioning of canonical view definitions (DEC-34 mentions the history of replaced views; B4 speaks only of saved queries).
- Any change in the engine, in automations or in the client panel.

## Capabilities

### Modified Capabilities
- `saved-queries`: edit, versions, restore, and the history table.
- `query-console`: the Versiones panel and the save-as-new-version action.

## Approach
A pure module `src/consultas-versiones.ts` holds the rules with no Prisma: body validation shared with the create route (extracted, behaviour-preserving), the "same content" comparison, the note rule and the `:version` parsing. The routes live in `src/consultas-guardadas.ts` next to the existing ones. Every write is an interactive transaction (archive, then update); the unique pair `(consultaGuardadaId, version)` makes a concurrent double edit fail with a conflict instead of forking the history. The console section reuses the page's text-node discipline and the inline-confirmation wording rule («Restaurar versión 3»).

## Affected Areas
- `prisma/schema.prisma`, a new migration, regenerated client
- `src/aislamiento-prisma.ts` (register `ConsultaGuardadaVersion`)
- `src/consultas-versiones.ts` (new) and its test
- `src/consultas-guardadas.ts`, `src/consultas-guardadas.test.ts`, a new route test file
- `src/consola.ts`, `src/consola.test.ts`
- `docs/01-decisiones.md` (DEC-146 to DEC-150, done)

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Cross-tenant read or restore of a version | Low | Model registered in `MODELOS_AISLADOS`; every route resolves the query through the scoped model first; two-tenant tests on all four routes |
| A crash between archive and update forks the history | Medium | One interactive transaction; unique `(consultaGuardadaId, version)`; test that a forced conflict leaves the row untouched |
| The scoping hook not applying inside an interactive transaction | Medium | Verify with a test first (a foreign id inside the transaction must not resolve) before building on it |
| Restore alters the stored SQL | Low | Copy the stored value as is; test byte equality including a trailing `;`, tabs and CRLF |
| Empty versions from no-op edits | Medium | `409 sin-cambios`; a note alone never creates a version |

## Review Workload Forecast
- PR1: migration, schema, isolation registration, pure module, shared validation: ~300 lines
- PR2: `PUT` and the two `GET` routes with tests: ~420 lines
- PR3: restore route with tests: ~250 lines
- PR4: console panel, compare, restore and save-as-version: ~450 lines
Total ~1400 lines; **400-line budget risk: High; Chained PRs recommended: Yes; Decision needed before apply: Yes** (the session strategy is `single-pr`).
