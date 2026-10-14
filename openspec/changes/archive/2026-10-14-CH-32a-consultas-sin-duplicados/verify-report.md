# Verify Report: CH-32a — Saved queries without duplicates, a connection picker, and the query pop-up

**Date**: 2026-10-14. **Branches**: `ch32a/exploracion`, `ch32a/consultas`, `ch32a/consultas-vista` (PRs #175, #176 and #177, stacked, merged). Verified on `master` at `4dfacff`.
**Verdict**: PASS with warnings. No blockers.

**How it was verified.**
- Inline by the orchestrator: the Claude Code hook refuses `sdd-*` sub-agent dispatch.
- The code was written by delegated writers, and the parent spot-checked it (`tsc`, `consola.test.ts`).
- The user tried the query pop-up in the app on 2026-10-14 («funciona bien»).
- There is no manual visual-pass task: no project document requires one (see the feedback memory `sin-pasada-visual-manual`).

## Commands

| Command | Result |
|---|---|
| `npx tsc -p tsconfig.json --noEmit` | exit 0 |
| `npm run build` | ok |
| `npx tsx --test src/consola.test.ts` | 199 of 199 (re-run by the parent after its own changes) |
| `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db`, with the Docker `app` running | 1355 tests, 1351 pass, 4 fail: the known `conexiones` false positives (W1) |

## Spec coverage — `specs/query-console/spec.md` (delta)

| Requirement | Evidence (`consola.test.ts`) |
|---|---|
| Saving the Current Statement (create only with no query loaded; the save gate) | «Guardar consulta creates the query»; «with a query loaded … sends nothing»; «the save control opens only after an ok «Probar» and a name»; «editing the SQL, the connection or the parameters closes the gate…»; «a failed «Probar», of any kind, closes the gate…»; «saving sends nothing while the gate is closed»; «the line next to the save control says why it is closed» |
| Result Next to the Execute Button (now inside the pop-up) | CH-30a's markup-order test, rewritten for the pop-up: form, result, pager, «Probar», then the saved list |
| Save as a New Version | the CH-25 save tests, run after an ok «Probar»; «a 200 saves the version, closes the pop-up and confirms on the page»; «a refused save keeps the pop-up open with the message inside» |
| Create and Edit Forms Open in a Pop-up | «Cancelar and Escape close the pop-up at once when nothing changed»; «with changes, Cancelar and Escape ask «Descartar cambios»…» (name, description, SQL and a parameter) |
| Query Screen and Query Pop-up | the markup tests (header button, `role=dialog`, `aria-modal`, field order, versions as a wide aside); «Nueva consulta» opens empty; «Abrir» opens loaded and titled; «Probar» renders the result inside the pop-up; a tenant switch closes it |
| Connection Picker | the 12 picker tests of PR1 (name + short id, loading, empty, truncated, error with «Reintentar», no tenant, choice kept, stale answer dropped) |

## Warnings

- **W1** — Pre-existing: four `conexiones` tests fail with the password `postgres`.
- **W2** — Found by this verify: the main spec's "Result Next to the Execute Button" and "Save as a New Version" (CH-30a, CH-25) no longer matched the pop-up. Both were added to the delta as MODIFIED before the sync, with "Previously" lines. Their scenarios are kept.
- **W3** — The indicator next to the save control (commit `5ec557c`) was written inline by the parent, after the last SDD attempt was settled, without acquiring a new attempt. Its evidence is the full suite above.
- **W4** — Every SDD runtime attempt of this change settled `passed` over its changed-line budget: about 627 for PR1 and about 1,520 for PR2, which includes the first version that was replaced. The PRs carry `size:exception`, accepted by the user, and resets were done under the user's standing authorization for CH-32a.
- **W5** — DEC-173 was first taken as "side panel" by the agent, then corrected by the user to "pop-up" the same day, before any merge. The first PR2 implementation (`6e048aa`) stays in the history, replaced.
- **W6** — The fake DOM cannot check layout: the 1100 px pop-up width and the table scrolling inside it were seen only by the user in the app.
