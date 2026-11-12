# Design: CH-54 — Mapping with expected fields

Inputs:
- `proposal.md` and `specs/query-console/spec.md`;
- `src/consola/consola.ts` L995–1040 (markup) and L7209–7480 (script);
- `src/mapeo/validacion-mapeo.ts` (`InformeValidacion`, `DiagnosticoCampo`);
- `src/contrato/contrato.ts` (`CONTRATO_CANONICO`);
- `src/mapeo/vistas-canonicas.ts` (`ENTIDADES_CANONICAS`).

Decisions in force: DEC-164 and DEC-176 (examples embedded in the page). No new architecture decision: the contract is embedded with the same mechanism as the examples.

## Technical Approach

### 1. Data
- **Contract.** `var CONTRATO = ${jsonEnScript(CONTRATO_CANONICO)};` goes next to `EJEMPLOS_MAPEO` (L7209). It is the same constant `GET /contrato` serves, so the console and the API cannot disagree. The apply phase confirms that the exported shape holds entities, fields, types and obligatoriness; the Contract screen already renders it.
- **Report.** The last report (`InformeValidacion`) is kept in `ultimoInformeMapeo` per connection. It is cleared on a connection or tenant change.

### 2. Markup (server)
```
#pantalla-mapeo
  zd-pagehead (unchanged + rule line #mapeo-regla above «Validar mapeo»)
  #mapeo-bloqueado (zd-state, hidden)          ← E6, «Ir a Conexiones»
  «Cómo mapear» (unchanged)
  .mapeo-columnas (bridge grid: 240px | 1fr | 300px; one column under 960px)
    nav#mapeo-entidades (ul; one li > button per entity, data-entidad, rendered from ENTIDADES_CANONICAS)
    div#mapeo-bloques  (five blocks rendered server-side; each: label[for], textarea (existing id), Guardar, example details)
    aside#mapeo-campos (h3 "Campos esperados", ul#mapeo-campos-lista, p#mapeo-sobrantes hidden)
  resumen (existing node) + automations table (existing)
```
- **Server-side blocks.** Rendering the five blocks on the server (today `bloqueDeEntidad` builds them in JS) gives each label and container its classes without JS (G3').
- **Ids.** The existing editor ids keep their names. If they were generated as `mapeo-sql-{entidad}`, the server uses the same pattern.
- **Visibility.** Only the selected block is visible (`hidden` on the others).

### 3. Script
- `seleccionarEntidad(entidad)`:
  - sets `aria-current` on its list button;
  - shows its block;
  - calls `renderizarCampos(entidad)`.
- `renderizarCampos(entidad)`:
  - for each contract field, an `li` with the name (mono), the type and «obligatorio» / «opcional»;
  - if `ultimoInformeMapeo` has a diagnostic for that entity, it appends the verdict in words through `textoDeVeredicto(campo)`, the hint in a mono `span`, and `data-tono` (`ok` or `error`);
  - extra columns go into `#mapeo-sobrantes`.
- `textoDeVeredicto`: one lookup table (spec). Unknown tokens fall back to the token itself, so a future verdict is never hidden.
- **Entity list state:** each list button writes its state text and its `data-tono` from `informe.entidades[].estado`, through the existing `etiquetaDeEstadoMapeo`.
- **Summary links:** `resumenDeMapeo` keeps its sentence. For each pending entity it appends a `button` (`botonTenant`) that calls `seleccionarEntidad`. These are buttons rather than `#mapeo/{entidad}` links: sub-routes come with CH-53 and DEC-208, and the mapping screen does not need an address for its entities.
- **Blocked state:** `cargarPantallaMapeo` reads `GET /conexiones` (it already does, to fill the select). With zero rows it shows `#mapeo-bloqueado` and hides the columns.
- `renderizarInforme` stops writing the `<ul>` lines per entity; the field column replaces them.

## Architecture Decisions

### Decision: Embed the contract, do not fetch it
**Choice:** `jsonEnScript(CONTRATO_CANONICO)`.
**Alternatives considered:** `GET /contrato` on each load.
**Rationale:** it is the precedent of DEC-176, adds no request, and the field column is available before the network answers.

### Decision: One entity at a time
**Choice:** a list plus one visible block.
**Alternatives considered:** keep the five stacked blocks and add a field column to each.
**Rationale:** admin.md §13. Five editors with five field lists would make the screen several screens tall.

### Decision: Entity selection is local state, not an address
**Choice:** no sub-hash.
**Rationale:** it keeps CH-54 independent of CH-53's sub-route mechanism. CH-55's precise links (G3) can add `#mapeo/{entidad}` later if wanted.

## Data Flow
```
#mapeo ──► cargarPantallaMapeo
             ├─ GET /conexiones ── 0 rows ─► #mapeo-bloqueado
             └─ connection chosen ─► GET …/validacion-mapeo ─► ultimoInformeMapeo
                                       ├─ entity list states
                                       ├─ seleccionarEntidad(first not valid)
                                       └─ resumen with buttons
select entity ─► renderizarCampos(CONTRATO[entidad] ⊕ diagnostic)
```

## File Changes
| File | Action | Description |
|------|--------|-------------|
| `src/consola/consola.ts` | Modify | Imports `CONTRATO_CANONICO` and `ENTIDADES_CANONICAS` (if not imported). Mapeo markup with server-rendered blocks. Bridge grid rule. `seleccionarEntidad`, `renderizarCampos` and `textoDeVeredicto`. `bloqueDeEntidad` reduced to wiring. `renderizarInforme` and `resumenDeMapeo` adjusted. Blocked state |
| `src/consola/consola.test.ts` | Modify | Mapeo cases select the entity first; new cases below |

## Interfaces / Contracts
No API change. New guarded ids: `mapeo-entidades`, `mapeo-bloques`, `mapeo-campos`, `mapeo-campos-lista`, `mapeo-sobrantes`, `mapeo-bloqueado`, `mapeo-regla`.

## Testing Strategy
| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (fake DOM) | Every contract field is listed before validation. Each verdict maps to its sentence. The hint is in mono. Extra columns. First non-valid entity is selected. A summary button selects its entity. Blocked state with zero connections. Labels exist with matching `for` | Stubbed `GET /conexiones` and report |
| Structural | The embedded contract equals `CONTRATO_CANONICO`. Examples still match the contract (existing case) | Existing harness |

## Migration / Rollout
None.

## Open Questions
- None blocking. A per-entity probe stays out (exploration).
