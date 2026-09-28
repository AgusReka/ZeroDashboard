# Design: CH-11 — Query Parameters

## Technical Approach

A new pure module, `src/parametros.ts`, owns the declaration type, a plain-text scanner (no parser, DEC-09/47) and `prepararSentencia`. That function returns either a branded `SentenciaPreparada {texto, valores}` or a list of problems. Routes check container shape with Fastify schemas and delegate the rest. `ejecutarConsulta` accepts only a `SentenciaPreparada` and binds pagination at `$(n+1)/$(n+2)` (DEC-53). The rewrite only ever inserts `$k` tokens and never a value, so rule 4 holds by construction. With zero parameters, the text and binds are byte-identical to today.

## Architecture Decisions (implementation-level, within DEC-47..60)

| Topic | Choice | Rejected | Rationale |
|---|---|---|---|
| Execution input | `PeticionEjecucion.sentencia: SentenciaPreparada`, a brand that only `prepararSentencia` constructs | Keep `sql` and add optional values | Every execution passes through the scanner, so no future caller can skip DEC-59 |
| Sanitizing | The route runs `sanearSql` once, before preparing; `ejecutarConsulta` no longer calls it | Sanitize in both places | `sanearSql` is not idempotent (`SELECT 1;;`) |
| Bind order | `$k` = declaration index + 1; `valores` follow declaration order | Order of first appearance | Deterministic, and independent of how the SQL is laid out |
| Casts | None injected. Postgres infers types; the operator can write `:x::date` | `$k::tipo` | DEC-47 rewrites to `$n` only. An injected cast would change comparison semantics (`date` vs `timestamptz`) |
| `fecha` bind | The validated ISO string | `new Date()` | pg serializes a `Date` in the server's local time zone |
| Route schema | Containers and keys only. `tipo` is an `enum` with no `type`; `nombre` and the values carry no type | Full typing in AJV | Fastify's AJV has `coerceTypes` on (`true`→`"true"`, `null`→`""`), which would defeat DEC-60 |
| Error body | `400 {error:'solicitud-invalida', campos, problemas:[{parametro, motivo, campo}]}`, listing every problem in a fixed order | A new error code; reporting the first problem only | Keeps today's code (saved-queries spec) and `campos` contract; `problemas` names the parameter (DEC-51). Listing every problem follows CH-10 |
| Check order | Before `destinoDeConexion` | After the lookup | Mirrors the empty-`sql` check: nothing is dialed or executed |
| Save path | Create runs the static checks (shape, DEC-56/57/59) without values | Shape only | With no update route (DEC-10), a row that cannot execute could never be fixed |
| Persistence | `parametros Json @default("[]")`, projected by create and get-by-id | Also on the list | The list stays metadata-only; CH-05 test 2.6 pins its keys |
| Logging | Values are never logged | — | Rule 5 |

## Scanner

| State | Enter | Exit |
|---|---|---|
| normal | — | Consumes words `[\p{L}\p{N}_$]+` whole, so `a$1` is an identifier |
| string | `'` (also after `B`/`X`/`U&`) | `'` not followed by `'` |
| escape string | the word `E`/`e` directly before `'` | an unescaped `'`; `\` escapes the next character |
| quoted identifier | `"` | `"` not followed by `"` |
| line comment | `--` | `\n` or `\r` |
| block comment | `/*` | the matching `*/`, with a depth counter because comments nest |
| dollar quote | `$tag$`, where tag is `([A-Za-z_][A-Za-z0-9_]*)?` | the same `$tag$` |

In the normal state:
- `::` is a cast.
- `:` followed by `[A-Za-z_][A-Za-z0-9_]*` is a marker.
- `$` followed by digits is a hand-written bind (DEC-59).
- Any other `:` or `$` is literal.

An unterminated construct runs to the end of the text, and Postgres rejects it (`error-sintaxis`). A name matches exactly (case-sensitive) and must satisfy `^[A-Za-z_][A-Za-z0-9_]*$`.

**Documented limits (rule 6):**
- In `arr[lo:hi]`, `:hi` is read as a marker. DEC-57 rejects it loudly; the workaround is `lo : hi`.
- `standard_conforming_strings=off` is not modeled.

## Data Flow

    Client ─POST /consultas/ejecutar─▶ AJV (containers) ─▶ sanearSql ('' → 400)
      ─▶ prepararSentencia ── problems ─▶ 400 solicitud-invalida (nothing dialed)
      ─▶ destinoDeConexion [+tenantId] → 404 | 409
      ─▶ ejecutarConsulta({sentencia}) ─▶ BEGIN READ ONLY → set_config → DEC-08
           text:   SELECT * FROM (<texto>) AS _consulta_usuario LIMIT $(n+1) OFFSET $(n+2)
           values: [...valores, limiteEfectivo+1, desplazamiento] ─▶ Tenant PG
      ◀─ 200 ok | 200 fallo (22xxx → error-datos: Postgres is the final arbiter)

    POST /consultas-guardadas ─▶ AJV ─▶ sanearSql ─▶ analizarSentencia ─▶ create {…, parametros}

## Interfaces / Contracts

```ts
export const TIPOS_PARAMETRO = ['texto', 'numero', 'booleano', 'fecha'] as const;
export type TipoParametro = (typeof TIPOS_PARAMETRO)[number];
export interface DeclaracionParametro { nombre: string; tipo: TipoParametro } // reused by CH-12 (DEC-52)
export type ValorParametro = string | number | boolean;
export type MotivoParametro =
  | 'nombre-invalido' | 'nombre-duplicado' | 'tipo-desconocido'
  | 'posicional-a-mano' | 'sin-declarar' | 'sin-usar'            // DEC-59, 57, 56
  | 'valor-faltante' | 'valor-no-declarado' | 'valor-invalido';  // DEC-50, 58, 60
export interface ProblemaParametro { parametro: string | null; motivo: MotivoParametro; campo: string }
declare const marca: unique symbol;
export interface SentenciaPreparada { readonly texto: string; readonly valores: readonly ValorParametro[]; readonly [marca]: true }
export type Resultado<T> = { ok: true; valor: T } | { ok: false; problemas: ProblemaParametro[] };
export function validarDeclaracion(e: unknown): Resultado<DeclaracionParametro[]>;
export function analizarSentencia(sql: string, d: readonly DeclaracionParametro[]): ProblemaParametro[];
export function prepararSentencia(sql: string, decl: unknown, valores: unknown): Resultado<SentenciaPreparada>;
```

**Value shapes (DEC-60):**
- `texto`: a string.
- `numero`: a finite number.
- `booleano`: a boolean.
- `fecha`: a string matching `^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})?)?$`. Calendar validity (`2026-02-30`) is left to Postgres.

The value map is read with `Object.keys` into a `Map` and is never indexed by a user-supplied key.

**Request bodies:**
- `/consultas/ejecutar` gains `parametros?` (default `[]`) and `valores?: object` (default `{}`).
- `/consultas-guardadas` gains `parametros?` in both `properties` and `propertyNames`. It has no `valores`.

## Console

The declaration editor sits inside `#formulario`. Each row has a `nombre` input, a `tipo` select, a value control and a `type="button"` Quitar button; an Agregar parámetro button adds rows. The value control depends on `tipo`:
- `texto`: a text input, sent verbatim.
- `numero`: a text input. It is sent as `Number()` when the result is finite; otherwise the raw string is sent, so the server names the problem.
- `booleano`: a select with a blank option, `true` and `false`.
- `fecha`: a text input with an ISO placeholder.

A blank value omits the key, and the server answers `valor-faltante`. The browser does no scanning. Save sends the declaration only. Load rebuilds the rows from `parametros` with empty values. Switching tenant clears the rows. Each entry of `problemas` renders as one legible line through `textContent`.

## File Changes

| File | Action | Description |
|---|---|---|
| `src/parametros.ts` (+ test) | Create | Types, scanner, rewrite, validation |
| `src/consulta-ejecucion.ts` | Modify | Takes `sentencia`; DEC-53 numbering |
| `src/consultas.ts` | Modify | Schema, preparation step, `400` |
| `src/consultas-guardadas.ts` | Modify | Schema, static check, projection |
| `prisma/schema.prisma`, `prisma/migrations/20260927000000_consulta_parametros/` | Modify / Create | JSONB column |
| `src/consola.ts` (+ test) | Modify | Editor, values, `problemas` messages |
| `src/consultas.test.ts`, `src/consultas-guardadas.test.ts` | Modify | Integration cases |

## Testing Strategy

Tests use `node:test` and `inject()`. Integration suites run against a live PostgreSQL and skip when it is unreachable.

| Layer | What | Approach |
|---|---|---|
| Unit | Every scanner row plus the spec scenarios: `E'\':x'`, nested `/* /* */ :x */`, `$t$ :x $t$`, `a$1`, `:=`, `arr[1:2]`, unterminated constructs, a repeated name, zero-parameter identity (`texto === input`), every `motivo`, and the DEC-60 accept/reject table (`"10"`, `null`, `1e400`, `27/09/2026`) | `parametros.test.ts` |
| Integration | Each `tipo` filters rows; page 2 with two parameters (`$3/$4`); `O'Brien` and `; DROP TABLE` come back as data and the table is intact; `:x` inside a literal comes back verbatim; `2026-02-30` and `1.5` against an int column return `200 fallo error-datos`; each `400` against a closed-port connection proves nothing was dialed; a foreign `conexionId` returns `404` | `consultas.test.ts`; existing cases unedited |
| Integration | Round trip of the declaration; omitted `parametros` stores `[]`; shape and DEC-56/57/59 failures return `400` and create no row; the list keys are unchanged | `consultas-guardadas.test.ts` |
| Console | Rendering, a map with correct JSON types, omitted blanks, save/load, `problemas` shown through `textContent`, document guards | `consola.test.ts` (extended DOM stub) |

## Threat Matrix

N/A for shell, subprocess, VCS/PR and file classification. SQL boundary rows:

| Case | Response | RED test |
|---|---|---|
| A value reaching SQL text | Only `$k` is inserted | Unit: the text never contains the value; integration: `; DROP` |
| A hand-written `$1` hijacking `LIMIT` | `400 posicional-a-mano` | Unit and integration |
| `:x` inside a literal, comment or `$$` | State machine | Unit edge table |
| `"10"` or `null` coerced | No scalar typing in the schema | Route test |
| A foreign `conexionId` | `404`, nothing dialed | Integration |

## Migration / Rollout

`ALTER TABLE "ConsultaGuardada" ADD COLUMN "parametros" JSONB NOT NULL DEFAULT '[]';` backfills every existing row. Rollback is `DROP COLUMN`. During apply, verify that Prisma 7 emits exactly this statement for `Json @default("[]")`.

Five stacked PRs of at most 400 lines each: (1) scanner and rewrite, with edge tests; (2) validation and `prepararSentencia`; (3) execution wiring; (4) saved-query persistence; (5) console. The pure module plus its tests exceeds one budget, so it is split in two.

## Open Questions

None. The spec was aligned with this design on 2026-09-27: the wrapper alias is `_consulta_usuario`, the console sends values on execute only (save sends the declaration only, DEC-48), and names match `^[A-Za-z_][A-Za-z0-9_]*$`, case-sensitive and unique within a declaration.

Validator notes (2026-09-27), settled here:
- `n` reported to the caller is `SentenciaPreparada.valores.length`; the pagination binds are `$(valores.length+1)` and `$(valores.length+2)`.
- The connection lookup stays tenant-scoped with parameters present: `destinoDeConexion` and its tenant filter are unchanged, and parameter checks run before it.
- "No casts injected" is an implementation corollary of DEC-47 (the rewrite emits only `$k`), DEC-51 (Postgres is the final arbiter of conversion) and DEC-60 (no implicit conversions), not a new architecture decision.
