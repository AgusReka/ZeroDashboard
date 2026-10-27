# Exploration: CH-37 — Client-facing title and description on the template

Status: **decided** (2026-10-24): 1(a), 2(a), 3(a), 4(a), chosen by the user; to be registered as DEC-190 before the proposal. Store: openspec. Story D4. Decision: DEC-182, business text option (a): "new fields on `Plantilla` (client title and description), with a migration. The two DEC-137 texts move to the seed." Depends on CH-36; prerequisite of CH-38. No research phase.

## What exists (verified)

| Piece | State |
|---|---|
| Model | `Plantilla` (`prisma/schema.prisma:160-170`): `id, nombre, sql, parametros, entidades, automatizacion, formato, toleranciaFrescuraMinutos`. No `titulo`/`descripcion`, no `creadoEn`. Global catalog, not in `MODELOS_AISLADOS` (`src/aislamiento/aislamiento-prisma.ts:40`). |
| Migrations | 15, named `AAAAMMDDHHMMSS_snake_case`, each opening with `-- CH-NN: … (DEC-xx). Additive.` and ending with a `Rollback` block. `Plantilla` was only ever created (`20260927100000_plantilla`, CH-12); no `ALTER TABLE "Plantilla"` so far. Nullable `ADD COLUMN` precedent: `20261008000000_tenant_frescura`. `docker-entrypoint.sh` runs `migrate deploy`, then the seed, then the server. |
| Business texts | `COPY_NEGOCIO` (`src/panel/panel-automatizaciones.ts:26-42`), keyed by the `automatizacion` **slug**, not by template id; `COPY_NEUTRO` fallback (`:45-48`); `copyDe` (`:51-53`). Readers: `proyectarActiva` (`:166`), `proyectarDisponibles` (`:229-255`), Q4's `where automatizacion in COPY_NEGOCIO.keys()` (`:302-305`). |
| Available rule | `proyectarDisponibles`: templates whose slug is in the map and has no active automation of the tenant; ordered by map insertion, then `id`; deduplicated **by slug**. Output `{titulo, descripcion}`. |
| Slugs | Closed enum `AUTOMATIZACIONES` (`src/contrato/contrato.ts:43-47`): `stock-fisico`, `stock-producible`, `reporte-diario`. Every template created later (CH-38, «Duplicar y editar») shares one of these slugs. |
| Seed | `CATALOGO_INICIAL` (`src/plantillas/catalogo-inicial.ts:35-79`), fixed ids `21b0…0001/0002`. `sembrarCatalogoInicial` (`:137-153`) is a single `createMany({ skipDuplicates: true })`: existing rows are never updated (DEC-125, DEC-68; spec "Seeding Is Create-If-Absent by Fixed Id"). Entries must carry every `PlantillaCompleta` key (`catalogo-inicial.test.ts:57-58`). |
| Template routes | `src/plantillas/plantillas-rutas.ts`: strict body schema with `propertyNames.enum` (`:60-100`), no `maxLength` anywhere; `PUT` replaces every column of `datosDePlantilla` (`:155-165`, also used by the seed). `PlantillaResumen` (`:23-29`) and `PlantillaCompleta` (`:32-37`). |
| Panel front | Inline in `src/panel/panel.ts`; reads only `item.titulo`/`item.descripcion` (`:287-291`, `:570`, `:606`). Unchanged if the JSON keeps those names. |
| Not affected | The email uses `nombre` and the slug theme (`src/automatizaciones/correo.ts:123-165`). The console keeps its own operator description map `DESCRIPCIONES_PLANTILLA` (`src/consola/consola.ts:1030-1034`, DEC-131): different audience, out of scope. P-04 routes select only `{sql, parametros}`. |
| Glossary | Test 1.9 (`panel-automatizaciones.test.ts:317-345`) checks the constant map against the forbidden terms (`tenant, cron, sql, consulta, query, ejecución, réplica, parámetro, timeout, plantilla`). Once the text lives in the DB, that guarantee needs a new home. |

### Specs affected

- `client-panel-automations`: "Available Automations Rule (DEC-137)" (`:123`), "Business Copy Map With Neutral Fallback" (`:264`; also cites the old path `src/correo.ts`), "Automations Read Route and Response Shape" (`:9`).
- `initial-template-catalog`: "No Schema, API or Engine Change" (`:220`, forbids a migration and a `descripcion` column: DEC-182 supersedes it), "Every Entry Passes the Save-Time Checks" (`:83`).
- `automation-templates`: field rules for `POST`/`PUT` (`:19`, `:46`), if the API takes the fields.

### Tests that pin it

- `panel-automatizaciones.test.ts`: `copyDe` 1.1, `proyectarActiva` 1.4, `proyectarDisponibles` 1.7/1.8, glossary 1.9, routes 2.1–2.11 (compare against `COPY_NEGOCIO`).
- `aislamiento-panel.test.ts`: 2.14–2.16 (`titulo(slug)` from the map).
- `catalogo-inicial.test.ts`: U1–U4, L1–L3. `plantillas-rutas.test.ts`: exact echo (`:215`) and exact summary keys (`:236`).
- 15 direct `plantilla.create` calls in other tests: unaffected only if the columns are nullable.

## Shape that fits

- **Migration.** `ADD COLUMN "titulo" TEXT NULL, "descripcion" TEXT NULL` on `Plantilla`, plus a backfill of the two DEC-137 texts (decision 1). The seed stays create-if-absent; `CATALOGO_INICIAL` gains both texts so a fresh install gets them.
- **Panel.** `COPY_NEGOCIO` disappears. Q1 selects `plantilla.titulo/descripcion`; Q4 selects templates with both texts set. An active automation whose template has no text keeps `COPY_NEUTRO` (DEC-137 unchanged). Dedup and order follow decisions 2 and 4.
- **"Has a text"** means both fields non-null and non-blank.
- **API.** Depends on decision 3.
- **Out of scope.** The console screen (CH-38), the operator description map, the email, `GET /plantillas` summary keys.

## Decisions (chosen by the user on 2026-10-24: all four options (a))

They refine DEC-182 and amend DEC-137; once chosen they go into `01-decisiones.md` as DEC-190 before the proposal (AGENTS.md).

1. **Backfill of existing rows.** (a) The migration sets the texts by slug (`stock-fisico`, `stock-producible`) on every row that has them — the panel shows exactly what it shows today, twins included. (b) By the two fixed ids only — an operator twin created through the API loses its card until someone fills its text. *Recommended: (a).*
2. **Dedup and "active hides available".** Today both use the slug, and every new template shares one of three slugs, so a CH-38 template would never be listed. (a) By `titulo`: two templates with the same client title are one offer. (b) Keep the slug: new templates stay hidden whenever a seed template has the same slug. (c) No dedup: one card per template with texts. *Recommended: (a).*
3. **API in CH-37.** (a) `POST`/`PUT /plantillas` accept optional `titulo` and `descripcion` (length cap, glossary check at save), `GET /plantillas/:id` returns them; `PUT` without them clears them, as with any replaced field. (b) DB, seed and panel only; the API waits for CH-38. *Recommended: (a): without it there is no way to give a new template its text, and CH-38 becomes front-end only.*
4. **Order of `disponibles`.** The map order disappears. (a) By `titulo`, then `id`: predictable for the client; the two seed cards swap places. (b) By `id`: today's order for the seed, arbitrary but stable for new templates. *Recommended: (a).*

## Size

With 1(a), 2(a), 3(a), 4(a): migration ~25, schema 2, panel ~40, routes ~35, seed ~10, tests ~200, docs/guide ~20 → **~330 changed lines**, one PR (close to the 400 budget). With 3(b): ~260.

## Risks

- The panel's glossary guarantee moves from a constant to stored data; without 3(a)'s save-time check, a template written through the API can show forbidden terms.
- Decision 2(b) would make CH-38 invisible to the client: worth deciding here, not in CH-38.
- The v2 docs (DEC-182) are still in unmerged PRs (#199–#209); the proposal cites them as they stand on `v2/mapa`.
