# Proposal: CH-52 — One feedback system and human errors

**Status**: approved by the user on 2026-11-11.

**Inputs:**
- `exploration.md` and EXPLORE 2026-11-11;
- `guidelines/admin.md` E1–E6, M4, M5 and T7;
- `guidelines/lenguaje.md`: console error formula, HTTP table, glossary and date rule.

**Priority: high, cross-cutting.** It lands before CH-53 to CH-56, which reuse its helpers. It goes after CH-51 in branch order, because both edit `consola.test.ts`.

## Intent
The console reports results in three different ways:
- the errors leak API paths and HTTP codes;
- the page banner sits behind an open pop-up and is moved by hand;
- the copy switches between voseo and "usted".

This change keeps one feedback component (`zd-banner`), places each message where the operator is looking, writes errors with the `lenguaje.md` formula and fixes the copy register. It does not change what any action does.

## Scope

Item tags:
- **[visual]**: presentation only.
- **[comportamiento front]**: new client-side behaviour.
- **[backend]**: none.

### In Scope

**1. E1 · One banner component.** [visual] + [comportamiento front]
- **The page banner:** `#banner` stays (DEC-164) and becomes a server-rendered `zd-banner`. The script sets its tone with `data-tono` and stops assigning `className` (`banner` / `banner exito`). The `.banner` bridge rules are removed.
- **Where each message goes:**
  - the result of an action, next to the control that triggered it, reusing `mostrarResultado`;
  - the state of a screen, under its header;
  - the global state, in the tenant bar.
- **With a pop-up open:** every refusal of that pop-up's action renders inside the pop-up. This is the rule `avisarEnDialogo` already applies to some flows, applied to all. `llevarBannerA` is removed.

**2. E2 · Async buttons.** [comportamiento front]
- **Change:** one `ocupado(boton, gerundio)` / `libre(boton)` pair sets `disabled`, `aria-busy="true"` and the gerund text ("Probando…", "Validando…", "Guardando…", "Ejecutando…"), and restores the label after.
- **Layout:** the button keeps its width so the layout does not move.
- **Scope:** it replaces the ad hoc versions.

**3. E3 · Success.** [visual]
- **Change:** each action shows a success banner **or** the result itself, never both. A success banner may carry a next-step link; the links themselves come in CH-55.

**4. E4 · Errors as sentences.** [comportamiento front]
- **Change:** one `mensajeDeError(respuesta, accion, objeto)` helper applies the `lenguaje.md` formula: what could not be done, then what to do, then the code in mono at the end.
- **Cases:**
  - network: "No pudimos conectar con el servidor de la consola. Revisá tu conexión y probá de nuevo.";
  - 400 and 422: the server's validation message;
  - 403: "Tu sesión no tiene permiso para esto. Volvé a ingresar.";
  - 404: "No encontramos {objeto}. Puede que lo hayan dado de baja.";
  - 409: the server's specific message, or "{Objeto} cambió o está en uso.";
  - 5xx: "La consola tuvo un error interno al {acción}. Probá de nuevo; si se repite, revisá el log del servidor." + `HTTP 500`.
- **401:** keeps returning to the login screen (unchanged requirement).
- **Paths:** API paths never appear.
- **Unchanged:** messages the console already writes for a specific code (`vista-canonica-no-aprobada`, `plantilla-en-uso`, `sin-cambios`, the read-only refusal of DEC-204, the execution categories) keep their text.

**5. M4 · Voseo everywhere.** [visual]
- **Change:** the "usted" strings move to voseo (L1503, L1932, L2297, L2426, L3519, L3525 and any others the apply grep finds).

**6. M5 · Copy names the controls.** [visual]
- **Change:** "Probá la consulta para poder guardarla." becomes "Ejecutá la consulta para poder guardarla." (L4474), because the button is «Ejecutar consulta» (L1160).
- **Spec fix:** the spec text that still calls that button «Probar» is corrected in CH-53, which rewrites those requirements.

**7. T7 · Each date says its zone.** [visual]
- **Lists and Auditoría:** they use the browser's zone and say so: "Hora de tu navegador" in the date column header or status line.
- **Automations and runs:** they use the deployment's zone and say "Hora del servidor".
- **Unchanged:** no conversion.

### Out of Scope
- Unifying the timezone: an open product question, not decided here.
- Confirmation pop-ups: CH-51. Blocked-by-prerequisite states (E6): CH-54 and CH-55.
- Server-side message texts and any API change.
- Renaming `.ayuda` to `.zd-help` in bulk: only lines already edited change.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `query-console`: one banner component with placement by scope, feedback inside an open pop-up, async buttons, errors as sentences, voseo and dated columns that state their zone.

`shared-visual-system` specifies the served stylesheet and needs no delta.

## Approach
- Introduce the helpers once, then replace call sites screen by screen: list loads, saves, tests and deletes.
- `#banner` keeps its id and `role="alert"`; its classes come from the server.
- Tests: the cases asserting `#banner` text or class are updated, and new cases cover feedback inside a pop-up, the busy state and each HTTP class.

## Rules Check
- **Rules 1 to 7:** untouched. The technical detail shows only the HTTP code and the message the server already returns, never credentials or client rows.
- **Anti-scope:** no new capability.

## Rollback
Front-end only; each PR reverts on its own.

## Affected Areas
- `src/consola/consola.ts`:
  - bridge style (`.banner`, L174);
  - `mostrarBanner`, `mostrarConfirmacion` and `ocultarBanner` (L1732–1752);
  - `mostrarResultado` (L1756);
  - `avisarEnDialogo` and `llevarBannerA` (L1820–1840);
  - `pedir` and the per-screen loaders' error paths (e.g. L5805);
  - the copy lines listed in items 5 and 6;
  - date formatting (L2851, L4950).
- `src/consola/consola.test.ts`.
- `openspec/specs/query-console`.

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Many tests assert exact banner strings or the `banner exito` class | High | Update in the same PR; keep specific server-derived messages identical |
| Size: many call sites | High | Two chained PRs (tasks): **52a** banner, placement and E2; **52b** `mensajeDeError`, voseo, M5 and T7 |
| A message targets a hidden node | Low | The helper falls back to the screen banner when the target is hidden |

## Success Criteria
- [ ] No `.banner` style or `className` assignment on `#banner` remains; every message is a `zd-banner` with `data-tono`.
- [ ] With a pop-up open, an error from its action appears inside it.
- [ ] No visible message contains an API path; every HTTP failure reads as a sentence with the code last, in mono.
- [ ] A grep for the listed "usted" forms finds nothing.
- [ ] The save hint of Consultas names «Ejecutar consulta».
- [ ] Every date column or status line states its zone.
- [ ] `npm test` and the typecheck pass.
