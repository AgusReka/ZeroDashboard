# Design: CH-25 — Versioning of saved queries

Decisions: DEC-146 (current row + history table), DEC-147 (restore creates a new version), DEC-148 (optional note, no author), DEC-149 (plain-text side-by-side comparison), DEC-150 (full edit and the route contract). No new architecture decision is introduced here.

## 1. Modules

| File | Role |
|---|---|
| `prisma/schema.prisma` + new migration | `ConsultaGuardada.version`, `.nota`; table `ConsultaGuardadaVersion` |
| `src/aislamiento-prisma.ts` | `ConsultaGuardadaVersion` joins `MODELOS_AISLADOS` |
| `src/consultas-versiones.ts` (new) | Pure: shared body validation, `mismoContenido`, `resolverNota`, `analizarVersion` |
| `src/consultas-guardadas.ts` | The create route calls the shared validation; adds `PUT`, two `GET` and `POST .../restaurar` |
| `src/consola.ts` | "Versiones" panel, comparison, restore, save-as-version |

`src/generated/prisma` is gitignored: `npm run prisma:generate` after the schema change.

## 2. Schema and migration

```prisma
model ConsultaGuardada {
  ...                       // unchanged columns
  version   Int     @default(1)
  nota      String?         // how the current version was reached; null for version 1
  versiones ConsultaGuardadaVersion[]
}

model ConsultaGuardadaVersion {
  id                 String   @id @default(uuid())
  tenantId           String
  tenant             Tenant   @relation(fields: [tenantId], references: [id])
  consultaGuardadaId String
  consultaGuardada   ConsultaGuardada @relation(fields: [consultaGuardadaId], references: [id], onDelete: Restrict)
  version            Int
  nombre             String
  descripcion        String?
  sql                String
  parametros         Json
  nota               String?
  desde              DateTime   // the instant this state became current

  @@unique([consultaGuardadaId, version])
  @@index([tenantId])
}
```

The migration is additive: two columns with defaults on an existing table and one new table, with its rollback in the header. Existing rows are valid with no backfill (version 1, no history). `Tenant` gains the back-relation field. Every foreign key is RESTRICT, as in the rest of the schema, so nothing can be deleted from under the history.

## 3. Pure layer (`src/consultas-versiones.ts`)

- `validarCuerpoConsulta(body)`: the checks the create route does today, extracted without changing behaviour (sanitized statement non-empty, `validarDeclaracion`, `analizarSentencia`, blank description to null). Returns `{ ok: true, datos: { nombre, descripcion, sql, parametros } }` or `{ ok: false, cuerpo }` with the exact 400 bodies the create gives now; both `POST` and `PUT` use it.
- `resolverNota(nota)`: `undefined`, `null` or blank gives `null`; a string up to 500 characters, trimmed, is kept; anything else (non-string, over 500) names `/nota`.
- `mismoContenido(actual, nuevo)`: equal `nombre`, `descripcion` (both normalized), `sql` (verbatim, no trimming) and `parametros` (deep equal on the `{nombre, tipo}` list in order). The note is not part of the comparison: a note alone never creates a version.
- `analizarVersion(texto)`: `:version` is a positive integer written as digits only (no sign, decimal, exponent or leading zeros, at most 9 digits), otherwise `null`; the routes answer 404 `version-no-encontrada`. Characters are checked one by one with a digit string, with no pattern literal, as the console script does.

## 4. Routes (`src/consultas-guardadas.ts`)

All run under the tenant header like the existing ones (`/consultas-guardadas/*` is not exempt, so the hooks resolve the tenant and the scoped client filters by it).

Body schema for `PUT`: the create schema plus `nota: {}`; `additionalProperties: false`, `propertyNames` with `nombre, descripcion, sql, parametros, nota`, every property listed (the CH-23 lesson). `nota` has no type so AJV cannot coerce; `resolverNota` checks it.

**Atomicity.** Edit and restore run in `prisma.$transaction(async (tx) => ...)`. Before building on it, a test proves the isolation extension applies inside the interactive transaction (a foreign id resolved through `tx` must give `null`); if it did not, the transaction would be rejected and this section reopened. Inside: read the row through `tx` (404 if missing), then `consultaGuardadaVersion.create` with the row's current state (`version`, content, `nota`, `desde: actualizadaEn`), then `consultaGuardada.update` with the new content and `version: version + 1`. The unique `(consultaGuardadaId, version)` turns a concurrent double edit into a `P2002`, mapped to 409 `conflicto-de-edicion`, and the rollback leaves the row untouched.

- `PUT /:id`: validate the body (400), `resolverNota` (400 `/nota`), then the transaction; if `mismoContenido` the answer is 409 `sin-cambios` before any write. Answer `200 { consultaGuardada }` with `ConsultaGuardadaCompleta` extended by `version` and `nota`.
- `GET /:id/versiones`: read the row through the scoped model (404), then `consultaGuardadaVersion.findMany({ where: { consultaGuardadaId }, select: sin sql, orderBy: version desc, take: LIMITE_LISTADO })`; the current version is prepended from the row (`esActual: true`, `fecha: actualizadaEn`); `truncado` when the history exceeds `LIMITE_LISTADO - 1`.
- `GET /:id/versiones/:version`: `analizarVersion`, then the row (404), then the current version from the row if the number matches, otherwise the history entry (404 `version-no-encontrada`). Full content including `sql`.
- `POST /:id/versiones/:version/restaurar`: `analizarVersion`, body `{ nota? }` strict, then the transaction: 409 `version-vigente` if the number is the current one, 404 `version-no-encontrada` if it is not in the history, otherwise archive the current state and update the row with the chosen version's `nombre`, `descripcion`, `sql`, `parametros` copied as stored.

`parametros` leaves the database as JSON and is written back unchanged, so a restore copies it without revalidating (it passed validation when it was saved).

## 5. Console (`src/consola.ts`)

- `consultaCargada` (`{ id }` or null) is set by `cargarGuardada` and cleared on tenant switch and after a failed load. With it set, a "Guardar como nueva versión" button and a note field (`type="text"`, `maxlength="500"`) appear in the saved-queries section; without it they are hidden. The button sends `PUT` with the same body `guardar()` builds plus the note.
- Each list entry gets a "Versiones" button next to "Cargar". It fills a panel `#versiones` below the list: one row per version (`Versión 3`, the date as the API returns it, the note, and a "Vigente" state with an icon and text). Non-current rows carry "Comparar con la actual" and "Restaurar".
- "Comparar con la actual" calls `GET .../versiones/<n>` and `GET .../versiones/<actual>` and renders two blocks (`<pre>` with `textContent`): title `Versión N`, then name, description, statement and declared parameters as text. No diff.
- "Restaurar" turns the row into a confirmation: a button «Restaurar versión N» and «Cancelar». Confirming sends the request, then refreshes the panel and the list and shows «Se creó la versión M con el contenido de la versión N.».
- State icons reuse the page's local-class approach from CH-24 (guard G3' forbids any shared `zd-*` class in the script); new ids are registered in the test harness `IDS`, and the fake DOM needs nothing beyond `createElementNS`, which CH-24 added.
- The section help text becomes: «Guarda la sentencia que está ahora en el editor. Podés editar una consulta guardada y cada cambio queda como una versión; no se puede borrar.»

## 6. Tests

- `consultas-versiones.test.ts` (pure): validation parity with the create bodies, notes (blank, 500, 501, non-string), `mismoContenido` (whitespace in the statement counts, parameter order counts, a note alone does not), `analizarVersion` (`0`, `-1`, `1.5`, `abc`, `007`, `1e3`, ten digits).
- `consultas-versiones-rutas.test.ts` (live database): each spec scenario for the four routes, the transaction guard (a pre-inserted conflicting history row gives 409 and the row stays at its version), byte-for-byte restore (trailing `;`, tabs, CRLF), nothing deleted by restore, and a two-tenant block on every route (404 identical to unknown, the other tenant's row and history untouched).
- `aislamiento-prisma` unit/live test: `ConsultaGuardadaVersion` is scoped, including inside `$transaction`.
- `consola.test.ts`: panel rows and "Vigente" with icon and text, the single-version text, compare blocks, hostile statement as text, confirmation (button text repeats action and object, cancel sends nothing, confirm sends once), refusals, save-as-version body and note, 409 messages, tenant switch clears everything. The existing assertion that the saved-queries help says «No se puede editar» is updated.

## 7. Trade-offs

- Two places hold content (the row for the current version, the table for the past ones); every history read joins them in code. Accepted in DEC-146.
- Restore and edit share one private archive-and-update helper so the two paths cannot diverge.
- History is unbounded per query (DEC-147); the list cap is the only limit.

## 8. Size forecast

Production: ~130 server lines for the pure module and the schema, ~170 for the four routes, ~220 for the console. With tests x1.7 about 1400 in all, so four chained PRs (`tasks.md`).
