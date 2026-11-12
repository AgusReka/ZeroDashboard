# Proposal: CH-55 — Setup guide as a layer

**Status**: approved by the user on 2026-11-11, with a condition: it is a non-mandatory visual guide. It orients without imposing a rigid path and without blocking any feature.

**Inputs:**
- `exploration.md` and EXPLORE 2026-11-11;
- `guidelines/admin.md` G1–G5, N5, N6, E3, E6 and M1.

**Priority: medium.** Depends on CH-50 (the titled tenant block where the N6 marks live) and on CH-52 (success notices). Connection preselection in Consultas is already part of CH-53; this change covers the other selects.

## Intent
A tenant's setup crosses about eight screens with no sense of progress, and only the tenant creation offers a "next step". This change adds a thin layer over the existing screens:
- a status strip in each setup screen;
- marks in the navigation;
- a "next step" link after each stage completes.

It is not a wizard. It never disables, hides or reorders anything, and it only reads data the console already gets from existing endpoints.

## Scope

Item tags:
- **[visual]**: presentation only.
- **[comportamiento front]**: new client-side behaviour.
- **[backend]**: none.

### In Scope

**1. G1 · Setup strip.** [visual] + [comportamiento front]

A server-rendered `zd-statusline` under the header of Agentes, Conexiones, Mapeo y validación, Usuarios del panel and Tablero del cliente:

`Puesta en marcha: ✓ Conexión · ● Mapeo (estás acá) · ○ Usuarios del panel · ○ Tablero · ○ Primera automatización — Siguiente: Usuarios del panel →`

| Stage | Done when | Source (existing) |
|---|---|---|
| Conexión | The tenant has at least one connection | `GET /conexiones` |
| Mapeo | Some connection has every obligatory entity "Válida" | `GET /conexiones/:id/validacion-mapeo` per connection |
| Usuarios del panel | At least one active panel user | `GET /usuarios` |
| Tablero | The dashboard holds at least one report | `GET /tablero` |
| Primera automatización | At least one active automation | `GET /automatizaciones` |

- **Agentes** is optional and is never a stage. Its screen shows the strip without an "estás acá" mark.
- **The "Mapeo" stage** reads the validation state, not the timing mark of `/tiempos-alta`. That mark only says a validation ran once, even if the mapping is invalid now, so the strip would show "done" when it is not (M6). This is a display rule, not a product decision.
- **"Siguiente"** names the first pending stage and links to its screen. When every stage is done, the strip says «Puesta en marcha completa».

**2. N6 · Navigation marks.** [visual]
- Each "Puesta en marcha" item except Agentes carries a mark: circle-check «Hecho» or circle-dashed «Pendiente».
- The mark is icon plus accessible text, from the same data as the strip.
- The marks are informative: every item stays usable (N5).

**3. G2 · Next step after a stage.** [comportamiento front]

The success notice of the action that completes a stage offers the next pending stage:
- connection test OK → «Siguiente: Mapeo y validación»;
- mapping valid → «Siguiente: Usuarios del panel»;
- first user created → «Siguiente: Tablero del cliente»;
- dashboard saved → «Siguiente: Automatizaciones».

The link after creating a tenant stays.

**4. G3 · One connection comes preselected.** [comportamiento front]
- In Mapeo, Tablero del cliente and step 1 of the automation wizard, a tenant with exactly one connection has it preselected.
- With two or more connections, nothing is preselected.

**5. M1 · Each setup screen states its step.** [visual]
- The purpose line of each setup screen starts with its step. For example: «Paso 3 de la puesta en marcha. Escribí un SELECT por entidad y validalo: sin mapeo validado no se pueden probar plantillas ni reportes.»

### Out of Scope
- A wizard, a forced order or any blocking (G4, G5). Every screen stays reachable and usable in any order.
- Moving or changing Tiempos de alta (CH-50 moved it to the footer).
- New endpoints or stored marks.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `query-console`: a setup strip, navigation marks, next-step links and one-connection preselection.

`onboarding-timing-marks` specifies the timing endpoint and needs no delta, because this change does not use it.

## Approach
- One `estadoPuestaEnMarcha()` loads the five sources for the active tenant: one validation request per connection, usually one or two.
- It caches the result per tenant and refreshes it after a closing action and on a tenant change.
- The strip and marks are server-rendered placeholders; the script fills them with text, `hidden` and `data-tono` (G3').

## Rules Check
- **Rule 2:** all reads carry the active tenant's `X-Tenant-Id`.
- **Rules 1 and 3 to 7:** untouched.
- **Anti-scope:** no flow engine, no branches (G5).

## Rollback
Front-end only; reverting the PR removes the strip, marks and links.

## Affected Areas
- `src/consola/consola.ts`:
  - headers of Agentes (L545), Conexiones (L478), Mapeo (L995), Usuarios (L571) and Tablero (L635);
  - navigation items;
  - success paths of the connection test, validation, user creation and dashboard save;
  - populate functions of the Mapeo, Tablero and wizard selects.
- `src/consola/consola.test.ts`.
- `openspec/specs/query-console`.

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Extra requests on setup screens | Medium | One cached load per tenant; refresh only after closing actions |
| The strip lies | Low | The "Mapeo" stage reads the validation state |
| The guide feels mandatory | Low | It disables nothing; the marks are text; the purpose lines say "Paso n", never "Primero completá" |
| Size | Medium | Forecast ~380 lines |

## Success Criteria
- [ ] Each setup screen shows the strip with done and pending stages, its own position and the next pending stage as a link.
- [ ] The navigation marks match the strip, and every item stays usable.
- [ ] Completing a stage offers the next one in its success notice.
- [ ] With one connection, the Mapeo, Tablero and wizard selects come preselected; with two or more, none is.
- [ ] No control is disabled or hidden because of the guide.
- [ ] `npm test` and the typecheck pass.
