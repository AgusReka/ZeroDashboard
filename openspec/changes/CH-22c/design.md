# Design: CH-22c — Panel "My Automations" with Failure State (P3h)

## Technical Approach
Extend CH-22b: derive `estado` as `activa | pausada | con_falla` in the pure projection based on `activo` and `ultimaEjecucion.resultado`. Update panel rendering to show an inline error banner when `estado === 'con_falla'`. No schema/migration; no email changes.

## 1. Pure layer changes (`src/panel-automatizaciones.ts`)

### Types
Update `ItemActiva.estado`:
```ts
export interface ItemActiva {
  titulo: string;
  descripcion: string;
  estado: 'activa' | 'pausada' | 'con_falla';
  frecuencia?: string;
  ultimaEjecucion: { fecha: string; resultado: ResultadoNegocio } | null;
  proximaEjecucion: string | null;
}
```

### Projection
In `proyectarActiva`, compute estado:
```ts
const ultimaRes = ultima?.resultado ?? null;
const estado: ItemActiva['estado'] = fila.activo
  ? (ultima !== null && ultimaRes === 'no-realizada' ? 'con_falla' : 'activa')
  : 'pausada';
```
Then set `estado` in the item. Keep `proximaEjecucion` logic: when `fila.activo` is true, compute next run (failure state doesn't change next run). Paused means `proximaEjecucion: null`.

This preserves allow-list, no spreading of stored rows. No other fields change.

## 2. Panel page changes (`src/panel.ts`)

When rendering an active card (`tarjetaActiva`), if `item.estado === 'con_falla'`, append an inline error banner inside the card (before/after times, consistent with design skill P-03). Use the panel's business copy:
- Title: "No pudimos completar esta automatización esta vez"
- Body: "La última revisión falló. La próxima vez que se ejecute, volvemos a intentarlo."
(Neutral, no technical terms; matches P-03 intent.)

Render with existing classes (use `.zd-banner .zd-banner--error`, role="alert"). Insert via DOM creation with `textContent` only (no innerHTML). Keep script constraints (string concatenation only, no template literals, no interpolation).

## 3. Tests

### `src/panel-automatizaciones.test.ts` (pure)
Add cases:
- Active + failed last run (`fallo` → `no-realizada`) gives `estado: 'con_falla'`
- Active + omitted (`omitida` → `no-realizada`) gives `con_falla`
- Active + successful gives `activa`
- Active + only `en-curso` gives `activa` (ultimaEjecucion null)
- Paused + failed gives `pausada` (never con_falla)
- Projection still produces only allow-listed keys

### `src/panel-automatizaciones.test.ts` (route, live DB)
Add route tests covering the same cases with fixtures.

### `src/panel.test.ts`
Add assertions that when the script receives `estado: 'con_falla'`, it renders the failure banner title/body. Also ensure glossary scan (case-insensitive) of visible text and script literals still finds none of the forbidden terms. The existing checks (no template literals, no innerHTML, no actions) remain.

### `src/aislamiento-panel.test.ts`
No change required; existing isolation cases still valid.

### `src/contexto-tenant.test.ts`
No change required; exemption row already present.

## 4. Wiring & Verification
No wiring changes (route already registered, exemption row present). Verification per unit:
- `npx tsc --noEmit`
- targeted tests for modified files
- `TEST_DB_PORT=5434 npm test` (full suite)
- `npm run build`

## 5. PR Strategy (chained, stacked-to-main)
- PR0: docs only (this folder)
- PR1: pure layer + unit tests (`panel-automatizaciones.ts`, its tests)
- PR2: route tests updates, any isolation additions if desired (minimal)
- PR3: page + page tests (`panel.ts`, `panel.test.ts`)

Rollback: revert PR(s); no migration/data change.
