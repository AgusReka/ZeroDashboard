# Tasks: CH-11 — Query Parameters

Derived from `design.md`. Verification tasks map to scenarios in `specs/query-parameters/spec.md`,
`specs/query-execution/spec.md`, `specs/saved-queries/spec.md`, and `specs/query-console/spec.md`.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~750–950 total (scanner+rewrite ~250, validation+`prepararSentencia` ~250, execution wiring ~150, saved-query persistence incl. migration ~150, console ~150) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (scanner+rewrite) → PR 2 (validation+`prepararSentencia`) → PR 3 (execution wiring) → PR 4 (saved-query persistence) → PR 5 (console) → PR 6 (full-suite checkpoint, verify, archive) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

`src/parametros.ts` plus its unit tests exceeds one 400-line budget on its own (design "Migration /
Rollout"), so it is split into PR 1 (the scanner state machine and the `:nombre`→`$k` text rewrite,
tested directly against every edge case) and PR 2 (`validarDeclaracion`, `analizarSentencia`,
`prepararSentencia`, value-shape checks, composed on top of PR 1's scanner). PR 3 wires the branded
`SentenciaPreparada` into `ejecutarConsulta`/`paginar` and `POST /consultas/ejecutar`. PR 4 adds the
additive `parametros` migration and the create/get-by-id projection. PR 5 is console-only. PR 6 has no
production code: full-suite checkpoint, `sdd-verify`, `sdd-archive` (mirrors CH-10's `4217d8d`/`7cc19c7`
verify-report-then-archive pair on one branch).

Threat Matrix rows carried as RED tests below: a value reaching SQL text (2.8, 3.5), a hand-written `$1`
hijacking `LIMIT` (2.4), `:x` inside a literal/comment/`$$` (1.2), `"10"`/`null` coerced (2.7), a foreign
`conexionId` (3.5). The Shell/VCS/PR/file-classification row is `N/A` per design and is omitted.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Scanner state machine + `:nombre`→`$k` rewrite in `src/parametros.ts` | `ch11/1-escaner-reescritura` (base `ch10/6-archivo`) | `npm test -- src/parametros.test.ts` | N/A — pure functions, no database | Delete `src/parametros.ts` and its test; nothing references it yet |
| 2 | `validarDeclaracion`, `analizarSentencia`, `prepararSentencia`, value-shape checks | `ch11/2-validacion-preparacion` (base unit 1) | `npm test -- src/parametros.test.ts` | N/A — pure functions, no database | Revert the additions to `src/parametros.ts`/test; unit 1's scanner is unaffected |
| 3 | `PeticionEjecucion.sentencia`, DEC-53 numbering, `/consultas/ejecutar` wiring | `ch11/3-ejecucion` (base unit 2) | `npm test -- src/consulta-ejecucion.test.ts src/consultas.test.ts` | `app.inject()` against live PostgreSQL, skipped when unreachable | Revert `src/consulta-ejecucion.ts`/`src/consultas.ts`; units 1–2 stay correct unconsumed |
| 4 | `parametros` migration + `src/consultas-guardadas.ts` schema/projection | `ch11/4-persistencia-guardadas` (base unit 3) | `npx prisma validate && npm test -- src/consultas-guardadas.test.ts` | `app.inject()` against live PostgreSQL, skipped when unreachable | `DROP COLUMN "parametros"` down migration; revert the route module |
| 5 | Console declaration editor in `src/consola.ts` | `ch11/5-consola` (base unit 4) | `npm test -- src/consola.test.ts` | N/A — DOM stub, no live server | Revert `src/consola.ts`/its test; units 1–4 are unaffected |
| 6 | Full-suite checkpoint, verify report, archive | `ch11/6-verify-archivo` (base unit 5) | `npm test` (full suite) | N/A — docs/verification only | Revert the archive move and bitácora entry |

## 1. Parameter Scanner & Rewrite (`src/parametros.ts` part 1)

- [x] 1.1 RED: `src/parametros.test.ts` — the scanner recognizes `:nombre` in the normal state; `::cast` is unchanged and not treated as a placeholder (spec "Cast operator is not rewritten")
- [x] 1.2 RED extend: a colon inside a single-quoted string, an `E'...'` escape string, a double-quoted identifier, a `--` line comment, a nested `/* /* */ */` block comment, and a `$$...$$`/`$tag$...$tag$` dollar-quoted block is never rewritten (spec 4 colon-inside-* scenarios; design Scanner table)
- [x] 1.3 RED extend: `a$1` scans as one identifier, not a hand-written bind; `arr[1:2]`'s `:2` reads as a marker (documented limit, design "Documented limits")
- [x] 1.4 RED extend: an unterminated string/comment/dollar-quote runs to end-of-text without throwing (design "An unterminated construct...")
- [x] 1.5 RED extend: `WHERE a = :x OR b = :x` rewrites both occurrences to the same `$1` (spec "Repeated name bound once")
- [x] 1.6 RED extend: zero markers and zero declared parameters leave the text byte-identical, `n === 0` (spec "Zero declared parameters yields n = 0")
- [x] 1.7 Implement the scanner state machine (design Scanner table: normal/string/escape-string/quoted-identifier/line-comment/block-comment/dollar-quote) and the marker rewrite that emits `$k` per assigned order in `src/parametros.ts`, satisfying 1.1–1.6
- [x] 1.8 Checkpoint: `npx tsc --noEmit` clean; `npm test -- src/parametros.test.ts` green

## 2. Declaration Validation & `prepararSentencia` (`src/parametros.ts` part 2)

- [x] 2.1 RED extend `src/parametros.test.ts`: `validarDeclaracion` accepts `[{nombre,tipo}]`; rejects an unknown `tipo` (DEC-49), a malformed `nombre`, and a duplicate `nombre`, each naming the entry (spec "Valid declaration accepted", "Unknown tipo rejected")
- [x] 2.2 RED extend: `analizarSentencia` reports `sin-usar` for a declared name with no `:nombre` marker (DEC-56, spec "Unused declaration rejected")
- [x] 2.3 RED extend: `analizarSentencia` reports `sin-declarar` for a `:y` marker absent from the declaration (DEC-57, spec "Undeclared marker rejected")
- [x] 2.4 RED extend: `analizarSentencia` reports `posicional-a-mano` for a `$1`-shaped token outside literal/comment/dollar-quote, with or without any declared parameter (DEC-59, both spec hand-written-bind scenarios)
- [x] 2.5 RED extend: `prepararSentencia` reports `valor-no-declarado` for a value-map key absent from the declaration (DEC-58, spec "Extra value rejected")
- [x] 2.6 RED extend: `prepararSentencia` reports `valor-faltante` for a declared name with no value key (DEC-50)
- [x] 2.7 RED extend: the DEC-60 value-shape table — `texto` string, `numero` finite JSON number only (`"10"` rejected), `booleano` JSON boolean, `fecha` ISO date/date-time regex (`27/09/2026`, `1e400` rejected as `valor-invalido`) (spec "Wrong shape rejected before execution", "Correct shape passed through to Postgres")
- [x] 2.8 RED extend: a value in `SentenciaPreparada.valores` never appears in `.texto`, including for `O'Brien`/`; DROP TABLE` values (spec "Value never appears in generated SQL text", rule 4)
- [x] 2.9 RED extend: `prepararSentencia` returns every problem in one fixed-order list, not only the first (design "Error body")
- [x] 2.10 Implement `TIPOS_PARAMETRO`, `DeclaracionParametro`, `ValorParametro`, `MotivoParametro`, `ProblemaParametro`, the branded `SentenciaPreparada`, `Resultado<T>`, `validarDeclaracion`, `analizarSentencia`, `prepararSentencia` in `src/parametros.ts`, composing Phase 1's scanner, satisfying 2.1–2.9
- [x] 2.11 Checkpoint: `npx tsc --noEmit` clean; `npm test -- src/parametros.test.ts` green (full file)

## 3. Execution Wiring (`src/consulta-ejecucion.ts`, `src/consultas.ts`)

- [x] 3.1 RED extend `src/consulta-ejecucion.test.ts`: a zero-parameter `SentenciaPreparada` produces byte-identical wrapped SQL, binding `LIMIT $1 OFFSET $2` (spec `query-execution` "Zero-parameter query is byte-identical to prior behavior")
- [x] 3.2 RED extend: two declared parameters bind at `$1`/`$2`, pagination binds at `$3`/`$4` (DEC-53, spec "Declared parameters bind before pagination's own binds")
- [x] 3.3 Modify `src/consulta-ejecucion.ts`: `PeticionEjecucion.sentencia: SentenciaPreparada` replaces `sql`; `paginar` numbers `LIMIT $(n+1) OFFSET $(n+2)` from `sentencia.valores.length`, binding `[...sentencia.valores, limiteEfectivo+1, desplazamiento]` — satisfies 3.1–3.2
- [x] 3.4 RED extend `src/consultas.test.ts`: `POST /consultas/ejecutar` accepts `parametros?`/`valores?` (default `[]`/`{}`); a malformed value returns `400 solicitud-invalida` naming the parameter before `destinoDeConexion` runs (spec "Validation failure executes nothing", "Ad hoc execution with inline parameters"; design "Check order")
- [x] 3.5 RED extend: each `tipo` filters correctly against a live column; page 2 with two parameters lands at `$3`/`$4`; `O'Brien`/`; DROP TABLE` values return as data with the table intact; `:x` inside a literal returns verbatim; `2026-02-30`/`1.5` against an int column return `200 fallo error-datos`; a `400` against a closed-port target proves nothing was dialed; a foreign `conexionId` returns `404` (spec integration scenarios; Threat Matrix)
- [x] 3.6 Modify `src/consultas.ts`: schema gains `parametros`/`valores`; run `sanearSql` then `prepararSentencia` before `destinoDeConexion`; pass `sentencia` to `ejecutarConsulta`; render problems as `400 {error:'solicitud-invalida', campos, problemas}` — satisfies 3.4–3.5
- [x] 3.7 Checkpoint: `npx tsc --noEmit` clean; `npm test -- src/consulta-ejecucion.test.ts src/consultas.test.ts` green

## 4. Saved-Query Persistence (`prisma/schema.prisma`, migration, `src/consultas-guardadas.ts`)

- [x] 4.1 Modify `prisma/schema.prisma`: add `parametros Json @default("[]")` to `ConsultaGuardada` (DEC-55)
- [x] 4.2 Generate migration `prisma/migrations/20260927000000_consulta_parametros/`; verify Prisma 7 emits exactly `ALTER TABLE "ConsultaGuardada" ADD COLUMN "parametros" JSONB NOT NULL DEFAULT '[]';`, backfilling existing rows, with `DROP COLUMN "parametros"` as the down path (design "Migration / Rollout")
- [x] 4.3 RED extend `src/consultas-guardadas.test.ts`: create persists a submitted `parametros`; omitted `parametros` stores `[]`; get-by-id returns `parametros`; an unknown `tipo` or a DEC-56/57 mismatch against `sql` returns `400` naming the entry and creates no row (spec "Creating a saved query with a valid declaration", "...with an unused or undeclared parameter", "Unknown tipo in a saved declaration")
- [x] 4.4 RED extend: get-by-id for another tenant's id is `404` and the response contains no `sql`/`parametros` (spec "Retrieving another tenant's saved query", regression)
- [x] 4.5 Modify `src/consultas-guardadas.ts`: schema gains `parametros?` in `properties`/`propertyNames`; run `validarDeclaracion` + `analizarSentencia` (no values) before create; add `parametros: true` to `ConsultaGuardadaCompleta` — satisfies 4.3–4.4
- [x] 4.6 Checkpoint: `npx prisma validate && npx tsc --noEmit`; `npm test -- src/consultas-guardadas.test.ts` green

## 5. Console (`src/consola.ts`)

- [x] 5.1 RED extend `src/consola.test.ts`: declaring `:desde` renders one input labeled `desde` appropriate to its `tipo`; a blank value omits its key rather than sending an empty string (spec "Rendering inputs for a declared parameter", design "A blank value omits the key")
- [x] 5.2 RED extend: execute submits a name→value map with `numero` sent as `Number()` when finite else the raw string, `booleano` as a JSON boolean, `fecha`/`texto` as strings (spec "Submitting collected parameter values"; design Console value-control table)
- [x] 5.3 RED extend: save submits the declaration only, never values; load rebuilds rows from a saved query's `parametros` with empty values (spec "Declaration saved with the query", "Declaration loaded with the query", DEC-48)
- [x] 5.4 RED extend: switching tenant clears the declaration rows; each `problemas` entry renders as one legible line through `textContent`, never a raw driver error or stack trace (spec "A parameter error is shown legibly") — tenant-switch clearing in `ch11/6-consola`; the `problemas` lines in `ch11/7-consola-errores`
- [x] 5.5 Modify `src/consola.ts`: add the declaration editor (`nombre` input, `tipo` select, value control, Quitar/Agregar parámetro buttons) inside `#formulario`; wire save/load/execute/tenant-switch — satisfies 5.1–5.4 (editor in `ch11/6-consola`; `problemas` mapping in `ch11/7-consola-errores`)
- [x] 5.6 Checkpoint: `npm test -- src/consola.test.ts` green

## 6. Full-Suite Checkpoint, Verify & Archive

- [x] 6.1 Full-suite checkpoint: `npm test` green; `npx tsc --noEmit` clean; `npx prisma validate` clean
- [x] 6.2 Run `sdd-verify` against `specs/query-parameters/spec.md`, `specs/query-execution/spec.md`, `specs/saved-queries/spec.md`, `specs/query-console/spec.md`; produce the verify report
- [ ] 6.3 Run `sdd-archive`: drop the "no migration" clause from the `saved-queries` main spec's Purpose statement when merging the delta (spec `saved-queries` "Note on Purpose"); move `openspec/changes/CH-11-query-parameters/` to `openspec/changes/archive/`; record the change in `docs/01-decisiones.md`'s bitácora

## Key Success-Criteria Traceability

- Parametrized query executes with values bound only as driver parameters → Phase 2 (2.8), Phase 3 (3.5)
- Missing or malformed value returns `400` naming the parameter → Phase 2 (2.5–2.7), Phase 3 (3.4)
- Saved declaration round-trips through create/get → Phase 4 (4.3)
- Zero-parameter queries behave byte-identically to today → Phase 1 (1.6), Phase 3 (3.1)
- All rewrite edge cases covered by tests → Phase 1 (1.1–1.4)
