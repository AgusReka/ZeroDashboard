# Tasks: CH-03 — Connection Registration and Test

Derived from `design.md`. Verification tasks map to `specs/connection-registration/spec.md` scenarios.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~550–650 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Config + probe engine: `src/config.ts`, `src/db-probe.ts`, its unit tests | PR 1 | `npm test -- src/db-probe.test.ts` | N/A — pure unit tests, no live DB | Revert `src/db-probe.ts`, `src/db-probe.test.ts`, the config field, `@types/pg`/test-script entries |
| 2 | Routes + wiring: `src/conexiones.ts`, `src/server.ts` | PR 2 | `npm test -- src/conexiones.test.ts -t success` | `docker compose up -d --build`, then the success-path probe | Revert `src/conexiones.ts` and the wiring line in `src/server.ts` |
| 3 | Remaining integration cases + smoke + docs | PR 3 | `npm test -- src/conexiones.test.ts` | `docker compose up -d --build`, then `npm run smoke` | Revert remaining test cases, the smoke.sh CH-03 section, the bitácora entry |

## 1. Foundation

- [x] 1.1 Add `connectionTestTimeoutMs` to `src/config.ts` (`CONNECTION_TEST_TIMEOUT_MS`, default `5000`, positive-integer check like `APP_PORT`)
- [x] 1.2 Document `CONNECTION_TEST_TIMEOUT_MS` (optional, default 5000) in `.env.example`
- [x] 1.3 Add `@types/pg` to `devDependencies` in `package.json` (no runtime dependency changes)
- [x] 1.4 Add a `test` script to `package.json` using Node's built-in test runner via `tsx` (`tsx --test src/**/*.test.ts`)

## 2. Failure Classification & Probe

- [x] 2.1 Create `src/db-probe.ts` with `classifyConnectionError(error, elapsedMs)`: all 8 design rows (timeout, ECONNREFUSED, ENOTFOUND/EAI_AGAIN, EHOSTUNREACH/ENETUNREACH/ECONNRESET, 28P01/28000, 3D000, 08***, fallback)
- [x] 2.2 In the same function, allowlist `codigo` via `/^[0-9A-Z]{5}$/` or `/^E[A-Z]{2,20}$/`; never read `message`, `stack`, or `connectionParameters`
- [x] 2.3 Add `probeConnection()` to `src/db-probe.ts`: discrete-field `pg.Client` (`host`, `port`, `database`, `user`, `password`, `connectionTimeoutMillis`), literal `SELECT 1`, `client.end()` in `finally` on every path
- [x] 2.4 Write `src/db-probe.test.ts`: one case per classification row (8), a non-`Error` throw, and an unmatched code (expect `codigo: null`)
- [x] 2.5 In `src/db-probe.test.ts`, assert an error carrying `connectionParameters.password` and `stack` yields a summary with neither value present

## 3. Routes

- [x] 3.1 Create `src/conexiones.ts` exporting `ConexionPublica`, a Prisma `select` allowlist excluding `credencial`
- [x] 3.2 Add `registerConexionRoutes(app, prisma)` with `POST /conexiones`: strict schema, server-resolved seeded tenant (`503 tenant-no-inicializado` if none), create `Conexion`, respond `201` with `ConexionPublica`
- [x] 3.3 Add `POST /conexiones/:id/prueba`: fetch row including `credencial` (`404` if missing), call `probeConnection`, respond `200` with `{resultado, categoria, codigo, host, puerto, duracionMs}`
- [x] 3.4 On failure, log only `app.log.warn({ conexionId, categoria, codigo, durationMs }, ...)` — never the raw error or `src/health.ts`'s `app.log.error(error, ...)` form

## 4. Wiring

- [x] 4.1 Import and call `registerConexionRoutes(app, prisma)` in `src/server.ts` beside `registerHealthRoute(app, prisma)`

## 5. Integration & Smoke

- [x] 5.1 Write `src/conexiones.test.ts`: register then probe a reachable Compose `db` target — expect `200 {resultado:"ok"}`
- [x] 5.2 Same file: probe with a wrong password — expect `categoria: "credenciales-invalidas"`, `codigo: "28P01"`
- [x] 5.3 Same file: probe a nonexistent database — expect `categoria: "base-inexistente"`, `codigo: "3D000"`
- [x] 5.4 Same file: probe an unroutable host — expect response within `connectionTestTimeoutMs`, `categoria: "tiempo-agotado"` — green after the blocker below was fixed; `npm test` re-run 5× consecutively, 24/24 each time, plus 12/12 samples through the live route inside Compose
- [x] 5.5 Extend `scripts/smoke.sh` with a CH-03 section covering 5.1–5.4, asserting no response body contains the submitted credential — two full `npm run smoke` runs exit 0, `unroutable host -> tiempo-agotado in 5s`

## 6. Project Process

- [x] 6.1 Add a bitácora entry at `docs/bitacora/` using `docs/_plantilla.md` (date, friction, time spent) per `docs/02-mapa-de-changes.md` — `docs/bitacora/CH-03-registro-y-prueba-de-conexiones.md`

## Coverage gap closed after verify

`sdd-verify` found two spec scenarios with no covering test — a planning gap in
section 5, which only ever allocated tasks for the four probe outcomes. Two cases
were added to `src/conexiones.test.ts` (no task renumbering, no production change):

- `an incomplete registration is rejected and creates no row` → spec scenario
  "Rejecting an incomplete registration" (CRITICAL finding)
- `a non-postgres motor still probes the stored host and port` → spec scenario
  "Testing a connection with a non-PostgreSQL engine value" (WARNING finding)

Suite after the addition: 26/26 pass, `npx tsc --noEmit` exit 0.

## Blocker found during apply (PR 3) — RESOLVED

`src/db-probe.ts` row 1 was `elapsedMs >= timeoutMs`, with no tolerance. A `pg`
`connectionTimeoutMillis` expiry carries no machine code, so that comparison was the only
signal — and the measured elapsed time can land a millisecond or two *under* the budget it
is compared against. Observed through the route inside Compose:

```
{"resultado":"fallo","categoria":"error-desconocido","codigo":null,"host":"192.0.2.1","puerto":5432,"duracionMs":4998}
```

Expected `categoria: "tiempo-agotado"` (spec: Bounded Connection-Attempt Timeout). Sampling
the same probe directly gave a margin of only +1 to +17 ms, so the correct classification
was luck, not logic. It was reported rather than patched because production code was outside
that test-only work unit.

**Fixed in this work unit, without a tolerance value.** `probeConnection()` now races its own
`setTimeout(timeoutMs)` against `client.connect()`: a won race *is* the timeout, established
rather than inferred, so no clock is consulted. `classifyConnectionError` lost both clock
parameters and is now a pure function of the error; its row 1 keeps `ETIMEDOUT` alone.
`connectionTimeoutMillis` is demoted to a driver-side backstop at `timeoutMs + 500` so the two
timers never race each other. See `design.md` → "Probe mechanics" and "Failure classification",
both corrected accordingly.

A second defect surfaced while fixing the first: `await client.end()` on a still-connecting
socket never settles (measured against `pg@8.23.0`, hanging indefinitely against both an
unroutable address and a silent local listener). `end()` is still issued on every path with its
outcome discarded unread, but it is only awaited when the driver had already settled.
