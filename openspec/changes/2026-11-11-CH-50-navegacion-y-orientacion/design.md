# Design: CH-50 — Console navigation and orientation

Inputs: `proposal.md`, `specs/query-console/spec.md`, `src/consola/consola.ts`, `guidelines/admin.md` §2, §3, §12. Decisions in force: DEC-164 (one document, `#` navigation, ids move and are never renamed), DEC-173 (pop-ups), DEC-175 (tenant baja). No new architecture decision: this change reorders markup and adds client behaviour inside the existing shell.

## Technical Approach

**Markup** (server string in `consola.ts`):
- Reorder the sidebar into three titled blocks, moving the existing `<a id="nav-*">` elements.
- Add a server-rendered heading node for the tenant block (`id="nav-tenant-nombre"`, `zd-sidenav__tenant`) and a hint line (`id="nav-tenant-hint"`, `zd-sidenav__meta`, `hidden` when a tenant is active).
- Add a footer block (`zd-sidenav__foot`) with the heading "Investigación" holding `nav-tiempos`.
- Add `section#pantalla-desconocida` (`hidden`) with a `zd-state` "Esta sección no existe" and one link (`id="desconocida-volver"`).
- Frescura: remove the second `h2` and add a `zd-pagehead__desc`. Consultas: replace the purpose text.
- Plantillas and Reportes headers: add a line `id="prueba-sobre-plantillas"` / `id="prueba-sobre-reportes"` next to the global scope tag.

**Script:**
- `fijarTenant(id)` keeps its job and also sets:
  - the sidebar heading text, the short id and the hint's `hidden`;
  - the tenant bar label "Operando sobre" plus a short-id node;
  - the two "Prueba sobre" lines;
  - `disabled` and the reason line of the template and report test and save controls when there is no tenant.
- `aplicarSinTenant()` writes "Del tenant · {nombre}" or "Necesita un tenant" into each `alcance-*` (today: "Del tenant activo: {nombre}").
- `mostrarPantalla()`:
  - an unknown hash now shows `pantalla-desconocida` and clears `aria-current` on every link;
  - an empty hash keeps today's rule (Tenants without a tenant, Consultas with one);
  - `document.title` is set from a map of screen to title. The initial `<title>` of the served document becomes "Consola — ZeroDashboard", so a failed script no longer claims "Consultas".
- The Tenants table's «Elegir como activo» and «Crear y elegir» call `abrirCambioTenant(id)`. It opens `dialogoCambioTenant` with `selectorTenant.value = id` and refreshes `actualizarConfirmacionDeTenant()`. `alAbrir` today resets the select to the active tenant, so it takes an optional preselected id.
- Unsaved-changes warning: `alAbrir` of `dialogoCambioTenant` toggles a server-rendered `zd-banner zd-banner--warn` (`id="tc-sin-guardar"`) with `hidden = !tableroCambiado()`. `tableroCambiado()` already exists (L7840).

**Styles:** no new `zd-*` class is assigned from the script (G3'). The `building` / `globe` icons are inline SVG in the server markup. The bridge `<style>` gains no rule unless the hint line needs a muted colour not already given by `zd-sidenav__meta`.

## Architecture Decisions

### Decision: The no-tenant default screen stays Tenants; an unknown hash gets its own screen
**Choice:** a dedicated `pantalla-desconocida` instead of redirecting to the default screen.
**Alternatives considered:** replacing the hash with the default one (silent, which the audit flagged).
**Rationale:** N9; the operator sees that the address was wrong.

### Decision: «Crear y elegir» also goes through the confirmation pop-up
**Choice:** «Crear y elegir» creates the tenant, then opens «Cambiar tenant» with it preselected. The operator confirms with «Operar sobre {nombre}».
**Alternatives considered:** keep the direct switch for «Crear y elegir», since the operator just asked for it.
**Rationale:** N7, one path. The cost is one extra click on a rare action. If the user prefers the direct switch, it is a one-line change in apply and the spec scenario changes with it.

### Decision: Short id in the bar comes from the existing fragment
The bar already shows `nombre (id8…)` as one text. It is split into a name node and an id node (`zd-tenantbar__id`, mono), both server-rendered. The script sets `textContent` only.

## Data Flow

```
hashchange ──► mostrarPantalla(hash)
                 ├─ known screen   → show section, aria-current on its link, document.title
                 ├─ empty          → tenant ? consultas : tenants
                 └─ unknown        → pantalla-desconocida, no aria-current

«Elegir como activo» (row) ──► abrirCambioTenant(id) ──► dialog (preselected, warning if tableroCambiado())
                                                          └─ «Operar sobre …» ─► cambiarTenant(id)  (unchanged)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/consola/consola.ts` | Modify | Sidebar markup (L370–392), tenant bar (L329–337), tenant pop-up (L344–368, adds the warning banner), `pantalla-desconocida`, headers of Frescura, Consultas, Plantillas and Reportes, `fijarTenant`, `aplicarSinTenant`, `mostrarPantalla`, `accionesTenant` (L4973) and `crearTenant` (L5109) |
| `src/consola/consola.test.ts` | Modify | `IDS` gains the new ids, the start-hidden list gains `pantalla-desconocida`, `tc-sin-guardar` and `nav-tenant-hint`, and the cases below are added. The cases that expect a direct switch from the table or Consultas on an unknown hash are updated |
| `openspec/specs/query-console/spec.md` | Modify at archive | Delta merged |

## Interfaces / Contracts
No API change. New guarded ids: `nav-tenant-nombre`, `nav-tenant-id`, `nav-tenant-hint`, `pantalla-desconocida`, `desconocida-volver`, `tc-sin-guardar`, `tenant-activo-id`, `prueba-sobre-plantillas`, `prueba-sobre-reportes`.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (fake DOM, `consola.test.ts`) | Order of `nav-*` links inside each block. Tenant heading and hint with and without a tenant. Unknown hash. `document.title`. Table button opens the pop-up preselected and does not switch. Warning visible only with `tableroCambiado()`. Scope text "Del tenant · X". Template and report controls disabled without a tenant | Existing harness: serve the document with `inject()`, run the inline script and assert on the fake nodes |
| Structural | Every guarded id exactly once; one script element; no markup-assigning property | Existing guards |
| Smoke | Served document still passes `scripts/smoke.sh` | Run in verify |

## Migration / Rollout
None. Front end only.

## Open Questions
- None blocking. Whether «Crear y elegir» should skip the confirmation is noted above as the only user-visible choice in this design.
