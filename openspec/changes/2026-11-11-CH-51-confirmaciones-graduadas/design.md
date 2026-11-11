# Design: CH-51 — Graded confirmations and destructive actions

Inputs: `proposal.md`, `specs/query-console/spec.md`, `src/consola/consola.ts` (`crearDialogo` L1782, `desactivar` L3536), `guidelines/admin.md` §8, T4, §12. Decisions in force: DEC-79, DEC-172, DEC-173, DEC-175. No new architecture decision: the confirmation pop-up is one more pop-up under DEC-173.

## Technical Approach

### 1. `crearDialogo` gains focus handling
- `abrir(abridor)` remembers `abridor` (default `document.activeElement`).
- `cerrar()` calls `abridor.focus()` when the node is still connected.
- A `keydown` listener on `opciones.fondo` handles Tab and Shift+Tab. It reads the pop-up's focusable controls (`button, input, select, textarea, a[href]` not `disabled` and not inside a `hidden` ancestor). On the last control it wraps to the first, and on the first it wraps to the last. The fake DOM's `querySelectorAll` support decides how this list is gathered; if the harness cannot do it, each `crearDialogo` call passes `controles: () => [...]` explicitly.
- Every existing caller keeps working: `abridor` is optional.

### 2. The confirmation pop-up
Server markup:
```html
<div id="confirmacion-dialogo" class="zd-dialog-backdrop" hidden>
  <div class="zd-dialog" role="dialog" aria-modal="true" aria-labelledby="confirmacion-titulo" aria-describedby="confirmacion-consecuencia">
    <h2 id="confirmacion-titulo" class="zd-dialog__title"></h2>
    <div class="zd-dialog__body">
      <p id="confirmacion-consecuencia"></p>
      <ul id="confirmacion-lista" hidden></ul>
      <!-- slot for the restore note -->
      <div id="confirmacion-extra" hidden></div>
    </div>
    <div class="zd-dialog__actions">
      <button id="confirmacion-cancelar" class="zd-btn zd-btn--secondary" type="button">Cancelar</button>
      <button id="confirmacion-primaria" class="zd-btn zd-btn--primary" type="button" hidden></button>
      <button id="confirmacion-peligro" class="zd-btn zd-btn--danger" type="button" hidden></button>
    </div>
  </div>
</div>
```

Script:
```
confirmar({ nivel: 'c1'|'c2', titulo, consecuencia, lista?: string[], verbo, extra?: Node }) → Promise<boolean>
```
- Sets the title, consequence and list with `textContent` (every value is text).
- Shows `confirmacion-primaria` (C1) or `confirmacion-peligro` (C2). For C2 it prepends "No se puede deshacer." to the consequence.
- Opens through `crearDialogo` with `primerCampo` = the action button (C1) or «Cancelar» (C2).
- Resolves `true` on the action and `false` on «Cancelar», Escape or a tenant switch.
- `hayCambios` returns `false`.
- **Restore note:** the restore confirmation moves the existing note input into `confirmacion-extra` while it is open and puts it back on close. The note input keeps its id.

### 3. Call sites
| Action | Today | After |
|---|---|---|
| Automation «Desactivar» (L3416 → `desactivar`, L3536) | Posts at once | `if (await confirmar({nivel:'c2', …})) { …post… }` |
| Agent «Revocar» | Inline nodes in the cell | `confirmar({nivel:'c2', verbo:'Revocar token'})` |
| User «Desactivar», «Reponer clave» | Inline nodes in the cell | `confirmar({nivel:'c1', …})` |
| Version «Restaurar» | Confirmation inside the versions panel | `confirmar({nivel:'c1', extra: notaRestaurar})` |
| Tenant baja (`#tenant-baja`) | Own pop-up | Unchanged flow. Its action button becomes `zd-btn--danger` server-side, and `primerCampo` stays the name field (typing is the task). The C3 rule says focus on «Cancelar», but the typed name *is* the safety step, so the field keeps the focus. This is noted as a deviation from admin.md C3 |

### 4. T4 style
In script-built rows, destructive buttons get `setAttribute('data-tono', 'error')` and are appended last. Bridge rule:
```css
button[data-tono="error"]:not(.zd-btn) { color: var(--error-text); border-color: var(--error-border, currentColor); }
button[data-tono="error"]:not(.zd-btn)::before { /* inline SVG mask: alert icon */ }
```
The token names are taken from `public/ui/tokens/colors.css` during apply. If `--error-border` does not exist, `currentColor` is used. No `zd-*` class is set from JS (G3').

## Architecture Decisions

### Decision: Extend `crearDialogo`, do not add a second helper
**Choice:** add focus trap and return to the existing helper.
**Alternatives considered:** a separate confirmation helper with its own focus code.
**Rationale:** one place for the pop-up rules; every DEC-173 pop-up gets the fix.

### Decision: The tenant baja keeps the focus on the name field
**Choice:** keep it on the field, as today.
**Alternatives considered:** focus on «Cancelar», as admin.md C3 says.
**Rationale:** in C3 the typed name is the safeguard, and the action button stays disabled until it matches.

## Data Flow
```
click «Desactivar» ──► confirmar(c2) ──► pop-up (focus: Cancelar)
                         ├─ Cancelar / Escape / tenant switch ─► false ─► nothing sent, focus back to «Desactivar»
                         └─ «Desactivar automatización» ─► true ─► POST …/desactivar ─► refresh list
```

## File Changes
| File | Action | Description |
|------|--------|-------------|
| `src/consola/consola.ts` | Modify | `crearDialogo` (L1782–1810); new `#confirmacion-dialogo` markup; `confirmar()`; call sites in automations (L3416, L3536), agents (L5497+), users (L5592+) and versions; bridge rules (near L166/L303); tenant baja button class (L458) |
| `src/consola/consola.test.ts` | Modify | Fake DOM: `document.activeElement`, `focus()`, and Tab keydown. `IDS` and the start-hidden list gain the pop-up ids. Inline-confirmation cases are rewritten. New cases below |

## Interfaces / Contracts
No API change. New guarded ids: `confirmacion-dialogo`, `confirmacion-titulo`, `confirmacion-consecuencia`, `confirmacion-lista`, `confirmacion-extra`, `confirmacion-cancelar`, `confirmacion-primaria`, `confirmacion-peligro`. The ids of the removed inline-confirmation nodes leave `IDS` in the same PR.

## Testing Strategy
| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (fake DOM) | Deactivate: no POST on the first click; POST once on confirm; none on cancel or Escape. Revoke, reset key, deactivate user and restore through the pop-up with the right level, button text and focus. Focus returns to the opener. Tab wraps. Destructive buttons last with `data-tono="error"` | Existing harness, extended with a focus model |
| Structural | Ids exactly once; no inline-confirmation node left | Existing guards |

## Migration / Rollout
None.

## Open Questions
- None.
