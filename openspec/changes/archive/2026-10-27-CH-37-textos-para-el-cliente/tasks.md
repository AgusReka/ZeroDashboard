# Tasks: CH-37 — Client-facing title and description on the template

Inputs: proposal.md, specs/client-panel-automations/spec.md, specs/initial-template-catalog/spec.md, specs/automation-templates/spec.md, design.md. Delivery: single-pr. Code branch from `ch36/comentarios` (CH-36 layout); DEC-190 is in PR #210.

## 1. Schema and migration
- [x] 1.1 `prisma/schema.prisma`: `titulo String?` and `descripcion String?` on `Plantilla`, plus the comment sentence of design §1.1. Run `npm run prisma:generate`.
- [x] 1.2 `prisma/migrations/20261027000000_plantilla_textos_cliente/migration.sql` per design §1.2. Confirm that the `ALTER` part matches `npx prisma migrate diff` (no drift).

## 2. Glossary
- [x] 2.1 `src/compartido/glosario-panel.ts`: `TERMINOS_PROHIBIDOS_PANEL` and `terminosProhibidosEn` (design §2).
- [x] 2.2 `src/compartido/glosario-panel.test.ts`: case-insensitive match, several terms, clean text gives `[]`.

## 3. Template routes
- [x] 3.1 `src/plantillas/plantillas-rutas.ts`:
  - `PlantillaCompleta`, `RegistroPlantillaBody` and the schema (`propertyNames.enum` and `properties`) gain both fields.
  - `LARGO_MAXIMO_TEXTO_CLIENTE` and `textoCliente`.
  - The length and glossary step in `rechazoDePlantilla`, with `/titulo` and `/descripcion` in `campos` and `terminos`.
  - `datosDePlantilla` writes the normalized texts (design §3).
- [x] 3.2 `src/plantillas/plantillas-rutas.test.ts`: the cases of design §6, including the updated echo of "3.1 a headerless create" (`:215`) and the JSON `null` case. DB tests use a per-file title tag.

## 4. Seed
- [x] 4.1 `src/plantillas/catalogo-inicial.ts`: the texts of the spec table on both entries, and the two `exigir` checks in `rechazoDeEntrada` (design §5).
- [x] 4.2 `src/plantillas/catalogo-inicial.test.ts`: U1 compares the texts, a unit test checks them against the glossary and the caps, and L1 checks the seeded rows carry them.
- [x] 4.3 `src/plantillas/migracion-textos-cliente.test.ts`: the backfill test of design §6, with a rolled-back transaction and the `id IN (...)` narrowing.

## 5. Panel
- [x] 5.1 `src/panel/panel-automatizaciones.ts`:
  - Remove `COPY_NEGOCIO` and `copyDe`.
  - Add `textoDe`.
  - Retype `FilaAutomatizacion` and `PlantillaCatalogo`.
  - Rewrite `proyectarActiva` and `proyectarDisponibles` (key, `Intl.Collator('es')`, lowest id wins).
  - Update Q1, Q4 and the route comment (design §4).
- [x] 5.2 `src/panel/panel-automatizaciones.test.ts`:
  - `textoDe`, plus 1.4, 1.7 and 1.8 over titles.
  - 1.9 over `TERMINOS_PROHIBIDOS_PANEL`.
  - Route fixtures with tagged titles, and 2.1, 2.7, 2.10 and 2.11 filtered to the tag.
- [x] 5.3 `src/aislamiento/aislamiento-panel.test.ts`: `montarAutomatizacion` with tagged titles; `titulo(slug)` from the fixtures; 2.14 and 2.15 filtered to the tag.

## 6. Docs
- [x] 6.1 `docs/guia/05-plantillas.md`, "Alta y cambio": the two fields, their caps, the glossary rule and its `400` with `terminos`, and the `PUT` that clears them (design §7).
- [x] 6.2 Grep for leftover `COPY_NEGOCIO` or `copyDe` in `src/`, `docs/guia/` and the skill copies; only the archived specs and `docs/01-decisiones.md` may keep historical mentions.

## Verification
- `npx tsc --noEmit`
- `npx tsx --test src/compartido/glosario-panel.test.ts src/panel/panel-automatizaciones.test.ts src/plantillas/plantillas-rutas.test.ts src/plantillas/catalogo-inicial.test.ts`
- `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db`. Known environmental failures: the 4 false positives in `conexiones.test.ts` (the response contains `"motor":"postgres"` with the `postgres` password).

## Review Workload Forecast
- Estimated changed lines: ~395 (code ~140, tests ~240, guide ~15)
- 400-line budget risk: Medium (at the limit; tests are most of it)
- Chained PRs recommended: No
- Decision needed before apply: No. If the real diff passes 400, stop before the PR and ask: split off the test-isolation work, or `size:exception`.

## Delivery outcome
- Actual diff: ~855 changed lines (tests ~600), over the forecast and the 400-line budget.
- The user chose on 2026-10-27 a single PR with `size:exception` over three chained PRs. The SDD attempt objective was reset by the maintainer with that reason.
- `npm run test:db` (port 5434), 2026-10-27: 1515/1519. The 4 failures are the known `conexiones` false positives. The run also caught the exact `Plantilla` column list in `src/aislamiento/aislamiento.test.ts`, which now includes the two new columns.
