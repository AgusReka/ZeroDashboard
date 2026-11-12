# Exploration: CH-50 — Console navigation and orientation

Source: the console UX audit (EXPLORE, 2026-11-11, reviewed by the user) and `.claude/skills/zerodashboard-design/guidelines/admin.md` §2, §3, §9. `Lnnn` = line in `src/consola/consola.ts`.

## Current state (verified)
- Single document with `#` navigation (DEC-164). `mostrarPantalla()` shows one `#pantalla-*` section at a time (L8119–8169).
- Sidebar `nav.zd-sidenav` (L370–392):
  - `zd-sidenav__group` with heading "Global": Tenants, Plantillas, Reportes, Contrato canónico.
  - `zd-sidenav__scope` **without a heading**, with two subheadings:
    - "Puesta en marcha": Conexiones, Agentes, Mapeo y validación, Usuarios del panel, Tablero del cliente, Tiempos de alta.
    - "Trabajo diario": Consultas, Automatizaciones, Frescura de datos, Auditoría.
- Agentes is listed after Conexiones, but the "Por el agente del tenant" option in the connection dialog only appears when an agent exists (L5295).
- Tiempos de alta is a research metric for P4 (the thesis), not a setup step.
- Plantillas and Reportes sit under "Global", but saving needs an active tenant, a connection with a validated mapping and a successful test (L6128, L6887).
- Two paths change the tenant:
  - the bar dialog `#tenant-cambio` (L344) confirms with «Operar sobre {nombre}»;
  - the Tenants table button "Elegir como activo" switches directly (L4975).
- Changing the tenant discards unsaved Tablero edits without warning (`cambiarTenant`, L4703).
- An unknown hash silently opens Consultas (L8145). The initial HTML leaves Consultas visible (L1041), and `document.title` starts as "Consultas — ZeroDashboard" (L99).
- Frescura repeats its title in an h1 (L1427) and an h2 (L1439) and has no purpose line. Consultas has a purpose line, but it only talks about read-only access (L1046).
- Available components: `zd-sidenav__heading`, `zd-sidenav__subheading`, `zd-sidenav__meta`, `zd-sidenav__tenant`, `zd-sidenav__foot`, `zd-pagehead__desc`, `zd-pagehead__meta`, `zd-scope--global|tenant|none` (`public/ui/components/components.css`).
- Bridge selectors the script can drive (G3'): `[aria-current]`, `[data-tono]`, `[data-icono]`, `[data-sin-tenant]` (L110–320).

## Hypotheses (need the running app)
- Two tabs with different tenants: a reload takes the last tenant written to `localStorage`.
- The sidebar's tenant block reads as "global" to a first-time operator.

## Open questions
- None blocking. The sidebar tenant title uses the tenant name already held by the script; no API change is needed.
