# Proposal: CH-51 — Graded confirmations and destructive actions

**Status**: approved by the user on 2026-11-11.

**Inputs:**
- `exploration.md` and EXPLORE 2026-11-11;
- `guidelines/admin.md` §8 (C0–C3), T4 and §12;
- decisions DEC-79 (no reactivation), DEC-172 (restore creates a version), DEC-173 (pop-ups) and DEC-175 (tenant baja types the name).

**Priority: high.** It depends on nothing. CH-52 to CH-56 reuse its confirmation helper.

**Correction after the spec phase.** The console already has a pop-up helper, `crearDialogo` (L1782). It handles Escape, focus on the first field and «Descartar cambios». What it lacks is keeping the focus inside and returning it on close (its own comment, L1777). This change extends that helper instead of adding a second one.

## Intent
Today each destructive action confirms in a different way, and the one with the least way back has no confirmation at all: deactivating an automation is one click and cannot be undone (L3536). This change adopts one confirmation pattern with four levels of gravity, built on the existing pop-up helper. Destructive row actions start to look destructive, and every pop-up keeps and returns the focus.

## Scope

Item tags:
- **[visual]**: presentation only.
- **[comportamiento front]**: new client-side behaviour.
- **[backend]**: none.

### In Scope

**1. One confirmation pop-up, `#confirmacion-dialogo`.** [comportamiento front]
- **Markup:**
  - server-rendered, built on `crearDialogo`;
  - title, consequence line, an optional short list, «Cancelar» and two action buttons (`zd-btn--primary` for C1, `zd-btn--danger` for C2);
  - the script shows one of the two buttons with `hidden` (G3').
- **API:** `confirmar({ nivel, titulo, consecuencia, lista, verbo })` returns a promise of `true`/`false`.
- **Focus:** on «Cancelar» for C2, on the action for C1.

**2. Levels applied (C):**

| Level | Action | Behaviour |
|---|---|---|
| C2 | Desactivar automatización | **New.** Title "¿Desactivar {plantilla} · {conexión}?", then "No se puede deshacer: una automatización desactivada no se reactiva." and "Sus ejecuciones pasadas siguen disponibles." Button «Desactivar automatización», danger |
| C2 | Revocar (agent) | Replaces the inline confirmation. "El agente y sus conexiones dejan de funcionar hasta que emitas un token nuevo." |
| C1 | Desactivar (panel user) | Replaces the inline confirmation. "No va a poder entrar al panel hasta que lo reactives." |
| C1 | Reponer clave | Replaces the inline confirmation. "La clave actual deja de funcionar y se cierran sus sesiones abiertas." |
| C1 | Restaurar versión | Replaces the confirmation inside the versions panel. "Se crea la versión {n+1} con el contenido de la versión {n}. No se borra nada." |
| C3 | Dar de baja (tenant) | **Kept** (DEC-175). Only the button style is aligned to danger and the focus starts on «Cancelar». |
| C0 | Probar, Ejecutar, Duplicar, Vista previa | Unchanged: no confirmation. |

**3. T4 · Destructive row actions look destructive.** [visual]
- **Change:** script-built destructive buttons (Desactivar, Revocar, Dar de baja) get `data-tono="error"` and always go last in their cell.
- **Style:** a new bridge selector `button[data-tono="error"]:not(.zd-btn)` gives them `--error-text` and an icon. This is an attribute, so G3' holds.

**4. Focus in every pop-up.** [comportamiento front]
- **Change:** `crearDialogo` gains:
  - focus trap: Tab and Shift+Tab cycle inside the pop-up;
  - focus return: on close, the focus goes back to the control that opened it (`abrir(abridor)`).
- **Scope:** this applies to every pop-up built on the helper.
- **Unchanged:** Escape already closes, and a backdrop click still does not close (DEC-173).

### Out of Scope
- Reactivating automations (DEC-79) and any API change.
- Moving the tenant baja to the generic pop-up: it keeps its own C3 pop-up (DEC-175).
- Banner system and error copy: CH-52.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `query-console`:
  - deactivating an automation, revoking a token, deactivating a user, resetting a key and restoring a version confirm in one graded pop-up;
  - destructive row actions in the error tone;
  - every pop-up keeps and returns the focus.

`automation-scheduling`, `agent-registration`, `panel-user-management` and `saved-queries` specify the API and need no delta.

## Approach
- Extend `crearDialogo` with the focus trap and `abridor`, then add `confirmar()` on top of one new server-rendered pop-up.
- Replace each inline confirmation's code path with `await confirmar(...)`. Inline confirmation nodes are removed together with the tests that reference them; every kept id keeps its name (DEC-164).
- The fake DOM in `consola.test.ts` gains a minimal `document.activeElement` and a `focus()` that sets it.

## Rules Check
- **Rules 1 to 7:** no SQL, data, tenant or secret flow changes.
- **Anti-scope:** no new capability; front-end confirmation only.

## Rollback
Front-end only. Reverting the PR restores the inline confirmations and the one-click deactivation.

## Affected Areas
- `src/consola/consola.ts`:
  - `crearDialogo` (L1782);
  - new pop-up markup;
  - bridge style (near L166, L303);
  - `desactivar` (L3536) and the automation row actions (L3416);
  - agent (L5497+), user (L5592+) and version restore rows;
  - tenant baja button style (L447).
- `src/consola/consola.test.ts`.
- `openspec/specs/query-console`.

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Tests that click inline confirmation nodes fail | High | Rewrite them for the pop-up in the same PR |
| The fake DOM has no focus model | High | Minimal `activeElement` stub, recorded as a harness limit |
| Size | Medium | Forecast ~390 lines with the helper reuse. If tasks find it above 400, split as 51a (pop-up + C2 automation + T4) and 51b (remaining call sites + focus) |

## Success Criteria
- [ ] «Desactivar» on an automation opens a pop-up that says it cannot be undone. «Cancelar» or Escape sends nothing; «Desactivar automatización» posts once and refreshes the list.
- [ ] Revocar, Desactivar usuario, Reponer clave and Restaurar versión confirm through the same pop-up with their level's copy. No inline confirmation remains.
- [ ] Destructive row buttons render last and in the error tone.
- [ ] In every pop-up, Tab stays inside, and closing returns the focus to the opener.
- [ ] Tenant baja still requires typing the name.
- [ ] `npm test` and the typecheck pass.
