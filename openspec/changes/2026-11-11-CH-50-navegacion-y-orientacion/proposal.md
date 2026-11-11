# Proposal: CH-50 — Console navigation and orientation

**Status**: approved by the user on 2026-11-11, with one addition: make clearer which sections are global and which need a tenant, including a better presentation of the active tenant. That addition is item 9. Inputs: `exploration.md`, the console UX audit (EXPLORE 2026-11-11), `guidelines/admin.md` N1–N9, P2, P3, M6, and DEC-164 (one document, `#` navigation, ids move and are never renamed) and DEC-166 (the redesign ships in slices). No story. No research phase: everything is internal. **Priority: high.** It is the first slice of the console UX series (CH-50 to CH-56).

## Intent
A first-time operator cannot tell from the sidebar which screens depend on the active tenant. The menu order also contradicts the real setup order. This change gives every navigation block a title, orders "Puesta en marcha" by real dependency, says the truth about the scope of Plantillas and Reportes, and makes changing the tenant a single, confirmed path. It changes no screen's content.

## Scope

Item tags:
- **[visual]**: presentation only.
- **[navegación]**: order, titles and routes.
- **[comportamiento front]**: new client-side behaviour.
- **[backend]**: none.

### In Scope

**1. N1 · The tenant block gets a title.** [navegación]
- **Problem (verified):** "Puesta en marcha" and "Trabajo diario" are loose subheadings under an untitled `zd-sidenav__scope` (L379–392).
- **Change:**
  - With a tenant: the block's heading is the active tenant's name, with its short id in mono underneath (`zd-sidenav__tenant`). The script sets the text, the server sets the classes.
  - Without a tenant: the heading reads "Ningún tenant".
- **Unchanged:** the item ids (`nav-*`) and their `href`s.

**2. N2 · Order follows the real dependency.** [navegación]
- **Change:** "Puesta en marcha" becomes:
  1. Agentes, with a `zd-sidenav__meta` reading "opcional"
  2. Conexiones
  3. Mapeo y validación
  4. Usuarios del panel
  5. Tablero del cliente
- **Unchanged:** the `<a>` elements move; their ids stay.

**3. N3 · Secondary items go to the footer.** [navegación]
- **Change:** "Tiempos de alta" moves to a `zd-sidenav__foot` block with the heading "Investigación".
- **Unchanged:** `#tiempos` and the screen itself.

**4. N4 / M6 · The global catalog is honest about the tenant.** [visual] + [comportamiento front]
- **Sidebar:** Plantillas and Reportes keep the "Global" group and get the meta "se prueba con el tenant activo".
- **Screen headers:** next to the `zd-scope--global` tag, a line "Prueba sobre: {tenant}". Without a tenant it reads "Prueba sobre: ningún tenant (elegí uno para probar o guardar)".
- **Without a tenant:** the screen stays readable. Its test and save actions are `disabled`, with the reason shown next to them. Today the 409/400 only appears after the operator tries.
- **Unchanged:** the server-side rule (L6128, L6887).

**5. N7 · One path to change the tenant.** [comportamiento front]
- **Change:** "Elegir como activo" in the Tenants table opens the same `#tenant-cambio` dialog with that tenant preselected. Only «Operar sobre {nombre}» switches the tenant.
- **Unchanged:** `cambiarTenant()` and its side effects.

**6. N8 · Unsaved changes.** [comportamiento front]
- **Change:** when the Tablero del cliente has unsaved changes (the state that today enables "Guardar tablero"), the `#tenant-cambio` dialog adds a `zd-banner--warn` inside it: "Tenés cambios sin guardar en Tablero del cliente. Si cambiás de tenant, se descartan."
- **Scope limit:** Tablero is the only screen with this state today. Other screens are not covered here.

**7. N9 · Unknown section.** [navegación] + [comportamiento front]
- **Change:** an unknown hash shows an `EmptyState` (`zd-state`) reading "Esta sección no existe", with «Ir a Tenants» or «Ir a Consultas» depending on whether a tenant is active. It no longer silently opens Consultas.
- **Also:** `document.title` follows the visible screen from the first render.

**8. P2 / P3 · Purpose lines.** [visual]
- **Frescura:** drop the duplicated h2 (L1439) and add the missing `zd-pagehead__desc`.
- **Consultas:** replace its description with the one in admin.md §13: "Explorá la réplica del tenant activo con SQL de solo lectura. Usala para revisar un mapeo, una plantilla o un reporte antes de guardarlos. Plantillas y automatizaciones no usan estas consultas."
- **Other screens:** any screen whose header lacks a purpose line gets one, written with the `lenguaje.md` glossary.

**9. Global vs. tenant dependency and the active tenant (user addition, N1, M6, E5).** [visual]

**Tenant bar:**
- With a tenant: the label "Operando sobre", the tenant's name in strong text and its short id in mono (`zd-tenantbar__id`). A `building` icon goes before the name.
- Without a tenant: the existing `zd-tenantbar--none` state, with "Ningún tenant seleccionado" and the hint "Las secciones del tenant necesitan uno". The icon and text carry the state, never the color alone.

**Page-header scope tags:**
- Every tenant screen's tag (`alcance-*`, which already exists) reads "Del tenant · {nombre}" instead of "Del tenant activo". Without a tenant it reads "Necesita un tenant".
- Global screens keep "Global · todos los tenants". Plantillas and Reportes add the "Prueba sobre" line of item 4.

**Sidebar:**
- Each block's heading carries a scope icon: `globe` for Global, `building` for the tenant block.
- Without a tenant, the tenant block shows the meta line "Elegí un tenant para usar estas secciones". Its items stay visible and clickable (N5) and lead to the existing "Elegí un tenant" empty state.

Sketch (from admin.md §2):
```
GLOBAL
  Tenants
  Plantillas   se prueba con el tenant activo
  Reportes     se prueba con el tenant activo
  Contrato canónico
────────────────────
ALMACÉN DON TITO  ten_7f3a…
 PUESTA EN MARCHA
  Agentes (opcional) · Conexiones · Mapeo y validación · Usuarios del panel · Tablero del cliente
 TRABAJO DIARIO
  Consultas · Automatizaciones · Frescura de datos · Auditoría
────────────────────
INVESTIGACIÓN
  Tiempos de alta
```

### Out of Scope
- Setup-progress marks on items (N6) and the setup guide strip: CH-55.
- Unifying banners and errors: CH-52. Confirmation dialogs other than the tenant change: CH-51.
- Breadcrumbs for subviews (N9, second half): they arrive with the first subview, in CH-53.
- Any API change, any new screen, and the client panel (P2).
- Two tabs with different tenants: this stays a hypothesis. Changing `localStorage` semantics would be a behaviour decision.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `query-console`. Every console screen is specified there, so this change only touches that spec. The spec phase found that `shared-visual-system`, `tenant-management`, `automation-templates` and `report-catalog` specify the stylesheet, the API and the catalog, not the console screens, so they need no delta. What changes:
  - navigation order, block titles, the "Investigación" footer and the unknown hash;
  - the active-tenant indicator and the scope tags;
  - the tenant switch goes through the confirmation dialog and warns about unsaved Tablero changes;
  - Plantillas and Reportes state their test tenant and disable test and save without one.

## Approach
- **Markup:** reorder and retitle the sidebar in the server string. Every id moves and none is renamed (DEC-164).
- **Script:** sets text and attributes only (`hidden`, `disabled`, `aria-current`, `data-*`), never `zd-*` classes (G3').
- **Tenant change:** the table button reuses the existing dialog-opening function with a preselected id.
- **Unsaved changes:** the warning reads the dirty state that already enables «Guardar tablero».
- **Unknown section:** `mostrarPantalla()` falls back to a new `#pantalla-desconocida` section instead of `consultas`.
- **Tests:** behavioural cases in `src/consola/consola.test.ts` cover the order, the titled block, the unknown hash, the dialog path from the table and the unsaved-changes banner. `IDS` and the `hidden`-at-start list are updated.

## Rules Check
- **Rule 1.** No change to what P2 can do.
- **Rule 2.** The tenant still travels only as `X-Tenant-Id` from the operator's own selection. Confirming every switch reduces the chance of operating on the wrong tenant.
- **Rules 3 to 7.** Untouched: no SQL, data or secrets are involved.
- **Anti-scope.** No new capability: navigation and copy only.

## Rollback
One PR, front-end only. Reverting it restores the previous sidebar and behaviour. No data or API is involved.

## Affected Areas
- `src/consola/consola.ts`:
  - sidebar markup (L370–392);
  - tenant dialog (L344);
  - Tenants table action (L4975);
  - `cambiarTenant` (L4703);
  - `mostrarPantalla` and the initial screen (L8119–8169);
  - headers of Frescura (L1423–1440), Consultas (L1041–1046), Plantillas (L691) and Reportes (L832);
  - bridge style (L110–320), only if a `data-*` selector is needed.
- `src/consola/consola.test.ts`: `IDS`, the start-hidden list and new behavioural cases.
- `openspec/specs/shared-visual-system`, `tenant-management`, `automation-templates`, `report-catalog`.

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Tests that assert the sidebar order or the old direct switch from the table fail | High | Update them in the same PR. They describe the old contract, which this change replaces on purpose |
| The tenant title in the sidebar needs a class set by JS | Low | The server renders the element; JS sets only `textContent` and `hidden` |
| Disabling the Plantillas/Reportes actions without a tenant hides the read-only use | Low | Only test and save are disabled; listing and the side panel stay usable |
| Size | Medium | Forecast ~300–350 changed lines including tests: within the 400-line budget |

## Success Criteria
- [ ] With a tenant, the sidebar shows "Global", then a block titled with the tenant's name, then "Investigación" at the foot. "Agentes (opcional)" comes before "Conexiones".
- [ ] Without a tenant, the tenant block reads "Ningún tenant" and each tenant screen keeps today's "Elegí un tenant" empty state.
- [ ] "Elegir como activo" in the Tenants table opens the confirmation dialog with that tenant preselected. Nothing changes until «Operar sobre {nombre}».
- [ ] With unsaved Tablero changes, the tenant dialog shows the discard warning. Without them, it does not.
- [ ] `#loquesea` shows "Esta sección no existe" with a way back, not Consultas.
- [ ] Frescura shows its title once and a purpose line. Plantillas and Reportes show "Prueba sobre: {tenant}" and, without a tenant, disabled actions with their reason.
- [ ] All existing ids are still present exactly once. `npm test` and `npx tsc -p tsconfig.json --noEmit` pass.
