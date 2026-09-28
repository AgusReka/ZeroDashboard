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

## Remaining

Phases 4–6. Branches: `ch11/5-persistencia-guardadas`, `ch11/6-consola`, `ch11/7-verify-archivo`.
