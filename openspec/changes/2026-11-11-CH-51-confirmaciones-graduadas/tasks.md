# Tasks: CH-51 — Graded confirmations and destructive actions

Inputs: proposal.md, specs/query-console/spec.md, design.md.

Delivery: **single-pr**. Branch `ch51/confirmaciones` from `master`, after CH-50 merges. It is independent of CH-50 in code, but both touch `consola.test.ts`; sequential branches avoid conflicts. No new DEC.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~390: ~190 production (helper ~40, pop-up markup ~25, `confirmar` ~45, call sites ~60, bridge ~20) + ~200 tests (focus model ~40, cases ~160) |
| 400-line budget risk | Medium |
| Chained PRs recommended | No, unless the apply count passes 400 |
| Suggested split | If over budget at apply: **51a** = units 1–3 (helper, pop-up, automation C2, T4); **51b** = unit 4 (agent, user and version call sites) |
| Delivery strategy | single-pr |
| Chain strategy | — |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: —
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Focused test command | Runtime harness | Rollback boundary |
|------|------|----------------------|-----------------|-------------------|
| 1 | Focus trap and return in `crearDialogo` | `npx tsx --test src/consola/consola.test.ts` | `npm test` | Revert the helper change |
| 2 | Confirmation pop-up + `confirmar()` | same | `npm test` | Revert pop-up and helper |
| 3 | Automation deactivate C2 + T4 style | same | `npm test` | Revert call site and bridge rule |
| 4 | Agent, user and version call sites | same | `npm test`; typecheck | Revert call sites |

## 1. Pop-up focus
- [ ] 1.1 Test harness: `document.activeElement`, a `focus()` that sets it, and Tab/Shift+Tab `keydown` events carrying `shiftKey`.
- [ ] 1.2 `crearDialogo`:
  - `abrir(abridor)` stores the opener;
  - `cerrar()` returns the focus to it;
  - Tab and Shift+Tab wrap inside `opciones.fondo`.
- [ ] 1.3 Pass the opener from every `.abrir()` call site that has one (the buttons of «Nuevo …», row actions).
- [ ] 1.4 Tests: focus returns to «Nuevo usuario» after «Cancelar»; Tab on the last control goes to the first.

## 2. Confirmation pop-up
- [ ] 2.1 Markup `#confirmacion-dialogo` (design §2); add its ids to `IDS` and the start-hidden list.
- [ ] 2.2 `confirmar({ nivel, titulo, consecuencia, lista, verbo, extra })` → `Promise<boolean>`, all text by `textContent`. Resolve `false` on a tenant switch (`cerrarDialogos`).
- [ ] 2.3 Tests:
  - C1: the primary button is visible and focused;
  - C2: the danger button is visible, "No se puede deshacer." is present and «Cancelar» is focused;
  - Escape resolves `false`.

## 3. Automation deactivate and T4
- [ ] 3.1 `desactivar(id)` awaits `confirmar({nivel:'c2', titulo:'¿Desactivar {plantilla} · {conexión}?', …, verbo:'Desactivar automatización'})`.
- [ ] 3.2 Row actions (L3416): «Desactivar» last, with `data-tono="error"`.
- [ ] 3.3 Bridge rule `button[data-tono="error"]:not(.zd-btn)` using the error tokens from `public/ui/tokens/colors.css`.
- [ ] 3.4 Tenant baja action button (L458): `zd-btn--danger` (server markup).
- [ ] 3.5 Tests: the first click sends nothing; confirm sends one POST; cancel sends none; the row's last button carries `data-tono="error"`. Update the existing deactivate case.

## 4. Remaining call sites
- [ ] 4.1 Agent «Revocar»: C2 «Revocar token»; remove the inline confirmation nodes; `data-tono="error"`.
- [ ] 4.2 User «Desactivar» (C1 «Desactivar usuario», `data-tono="error"`) and «Reponer clave» (C1 «Reponer clave»); remove the inline nodes.
- [ ] 4.3 Version «Restaurar»: C1 «Restaurar versión {n}» with the note input moved into `confirmacion-extra` while open; remove the in-panel confirmation.
- [ ] 4.4 Tests: rewrite the inline-confirmation cases of agents, users and versions for the pop-up; drop removed ids from `IDS`.

## 5. Verify
- [ ] 5.1 `npm test`, `npx tsc -p tsconfig.json --noEmit` and `scripts/smoke.sh` pass.
- [ ] 5.2 A grep finds no remaining inline confirmation in `consola.ts`, and every destructive row action carries `data-tono="error"`.
