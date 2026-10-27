# Design: CH-37 — Client-facing title and description on the template

Inputs: proposal.md, the three spec deltas (`client-panel-automations`, `initial-template-catalog`, `automation-templates`), DEC-182, DEC-190, DEC-137, DEC-125, DEC-128. Code as it stands on `ch36/comentarios`: `src/panel/panel-automatizaciones.ts`, `src/plantillas/plantillas-rutas.ts`, `src/plantillas/catalogo-inicial.ts`, `prisma/schema.prisma:160-170`, and the migration header style of `20261008000000_tenant_frescura`.

## 1. Schema and migration

### 1.1 `prisma/schema.prisma`

```prisma
model Plantilla {
  ...
  toleranciaFrescuraMinutos Int
  titulo                    String?
  descripcion               String?
  automatizaciones          Automatizacion[]
}
```

The model comment gains one sentence: `titulo` and `descripcion` are the client panel's texts (DEC-182, DEC-190), optional, checked in the application.

### 1.2 `prisma/migrations/20261027000000_plantilla_textos_cliente/migration.sql`

```sql
-- CH-37: the client-facing title and description of a template (DEC-182, DEC-190). Additive.
--
-- Two nullable columns and no default: null means "no client text", and such a template
-- is simply not offered in the panel. Length and glossary are checked in the
-- application, like "Plantilla"."toleranciaFrescuraMinutos". The two UPDATEs write the
-- DEC-137 texts by slug, so every pre-CH-37 row the panel listed keeps its card; the
-- seeder never updates a row (DEC-125).
-- Rollback (after reverting the code units):
--   ALTER TABLE "Plantilla" DROP COLUMN "titulo";
--   ALTER TABLE "Plantilla" DROP COLUMN "descripcion";

-- AlterTable
ALTER TABLE "Plantilla" ADD COLUMN     "titulo" TEXT,
ADD COLUMN     "descripcion" TEXT;

-- Backfill
UPDATE "Plantilla"
SET "titulo" = 'Aviso de stock bajo',
    "descripcion" = 'Te avisamos por correo cuando un producto se está quedando sin stock.'
WHERE "automatizacion" = 'stock-fisico';

UPDATE "Plantilla"
SET "titulo" = 'Aviso de productos que ya casi no podés armar',
    "descripcion" = 'Te avisamos por correo cuando, con los insumos que tenés, ya casi no podés armar un producto.'
WHERE "automatizacion" = 'stock-producible';
```

The `ALTER` part must match what `prisma migrate diff` generates, so `migrate dev` reports no drift.

## 2. Glossary check (`src/compartido/glosario-panel.ts`, new)

```ts
/** The panel glossary's forbidden terms (DEC-04, `lenguaje.md`). Lower case. */
export const TERMINOS_PROHIBIDOS_PANEL: readonly string[] = Object.freeze([
  'tenant', 'cron', 'sql', 'consulta', 'query', 'ejecución', 'réplica', 'parámetro', 'timeout', 'plantilla',
]);

/** The forbidden terms `texto` contains, case-insensitively, in list order. */
export function terminosProhibidosEn(texto: string): string[]
```

- It lives in `compartido/` because both `plantillas/` (save-time check) and `panel/` (the test over the fallback and frequency texts) read it. `plantillas/` must not import from `panel/`.
- The match is `texto.toLocaleLowerCase('es').includes(termino)`. Test 1.9 uses `toLowerCase()` today, which gives the same result for these terms. It switches to this list, so there is a single copy of it.

## 3. Template routes (`src/plantillas/plantillas-rutas.ts`)

### 3.1 Projections and body

- `PlantillaCompleta` gains `titulo: true, descripcion: true`. `PlantillaResumen` does not change.
- `RegistroPlantillaBody` gains `titulo?: string | null; descripcion?: string | null`. `null` is allowed because the seed entries may carry it, and AJV can produce it after coercion.
- `registroPlantillaSchema`: both keys join `propertyNames.enum` (otherwise `removeAdditional` drops them silently) and `properties`, as `{ type: 'string' }`. Neither is in `required`.
- Fastify's AJV coerces types (`coerceTypes: 'array'`): a JSON `null` arrives as `""` and is stored as `null`, `5` arrives as `"5"`, and an object is refused. This is accepted behavior, and a test pins the `null` case.

### 3.2 Normalization and checks

```ts
export const LARGO_MAXIMO_TEXTO_CLIENTE = { titulo: 80, descripcion: 200 } as const;

/** Trimmed text, or `null` when absent, null or blank. */
export function textoCliente(valor: string | null | undefined): string | null
```

`rechazoDePlantilla` gains one step after AJV and before the SQL checks. For each of `titulo` and `descripcion`, on the normalized value:
- longer than its cap: the field joins `campos` in JSON-pointer form (`/titulo`, `/descripcion`), like `camposInvalidos` and the seed;
- contains forbidden terms: the field joins `campos` in the same form, and the terms join `terminos`, deduplicated.

When the step collects anything, the function returns `{ error: 'solicitud-invalida', campos, terminos? }`. The length goes through this code and not through AJV's `maxLength`, so it is measured after trimming, and the seed (section 5) runs the same code. AJV's `maxLength` would count the surrounding spaces.

### 3.3 Columns written

`datosDePlantilla` writes `titulo: textoCliente(cuerpo.titulo)` and `descripcion: textoCliente(cuerpo.descripcion)`. `PUT` keeps its single `update` with every column, so an omitted text becomes `null`, as the spec states.

## 4. Panel read (`src/panel/panel-automatizaciones.ts`)

### 4.1 Pure part

- `COPY_NEGOCIO` and `copyDe` are removed. `CopyNegocio` and `COPY_NEUTRO` stay.
- New `textoDe(p: { titulo: string | null; descripcion: string | null }): CopyNegocio | null` returns both texts trimmed, or `null` unless both are non-blank.
- `FilaAutomatizacion.plantilla` becomes `{ titulo: string | null; descripcion: string | null }`. `proyectarActiva` uses `textoDe(fila.plantilla) ?? COPY_NEUTRO`.
- `PlantillaCatalogo` becomes `{ id; titulo: string | null; descripcion: string | null }`.
- `proyectarDisponibles(plantillas, plantillaIdsActivas)`:
  1. `conTexto` = the templates with a non-null `textoDe`, paired with their key `clave = titulo.trim().toLocaleLowerCase('es')`.
  2. `clavesActivas` = the keys of the `conTexto` entries whose id is in `plantillaIdsActivas`.
  3. `candidatas` = the `conTexto` entries whose key is not in `clavesActivas`, sorted by `COLACION.compare(a.clave, b.clave)` (`const COLACION = new Intl.Collator('es')`), then by `id`.
  4. Deduplication by key keeps the first entry, which is the lowest `id` among equal keys. The output is `{ titulo, descripcion }` from `textoDe`.

  Sorting by the normalized key, not by the raw title, makes "the lower `id` wins" hold regardless of case. A template without texts can neither be listed nor hide anything.

### 4.2 Route

- **Q1** selects `plantilla: { select: { titulo: true, descripcion: true } }`. The slug is no longer read here.
- **Q4** becomes `prisma.plantilla.findMany({ where: { titulo: { not: null }, descripcion: { not: null } }, select: { id: true, titulo: true, descripcion: true } })`. Blank values are filtered by `textoDe`.
- **Q4 is unbounded.** The catalog is global and curated by P1 (a few dozen rows). Bounding it would let a truncated active template stop hiding its twins. The query count stays at five.
- The header comment of the route updates the Q4 line.

## 5. Seed (`src/plantillas/catalogo-inicial.ts`)

- Both `CATALOGO_INICIAL` entries gain the `titulo` and `descripcion` of the spec table.
- `CLAVES` derives from `PlantillaCompleta`, so the entries must carry the two keys (test U1 already enforces it).
- `rechazoDeEntrada` adds two `exigir` checks: `/titulo` and `/descripcion` must be a string or `null`. Length and glossary are then checked by `rechazoDePlantilla`, as for the route.
- `FilaCatalogo` follows `datosDePlantilla` with no change.

## 6. Tests

| File | Change |
|---|---|
| `src/compartido/glosario-panel.test.ts` (new) | `terminosProhibidosEn`: case-insensitive, several terms, a clean text gives `[]` |
| `src/panel/panel-automatizaciones.test.ts` | The `copyDe` block becomes `textoDe` (both texts, half-filled, blank, trimmed). `proyectarActiva` 1.4: text from the row, fallback with no text or half text. `proyectarDisponibles` 1.7/1.8: rewritten over titles (same-title dedup with the lowest id, case-insensitive key, a new title beside an active twin slug, title order). 1.9 uses `TERMINOS_PROHIBIDOS_PANEL` over `COPY_NEUTRO` and the frequencies. Route fixtures (`:432`) create templates with texts; 2.1 compares against those texts in title order |
| `src/aislamiento/aislamiento-panel.test.ts` | `montarAutomatizacion` gives each template a title; `titulo(slug)` reads the fixture texts instead of `COPY_NEGOCIO` |
| `src/plantillas/plantillas-rutas.test.ts` | Without DB: forbidden term (`terminos`), over cap, `propertyNames` keeps both keys. With DB: create with texts and a trimmed echo, create without texts gives `null`, blank gives `null`, a JSON `null` gives `null`, `PUT` without texts clears them, the summary keys are unchanged (`:236` stays as is). "3.1 a headerless create persists every field it echoes back" (`:215`) expects `titulo: null, descripcion: null` in its echo |
| `src/plantillas/catalogo-inicial.test.ts` | U1 compares the texts. A new unit test checks the seeded texts against the glossary and the caps. L1: the seeded rows carry the texts |
| `src/plantillas/migracion-textos-cliente.test.ts` (new, DB) | Inserts a `stock-fisico`, a `stock-producible` and a `reporte-diario` row with null texts, then runs the two `UPDATE` statements read from the migration file inside an interactive transaction. Each statement is narrowed with `AND "id" IN (<the three ids>)`, appended as a bound parameter list. Inside the transaction it asserts that the first two get their slug's texts and the third keeps `null`, then throws a sentinel error so the transaction rolls back. This checks the backfill SQL itself, which a fresh `test:db` database never exercises, without touching rows of the test files that run in parallel |

The 15 direct `plantilla.create` calls in other tests keep working, because the columns are nullable.

**Parallel test files.** `npm run test:db` runs every test file at once against one database (`scripts/test-db.mjs:64`), and `Plantilla` is global. With dedup by slug, «disponibles» could hold at most two items. With dedup by title, any titled template another file creates at the same moment shows up in it. Therefore:
- Every DB test that creates titled templates puts a per-file random tag in the title, e.g. `Aviso de prueba ${etiqueta}`. Tags must not contain a forbidden term.
- The panel route tests (2.1, 2.7, 2.10, 2.11) and the isolation tests 2.14 and 2.15 filter `disponibles` to the items of their own tag before comparing. 2.15 compares two bodies byte for byte; both reads see the same catalog only if no other file writes in between, so it compares the filtered lists instead.
- The neutral-fallback tests use templates without texts, which no other file can turn into templates with texts, now that the migration test rolls back.

## 7. Docs

`docs/guia/05-plantillas.md`, section "Alta y cambio":
- the two optional fields, their caps and the glossary rule;
- the `400` with `terminos`;
- the warning that a `PUT` without them clears them.

## 8. Rejected alternatives

- **AJV `maxLength`:** it counts untrimmed text, and the seed check would need to restate it.
- **Columns `NOT NULL DEFAULT ''`:** they hide the "no text" state behind a sentinel value.
- **Dedup by exact title:** «Aviso de stock bajo» and «aviso de stock bajo» would be two cards with the same meaning.
- **Glossary list in `panel/`:** `plantillas/` would have to import from `panel/`, inverting the domain dependency of DEC-181.

## 9. Size forecast

Migration 25, schema 4, glossary module 20, routes 35, panel 45, seed 12, tests ~240 (the per-file title tags add ~30), guide 15: **~395 changed lines**. One PR, right at the 400-line budget: if the tasks forecast passes it, the test-isolation work is the first candidate to move into a second PR.
