# Apply Progress: CH-03 — Connection Registration and Test

**All 20/20 tasks are `[x]`.** Delivered across five work units on the native SDD attempt ledger (four apply-phase, one verify-phase continuation), stacked-to-main delivery strategy.

## PR1 — Config + probe/classification engine (tasks 1.1–1.4, 2.1–2.5)

**Where**: `src/config.ts` (+`connectionTestTimeoutMs`), `.env.example`, `package.json`/`package-lock.json` (`@types/pg` devDep, `test` script), new `src/db-probe.ts`, new `src/db-probe.test.ts`. `pg` itself untouched — already a direct dependency (design's correction of the proposal's wrong claim, confirmed against `package.json`).

**Learned**:
- 18/18 unit tests pass, `tsc --noEmit` clean, `gentle-ai review assess` rated the diff `risk: medium` (only reason: `.env.example` configuration_change).
- Attempt ledger blocked once on `maintainer_decision` because `--max-changed-lines 300` was too tight; user authorized `gentle-ai sdd-attempt reset` with a corrected budget.
- `EAI_AGAIN` cannot pass the design's own `codigo` allowlist regex (`/^E[A-Z]{2,20}$/` rejects the underscore) — classifies as `dns-no-resuelve` but publishes `codigo: null`. Left as-is deliberately.
- `tsc -p tsconfig.json` (`include: ["src"]`) also emits `dist/*.test.js` since test files live under `src/` — harmless, worth a tsconfig exclude later.

## PR2 — Routes + wiring (tasks 3.1–3.4, 4.1)

**Where**: new `src/conexiones.ts` (180 lines: `ConexionPublica` select allowlist, `registerConexionRoutes` with `POST /conexiones` and `POST /conexiones/:id/prueba`), `src/server.ts` (+2 lines). 182 authored lines.

**Learned**:
- Fastify 5 types `request.validationError` as `Error & { validation: any; validationContext: string }`, NOT `FastifyError` — the 400-handler narrows `{ validation?: unknown }` by hand.
- Validation is route-scoped via `attachValidation: true`, not a global error handler. `400` returns `{ error: "solicitud-invalida", campos: [<instancePath>…] }`.
- `ConexionPublica` is an `as const` Prisma `select`; `credencial` is absent by construction. The probe path selects `credencial` in its own `findUnique` and hands it straight to `probeConnection`.
- Tenant resolved server-side; empty table returns `503 { error: "tenant-no-inicializado" }`. `404` is `{ error: "conexion-no-encontrada" }`.
- No `motor` gate (design Decision 1). Failure logging is `app.log.warn({ conexionId, categoria, codigo, durationMs }, …)` only. Response field is `duracionMs`, log key is `durationMs` — both intentional.
- Settle first blocked on `undeclared_untracked`; the blocked response itself carries the fresh inventory hash, so no separate `gentle-ai review status` call is needed.

## PR3 — Integration tests + smoke + bitácora (tasks 5.1–5.5, 6.1)

**Where**: new `src/conexiones.test.ts` (207 lines, 4 integration cases), `scripts/smoke.sh` (+87/-6: CH-03 section + `wait_for_app`), `tasks.md`. ~297 authored lines.

**Learned**:
- Exact `pg` codes confirmed against a live PostgreSQL 16 target (the research gap the design asked apply to close): wrong password → `28P01`/`credenciales-invalidas`; nonexistent database → `3D000`/`base-inexistente`.
- `192.0.2.1` (RFC 5737 TEST-NET-1) is the right unresponsive target: packets are dropped, not refused, so the attempt can only end by exhausting the budget. An unused local port gives `ECONNREFUSED` → `host-inalcanzable`, a different row.
- `probeConnection` calls `loadConfig()` on every invocation, so any test driving the route must set `APP_PORT` and `DATABASE_URL` in `process.env` or the probe throws before its own try block. Passing `timeoutMs` explicitly to `probeConnection` bypasses `loadConfig()` entirely.
- `docker-compose.yml` does not publish the `db` port; host-side integration tests use a scratchpad-only override (`-f docker-compose.yml -f <scratch>/docker-compose.override.yml`, `55432:5432`) so no tracked file is touched. The suite reads `TEST_DB_*` and skips with a reason when nothing answers.
- `scripts/smoke.sh` raced the app's ~17s startup with a fixed 3s sleep and died silently under `set -e`; replaced with a bounded `wait_for_app` poll.
- This slice reported a real production defect (the timeout-classification race, below) and correctly stopped without patching out-of-scope production code from a test-only work unit.

## PR3-correction — the timeout defect and its fix

**Where**: `src/db-probe.ts` (+65/-21), `src/db-probe.test.ts` (+112/-56), `design.md` (Probe mechanics + Failure classification + mermaid + scope-check row), `tasks.md` (+22/-10), new `docs/bitacora/CH-03-registro-y-prueba-de-conexiones.md` (73 lines). 377 authored changed lines, under the 400 budget.

**Root cause**: classification row 1 was `elapsedMs >= timeoutMs`. That asks a measured duration whether it exceeds the budget it was measured against, but the instant `pg` rejects and the instant the clock is read are different instants, and a Docker Desktop guest clock can step between them. Observed `{"categoria":"error-desconocido","duracionMs":4998}` against a 5000ms budget. Sampled margin was +1..+17ms, so a correct verdict was luck. No tolerance value fixes this — a tolerance only widens the window in which the answer is still a guess.

**Fix**: `probeConnection()` races its own `setTimeout(timeoutMs)` against `client.connect()`, rejecting with a module-private `Symbol('presupuesto-agotado')`. A won race *is* the timeout, established rather than inferred. `classifyConnectionError` lost both clock parameters — signature is now `classifyConnectionError(error: unknown)`, a pure function of the error; row 1 keeps `ETIMEDOUT` alone. Rows 2-8, the `codigo` allowlist, and every credential-safety boundary are unchanged. `connectionTimeoutMillis` stays mandatory and explicit but is set to `timeoutMs + 500` and demoted to a backstop so the two timers never race each other.

**Second defect found while fixing the first**: `await client.end()` on a still-connecting `pg.Client` never settles (measured against `pg@8.23.0`, hung indefinitely). `end()` is still issued on every path with its outcome discarded unread, but only awaited when the driver had already settled; on the timer-won path the backstop reclaims the socket.

**Verification**: `npx tsc --noEmit` exit 0; `npx tsx --test src/db-probe.test.ts` 20/20; `npm test` 5 consecutive runs, 24/24 each; 12/12 live in-Compose route samples all `tiempo-agotado`; 25/25 sub-budget probe samples correctly classified; `npm run smoke` 2 full runs, exit 0.

**Ledger accounting gotcha (hit 3 of 5 attempts)**: `sdd-attempt acquire` takes no `--intended-untracked`, so the begin candidate tree is snapshotted without any untracked file. Declaring them at settle charges each one's entire length as insertions, not the diff. Attempts 1 (350), 3 (382), and this one (769 vs. 377 actual) hit this artifact; all three were resolved with a user-authorized `gentle-ai sdd-attempt reset`. Not unconditional — the PR2 and coverage-gap slices settled cleanly on the first try.

## Post-verify coverage-gap slice (verify-phase continuation)

**Where**: `src/conexiones.test.ts` (207 → 280 lines, +73: two new test cases plus a header note), `tasks.md` (+13, one "Coverage gap closed after verify" note). ~86 authored changed lines, under the 150 budget. Zero production files touched.

**Learned**:
- First `sdd-verify` returned `verdict: fail` on 10/12 scenarios: one CRITICAL ("Rejecting an incomplete registration", zero coverage anywhere) and one WARNING ("Testing a connection with a non-PostgreSQL engine value", code-inspection only). Root cause was a tasks.md planning gap: section 5 only ever allocated tasks for the four probe outcomes, never for the registration-rejection path.
- Two cases added to `src/conexiones.test.ts`, appended after 5.4 inside the existing live-target `describe`, deliberately not renumbered as 5.x: `an incomplete registration is rejected and creates no row` and `a non-postgres motor still probes the stored host and port`.
- The rejection test omits `credencial` and asserts `400` + `error: "solicitud-invalida"` + a non-empty `campos` array, then proves the absence of a write with `prisma.conexion.count({ where: { nombre } })` against a `Date.now()`-suffixed unique `nombre`.
- The motor case registers `motor: 'mysql'` against the same reachable Compose target and asserts a `200` with a real verdict and no gating — the point is the absence of a gate, not a particular verdict.
- No production file was touched and no bug surfaced — `src/conexiones.ts` and `src/db-probe.ts` behaved exactly as the verify report's static reading predicted.
- Second `sdd-verify` pass: PASS, 0 blockers, 0 CRITICAL, 0 WARNINGs, 5/5 requirements, 12/12 scenarios, 26/26 tests.

## Known remaining gaps (accepted, out of scope)

The 404 `conexion-no-encontrada` and 503 `tenant-no-inicializado` paths have no automated test (neither is a spec.md scenario); "DNS resolution failure" and "Other unclassified failure" remain pure-function-only per design.md's own documented test strategy; no coverage tool is configured (pre-existing to the project).

## Delivery status

No git commit, branch, or PR was created for any of the five work units — all changes landed directly in the working tree. Committing and PR creation (stacked-to-main chain strategy, as scoped during tasks/apply) is a separate, explicitly-authorized step not yet requested.
