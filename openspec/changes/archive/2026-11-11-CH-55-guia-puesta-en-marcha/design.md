# Design: CH-55 — Setup guide as a layer

Inputs:
- `proposal.md` and `specs/query-console/spec.md`;
- `src/consola/consola.ts`: headers, navigation, success paths and select populate functions;
- `guidelines/admin.md` G1–G5, N5 and N6.

Depends on CH-50 (navigation structure) and CH-52 (`avisar` with an action link). No new architecture decision.

## Technical Approach

### 1. State
```
var puestaEnMarcha = { tenant: null, cargando: null, etapas: null };
// etapas: { conexion: bool, mapeo: bool, usuarios: bool, tablero: bool, automatizacion: bool }

async function estadoPuestaEnMarcha(forzar) {
  if (!forzar && puestaEnMarcha.tenant === tenantActivo && puestaEnMarcha.etapas) return puestaEnMarcha.etapas;
  // Promise.all over: GET /conexiones, GET /usuarios, GET /tablero, GET /automatizaciones
  // then, for each connection (bounded by LIMITE_LISTADO), GET /conexiones/:id/validacion-mapeo
  //   until one has every obligatory entity 'valida' (short-circuit)
}
```
- **Request helper:** every request goes through `pedir()`, which adds `X-Tenant-Id`.
- **Failures:** if any read fails, that stage shows «Sin datos» (icon `circle-help`) instead of Hecho or Pendiente, and the strip omits "Siguiente". The guide never blocks, so a failure only reduces the information.
- **Stale answers:** a request started for another tenant is ignored when it answers. The tenant is compared before writing, the same way the existing loaders already guard.

### 2. Markup (server)
- **Strip.** In each of the five headers: `<p id="pm-{pantalla}" class="zd-statusline" hidden>`, with one `span` per stage (icon + text) and a final `a` («Siguiente: …»).
  - Icons are server SVGs for `circle-check`, `circle-dashed` and `circle-help`. The script shows one of the three per stage with `hidden`.
  - Text and `data-tono` (`ok` / `warn`) come from the script.
- **Navigation marks.** On `nav-conexiones`, `nav-mapeo`, `nav-usuarios` and `nav-tablero`: a `span.zd-sidenav__meta` with two server icons and a text node.

### 3. Rendering
- **`renderizarPuestaEnMarcha(pantallaVisible)`** fills:
  - the visible screen's strip, marking its stage «estás acá»;
  - the four navigation marks.
- **When it runs:**
  - from `mostrarPantalla` when a setup screen is shown;
  - from `fijarTenant`, after the cache is cleared;
  - after each closing action, with `estadoPuestaEnMarcha(true)`.

### 4. Next-step links (G2)
`siguienteEtapa(etapas)` returns the first pending stage. Each closing action's success path calls `avisar(texto, { tono: 'ok', accion: { texto: 'Siguiente: …', href: '#…' } })` only when:
- the stage it completes was pending before the action;
- it is done after the refresh.

`avisar` (CH-52) gains an optional `accion`, rendered as a link inside the banner's `zd-banner__actions`, which is server markup.

### 5. Preselection (G3)
In the populate functions of `#mapeo-conexion`, the Tablero connection select (only when the tenant has no dashboard) and the wizard's step-1 connection: when `conexiones.length === 1`, set its value and dispatch the existing change handler. Consultas already does this from CH-53.

### 6. Purpose lines (M1)
Server text edits in the four headers, plus Agentes' «Opcional: solo hace falta si la réplica está en una red privada.»

## Architecture Decisions

### Decision: Validation state, not the timing mark
**Choice:** the Mapeo stage reads `validacion-mapeo`.
**Alternatives considered:** `/tiempos-alta`'s last validation date.
**Rationale:** the timing mark says a validation ran, not that the mapping is valid (M6). It costs one request per connection, short-circuited at the first valid one.

### Decision: Failures degrade to «Sin datos»
**Choice:** a failed read shows «Sin datos» for that stage.
**Alternatives considered:** a global error.
**Rationale:** the guide is informative; one failed read must not look like a broken screen.

## Data Flow
```
mostrarPantalla(setup screen) ─► estadoPuestaEnMarcha() ─ cached? ─► renderizarPuestaEnMarcha
                                       └─ Promise.all(4 GETs) + validation per connection (short-circuit)
closing action OK ─► estadoPuestaEnMarcha(true) ─► render + avisar(…, Siguiente)
fijarTenant ─► cache cleared
```

## File Changes
| File | Action | Description |
|------|--------|-------------|
| `src/consola/consola.ts` | Modify | Strip markup in five headers; navigation marks; `estadoPuestaEnMarcha`, `renderizarPuestaEnMarcha` and `siguienteEtapa`; the `avisar` action link; success paths (connection test, validation, user create, dashboard save, automation create); preselection in three populate functions; purpose lines |
| `src/consola/consola.test.ts` | Modify | New cases; the request counters of existing cases on setup screens are updated for the extra reads |

## Interfaces / Contracts
No API change. New guarded ids: `pm-agentes`, `pm-conexiones`, `pm-mapeo`, `pm-usuarios`, `pm-tablero`, `nav-marca-conexiones`, `nav-marca-mapeo`, `nav-marca-usuarios`, `nav-marca-tablero`.

## Testing Strategy
| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (fake DOM) | Each stage's done and pending states from stubbed answers. «estás acá». «Siguiente» names the first pending stage. «Puesta en marcha completa». An invalid mapping is pending. A failed read gives «Sin datos». The navigation marks match the strip. A next-step link only when the stage flipped. Preselection with one connection and none with two. No control changes `disabled` because of the guide | Stubbed `fetch`, counting requests |
| Structural | New ids exactly once | Existing guard |

## Migration / Rollout
None.

## Open Questions
- None.
