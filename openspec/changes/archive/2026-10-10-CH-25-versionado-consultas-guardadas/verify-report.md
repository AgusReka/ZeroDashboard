# Verify Report: CH-25 — Saved-query versioning

**Date**: 2026-10-10. **Branches**: `ch25/esquema`, `ch25/reglas-puras`, `ch25/edicion`, `ch25/historial`, `ch25/restaurar`, `ch25/panel-versiones`, `ch25/comparar-restaurar`, `ch25/guardar-version`, stacked on `ch25/exploracion` and on the CH-24 chain.
**Verdict**: PASS with warnings. No blockers, no critical findings.
Verified inline by the orchestrator: the Claude Code hook refuses `sdd-*` sub-agent dispatch, so this is not an independent verifier run.

## Commands

| Command | Result |
|---|---|
| `npx tsc -p tsconfig.json --noEmit` | exit 0, no output |
| `npm test` against the dev database (password `postgres`), **app container stopped** | 1140 tests, 1136 pass, 4 fail: the known `conexiones` false positives (W3) |
| Manual visual pass on the rebuilt image | done by the user on 2026-10-10 ("La prueba visual salió bien"): load, save as a new version, versions panel, compare, restore |
| `scripts/smoke.sh` | not run: it creates data and runs `docker compose down` on failure |

## Spec coverage — `specs/saved-queries/spec.md`

| Requirement / scenario | Evidence |
|---|---|
| Columns and history table; existing queries need no backfill | migration `20261009000000_consulta_guardada_versiones` (`version` default 1); `consultas-versiones-historial.test.ts` "a query never edited lists one current version, with no statement" |
| History table in the isolation extension | `aislamiento.test.ts` (model list); `aislamiento-versiones.test.ts` (four cases, `$transaction` included) |
| Optional note | `consultas-versiones-rutas.test.ts` "the note is optional, blank is null, and a long or non-text note is refused"; `consultas-versiones.test.ts` `resolverNota` cases (limit 500) |
| A valid edit creates a version | "a valid edit archives the previous state, updates the row and bumps the version"; "each edit keeps the note of the version it archives" |
| An identical edit creates nothing | "an identical edit is 409 sin-cambios and creates nothing, even with a note"; `mismoContenido` cases |
| Invalid content refused as in the create | "invalid content gives the same 400 body the create gives, and stores nothing" |
| Forbidden keys | "forbidden and unknown keys are refused" |
| Statement stored verbatim | "the statement is stored verbatim: spaces, tabs, CRLF and the final semicolon" |
| Unknown or foreign id | "an unknown id is 404"; "tenant A cannot edit tenant B" |
| Conflicting concurrent edit | "a conflicting archive is 409 conflicto-de-edicion and the whole edit is rolled back" |
| List the versions (single, order, flags, cap, foreign tenant) | `consultas-versiones-historial.test.ts`: "after two edits the list is newest first and only the newest is current", "the list keeps the current version and caps the past ones at the listing limit", "tenant A cannot read tenant B" |
| Read one version; unknown versions | "one version returns its full content, the current one included"; "a version that is not a positive integer or has no entry is version-no-encontrada" |
| Restore creates a new version; history only grows | `consultas-versiones-restaurar.test.ts` "restoring version 2 at version 5 creates version 6 with the content of version 2, and the history only grows" |
| Restore copies byte for byte | "the statement and the parameters are copied exactly as stored" |
| Restoring the current version | "restoring the current version is 409 version-vigente and changes nothing" |
| Restore, foreign tenant | "tenant A cannot restore a version of tenant B"; "restoring in tenant A never touches tenant B" |
| Tenant header on the four routes | "the edit route requires…", "both read routes require…", "the restore route requires the tenant header" |

## Spec coverage — `specs/query-console/spec.md`

| Requirement / scenario | Evidence (`consola.test.ts`, prefix `CH-25`) |
|---|---|
| Versions panel: rows, Vigente with icon and word | "opening shows loading at once, then the rows newest first with Vigente as icon and word" |
| A query never edited | "a query with one version says so and offers no action" |
| Errors and cap | "a failed history request shows the reason and no rows"; "a capped history is announced" |
| Tenant switch | "switching tenant closes the panel and clears every row of the previous tenant"; "Cerrar versiones hides the panel, and a response that arrives afterwards is dropped" |
| Compare as two plain-text blocks; hostile statement | "comparing reads the chosen and the current version and shows both as text, side by side"; "a refused comparison keeps the rows and says why" |
| Restore with confirmation; cancel; refusals | "Restaurar asks first…", "confirming restores exactly once, with the note…", "without a note the restore body is empty", "a refused restore keeps the rows and explains the refusal" |
| Save as a new version | "saving sends one PUT for the loaded id with the editor content and the note…", "without a note the body carries no nota key", "saving refreshes the open versions panel of the same query" |
| Nothing loaded; tenant switch forgets the loaded query | "with nothing loaded the action is not offered"; "switching tenant forgets the loaded query and hides the action" |
| `sin-cambios` and `conflicto-de-edicion` messages | "each refusal reads in plain words and keeps the editor as it was"; "when the query is gone the notice disappears and the list is refreshed" |
| Help text | "the help text no longer says a saved query cannot be edited, and still says it cannot be deleted" |

Rules: 1 and 2 hold (the four routes are console-only; the client panel never calls them); 6: `planificador.ts` is untouched — an automation keeps reading the template, not a saved query.

## Deviations from the design

- `POST …/restaurar` declares no body schema: a POST with no body failed Fastify's object schema, so the body is read by the pure `leerCuerpoRestauracion` (no body, `null` and `{}` all mean "no note"; any other key is refused by name).
- Loading a saved query now also fills the name and description fields, so "Guardar como nueva versión" sends the editor's full content.
- Restoring the query that is loaded in the editor reloads the editor with the restored content.
- Shared route-test setup lives in `src/consultas-versiones-apoyo.ts`.
- The migration was applied to the user's dev database.

## Findings

- **W1 size**: `ch25/edicion` has ~472 changed lines against the 400 budget (`size:exception` or split); the other slices are under budget.
- **W2 independence**: verified by the orchestrator that wrote the code.
- **W3 environment**: with the database password `postgres`, four `conexiones.test.ts` cases fail because the response legitimately contains `"motor":"postgres"`. They pass with another password.
- **W4 shared database**: run the full suite with the app container stopped (`CH-14 5.11` and `CH-17a 2.1` are timing-sensitive against the running scheduler).
- **W5 docs**: `docs/02-mapa-de-changes.md` still lists CH-25 as pending.
