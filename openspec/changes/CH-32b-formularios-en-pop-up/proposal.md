# Proposal: CH-32b — Create forms in a pop-up, and the audit's F2 items

**Status**: ready for spec and design. Inputs: exploration.md (decisions D1–D3 resolved 2026-10-14), DEC-173, DEC-156 («Reponer clave»), DEC-129 (schedule presets), DEC-132/DEC-167 (`GET /conexiones`), the audit of 2026-10-13 (observations 9–12, F2), the design guide (`consola.md` C-02, C-05, C-09; `lenguaje.md`).

## Intent
- Every create form of the console follows DEC-173, as Consultas already does (audit obs. 9).
- A tenant can be chosen as it is created (audit obs. 11).
- Resetting a panel user's password, which closes their sessions, is confirmed first (audit obs. 10).
- The automations list reads in words: the connection's name and the schedule (audit obs. 12).

## Scope

### In Scope
- **One pop-up mechanism.** CH-32a's open / ask-then-close / discard logic becomes one console helper used by the five pop-ups; Consultas keeps its ids and behaviour.
- **«Nuevo tenant» pop-up** (name), with two actions at its foot: «Crear tenant» and «Crear y elegir» (D1 a). «Crear y elegir» creates the tenant and makes it the active one through the same path as «Elegir como activo».
- **«Nuevo usuario» pop-up** (email, name). On success it closes and the generated password shows once in the page notice, as today.
- **«Nueva conexión» pop-up** replacing the side panel, same fields (including «Vía»). «Guardar y probar» saves, tests, closes the pop-up and reports «Guardada. Prueba: …» in the page notice, also when the test fails (D3 a). A rejected registration keeps the pop-up open with the message inside and the password field empty.
- **Automation wizard pop-up** (wide), keeping its two steps, stepper and preview. Opens from «Nueva automatización» in the page header.
- **«Cancelar» and Escape** on the four pop-ups close without sending; with something typed they first ask «Descartar cambios» («Hay cambios sin guardar.» + «Descartar cambios» + «Seguir editando»). A tenant switch closes any of them without asking. Focus goes to the first field when one opens.
- **Openers in the page header**, one primary action per screen.
- **«Reponer clave» confirms inline**, like «Desactivar»: «Reponer clave de {correo}» + «Cancelar», with a line saying that the user's open sessions will be closed.
- **Automations list:** the Conexión column shows the connection's name (`GET /conexiones` loaded with the list; the short id when the connection is not found); the Horario column shows the schedule in words plus the cron in mono for the three DEC-129 presets (D2 b, guide C-09) and the cron alone for a custom expression.
- `docs/02-mapa-de-changes.md` gains the CH-32b row.

### Out of Scope
- Editing automations (audit obs. 8, F3) or any other record: the console has no edit forms for these four.
- Typed confirmation of a tenant's baja (audit §3.4, F3).
- Rewriting the design guide's C-05 ("panel lateral" for «Nueva conexión»): superseded by DEC-173; noted as a proposal to the guide.
- Focus trap, focus return and backdrop click (not in DEC-173; CH-32a does not have them either).
- The audit's visual pass at 360/1280 px (standing user preference: not added).
- Any route, schema or API change.

## Capabilities

### Modified Capabilities
- `query-console`: Tenants Screen, Connections Screen, Connection Through the Agent, Panel Users Screen, Console Displays Automations and Supports Creating One (DEC-78), Create and Edit Forms Open in a Pop-up (DEC-173).

## Approach
Same pattern as CH-32a: static markup, every id guarded in `IDS` (new hidden pop-ups in `IDS_OCULTOS`, retired ones in `IDS_RETIRADOS`), API text written with `textContent`, no `zd-*` class assigned from the script (guard G3'), tenant routes through `pedir()`. The cron-to-words reverse is ported into the console script from `frecuenciaDeCron` (`src/panel-automatizaciones.ts:103`), since the script cannot import modules.

## Affected Areas
- `src/consola.ts`, `src/consola.test.ts`, `openspec/specs/query-console/spec.md` (at archive), `docs/02-mapa-de-changes.md`.

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| ~36 existing tests drive the inline forms, panel and wizard by id | High | Keep every field id; only containers and openers change. Tests open the pop-up through shared helpers before filling it |
| Loading `GET /conexiones` with the automations list breaks every scenario that loads that screen (empty fake response queue throws) | High | One test helper queues the connections answer with the list; done once, first |
| Escape listener is per pop-up node (as in CH-32a), so it fires only with focus inside | Low | Focus moves to the first field on open; same accepted limit as CH-32a |
| «Crear y elegir» wipes open screens like any tenant switch | Low | It is an explicit action, named as such |
| The size goes over the 400-line budget | High | Three-slice plan in tasks; the user decides split or `size:exception` |

## Rollback
Revert the PR(s): front-end only, no data or API change.

## Review Workload Forecast
- `src/consola.ts` ~370, `src/consola.test.ts` ~500, spec delta ~120: **~990 lines**. 400-line budget risk: High; Chained PRs recommended: Yes (three slices); Decision needed before apply: Yes (delivery strategy is single PR).
