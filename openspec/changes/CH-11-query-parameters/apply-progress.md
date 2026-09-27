# Apply Progress: CH-11 — Query Parameters

**Mode**: Standard (strict TDD disabled). Delivery: auto-chain, stacked-to-main.

## Work Unit 1 — Scanner + `:nombre` → `$k` rewrite (branch `ch11/1-escaner-reescritura`)

Status: complete. Tasks 1.1–1.8 marked `[x]` in `tasks.md`.

### Files

| File | Action | What |
|---|---|---|
| `src/parametros.ts` | Created | `escanearSentencia` (state machine: normal, string, escape string, quoted identifier, line comment, nested block comment, dollar quote) reporting `Marcador[]` and `PosicionalAMano[]`; `reescribirMarcadores(sql, nombres)` returning `{texto, n}` |
| `src/parametros.test.ts` | Created | 38 `node:test` cases: every scanner state, `::cast`, `:=`, case-sensitive names, `a$1`, `arr[1:2]`, `arr[lo:hi]` limit, unterminated constructs, repeated name, declaration-order `$k`, zero-parameter byte identity |

### Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test | `npx tsx --test src/parametros.test.ts`: 38 pass, 0 fail |
| Mutation check | Disabling block-comment nesting and the `E'` prefix made 4 tests fail (34/38); restored |
| Typecheck | `npx tsc --noEmit`: exit 0 |
| Full suite | `npm test`: 219 pass, 11 fail, 136 cancelled. Base without this unit: 181 pass, 11 fail, 136 cancelled. Same failure set, all `28P01` password authentication failed against the local PostgreSQL (environmental) |
| Runtime harness | N/A — pure functions, no database or route consumes them yet |
| Rollback boundary | Delete `src/parametros.ts` and `src/parametros.test.ts`; nothing imports them |

### Interface for Unit 2

- `escanearSentencia(sql): { marcadores: {nombre, inicio, fin}[]; posicionales: {texto, inicio, fin}[] }` — feeds DEC-56 (`sin-usar`), DEC-57 (`sin-declarar`), DEC-59 (`posicional-a-mano`).
- `reescribirMarcadores(sql, nombres)` — `$k` = index in `nombres` + 1; undeclared markers left verbatim (caller rejects first); throws on duplicate `nombres` (programming error; `validarDeclaracion` guarantees uniqueness).

### Deviations

- Task 1.3 says `arr[1:2]`'s `:2` reads as a marker. The design grammar (`:` + `[A-Za-z_][A-Za-z0-9_]*`) makes `:2` literal; the documented limit is `arr[lo:hi]` (`:hi` is a marker). Implemented and tested per design: `arr[1:2]` has no marker, `arr[lo:hi]` yields `hi`, `arr[lo : hi]` yields none.
- Escape strings also treat a doubled `''` as an embedded quote (Postgres behavior), in addition to the design's `\` escape.

### Budget

Unit code + tests: 403 lines (234 + 169), plus bookkeeping (`tasks.md`, this file). Slightly above 400; not compressed per the budget rule.

## Work Unit 2a — Declaration + static analysis (branch `ch11/2-validacion-preparacion`)

Status: complete. Tasks 2.1–2.4 `[x]`. Unit 2 as a whole was 405 code+test lines, so it was sliced once: 2a (this commit) and 2b (2.5–2.11).

- `src/parametros.ts`: `TIPOS_PARAMETRO`, `DeclaracionParametro`, `MOTIVOS_PARAMETRO`/`MotivoParametro` (the const array fixes the problem order), `ProblemaParametro {parametro, motivo, campo}` (`campo` is a JSON pointer: `/parametros/i/nombre|tipo`, `/sql`), `Resultado<T>`, `validarDeclaracion`, `analizarSentencia`.
- `src/parametros.test.ts`: +9 cases (47 total).
- Choices: `parametro` of `posicional-a-mano` is the token text (`$1`); each distinct token or name is reported once; a non-list declaration is `nombre-invalido` at `/parametros`.

| Evidence | Value |
|---|---|
| Focused test | `npx tsx --test src/parametros.test.ts`: 47 pass, 0 fail |
| Typecheck | `npx tsc --noEmit`: exit 0 |
| Full suite | `npm test` (live DB on :5434): 375 pass, 0 fail (baseline 366) |
| Runtime harness | N/A — pure functions, nothing consumes them yet |
| Rollback boundary | Revert this commit's additions to `src/parametros.ts`/test; the unit 1 scanner is unaffected |

## Unit 2b — `ch11/3-valores-preparacion`

Tasks 2.5–2.11: `ValorParametro`, branded `SentenciaPreparada`, DEC-60 value shapes, `validarValores`, `prepararSentencia`. Popped from the stash onto its own branch (the whole of unit 2 was 405 code+test lines). Choices: an invalid declaration is reported alone; a non-object value map is `valor-invalido` at `/valores`.

| Evidence | Value |
|---|---|
| Focused test | `npx tsx --test src/parametros.test.ts`: 57 pass, 0 fail |
| Typecheck | `npx tsc --noEmit`: exit 0 |
| Full suite | `npm test` (live DB on :5434): 385 pass, 0 fail |

## Unit 3 — `ch11/4-ejecucion`

Tasks 3.1–3.7. `PeticionEjecucion.sentencia: SentenciaPreparada` replaces `sql`; exported pure `sentenciaPaginada` numbers `LIMIT $(n+1) OFFSET $(n+2)` (DEC-53); `ejecutarConsulta` no longer calls `sanearSql`. The route sanitizes once, runs `prepararSentencia` before `destinoDeConexion`, and answers `400 {error, campos (deduplicated), problemas}`. Schema: `parametros` items `{nombre: {}, tipo: {enum}}`, `valores: object`, defaults `[]`/`{}`.

- "Nothing dialed" is proven with an unreadable-credential row (a lookup would answer `409`), not a closed port: stronger, since not even the lookup runs.
- Unknown `tipo` is refused by the schema enum (`campos: ['/parametros/0/tipo']`, no `problemas`), per design.
- Test fixture gains `ch04_pruebas.evento` (one column per `tipo`); existing cases unedited.

| Evidence | Value |
|---|---|
| Focused test | `npx tsx --test src/consulta-ejecucion.test.ts src/consultas.test.ts` (live DB :5434): 74 pass, 0 fail |
| Mutation check | Hard-coding `LIMIT $1 OFFSET $2` fails 5 tests (1 unit, 4 integration); restored |
| Typecheck | `npx tsc --noEmit`: exit 0 |
| Full suite | `npm test` (live DB :5434): 395 pass, 0 fail (baseline 385) |
| Runtime harness | `app.inject()` against live PostgreSQL 16 (8 CH-11 route cases) |
| Rollback boundary | Revert `src/consulta-ejecucion.ts`, `src/consultas.ts` and their tests; `src/parametros.ts` stays correct unconsumed |

## Unit 4 — `ch11/5-persistencia-guardadas`

Tasks 4.1–4.6. `ConsultaGuardada.parametros Json @default("[]")`; migration `20260927000000_consulta_parametros` (DEC-55). The create schema gains `parametros` (same shape as `/consultas/ejecutar`, default `[]`, listed in `propertyNames`); create runs `validarDeclaracion` then `analizarSentencia` on the sanitized statement (no values) and answers `400 {error, campos, problemas}`; it persists the validated copy. `ConsultaGuardadaCompleta` projects `parametros`; the list projection is unchanged.

- `prisma migrate diff --from-schema <HEAD schema> --to-schema prisma/schema.prisma --script` emitted exactly `ALTER TABLE "ConsultaGuardada" ADD COLUMN "parametros" JSONB NOT NULL DEFAULT '[]';` (Prisma pads the spaces after `COLUMN`). Applied to the :5434 test DB with `prisma migrate deploy`; client regenerated with `prisma generate` (untracked output).
- Backfill checked in a rolled-back transaction (the test DB had no rows): a pre-existing row kept its `sql` and read `parametros = []`.
- The JSON write needs `as unknown as Prisma.InputJsonValue`, following CH-10's `diagnosticoValidacion` (an interface has no index signature).

| Evidence | Value |
|---|---|
| Focused test | `npx tsx --test src/consultas-guardadas.test.ts` (live DB :5434): 22 pass, 0 fail (4 RED before the route change; 4.4 is a regression guard and passed before) |
| Mutation check | Dropping the `analizarSentencia` call fails 1 test (21/22); restored |
| Typecheck / schema | `npx tsc --noEmit`: exit 0. `npx prisma validate`: valid |
| Full suite | `npm test` (live DB :5434): 400 pass, 0 fail (baseline 395) |
| Runtime harness | `app.inject()` against live PostgreSQL 16 (5 CH-11 route cases) |
| Rollback boundary | Revert `src/consultas-guardadas.ts`/test and the schema line; `ALTER TABLE "ConsultaGuardada" DROP COLUMN "parametros";` then delete the migration directory |

## Unit 5a — `ch11/6-consola`

Tasks 5.1–5.3 and the tenant-switch half of 5.4. `#formulario` gains `#parametros` rows (nombre input, tipo select, value control labeled with the nombre, Quitar) and `#agregar-parametro`. Execute sends `parametros` + `valores` (DEC-60 JSON types: `numero` as `Number()` when finite else the raw text, `booleano` as boolean, `fecha` trimmed, `texto` verbatim; a blank omits the key; the map has no prototype so `__proto__` stays a key). Save sends the declaration only (DEC-48); load rebuilds the rows with empty values; switching tenant clears them.

- Sliced once: the whole phase was 396 code+test lines before bookkeeping. Deferred to 5b (~85 lines): a `MENSAJES_PARAMETRO` map and a shared `mensajeDeSolicitudInvalida(cuerpo, declaracionEnviada)` for execute and save — one `textContent` line per `problemas` entry, `«nombre»: <sentence>` (null `parametro` reads "Declaración de parámetros"), and a `campos`-only schema 400 mapping `/parametros/i/<campo>` to the name sent at index i (the newline escape must be written doubled in the TS source, since the document is a template literal). Until then a 400 shows the existing `campos` message, which carries `/valores/<nombre>`.

| Evidence | Value |
|---|---|
| Focused test | `npx tsx --test src/consola.test.ts`: 15 pass, 0 fail (4 new cases RED before the change) |
| Mutation check | Sending `numero` as raw text fails 1 test; restored |
| Typecheck / full suite | `npx tsc --noEmit`: exit 0. `npm test` (live DB :5434): 404 pass, 0 fail (baseline 400) |
| Runtime harness | N/A — the served script runs over the DOM stub; no live server |
| Rollback boundary | Revert `src/consola.ts` and `src/consola.test.ts`; units 1–4 are unaffected |

## Unit 5b — `ch11/7-consola-errores`

Tasks 5.4 (the `problemas` half), 5.5, 5.6. `MENSAJES_PARAMETRO` (one sentence per motivo) and `mensajeDeSolicitudInvalida(cuerpo, declaracion)`, shared by the execute and save `400` branches: a heading plus one line per `problemas` entry, `Parámetro «nombre»: <sentence>.` (null `parametro` reads `Declaración de parámetros`; an unknown motivo reads `no es válido`); a `campos`-only body maps `/parametros/i/<campo>` to `el <campo> del parámetro «<name sent at i>»`, other paths stay verbatim. Both flows capture the declaration they send in a local, so the mapping uses exactly what was submitted. Only known body fields are read: a `stack` never reaches the page. The banner already had `white-space: pre-wrap`, so the lines render.

| Evidence | Value |
|---|---|
| Focused test | `npx tsx --test src/consola.test.ts`: 17 pass, 0 fail (2 new cases RED before the change) |
| Mutation check | Disabling the index-to-name mapping fails 1 test; restored |
| Typecheck / full suite | `npx tsc --noEmit`: exit 0. `npm test` (live DB :5434): 406 pass, 0 fail (baseline 404) |
| Runtime harness | N/A — the served script runs over the DOM stub; no live server |
| Rollback boundary | Revert this commit's `src/consola.ts`/test hunks; the 400 falls back to the raw `campos` message and 5a is unaffected |

## Remaining

Phase 6 (full-suite checkpoint, verify, archive) on `ch11/8-verify-archivo`.
