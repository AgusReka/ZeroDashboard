# Design: CH-56 — Template and report editor as a sectioned page

Inputs:
- `proposal.md` and `specs/query-console/spec.md`;
- `src/consola/consola.ts`: Plantillas markup L691–830 and script L5784–6450; Reportes markup L832–970 and script L6451–7170;
- the CH-53 design (`leerRuta`, the leave guard, the status line).

Decisions in force: DEC-164, DEC-173, DEC-191, DEC-198 and **DEC-208**. No new architecture decision.

## Technical Approach

### 1. Sub-routes
`mostrarPantalla` (CH-53's `leerRuta`) gains handlers for `plantillas` and `reportes`:

| `sub` | Plantillas | Reportes |
|---|---|---|
| `null` | list | list |
| `nueva` / `nuevo` | empty editor | empty editor |
| `{id}` | `GET /plantillas/:id`, then the editor in edit mode. If `enUso: true`, the editor is not opened for edit: the side panel's rule stays («Duplicar y editar» only), so the address redirects to the list with the side panel open on that template | `GET /reportes/:id`, same rule |
| `{id}/duplicar` | `GET /plantillas/:id`, then the editor in duplicate mode (today's «Duplicar y editar» fill) | same |
| unknown id | «No encontramos esa plantilla.» | «No encontramos ese reporte.» |

- The buttons «Nueva plantilla», «Editar» and «Duplicar y editar», in the header and the side panel, set `location.hash` instead of calling the pop-up's `abrir`.
- The 409 path's «Duplicar y editar» keeps today's in-place conversion (spec): it switches the mode and uses `history.replaceState` to `#…/{id}/duplicar`, without reloading.

### 2. Shared skeleton (K3)
Server markup per editor:
```
div#{plantilla|reporte}-editor hidden
  header.zd-pagehead  (crumbs, «Prueba sobre» line from CH-50)
  div#{…}-copia-aviso.zd-banner.zd-banner--neutral hidden
  ol.editor-secciones
    li section 1 «Qué es»     (h2 + p purpose + fields)
    li section 2 «Datos»
    li section 3 «Salida»
    li section 4 «Prueba»     (existing test block nodes)
  footer.editor-pie           (Cancelar · #{…}-motivo · Guardar …)   ← sticky
```
- **Classes:** `editor-secciones` and `editor-pie` are bridge selectors written once and used by both editors. They are not `zd-*`, and the server sets them, so G3' holds.
- **Sticky footer:** `position: sticky; bottom: 0;` with the surface background and a top border token. The editor gets `padding-bottom` equal to the footer height.
- **Moved nodes:** every field node of `#plantilla-dialogo` / `#reporte-dialogo` moves into its section with its id.
- **Removed:** the wrappers (backdrop, dialog, title) and their `dialogos` entries. Their own Cancel and Escape logic is replaced by the CH-53 leave guard.

### 3. Footer reason line (F4)
- **Existing logic:** the reason sentence (no test yet, last test failed, or changed since the last test) is already computed today. It is written into `#{…}-motivo`.
- **Passing test:** when the test passes and the fingerprint matches, the line becomes «Última prueba: OK · {hh:mm} · {n} filas». The time and the row count come from the stored last-test result, which already holds the rows.

### 4. Copy banner (F5)
- **When:** in duplicate mode, if the original had `enUso: true`.
- **What it shows:** `#{…}-copia-aviso` with the original's name and the restriction sentence.
- **Templates:** the existing "copy will not appear in the client panel…" line moves into this banner.
- **Reports:** the banner says the original is on a client dashboard.

### 5. Leaving and tenant switch
- Reuse CH-53's guard. The predicate is the editor's existing `hayCambios` function, which today is passed to `crearDialogo`.
- `tc-sin-guardar` lists Plantillas and Reportes when they have changes.
- `cambiarTenant` sends a visible editor back to its list, replacing today's pop-up close. `limpiarPruebaPlantilla` and `limpiarPruebaReporte` stay.

## Architecture Decisions

### Decision: An in-use template's `{id}` address goes to the list with the side panel
**Choice:** redirect to the list, with the side panel open on that template.
**Alternatives considered:** opening the editor read-only.
**Rationale:** today there is no edit path for an in-use template, only «Duplicar y editar» (DEC-191). A read-only editor would be a new view, and the side panel already is the read-only view.

### Decision: Two slices on one skeleton
**Choice:** 56a builds the shared skeleton, bridge rules and sub-route handlers with Plantillas. 56b moves Reportes onto it.
**Rationale:** the user asked for Plantillas first, and K3 consistency comes from reuse rather than parallel work.

## Data Flow
```
«Editar» ─► #plantillas/{id} ─► GET /plantillas/:id ─ enUso? ─ yes ─► #plantillas + side panel
                                                       └ no ─► editor (edit mode)
«Probar» ─► POST /plantillas/prueba (unchanged) ─► section 4 result + footer line
«Guardar plantilla» ─► POST|PUT /plantillas (unchanged) ─► #plantillas + side panel on saved
```

## File Changes
| File | Action | Description |
|------|--------|-------------|
| `src/consola/consola.ts` (56a) | Modify | Plantillas editor markup with sections and footer; pop-up wrapper removed; sub-route handlers; button wiring; footer line; copy banner; leave guard and tenant switch; shared bridge rules `editor-secciones` and `editor-pie` |
| `src/consola/consola.ts` (56b) | Modify | Reportes editor on the same skeleton; sub-route handlers; footer line; copy banner; leave guard |
| `src/consola/consola.test.ts` | Modify | The template cases (56a) and report cases (56b) open by hash; new cases below; `IDS` and the start-hidden list updated |

## Interfaces / Contracts
No API change.
- New guarded ids: `plantilla-editor`, `plantilla-copia-aviso`, `plantilla-motivo`, `plantilla-no-encontrada`, and the `reporte-*` equivalents.
- Removed: the dialog wrapper ids `plantilla-dialogo` and `reporte-dialogo`, and their titles.

## Testing Strategy
| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (fake DOM) | Each address and its mode. An in-use `{id}` goes to the list with the panel. Not found. The four sections in order, with the same titles in both editors. Footer reason and «Última prueba» line. Copy banner only from an in-use original. Leave guard. Tenant switch returns to the list. The 409 → duplicate conversion keeps «Guardar» enabled | Existing harness, plus CH-53's hash helpers |
| Existing | Fingerprint, gate, 400 and 409 answers, message texts, columns by role, period | Keep assertions; change only the open steps |

## Migration / Rollout
None. Each slice is reverted on its own.

## Open Questions
- K4 (whether duplicating a template should keep its client texts) stays a product question.
