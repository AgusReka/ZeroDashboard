# Design: CH-03 — Connection Registration and Test

## Inputs

- `proposal.md` (this change)
- `specs/connection-registration/spec.md` (this change) — written in parallel; this design tracks the proposal's success-criteria list, reconciled in the scope check below
- Engram `sdd/CH-03/explore` (obs #24) and `sdd/CH-03/research` (obs #25) — claims C1–C9 are cited inline
- CH-01 `design.md` (Fastify + Prisma 7 driver adapter, `register<X>Route(app, prisma)` pattern, env-only configuration) and CH-02 `design.md` (Spanish domain vocabulary, `Conexion` shape, plaintext `credencial`)
- `docs/01-decisiones.md` D-4 (open engine gate), DEC-05 (design-level resolution precedent), DEC-06 (one seeded tenant); `docs/00-contexto.md` §5 rules 4 and 7

## Decisions resolved at design level

Same class as CH-01's framework/ORM calls under DEC-05: implementation choices inside an already-fixed stack, not new architecture gates.

### 1. PostgreSQL is the only engine the test dials — and it dials it unconditionally

**Alternatives considered:** dial per `motor` with a driver registry (resolves D-4 by accident, and pulls a MySQL driver into R0 for a tenant that does not exist); gate the test path on `motor` and refuse an unsupported value with `422` before opening a socket (contradicts spec.md's scenario "Testing a connection with a non-PostgreSQL engine value", which requires the fixed probe to *still be attempted*, and invents a refusal shape outside the probe-result envelope).

**Decision:** `motor` stays free-text and is still stored unvalidated at registration, so D-4 remains open. The **test** path never reads it: `motor` is recorded but neither gates nor branches the probe. Every test opens the same fixed PostgreSQL probe against the stored `host`/`puerto`. A non-Postgres target produces whatever the `pg` driver produces when it dials a service that does not speak the Postgres wire protocol — a protocol-level error, a refused connection, or a timeout — and that goes through `classifyConnectionError` like any other failure, normally landing in `error-desconocido` (rows 7–8) unless it matches an earlier row. No new category, no new response shape, no short-circuit.

**Resigned:** a MySQL row gets a generic failure verdict rather than one naming the engine mismatch. Accepted: a legible, bounded failure in the normal envelope is exactly what the spec asks for, and D-4 stays genuinely open instead of being half-resolved by a gate enforced on the test path.

### 2. Two operations, not one combined register-and-test

**Alternatives considered:** a single `POST /conexiones` that registers and probes in one response (couples persistence to third-party reachability — a replica that is briefly down would block registration, and A1 asks for a *repeatable* visible result, not a one-shot one); an ad hoc `POST /conexiones/prueba` that probes an unsaved body (extra public surface A1 does not ask for, and it would accept credentials with nowhere to put them).

**Decision:** `POST /conexiones` persists and returns `201`; `POST /conexiones/:id/prueba` dials the stored row and returns the result. Registration never dials.

### 3. A completed probe is `200`, whatever its verdict

**Alternatives considered:** mapping categories onto `502`/`504`/`401`/`404` (collapses six distinguishable categories into fewer status codes, and invites clients and proxies to treat a tenant's bad password as a retryable transport fault of *our* API).

**Decision:** the probe ran, so the operation succeeded: `200` with the verdict in the body. HTTP error codes are reserved for failures of the request itself — `400` (schema validation), `404` (unknown connection id), `503` (no seeded tenant). A connectivity outcome is never an HTTP error, and the stored `motor` never produces one.

### 4. Tenant is resolved server-side, never supplied by the client

`POST /conexiones` accepts no `tenantId`. The handler resolves the single seeded row (`prisma.tenant.findFirst({ orderBy: { creadoEn: 'asc' }, select: { id: true } })`) and uses its id for the required FK. Empty table → `503 { "error": "tenant-no-inicializado" }`. Accepting a client-supplied `tenantId` would pre-empt T1/T2 (CH-06); rejected.

## Contracts

```jsonc
// POST /conexiones  (Fastify JSON schema; additionalProperties: false)
{ "nombre": "Replica Food Store", "motor": "postgres", "host": "10.0.0.7",
  "puerto": 5432, "baseDeDatos": "foodstore", "usuarioDb": "lector",
  "credencial": "<secret>", "soloLectura": true }        // soloLectura optional, defaults true

// 201
{ "conexion": { "id": "…", "nombre": "…", "motor": "…", "host": "…", "puerto": 5432,
                "baseDeDatos": "…", "usuarioDb": "…", "soloLectura": true,
                "creadaEn": "…", "actualizadaEn": "…" } }   // ConexionPublica — no `credencial` field exists

// POST /conexiones/:id/prueba — 200, both verdicts
{ "resultado": "ok",    "categoria": null,                    "codigo": null,    "host": "10.0.0.7", "puerto": 5432, "duracionMs": 41 }
{ "resultado": "fallo", "categoria": "credenciales-invalidas", "codigo": "28P01", "host": "10.0.0.7", "puerto": 5432, "duracionMs": 88 }
```

`ConexionPublica` is a single exported Prisma `select` allowlist reused by every response path; `credencial` is never in it, so read paths never even fetch the column. The test path fetches it explicitly and it never leaves the probe function.

## Probe mechanics (research C1–C3)

A raw short-lived `pg.Client` built from **discrete fields** — `{ host, port, database, user, password, connectionTimeoutMillis }` — never a composed connection string (C9/GH #3557: a `:`/`?`/`#` in a password breaks URL parsing and the malformed credential-bearing string surfaces in the parse error), never `Pool`, and never the app's `PrismaClient`, which is startup-bound to the own database (C3). Sequence: `connect()` → `SELECT 1` as a literal parameterless statement (rule 4) → `client.end()` in `finally`, unconditionally, on every path including timeout. The budget reads from `loadConfig()` as `connectionTestTimeoutMs`, optional env `CONNECTION_TEST_TIMEOUT_MS`, default `5000`, validated as a positive integer like `APP_PORT` already is.

**The budget is enforced by a race, not measured after the fact (corrected during apply — see "Failure classification" below).** `probeConnection` starts its own `setTimeout(timeoutMs)` and races it against `connect()`. If the timer wins, the attempt exhausted its budget *as a fact*, and the result is `tiempo-agotado` without consulting any clock. If `connect()` wins — resolving or rejecting — the timer is cleared and the outcome follows the normal path (`SELECT 1`, or `classifyConnectionError` on the driver's error). The timer is cleared on every exit path, so it can neither fire behind an already-decided race nor hold the process open.

`connectionTimeoutMillis` stays mandatory and explicit (C2 — the driver default is `0`, i.e. wait forever), but it is set to `timeoutMs + 500` and demoted to a **backstop**: the two timers must never race each other, or the knife-edge simply moves. Its remaining job is socket reclamation, and that job is real. Verified against `pg@8.23.0`: `client.end()` on a socket that is still connecting queues a FIN that can never be sent, so its promise never settles — measured hanging indefinitely against both an unroutable address and a silent local listener. So `end()` is still *issued* on every path and its outcome still discarded unread, but it is only *awaited* when the driver had already settled; on the timer-won path the backstop destroys the socket instead. Awaiting it there would make the probe outlive the very budget it exists to enforce.

## Failure classification (research C4–C6)

One exported pure function, `classifyConnectionError(error: unknown): { categoria, codigo }`, applied in this order. It is the only code in the change that touches the raw error object, and it reads no clock.

| # | Observed | Source | `categoria` |
|---|---|---|---|
| 1 | the probe's own timer won the race (decided in `probeConnection`), or `code === 'ETIMEDOUT'` | probe race / Node | `tiempo-agotado` |
| 2 | `ECONNREFUSED` | Node net | `host-inalcanzable` |
| 3 | `ENOTFOUND`, `EAI_AGAIN` | Node DNS | `dns-no-resuelve` |
| 4 | `EHOSTUNREACH`, `ENETUNREACH`, `ECONNRESET` | Node net | `host-inalcanzable` |
| 5 | `28P01`, `28000` | SQLSTATE | `credenciales-invalidas` |
| 6 | `3D000` | SQLSTATE | `base-inexistente` |
| 7 | `08***` (any class-08) | SQLSTATE | `error-desconocido` |
| 8 | anything else, including a non-`Error` throw | — | `error-desconocido` |

**Rule 1 corrected during apply.** This design originally split rule 1 between `code === 'ETIMEDOUT'` and `elapsedMs >= connectionTestTimeoutMs`, because a `connectionTimeoutMillis` expiry carries no stable machine-readable code and matching on pg's `"timeout expired"` message text would couple us to an undocumented string. Both of those remain true; the elapsed-time comparison was the wrong conclusion to draw from them. Live integration testing produced `{"categoria":"error-desconocido","duracionMs":4998}` against a 5000 ms budget: a genuine timeout, misclassified, because the comparison asks a measured duration whether it exceeds the budget it was measured against — and the driver's rejection and our clock read are two different instants, with the guest clock free to step between them. Sampling gave a margin of only +1 to +17 ms, so a correct verdict was luck. No tolerance value fixes that; a tolerance only widens the window in which the answer is still a guess.

So rule 1's budget half is no longer *inferred from* the elapsed time — it is *established by* the race in "Probe mechanics" above. `probeConnection` knows which promise won, and that is not an approximation of the answer, it is the answer. `duracionMs` is reported to the client and consulted by nothing. `classifyConnectionError` therefore takes only the error and only ever sees errors the driver actually produced; its rule 1 keeps `ETIMEDOUT` alone, which is a real Node socket code and needs no clock. Rows 2–8 are unchanged, as are the `codigo` allowlist and every credential-safety boundary below. Node codes are still checked before SQLSTATE because both live on `error.code` and the pre-TCP set is a closed, known list.

## Credential safety (research C7–C9, rule 7)

Four enforced boundaries — the first three are mechanisms, not conventions:

1. **`codigo` is allowlist-shaped, never free text.** It is emitted only if it matches `/^[0-9A-Z]{5}$/` (SQLSTATE) or `/^E[A-Z]{2,20}$/` (Node code); otherwise `null`. `error.message`, `error.stack`, `error.connectionParameters` (the GH #1568 plaintext-password vector) and the error object itself are never read, spread, serialized, or returned.
2. **The raw error never escapes the probe function.** `probeConnection()` catches everything and returns `{ resultado, categoria, codigo, duracionMs }`. The route handler never sees a `pg` error object, so it cannot leak one.
3. **Logging is sanitized-only.** This route MUST NOT use `src/health.ts`'s `app.log.error(error, …)` form — safe there (own-DB error, no client credential) and a direct #1568 leak here. Logging is `app.log.warn({ conexionId, categoria, codigo, durationMs }, 'connection test failed')`: the sanitized summary only, never `host`-bearing credentials, never the error.
4. **No echo of the submitted body.** `400` responses map Fastify validation failures to `{ error: "solicitud-invalida", campos: [<instancePath>…] }` — field paths only, never values. Fastify does not log request bodies by default; nothing in this change enables that.

## Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant R as POST /conexiones/:id/prueba
    participant P as Prisma (own DB)
    participant T as Target Postgres

    C->>R: POST /conexiones/{id}/prueba
    R->>P: findUnique(id) + credencial
    P-->>R: row (or null -> 404)
    R->>T: pg.Client(discrete fields, connectionTimeoutMillis) — always, motor not consulted
    alt reachable and authorized
        T-->>R: connected
        R->>T: SELECT 1
        T-->>R: 1
        R->>R: client.end() (finally)
        R-->>C: 200 {resultado:"ok", categoria:null}
    else bad password (28P01)
        T-->>R: error.code = 28P01
        R->>R: classify -> credenciales-invalidas; client.end() (finally)
        R-->>C: 200 {resultado:"fallo", categoria:"credenciales-invalidas", codigo:"28P01"}
    else unreachable host (no response)
        R->>R: own timer wins the race at connectionTestTimeoutMs; client.end() issued (finally)
        R-->>C: 200 {resultado:"fallo", categoria:"tiempo-agotado"}
    end
```

## File changes

| File | Action | Description |
|---|---|---|
| `src/conexiones.ts` | Create | `registerConexionRoutes(app, prisma)` — both routes, JSON schemas, tenant resolution, `ConexionPublica` select, sanitized logging. Follows `src/health.ts`'s `register<X>Route(app, prisma)` signature exactly. |
| `src/db-probe.ts` | Create | `probeConnection()` and `classifyConnectionError()`. Separate from the route so the classifier is unit-testable without HTTP and the raw-error containment boundary is one reviewable file. |
| `src/server.ts` | Modify | One import + one `registerConexionRoutes(app, prisma)` call beside the existing `registerHealthRoute(app, prisma)`. |
| `src/config.ts` | Modify | Add `connectionTestTimeoutMs` (optional `CONNECTION_TEST_TIMEOUT_MS`, default `5000`, positive-integer validation mirroring `APP_PORT`). |
| `.env.example` | Modify | Document `CONNECTION_TEST_TIMEOUT_MS` as optional with its default. |
| `package.json` | Modify | Add `@types/pg` to `devDependencies` only — see below. |

**Dependency correction (verified against `package.json`, not assumed):** the proposal states `pg` is only transitive via `@prisma/adapter-pg`. It is not — CH-01 already lists `"pg": "^8.23.0"` as a direct runtime dependency, because the driver adapter needs it directly. So no runtime dependency is added by this change. What *is* missing is `@types/pg`: `pg` ships no bundled types, and `tsconfig.json` has `"strict": true`, so `import pg from 'pg'` fails to compile without it. `skipLibCheck: true` does not help — it skips checking declaration files, it does not invent them.

## Testing strategy

| Layer | What | Approach |
|---|---|---|
| Unit | `classifyConnectionError` rows 1–8 | Synthetic error objects per row, plus a non-`Error` throw and an unknown `code` asserting `codigo: null` |
| Unit | Sanitization | Assert an error carrying `connectionParameters.password` and a `stack` yields a summary containing neither |
| Integration | Register + probe | `POST /conexiones` then `POST /:id/prueba` against the Compose `db` service (success), a wrong password (`28P01`), a nonexistent database (`3D000`), and an unroutable host (timeout within the budget) |
| Smoke | End-to-end | Extend the `scripts/smoke.sh` convention with a CH-03 script covering the four cases above and asserting no response body contains the submitted credential |

The research gap on exact codes is closed here: the integration cases against a deliberately misconfigured target are the smoke test obs #25 recommended.

## Threat matrix

`N/A` for every row in `references/threat-matrix.md` — this change adds no shell command, subprocess, VCS/PR automation, executable-file classification, or process integration. Its genuine adversarial boundary is credential leakage and an outbound dial to a client-supplied host; both are handled above (credential safety 1–4; the bounded `connectionTimeoutMillis` caps the dial). Outbound-destination restriction (SSRF allowlisting) is not in R0's threat model — one operator registers one tenant's replica — and is noted for the hardening change (CH-07) rather than invented here.

## Migration / rollout

No migration and no schema change; CH-02's `Conexion` model is used as-is. Rollback is reverting the commit (two new files, three edited lines, one devDependency). Rows already registered are orphaned but harmless.

## Scope check against the proposal's success criteria

| Criterion (proposal.md) | Covered by |
|---|---|
| A connection registers and persists as a `Conexion` row for the seeded tenant | Decision 2 (`POST /conexiones`, `201`) + Decision 4 (server-side tenant resolution) |
| Testing a reachable PostgreSQL target returns a success result | Probe mechanics + `200 {resultado:"ok"}` |
| Unreachable host, bad password, and missing database return distinguishable results | Classification table rows 1–2 / 5 / 6 |
| No credential value appears in any response, error, or log line | Credential safety 1–4 + `ConexionPublica` allowlist |
| A test against an unreachable host returns within the bounded timeout | The probe's own timer raced against `connect()` at `connectionTestTimeoutMs`, with `connectionTimeoutMillis` as the driver-side backstop (C2); classification row 1 |
| Failure legibility for a non-Postgres engine (Decision 1) | Probe always attempted against the stored host/port; the driver error is classified through the existing table into `error-desconocido` (rows 7–8), returned in the normal `200 {resultado:"fallo", categoria}` envelope |

## Scope check against the spec's scenarios

The proposal's criteria are not the only contract this design must satisfy; drift is only caught if `spec.md`'s scenarios are reconciled explicitly. Every scenario in `specs/connection-registration/spec.md` is covered by the sections above; the one that previously diverged is pinned here:

| Scenario (spec.md) | Covered by |
|---|---|
| "Testing a connection with a non-PostgreSQL engine value" — the system SHALL **still attempt** the fixed PostgreSQL probe against the stored host and port, and report a legible failure rather than hanging, crashing, or reporting false success | Decision 1 as corrected: `motor` never gates or branches the probe, so the fixed probe runs against the stored `host`/`puerto` in every case; the driver error is classified by `classifyConnectionError` (normally `error-desconocido`, the same bucket as the spec's "Other unclassified failure" scenario) and returned as `200 {resultado:"fallo", categoria, codigo}`. Hanging is excluded by the mandatory `connectionTimeoutMillis`; crashing by the catch-everything boundary in `probeConnection()`; false success by requiring a completed `SELECT 1` |

## Out of scope (unchanged from proposal.md)

No read-only enforcement (A3, CH-04), no credential encryption at rest (A2, CH-07), no per-query timeout or row limits (A4, CH-07), no tenant CRUD/isolation/picker (T-block, CH-06), no UI, no query execution beyond the fixed `SELECT 1` probe, no listing or editing of registered connections beyond what the two routes above return.
