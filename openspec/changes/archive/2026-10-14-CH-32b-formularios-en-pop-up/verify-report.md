# Verify Report: CH-32b — Create forms in a pop-up, and the audit's F2 items

**Date**: 2026-10-14. **Branch**: `ch32b/formularios` (PR #179, one PR with `size:exception`, merged). Verified on `master` at `8a7d90d`.
**Verdict**: PASS with warnings. No blockers.

**How it was verified.**
- Inline by the orchestrator: the Claude Code hook refuses `sdd-*` sub-agent dispatch.
- The code was written by one delegated writer; the parent re-ran `consola.test.ts` and read the schedule-in-words and «Reponer clave» code.
- There is no manual visual-pass task: no project document requires one (feedback memory `sin-pasada-visual-manual`).

## Commands

| Command | Result |
|---|---|
| `npx tsc -p tsconfig.json --noEmit` | exit 0 |
| `npm run build` | ok |
| `npx tsx --test src/consola.test.ts` | 262 of 262 |
| `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db` | 1418 tests, 1414 pass, 4 fail: the known `conexiones` false positives (W1) |

## Spec coverage — `specs/query-console/spec.md` (delta)

| Requirement | Evidence (`consola.test.ts`, prefix `CH-32b`) |
|---|---|
| Create and Edit Forms Open in a Pop-up (DEC-173) | table-driven over the four new pop-ups: «is a hidden modal dialog opened from the page header…», «opens with the focus on its first field…», «Cancelar/Escape with nothing typed closes it and sends nothing», «…with something typed asks first; Seguir editando keeps it, Descartar cambios closes it», «a tenant switch closes it without asking, and it reopens blank»; «the script has one pop-up factory, and the query pop-up is built on it» plus the unchanged CH-32a pop-up tests |
| Tenants Screen | ««Crear tenant» creates it, closes the pop-up, reloads and leaves the active tenant as it was»; ««Crear y elegir» creates it and makes it the active tenant, selector and bar»; «…on a 201 with no id only reports the creation»; «an empty name is refused inside the pop-up by both buttons…»; «a refused or unreachable creation is told inside the pop-up…»; the CH-30c baja tests |
| Connections Screen | ««Nueva conexión» is a pop-up with the same fields as the panel had, and the panel and its ids are gone»; «a saved connection whose test fails still closes the pop-up and says so…»; «…whose test could not run…»; «a rejected registration keeps the pop-up open with the fields named and the password empty»; «any other refusal is told inside the pop-up too, and a second press while saving sends nothing more»; «discarding a typed password empties the field…»; «a tenant switch while the test runs leaves no notice…» |
| Connection Through the Agent | the CH-30c agent-route test, opening the pop-up |
| Panel Users Screen | ««Nuevo usuario» holds the email and the optional name…»; «a created user closes the pop-up and the password shows once on the page…»; «a rejected user says which fields inside the pop-up…»; «Reponer clave asks first, in the row, saying the sessions will close; Cancelar restores the actions and sends nothing»; «confirming «Reponer clave de {correo}» posts to the clave route and shows the password once, for an inactive user too» |
| Console Displays Automations and Supports Creating One (DEC-78) | «the wizard is a wide pop-up on #auto-alta, opened from the header…»; «on step 2, Cancelar and Escape ask the same question…»; «a connection, a template, a parameter value or a recipient each count as changes…»; «any other refusal of the create is told inside the pop-up too…»; «a created automation closes the pop-up, resets it…»; «each preset reads in words followed by its cron in monospace, and the connection by its name»; «a custom or malformed schedule shows the cron alone…»; «a connection that is not among the tenant's…»; «a hostile connection name is shown as text»; «the connections answering badly or not at all leaves the list drawn with short ids…»; the CH-13/CH-21c wizard tests |
| Automation Views Respect the Active-Tenant Indicator (added by this verify, W2) | «loading the screen asks for the catalog, then the connections, then the list» (asserts the five tenant-load requests in order); «the names of the tenant just left never reach the list of the new one»; the CH-21c tenant-switch tests |

## Warnings

- **W1** — Pre-existing: four `conexiones` tests fail with the password `postgres`.
- **W2** — Found by this verify: the main spec's "Automation Views Respect the Active-Tenant Indicator" still said the tenant load issues exactly three requests and none to `GET /conexiones` (already untrue since CH-32a). It was added to the delta as MODIFIED, with a "Previously" line, before the sync; its scenarios are kept, the last one restated with the five requests.
- **W3** — Size: about 1,540 changed lines in `src` (`consola.test.ts` 854, `consola.ts` 686) against a forecast of ~900; one PR with `size:exception`, decided by the user.
- **W4** — No fresh-context design validator, no independent code review and no SDD runtime attempt ledger: `sdd-*` dispatch is refused by the hook and receipt-driven development is off. Evidence is the suites above and the parent's spot check.
- **W5** — Deviations from design.md, reported by the writer and accepted: the factory also exposes `pedirCerrar` (for the wizard's second «Cancelar»); the wizard's status line and discard strip sit at dialog level so both steps share them; pop-ups also clear their fields on close; the user, connection and wizard pop-ups refuse to open with no tenant; double-submit guards on tenant and connection; the connection pop-up closes after the test answers; the wizard's connection load also refreshes the list's names.
- **W6** — The fake DOM cannot check layout: the 900 px wizard pop-up and the other dialogs have not been seen in this verify.
- **W7** — The design guide's C-05 still says "panel lateral" for «Nueva conexión»; DEC-173 supersedes it. Left as a proposal to the guide.
