# Exploration: CH-51 — Graded confirmations and destructive actions

Source: the console UX audit (EXPLORE, 2026-11-11) and `guidelines/admin.md` §8 (C0–C3), T4, §12. `Lnnn` = line in `src/consola/consola.ts`.

## Current state (verified)

**How each destructive action confirms today:**

| Action | Today | Reversible? |
|---|---|---|
| Dar de baja (tenant) | `#tenant-baja` dialog where the operator types the name (L447, DEC-175) | No |
| Desactivar (automation) | **No confirmation**: `desactivar(id)` posts at once (L3416 → L3536) | No: there is no reactivation (DEC-79) |
| Revocar (agent token) | Inline confirmation in the cell | No |
| Desactivar (panel user) | Inline confirmation in the cell | Yes: «Reactivar» |
| Reponer clave (panel user) | Inline confirmation in the cell | The old key stops working |
| Restaurar (query version) | Inline confirmation in the row | Yes: it creates a new version and deletes nothing (DEC-172) |
| Cambiar de tenant | `#tenant-cambio` dialog, «Operar sobre {nombre}» | Yes |

**Implementation details:**
- Destructive row buttons are built by the script, so they take `button:not(.zd-btn)` (L166). They look the same as harmless ones. The bridge has no danger selector.
- Dialogs are `div.zd-dialog-backdrop[hidden]` with `role="dialog" aria-modal="true"`. They have no focus trap, do not return focus on close and do not close on backdrop click (comment at L1777–1778). Esc closes the query pop-up (CH-32a).
- `zd-btn--danger` exists in `components.css`, but only server-rendered markup can use it (G3').

## Hypotheses
- Operators will expect Desactivar to be undoable, because "Desactivar" on a panel user is undoable. The C2 copy has to say it is not.

## Open questions (product, not decided here)
- Reactivating an automation (DEC-79 says no). Out of scope; the dialog only states it.
