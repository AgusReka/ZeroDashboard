# Proposal: CH-54 — Mapping with expected fields

**Status**: approved by the user on 2026-11-11.

**Inputs:**
- `exploration.md` and EXPLORE 2026-11-11;
- `guidelines/admin.md` §13 Mapeo, W1, W8, E5, E6, F2 and §12;
- the validation report shape in `src/mapeo/validacion-mapeo.ts`;
- the requirement "Mapping and Validation Screen" in `query-console`.

**Priority: high.** It depends on CH-52 for its feedback helpers.

**Correction after the spec phase.** The screen already has:
- a count summary («{n} de {m} entidades válidas», `resumenDeMapeo`, L7379);
- per-field diagnostics.

The diagnostics are written as raw tokens («stockDisponible: tipo-incorrecto · columna … · probá castear con …», L7317), and only for failing fields. The scope below is adjusted to that.

## Intent
Mapping is the step that unlocks templates and reports, yet the screen never shows what each entity's SELECT must return. The operator has to open Contrato canónico in another screen, and after validating the diagnosis reads as machine tokens. This change:
- puts each entity's expected fields next to its editor;
- shows each field's verdict in words;
- lists the entities with their state, editing one at a time;
- makes the summary link to the entities that need work.

It uses only data the console already has.

## Scope

Item tags:
- **[visual]**: presentation only.
- **[comportamiento front]**: new client-side behaviour.
- **[backend]**: none.

### In Scope

**1. Three-column layout (admin.md §13 Mapeo).** [visual] + [comportamiento front]
```
┌ Mapeo y validación · Conexión [food-store ▾] ───────────────────── [Validar mapeo] ┐
│ ENTIDADES                 │ producto · SELECT                 │ CAMPOS ESPERADOS    │
│ ✓ producto     Válida     │ <textarea, with label>            │ ✓ id       entero   │
│ ✗ pedido       Inválida   │ [Guardar mapeo]                   │ ✓ nombre   texto    │
│ ○ item_pedido  Sin mapear │ ▸ Ejemplo sobre la réplica de demo│ ✗ precio   Falta    │
└───────────────────────────┴───────────────────────────────────┴─────────────────────┘
```
- **Left:** the five entities in contract order, each with its obligatoriness and its state (icon + text, E5). Selecting one shows its block (`aria-current`).
- **Center:** the selected entity's editor, «Guardar mapeo» and the example, all as today.
- **Right:** the entity's contract fields (name, type, obligatory) before any validation. After a validation, each field shows its verdict in words:
  - `ok` → «Coincide»;
  - `ausente` → «Falta en el SELECT»;
  - `tipo-incorrecto` → «Tipo distinto: llega {tipoObservado}»;
  - `alias-sin-comillas` → «Usá el alias entre comillas dobles»;
  - `duplicada` → «La columna aparece dos veces»;
  - the cast hint, when present, in mono;
  - extra columns: «Columnas que sobran: …».

**2. Labels (§12, F2).** [visual]
- **Change:** each editor gets an associated label «SELECT de {entidad}».

**3. The summary links to the work.** [visual] + [comportamiento front]
- **Change:** the existing summary keeps its text and gains, per pending entity, a link that selects it.
- **Rule line:** above «Validar mapeo», one line states what makes the mapping valid, using the rule the code applies (each obligatory entity mapped, probed without error and with every field `ok`). No new rule is invented.

**4. E6 · Blocked state.** [comportamiento front]
- **Change:** with a tenant but no connections, the screen shows «Primero registrá una conexión. El mapeo se escribe sobre la réplica que llega por esa conexión.» with «Ir a Conexiones», and sends nothing else.

**5. Automations table.** [visual]
- **Change:** its states are shown as icon + text, as the existing labels already say.

### Out of Scope
- A per-entity "probar SELECT" with a result preview: it would be a new capability (an open question in `exploration.md`).
- Any change to validation rules, the probe, the contract or the endpoints.
- The setup strip on this screen: CH-55.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `query-console` ("Mapping and Validation Screen"):
  - the entities are listed with their state and edited one at a time, with labelled editors;
  - the contract fields are shown per entity, with verdicts in words;
  - the summary links to the pending entities;
  - a blocked state appears when there is no connection.

`mapping-validation` and `tenant-schema-mapping` specify the API, which does not change.

## Approach
- **Contract:** embedded in the page with `jsonEnScript(CONTRATO_CANONICO)`, the same way `EJEMPLOS_MAPEO` already is (DEC-176). No request is added, and the field column cannot drift from the server's contract.
- **Markup:** the entity list and the three columns are server-rendered (`zd-*`). The five entity blocks are rendered server-side from `ENTIDADES_CANONICAS`, so the labels and containers carry their classes without JS (G3').
- **Script:** fills text and toggles `hidden`, `aria-current` and `data-tono`.
- **Tests:** a stubbed report covering every verdict, the selection, the summary links and the blocked state.

## Rules Check
- **Rules 1 to 7:** untouched. The diagnostic already names only columns and types, never client rows (rule 5).
- **Anti-scope:** no engine change, no new probe.

## Rollback
Front-end only. Reverting the PR restores the stacked editors.

## Affected Areas
- `src/consola/consola.ts`:
  - Mapeo markup (L995–1040);
  - script L7209–7480 (`bloqueDeEntidad`, `renderizarInforme`, `resumenDeMapeo` and `cargarPantallaMapeo`).
- `src/consola/consola.test.ts`: Mapeo cases.
- `openspec/specs/query-console`.

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Tests assume all five editors are visible at once | High | Ids unchanged; tests select the entity first |
| The embedded contract grows the served document | Low | Five entities, a few dozen fields; the same pattern as the examples |
| Size | Medium | Forecast ~390 lines; if over budget, split into 54a (labels + field column + verdict words) and 54b (entity list + summary links + blocked state) |

## Success Criteria
- [ ] Selecting an entity shows its editor and, beside it, the contract fields it must return, before any validation.
- [ ] After «Validar mapeo», each field shows its verdict in words, and the cast hint in mono.
- [ ] The summary links each pending entity, and the link selects it.
- [ ] Each entity shows its state as icon + text, and each editor has a label.
- [ ] With no connections, the blocked state shows «Ir a Conexiones».
- [ ] No new request is made. `npm test` and the typecheck pass.
