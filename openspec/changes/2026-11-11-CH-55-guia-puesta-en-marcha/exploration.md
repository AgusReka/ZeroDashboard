# Exploration: CH-55 — Setup guide as a layer

Source: the console UX audit (EXPLORE, 2026-11-11), `guidelines/admin.md` G1–G5, N5, N6, E6, and `src/conexiones/tiempos-alta.ts`. `Lnnn` = line in `src/consola/consola.ts`.

## Current state (verified)
- **Steps to a first working automation:** about 8 screens and 6 dialogs or forms (*hypothesis*: not measured in the running app). The only "next step" link appears after creating a tenant: "Siguiente: registrar la conexión" (L415).
- **`GET /tiempos-alta`** (`src/conexiones/tiempos-alta.ts:18`) returns one entry per connection of the active tenant with:
  - `altaInicio`
  - `conexionRegistrada`
  - `mapeoInicio`
  - `mapeoFin`
  - the last validation (any `validadaEn`, **valid or not**)
  - `automatizacionCreada`
  - first run
  - first OK run
  - and `truncado`
- **It does not say whether the mapping is currently valid.** Only `GET /conexiones/:id/validacion-mapeo` returns `estado` per entity.
- **Panel users and the dashboard are not in `/tiempos-alta`.** They are available from `GET /usuarios` and `GET /tablero`, which the console already calls on their screens.
- The Tiempos de alta screen (L673, JS L7687) shows the marks retrospectively. It does not guide.

## Hypotheses
- A visible "where am I / what's next" strip shortens the first setup.

## Open questions
- "Mapeo" done = "every obligatory entity `valida` on at least one connection" (needs `GET …/validacion-mapeo`, one request per connection) **or** "validated at least once" (from `/tiempos-alta`, cheaper but can say done while the mapping is invalid). Recommended: the first one, because the strip must not lie (M6). The design phase confirms the request cost.
