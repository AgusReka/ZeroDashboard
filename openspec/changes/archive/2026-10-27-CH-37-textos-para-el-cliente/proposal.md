# Proposal: CH-37 — Client-facing title and description on the template

**Status**: ready for spec and design. Inputs: exploration.md, DEC-182 (business text (a)), DEC-190, DEC-137, DEC-125, DEC-68, DEC-67, DEC-04. Story D4.

## Intent
A template carries its own client-facing title and description in the database, so any template — not only the two seeded ones — can reach the client panel. This is the prerequisite of CH-38: without it, a template created from the console never appears under «disponibles».

## Scope

### In Scope
- **Model.** `Plantilla` gains `titulo` and `descripcion`, both nullable, through one additive migration.
- **Backfill.** The same migration writes the two DEC-137 texts on every row whose `automatizacion` is `stock-fisico` or `stock-producible` (DEC-190, load (a)). The panel shows what it shows today, twins included.
- **Seed.** `CATALOGO_INICIAL` carries both texts, so a fresh install gets them. Seeding stays create-if-absent (DEC-125).
- **Panel read.** `GET /api/panel/automatizaciones` reads the texts from the template row; `COPY_NEGOCIO` disappears and `COPY_NEUTRO` stays as the fallback of an active automation whose template has no text.
  - «Disponibles»: templates with both texts non-blank, deduplicated by `titulo`, hidden when an active automation's template has the same `titulo`, ordered by `titulo` then `id` (DEC-190).
  - The response shape and the panel front end do not change.
- **Template API.** `POST` and `PUT /plantillas` accept optional `titulo` and `descripcion`, with a length cap and a check against the panel glossary (DEC-04). `GET /plantillas/:id` returns them. `PUT` without them clears them, as with any replaced field. The `GET /plantillas` summary is unchanged.
- **Docs.** `docs/guia/05-plantillas.md` documents the two fields.

### Out of Scope
- The console screen to create or edit templates and «Duplicar y editar» (CH-38).
- The console's operator description map (`DESCRIPCIONES_PLANTILLA`, DEC-131) and the email (it keeps `nombre` and the slug theme).
- The message text fields of DEC-188 (CH-39), even though they will add columns to the same model.
- Any engine, execution or tenant-scoped change.

## Capabilities

### Modified Capabilities
- `client-panel-automations`: "Available Automations Rule (DEC-137)" and "Business Copy Map With Neutral Fallback" (texts from the template row, dedup and order by title).
- `initial-template-catalog`: "No Schema, API or Engine Change" (superseded by DEC-182 for these two columns) and the catalog entries (they carry the texts).
- `automation-templates`: the create/replace body and the full projection gain the two optional fields, with their validation.

## Approach
- **Migration** `2026xxxx000000_plantilla_textos_cliente`: two `ADD COLUMN ... TEXT NULL` and two `UPDATE ... WHERE "automatizacion" = ...`, with the house header (`-- CH-37 … Additive.`) and a `Rollback` block.
- **Panel module.** Q1 selects `plantilla: { titulo, descripcion }`; Q4 selects `{ id, titulo, descripcion }` of templates with both texts set. `proyectarActiva` and `proyectarDisponibles` take the texts from those rows; a pure helper decides "has a text" (non-null and non-blank after trim).
- **Template routes.** `titulo` and `descripcion` join `registroPlantillaSchema` (`propertyNames.enum` included, so `removeAdditional` never drops them), `PlantillaCompleta` and `datosDePlantilla`. The glossary check is one pure function shared by the routes and the seed check (`rechazoDeEntrada`), with the forbidden-term list now in code instead of only in the panel test.
- **Length caps.** Proposed `titulo` ≤ 80 and `descripcion` ≤ 200 characters; the spec fixes them.

## Affected Areas
- `prisma/schema.prisma`, `prisma/migrations/<new>/migration.sql`
- `src/panel/panel-automatizaciones.ts`, `src/panel/panel-automatizaciones.test.ts`, `src/aislamiento/aislamiento-panel.test.ts`
- `src/plantillas/plantillas-rutas.ts`, `src/plantillas/plantillas-rutas.test.ts`
- `src/plantillas/catalogo-inicial.ts`, `src/plantillas/catalogo-inicial.test.ts`
- `docs/guia/05-plantillas.md`; the three specs above (at archive)

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| A text stored with a forbidden term reaches the client | Medium | Save-time glossary check on `POST`/`PUT` and in the seed check; a test over the seeded texts. Direct SQL is outside the check (DEC-190, "Se resigna") |
| Existing installs show no cards after the deploy | Low | The migration backfills by slug before the server starts (`docker-entrypoint.sh`: migrate, seed, serve); a migration test on a seeded DB |
| `PUT` silently clears texts a caller did not resend | Medium | Documented replace semantics in the guide; the CH-38 form always sends both |
| Nullable columns let a half-filled template (only a title) exist | Low | It is simply not listed under «disponibles»; covered by a scenario |
| Tests that compare against `COPY_NEGOCIO` break in cascade | High | Fixtures get the texts explicitly; the 15 direct `plantilla.create` calls stay valid because the columns are nullable |
| Size close to the 400-line budget (~330) | Medium | Single PR as chosen; the tasks forecast re-checks it |
| Branch base: the code needs CH-36 (`ch36/comentarios`, #209) and the docs need DEC-190 (#210), on two unmerged stacks | Medium | Branch the code from `ch36/comentarios`; the PR cites #210 as a documentation dependency |
