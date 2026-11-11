# Query Console Specification (CH-50 delta)

Every console screen is specified in `query-console`, so this is the only delta of CH-50. The specs `shared-visual-system`, `tenant-management`, `automation-templates` and `report-catalog` specify the stylesheet, the API and the catalog, and their requirements do not change. Rule references (N1, M6…) point to `.claude/skills/zerodashboard-design/guidelines/admin.md`.

## MODIFIED Requirements

### Requirement: Navigation by Hash
The side navigation SHALL hold three titled blocks, in this order:
- a block headed "Global" with `#tenants`, `#plantillas`, `#reportes` and `#contrato`. `#plantillas` and `#reportes` SHALL carry the meta badge "con tenant", whose title reads "Se prueba con el tenant activo" (the full sentence does not fit the item's badge);
- a block headed with the active tenant's name and its short id in mono, or "Ningún tenant" when none is selected. It holds:
  - a "Puesta en marcha" group with `#agentes` (meta "opcional"), `#conexiones`, `#mapeo`, `#usuarios` and `#tablero`, in that order;
  - a "Trabajo diario" group with `#consultas`, `#automatizaciones`, `#frescura` and `#auditoria`;
- a footer block headed "Investigación" with `#tiempos`.

Every link SHALL stay visible and usable with or without an active tenant (N5). Every link id (`nav-*`) SHALL keep its name (DEC-164).

On load and on every `hashchange`, exactly one screen SHALL be visible:
- the one named by the hash;
- with an empty hash, Consultas when a tenant is active and Tenants when none is;
- with a hash that names no screen, the "unknown section" screen (`pantalla-desconocida`). It says «Esta sección no existe» and offers one link to the default screen.

The link of the visible screen SHALL carry `aria-current="page"` and no other link SHALL. `document.title` SHALL name the visible screen from the first render.
(Previously: "Puesta en marcha" listed `#conexiones` before `#agentes` and held `#tiempos`; the tenant block had no heading; an unknown hash showed Consultas.)

#### Scenario: Block order and titles with a tenant
- **GIVEN** tenant "Almacén Don Tito" is active
- **WHEN** the console is shown
- **THEN** the navigation shows "Global", then a block headed "Almacén Don Tito" with its short id, then "Investigación" holding only Tiempos de alta
- **AND** inside "Puesta en marcha", Agentes (marked "opcional") comes before Conexiones

#### Scenario: Tenant block without a tenant
- **GIVEN** no tenant is selected
- **THEN** the tenant block is headed "Ningún tenant" and its links are still visible and usable

#### Scenario: Default screen
- **GIVEN** the page is opened with no hash and a tenant is active
- **THEN** Consultas is visible and its link is current

#### Scenario: Switching screens
- **WHEN** the hash becomes `#tiempos`
- **THEN** only Tiempos de alta is visible and its link is current

#### Scenario: Unknown hash
- **WHEN** the hash is `#no-existe`
- **THEN** only the unknown-section screen is visible, it says «Esta sección no existe», and no navigation link is current

#### Scenario: The reports screen
- **WHEN** the hash becomes `#reportes`
- **THEN** only Reportes is visible and its link is current

#### Scenario: The dashboard screen
- **WHEN** the hash becomes `#tablero`
- **THEN** only Tablero del cliente is visible and its link is current

### Requirement: Permanent Active-Tenant Indicator (T4)
The console SHALL display, at all times and without ambiguity, which tenant it is currently operating against.

With a tenant, the tenant bar SHALL show:
- the label "Operando sobre";
- the tenant's name;
- its short id in mono.

The no-active-tenant state MUST remain visually distinct from the active state, and MUST state in text that no tenant is selected and that the tenant sections need one. Icon and text carry the state, never color alone.

Every screen's page header SHALL state its scope:
- "Global · todos los tenants" for Tenants, Plantillas, Reportes and Contrato canónico;
- "Del tenant · {nombre}" for every tenant screen, or "Necesita un tenant" when none is selected.

(Previously: the bar's label was "Tenant activo", with no short id and no hint in the no-tenant state; tenant screens said "Del tenant activo" without naming it.)

#### Scenario: Indicator is always visible
- **GIVEN** the console page is loaded with an active tenant selected
- **WHEN** any part of the console is viewed
- **THEN** the active tenant's name and short id are identifiable on screen without further action

#### Scenario: No-tenant state stays distinct
- **GIVEN** the console page is loaded with no active tenant
- **WHEN** the tenant bar is rendered with the shared stylesheet
- **THEN** it SHALL carry text stating no tenant is selected and that the tenant sections need one
- **AND** its style SHALL differ from the active-tenant state

#### Scenario: Scope tag names the tenant
- **GIVEN** tenant "Almacén Don Tito" is active
- **WHEN** the hash becomes `#conexiones`
- **THEN** the page header's scope reads "Del tenant · Almacén Don Tito"
- **WHEN** the hash becomes `#tenants`
- **THEN** it reads "Global · todos los tenants"

### Requirement: Tenant Selector
The console SHALL provide one path to change the active tenant: the «Cambiar tenant» pop-up.
- **Choosing:** a tenant is chosen in the list, and nothing changes until «Operar sobre {nombre}» is pressed.
- **From the Tenants screen:** «Elegir como activo» and «Crear y elegir» SHALL open that same pop-up with the tenant preselected, instead of switching directly.
- **Unsaved changes:** when the Tablero del cliente screen has unsaved changes (the state that enables its «Guardar»), the pop-up SHALL show, inside it, a warning: «Tenés cambios sin guardar en Tablero del cliente. Si cambiás de tenant, se descartan.» Confirming still discards them (Tenant Dashboard Screen).

(Previously: «Elegir como activo» and «Crear y elegir» switched the tenant directly, and unsaved Tablero changes were discarded without notice.)

#### Scenario: Switching the active tenant
- **GIVEN** the console page is loaded and more than one tenant exists
- **WHEN** the operator chooses a different tenant in the pop-up and presses «Operar sobre {nombre}»
- **THEN** the indicator SHALL update to reflect the newly selected tenant

#### Scenario: Choosing from the Tenants screen asks first
- **GIVEN** tenant A is active and tenant B is listed
- **WHEN** the operator presses «Elegir como activo» on B
- **THEN** the «Cambiar tenant» pop-up opens with B preselected and the active tenant is still A
- **AND** pressing «Operar sobre B» makes B active

#### Scenario: Unsaved dashboard changes are announced
- **GIVEN** the operator reordered reports in Tablero del cliente and did not save
- **WHEN** the «Cambiar tenant» pop-up opens
- **THEN** it shows the unsaved-changes warning
- **AND** with no unsaved changes it does not

## ADDED Requirements

### Requirement: Catalog Screens State Their Test Tenant (N4, M6)
The Plantillas and Reportes screens SHALL keep their "Global · todos los tenants" scope. Next to it, they SHALL show the line "Prueba sobre: {nombre del tenant}", or "Prueba sobre: ningún tenant (elegí uno para probar o guardar)" when none is selected.

Without an active tenant, the existing rules of the template and report pop-ups keep applying: «Probar» says «Elegí un tenant para probar la plantilla» (or «…el reporte») and sends nothing, and the save control stays disabled with that reason next to it. Listing and the read-only side panel SHALL keep working.

The server-side rules (DEC-191, DEC-198) do not change.

#### Scenario: No tenant on Plantillas
- **GIVEN** no tenant is selected
- **WHEN** the operator opens «Nueva plantilla»
- **THEN** the header says "Prueba sobre: ningún tenant (elegí uno para probar o guardar)"
- **AND** pressing «Probar» says «Elegí un tenant para probar la plantilla», the save control stays disabled, and no test request is sent

#### Scenario: With a tenant
- **GIVEN** tenant A is active
- **WHEN** the hash becomes `#reportes`
- **THEN** the header shows "Prueba sobre: A"

### Requirement: Every Screen States Its Purpose (P2, P3)
Every screen's page header SHALL hold exactly one title and one purpose line (`zd-pagehead__desc`) that says what is done there and what it is for in the flow.
- **Frescura de datos:** it SHALL NOT repeat its title as a second heading.
- **Consultas:** its purpose line SHALL read «Explorá la réplica del tenant activo con SQL de solo lectura. Usala para revisar un mapeo, una plantilla o un reporte antes de guardarlos. Plantillas y automatizaciones no usan estas consultas.»

#### Scenario: Frescura has one title
- **WHEN** the console document is served
- **THEN** `pantalla-frescura` holds one heading "Frescura de datos" and a purpose line

#### Scenario: Consultas says what it is for
- **WHEN** the hash becomes `#consultas`
- **THEN** the purpose line says that templates and automations do not use these queries
