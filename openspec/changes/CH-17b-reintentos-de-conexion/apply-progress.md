# Apply Progress: CH-17b — Bounded Connection Retries (X5)

**Mode**: Strict TDD (orchestrator-injected; `openspec/config.yaml` still says `strict_tdd: false` from the greenfield init, superseded by the launch instruction)
**Delivery**: auto-chain, stacked-to-main. This batch = slice 1 only, on branch `ch17b/2-config-y-regla` (stacked on `ch17b/1-artefactos`).
**Status**: Slice 1 complete (7/7). Slices 2 and 3 pending (13 tasks).

## Task Status

### Slice 1: Config, Env, Migration, Pure Rule — done
- [x] 1.1 RED `esFalloReintentable` truth table (`src/automatizaciones.test.ts`)
- [x] 1.2 GREEN `esFalloReintentable` + closed `CATEGORIAS_REINTENTABLES` beside `cierreDeResultado` (`src/automatizaciones.ts`)
- [x] 1.3 RED config cases (`src/config.test.ts`)
- [x] 1.4 GREEN `DEFAULT_CONNECTION_RETRY_ATTEMPTS`, `MAX_CONNECTION_RETRY_ATTEMPTS`, `DEFAULT_CONNECTION_RETRY_PAUSE_MS`, `enteroEnRangoOpcional`, `connectionRetryAttempts`, `connectionRetryPauseMs` (`src/config.ts`)
- [x] 1.5 `.env.example` (empty placeholders + commented defaults/ranges) and `docker-compose.yml` (`${VAR:-}` forwarding)
- [x] 1.6 `prisma/schema.prisma` `intentos Int?` + comment block; `prisma/migrations/20261001000000_ejecucion_intentos/migration.sql`; `npx prisma generate`; applied to test DB
- [x] 1.7 Checkpoint: full suite green, `npx tsc --noEmit` clean

### Slice 2: Retry Loop and Wiring — pending (2.1-2.7)
### Slice 3: Listing, Console, Bitácora — pending (3.1-3.7)

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1/1.2 | `src/automatizaciones.test.ts` | Unit (pure) | 71/71 (config + automatizaciones) | Written; run failed: `does not provide an export named 'esFalloReintentable'` | 43/43 file | 5 tests: 3 retryable conn categories; 3 non-retryable conn categories; ejecucion `tiempo-agotado` + 3 other query categories; 3 permisos; ok/2 rechazo/excepcion | Wrapped the return expression to the file's ~100-col style; 43/43 |
| 1.3/1.4 | `src/config.test.ts` | Unit | 71/71 (same baseline) | Written; run failed: `does not provide an export named 'DEFAULT_CONNECTION_RETRY_ATTEMPTS'` | 43/43 file | 10 tests: defaults; overrides 5/1000; `1` accepted; empty fallback; `6` (range message); attempts `0`/`abc`/`12.5`; pause `0`/`abc` — every refusal names the variable and never quotes the value | Shortened three over-long titles; 86/86 both files |
| 1.5 | — | Config files | N/A | N/A (no executable behavior; spec scenario is inspection) | `docker compose config --quiet` exit 0; rendered env shows both vars `""` | Triangulation skipped: structural placeholder lines only | ➖ None needed |
| 1.6 | `src/planificador.test.ts` (existing 4.6 allowlist) | Integration (live PG) | Full suite run surfaced 1 failure: 4.6 column allowlist lacked `intentos` | Allowlist is the RED: column added → 4.6 failed with `+ 'intentos'` | Allowlist updated (+`intentos`); 663/663 | ➖ Single (schema shape) | ➖ None needed |
| 1.7 | full suite | All | — | — | `TEST_DB_PORT=5434 npm test`: tests 663, suites 96, pass 663, fail 0, skipped 0; `npx tsc --noEmit` exit 0 | — | — |

## Work Unit Evidence (Unit 1)

| Evidence | Value |
|---|---|
| Focused test command and result | `npx tsx --test src/config.test.ts src/automatizaciones.test.ts` → tests 86, pass 86, fail 0 |
| Runtime harness | `DATABASE_URL=postgresql://zerodashboard:change-me@localhost:5434/zerodashboard npx prisma migrate deploy` → applied `20261001000000_ejecucion_intentos`; `prisma migrate status` → "Database schema is up to date!"; `information_schema` → `intentos|integer|YES|<none>`; `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma` → "No difference detected." |
| Full suite | `TEST_DB_PORT=5434 npm test` → 663/663 pass, exit 0; `npx tsc --noEmit` exit 0 |
| Rollback boundary | Revert `src/config.ts`, `src/automatizaciones.ts`, their tests, `src/planificador.test.ts` allowlist, `.env.example`, `docker-compose.yml`, `prisma/schema.prisma`. The applied migration file stays (nullable column ignored by older code); optional forward `DROP COLUMN` per the migration header. Nothing consumes the new symbols yet. |

## Commands Run (environment)

- `npx prisma generate` → client 7.10.0 into gitignored `src/generated/prisma`.
- Test DB: container `zd-ch09-testdb` on host port 5434 (the convention since CH-13; port 5432 belongs to another project's Postgres). Migration applied with `DATABASE_URL=...@localhost:5434/zerodashboard npx prisma migrate deploy` (same method as earlier changes). `prisma.config.ts` loads `dotenv/config`, which does not override an exported `DATABASE_URL`.

## Files Changed (slice 1)

| File | Action | Lines (+/-) |
|------|--------|-------------|
| `src/automatizaciones.ts` | Modified | +29 |
| `src/automatizaciones.test.ts` | Modified | +58 |
| `src/config.ts` | Modified | +44 |
| `src/config.test.ts` | Modified | +70 |
| `src/planificador.test.ts` | Modified (allowlist) | +2/-1 |
| `prisma/schema.prisma` | Modified | +6 |
| `prisma/migrations/20261001000000_ejecucion_intentos/migration.sql` | Created | +12 |
| `.env.example` | Modified | +11 |
| `docker-compose.yml` | Modified | +5 |
| `openspec/changes/CH-17b-reintentos-de-conexion/tasks.md` | Modified (checkboxes) | +7/-7 |

Code + tests + prisma: 222 changed lines; env/compose: 16; docs: tasks 14 + this file.

## Deviations from Design

1. `src/planificador.test.ts` `COLUMNAS_EJECUCION` (CH-13 4.6 column allowlist) gained `intentos`. Task 1.7 says "existing tests unmodified", but this allowlist asserts the exact column set of `Ejecucion`, so any schema-adding slice must extend it (CH-14 did the same for `notificacion`). Only the list constant and its doc comment changed; no assertion logic changed. The design's file table did not list this test.
2. `.env.example` uses empty placeholders with commented defaults (the `SMTP_TIMEOUT_MS` pattern) rather than literal default values; both satisfy "default or placeholder values only".
3. Slice size: 222 code/test/prisma lines (+16 env/compose) against the ~160 forecast; still under 400.

## Issues

- A 0-byte untracked file named `clave.toLowerCase().includes('smtp'))` appeared in the repo root at 13:12:04 during this session (not created by this batch's commands as far as can be determined; it looks like a shell redirect of an unquoted `=>`). Left untouched; must not be committed.
