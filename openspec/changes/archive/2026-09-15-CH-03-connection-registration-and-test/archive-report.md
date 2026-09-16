# Archive Report: CH-03 — Connection Registration and Test

Archived: 2026-09-15

## Outcome

Verified — all 5 requirements and 12/12 scenarios in `specs/connection-registration/spec.md` pass against a real Docker Compose stack (see `verify-report.md`). Merged into `openspec/specs/connection-registration/spec.md` as the new `connection-registration` capability (no prior main spec existed — greenfield capability).

## Final state

- 20/20 tasks complete (`tasks.md` plus documented post-verify coverage addendum closing 2 spec scenarios via real runtime test cases with no production code change).
- `npx tsc --noEmit`: exit 0.
- `npm test` (26 tests, 24 prior + 2 new coverage-gap closures): 26 passed / 0 failed / 0 skipped, exit 0.
- `npm run smoke` (end-to-end against Docker Compose): exit 0, all 4 CH-03 scenarios covered, credential-leak log check passed.
- All 5 spec requirements: COMPLIANT (10/12 scenarios fully live/functional, 2/12 scenarios deliberately unit-only by design, 0/12 with zero test coverage).
- Verification report: PASS, 0 blockers, 0 CRITICAL findings, 0 WARNINGs (both gaps from prior verify run are closed).

## What this change delivered

The connection-registration capability required by `docs/02-mapa-de-changes.md` as story A1: registering a tenant's target database connection and proving its reachability with legible failure categories, without ever exposing the stored credential. Scope:

- `POST /conexiones` registers a `Conexion` row against the single seeded `Tenant`, capturing host, port, database name, user, credential, engine (`motor`), and a name. Server-side tenant resolution (only the seeded tenant is available in R0). Strict Fastify schema rejects incomplete registrations.
- `POST /conexiones/:id/prueba` opens a short-lived `pg.Client` with discrete fields, executes a literal `SELECT 1` probe, and returns a legible result categorizing any failure into: unreachable host/port, DNS resolution failure, timeout, bad credentials, missing database, or other/unclassified.
- Failure classification implemented via `classifyConnectionError()` in a separate pure function (unit-testable, isolated credential-safety boundary).
- Probe mechanics use a race between the application's own `setTimeout(timeoutMs)` and `pg.Client.connect()` — the winning race *is* the timeout, established rather than inferred. `connectionTimeoutMillis` is demoted to a driver-side backstop at `timeoutMs + 500`.
- Credential safety: four enforced boundaries — allowlist-shaped `codigo`, no error object exposure, sanitized logging (summary only, never raw error or host-bearing credentials), no echo of submitted request bodies.
- Configuration: `connectionTestTimeoutMs` added to `src/config.ts` (optional env `CONNECTION_TEST_TIMEOUT_MS`, default `5000`, validated as a positive integer). Dependency: `@types/pg` added to `devDependencies` only (runtime dependency `pg` already present from CH-01's `@prisma/adapter-pg`).

## Implementation path and friction log

Implementation was completed across 4 work units after the initial apply + verify cycle:

1. **PR1 (apply phase, work unit 1)**: Config timeout + `src/db-probe.ts` probe/classification engine + unit tests. Foundation complete, 18 unit cases pass.

2. **PR2 (apply phase, work unit 2)**: `src/conexiones.ts` routes + `src/server.ts` wiring. Registration and probe endpoints wired, registration path unit-tested.

3. **PR3 (apply phase, work unit 3)**: Integration tests + `scripts/smoke.sh` + bitácora entry. First `sdd-verify` pass found 1 CRITICAL (incomplete registration not tested) + 1 WARNING (non-Postgres motor scenario untested). A real timeout-classification race bug was discovered during integration testing and correctly stopped without patching out-of-scope — see bugfix work unit below.

4. **Bugfix work unit (apply phase continuation)**: `probeConnection()` timeout mechanism reworked. Original design rule 1 compared `elapsedMs >= timeoutMs`, which is unreliable (measured elapsed time can land +1 to +17 ms under the budget it is compared against, making the correct verdict luck rather than logic). Replaced with a race: `probeConnection()` starts its own `setTimeout(timeoutMs)` and races it against `client.connect()`. The won race *is* the timeout, established rather than inferred, so `classifyConnectionError()` no longer needs clock parameters and is now a pure function of the error alone. `ETIMEDOUT` remains the only Node socket code checked in rule 1. This fix also corrected a second latent bug: `pg`'s `client.end()` never settles on a still-connecting socket, so it is only awaited when the driver had already settled; on the timer-won path, the backstop socket destroyer is called instead. All 26 tests re-run green after the fix.

5. **Coverage-gap work unit (verify phase continuation)**: `sdd-verify` re-run after two new test cases were added to `src/conexiones.test.ts`. Both gaps are closed with real, passing runtime test coverage: "an incomplete registration is rejected and creates no row" genuinely posts an incomplete body and confirms zero rows were created; "a non-postgres motor still probes the stored host and port" confirms the probe is not gated and still reaches the stored host/port with a legible verdict (motor=mysql registered and probed against the real Postgres Compose target; the probe reaches the target without gating, and the result is ok not a 4xx refusal). Verdict: PASS, 0 blockers, 0 CRITICAL, 0 WARNINGs. Bitácora entry exists at `docs/bitacora/CH-03-registro-y-prueba-de-conexiones.md` with full friction/timing narrative from PR1–PR3 + bugfix path.

## Key implementation choices (design.md decisions)

1. **PostgreSQL is the only engine the probe dials.** `motor` is stored, never branched on. D-4 (open engine gate) remains genuinely open; a non-Postgres target produces whatever the `pg` driver produces when it dials a non-Postgres service (protocol-level error, refused connection, or timeout), classified by `classifyConnectionError()` normally landing in `error-desconocido`.

2. **Two operations, not one combined register-and-test.** `POST /conexiones` persists and returns `201`; `POST /conexiones/:id/prueba` dials the stored row and returns the result. Registration never dials (avoids coupling persistence to third-party reachability).

3. **A completed probe is always `200`, whatever its verdict.** HTTP error codes are reserved for request failures (schema validation, missing connection ID, uninitialized tenant). Connectivity outcomes are never HTTP errors.

4. **Tenant is resolved server-side, never supplied by the client.** `POST /conexiones` resolves the single seeded row and uses its id for the required FK. Empty table → `503 { "error": "tenant-no-inicializado" }`. Protects against pre-empting T1/T2 (CH-06).

5. **The timeout budget is enforced by a race, not by sampling elapsed time.** `probeConnection()` races its own timer against `connect()`; a won race is the timeout, established as a fact, not inferred from a clock measurement prone to +1 to +17 ms slip. `connectionTimeoutMillis` is a driver-side backstop at `timeoutMs + 500` so the two timers never race each other.

6. **Credential safety: four enforced boundaries.** (1) `codigo` is allowlist-shaped, never free text. (2) The raw error never escapes the probe function. (3) Logging is sanitized-only (summary via `{ conexionId, categoria, codigo, durationMs }`, never raw error or `host`-bearing credentials). (4) No echo of the submitted body in validation errors.

## What CH-03 explicitly does not include

- Tenant isolation, lifecycle, or alta/baja (stories T1, T2, T4) → CH-06.
- Credential encryption at rest (story A2) → CH-07. `Conexion.credencial` stays plaintext.
- Per-query timeout and row limits (story A4) → CH-07. The connection-attempt timeout above is not A4.
- Read-only enforcement (story A3) → CH-04. `soloLectura` stays stored-but-unenforced.
- Any query execution beyond the fixed `SELECT 1` probe.
- No schema migration or data model change (CH-02's `Conexion` model is used as-is).
- No UI (result is JSON only; first UI is CH-04, story B1).

## Spec changes merged

| Domain | Action | Details |
|--------|--------|---------|
| connection-registration | Created | New capability: 5 requirements, 12/12 scenarios, full spec merged into `openspec/specs/connection-registration/spec.md` |

## Artifacts in archive

- `proposal.md` (change scope and success criteria)
- `specs/connection-registration/spec.md` (full spec, 5 requirements, 12 scenarios)
- `design.md` (decisions, implementation contracts, threat matrix)
- `tasks.md` (20 tasks, all complete; coverage-gap addendum documents 2 test cases added post-verify)
- `verify-report.md` (PASS verdict, 5/5 requirements, 12/12 scenarios, 20/20 tasks, 0 blockers, 0 CRITICALs)
- `apply-progress.md` (cumulative implementation log across all work units)

## Source of truth updated

The following spec now reflects the new behavior:
- `openspec/specs/connection-registration/spec.md` (new capability)

## Follow-ups for later changes

- CH-04 (query execution, story B1) builds on the registered, proven-reachable connection as its foundation.
- CH-06 (tenant lifecycle, stories T1, T2, T4) should extend `Conexion` schema for tenant CRUD and soft-delete.
- CH-07 (hardening, stories A2, A4) adds credential encryption and per-query timeout/row limits.
- The `connection-registration` capability now exists in `openspec/specs/` — later changes touching connection registration should delta against it rather than redefine it.

## Delivery note

No git commit, branch, or PR was created for CH-03 during implementation — all four work units landed directly in the working tree. Committing and any PR/chained-PR creation (stacked-to-main, as scoped during tasks/apply) is a separate, explicitly-authorized step that has not yet been requested.

## Traceability

- Proposal artifact: `proposal.md` (this archive)
- Spec artifact: `specs/connection-registration/spec.md` (this archive; merged to `openspec/specs/connection-registration/spec.md`)
- Design artifact: `design.md` (this archive)
- Tasks artifact: `tasks.md` (this archive)
- Verify report artifact: `verify-report.md` (this archive; PASS verdict, 0 blockers)
- Apply progress artifact: `apply-progress.md` (this archive)
- Bitácora: `docs/bitacora/CH-03-registro-y-prueba-de-conexiones.md` (friction log)
