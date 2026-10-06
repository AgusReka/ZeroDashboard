```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:60997e288821574efb462efa06890ae795e047e10d94c4a7dfb44bfb52873325
verdict: pass
blockers: 0
critical_findings: 0
requirements: 6/6
scenarios: 16/16
test_command: TEST_DB_PORT=5434 npm test
test_exit_code: 0
test_output_hash: sha256:dca183b6b04c7b9553f02e53a2197befdd3f6ead8c5ee4070a12531807f7a764
build_command: npm run build
build_exit_code: 0
build_output_hash: sha256:4cc99727e0df336beb25a4f6150cbe8332bcef1cf3814bb4a6fa3ad852b9898b
```

*Envelope context (not part of the validated schema): change `CH-22a-autenticacion-panel`, schema store `openspec`, mode `strict-tdd` (orchestrator-declared and authoritative; `strict-tdd-verify.md` loaded from disk), `ready: true`, `requirements_passed 6/6`, `scenarios_passed 16/16`, `scenarios_untested 0`, implementation tasks 14/14 complete, closure task 4.1 newly checked by this verification, typecheck `npx tsc --noEmit` exit 0 (empty output, sha256 of empty), coverage threshold 0 (no coverage tooling). This report supersedes the previous `fail` report (one CRITICAL UNTESTED scenario: domain-data-model "Unique email constraint"); the corrective slice commit `515cd23` added the covering DB-backed runtime test.*

## Verification Report

### Change

**CH-22a — Panel Authentication, Client User, Session and Strict Tenant Derivation (T3)**

- **Mode**: Strict TDD (declared by orchestrator, authoritative; `strict-tdd-verify.md` loaded from `C:\Users\messi\.config\opencode\skills\sdd-verify\strict-tdd-verify.md`). RED→GREEN evidence cross-checked from `apply-progress.md` (PR1, PR2, PR3 and the corrective 4.1 lot), git history, and actual test execution.
- **Artifact set**: proposal, 3 delta specs (`client-panel-auth`, `domain-data-model`, `tenant-isolation`), design, tasks, apply-progress — full set; all four dimensions executed (completeness, correctness, design coherence, runtime evidence).
- **Re-verification scope**: previous verify reported `fail` with a single CRITICAL (domain-data-model "Unique email constraint" had no covering runtime test). The corrective slice (`515cd23`, test-only: `src/panel-auth.test.ts` + `apply-progress.md`) added the covering test; no production code changed. All prior evidence re-executed on the current tree.

### Completeness (tasks.md)

| Unit | Tasks | State |
|---|---|---|
| PR0 Docs | 0.1–0.4 | [x] all checked |
| PR1 Model + crypto | 1.1–1.5 | [x] all checked |
| PR2 Auth routes + isolation | 2.1–2.5 | [x] all checked |
| PR3 Panel page | 3.1–3.4 | [x] all checked (3.4 human visual review recorded in apply-progress; maintainer confirmed the 4 points OK on 2026-10-06 over the local HTTPS stack) |
| Closure | 4.1 verify | **[x] checked by this verification** (16/16 scenarios PASS; all commands exit 0) |
| Closure | 4.2 archive | `[ ]` — pending by plan (after the single PR merges) |

Git history confirms the work units on `ch22a/panel-auth`: `3238249` (crypto), `0b346dc` (schema + migration), `d6f36aa` (model pin), `5f5c2ce` (auth surface), `4a5ac14` (panel page), `515cd23` (corrective P2002 test), plus docs commits. None pushed.

### Command Evidence

| Command | Observed result | Exit |
|---|---|---|
| `npx tsc --noEmit` | clean, no diagnostics (0-byte output) | 0 |
| `TEST_DB_PORT=5434 npm test` (full suite) | `tests 945, suites 147, pass 945, fail 0, cancelled 0, skipped 0, todo 0` (duration 22.3 s) | 0 |
| `npm run build` (`tsc -p tsconfig.json`) | clean emit | 0 |
| Focused CH-22a suites (included in the full run) | `panel auth routes` 11/11, `panel two-tenant isolation` 5/5, `GET /panel` 4/4, `crypto-auth` 22/22 — all pass | 0 |

Coverage: no threshold configured (`openspec/config.yaml` `coverage_threshold: 0`); no coverage tooling in the repo — coverage analysis skipped, not a failure.

Runtime harness: live PostgreSQL in the `zd-ch09-testdb` container on **127.0.0.1:5434** (never 5432; port 5432 is an unrelated Saleor Postgres and was not touched). The passing integration suites create `Tenant`/`Usuario`/`SesionPanel` rows against that database, which independently proves migration `20261006000000_usuario_sesion_panel` is applied (11/11).

`evidence_revision sha256:60997e28…` = digest of the concatenated exact outputs of `npx tsc --noEmit`, `TEST_DB_PORT=5434 npm test`, `npm run build` in that order (files: `tsc.out` 0 B, `test.out`, `build.out`).

### Spec Compliance Matrix

**Specs retrieved** → 6 requirements, 16 scenarios (counted from the `### Requirement:` / `#### Scenario:` headings of the three delta specs; matches the authoritative totals).

#### client-panel-auth (spec.md)

| Scenario | Status | Covering test (passed) | Evidence |
|---|---|---|---|
| Successful login with valid credentials | ✅ COMPLIANT | `panel-auth.test.ts:176` | 200 with `{usuario, tenant}`; cookie `zd_panel_session` with HttpOnly, Path=/, SameSite=Lax, Max-Age=2592000, Secure; `SesionPanel` row stores only the SHA-256 hash (`panel-auth.test.ts:186-203`; `panel-auth.ts:216-264`) |
| Invalid password rejected | ✅ COMPLIANT | `panel-auth.test.ts:206` | 401 `correo-o-clave-incorrectos`, no cookie (`panel-auth.ts:243-246`) |
| Nonexistent email rejected | ✅ COMPLIANT | `panel-auth.test.ts:217` | 401, same generic error, no account oracle (`panel-auth.ts:236-239`) |
| Deactivated user rejected | ✅ COMPLIANT | `panel-auth.test.ts:228` | 401, no session (`panel-auth.ts:237-238`) |
| Deactivated tenant user rejected | ✅ COMPLIANT | `panel-auth.test.ts:235` | 409 `tenant-desactivado`, no cookie (`panel-auth.ts:240-242`) |
| Session token set on cookie | ✅ COMPLIANT | `panel-auth.test.ts:186-192` | Set-Cookie shape with HttpOnly, Path=/, SameSite=Lax (+ Secure, DEC-134) (`panel-auth.ts:83-88`) |
| Reading active session state | ✅ COMPLIANT | `panel-auth.test.ts:282` | 200 `{usuario:{id,correo,nombre}, tenant:{id,nombre}}` (`panel-auth.ts:281-307`) |
| Logging out terminates session | ✅ COMPLIANT | `panel-auth.test.ts:254` | row deleted (not marked), cookie emptied with Max-Age=0, token → 401 afterwards (`panel-auth.ts:266-279`) |
| Expired session is rejected | ✅ COMPLIANT | `panel-auth.test.ts:306` | 401 `sesion-expirada`, expired row cleaned up on use (`panel-auth.ts:148-155, 198-200`) |
| Unauthenticated request serves login form | ✅ COMPLIANT | `panel.test.ts:139` | login screen with `correo`/`clave` fields, form action `/api/panel/auth/ingresar`, stylesheet link, no tenant leak (`panel.ts:108-183`) |
| Authenticated request serves panel shell | ✅ COMPLIANT | `panel.test.ts:165` | shell with tenant store name (escaped: `&`/`<` pinned via `Tienda & Cía <prueba>`), Salir button, no login form, no token leak (`panel.ts:193-224`) |

#### domain-data-model (spec.md)

| Scenario | Status | Covering test (passed) | Evidence |
|---|---|---|---|
| Creating a client user | ✅ COMPLIANT | exercised at runtime by every CH-22a fixture: `panel-auth.test.ts:128-136`, `aislamiento-panel.test.ts:108-116`, `panel.test.ts:106-108` | rows persist linked to `tenantId` and are read back by login lookup (`aislamiento-prisma.ts:179-214`) and session lookup; schema `Usuario` matches design (`schema.prisma:249-262`; migration `20261006000000_usuario_sesion_panel/migration.sql:13-24`) |
| **Unique email constraint** | ✅ COMPLIANT | `panel-auth.test.ts:339` — "the database rejects a second Usuario with the same correo (P2002, unique email)", passed at runtime (11/11 in `panel auth routes`) | DB-backed test: GIVEN the fixture `a` row (`panel-auth.test.ts:99`), a second `db.usuario.create` with the same `correo` (same `tenantId`, so only the global unique index can refuse it) is rejected with `Prisma.PrismaClientKnownRequestError` code `P2002` via the canonical `conCodigo` matcher (`panel-auth.test.ts:331-332`, same matcher as `src/aislamiento.test.ts`), and the follow-up `count` proves the duplicate never persisted (`panel-auth.test.ts:355`). Constraint mechanism: `correo String @unique` (`schema.prisma:253`) and `CREATE UNIQUE INDEX "Usuario_correo_key"` (`migration.sql:39`), applied 11/11 on 5434 |
| Creating a session record | ✅ COMPLIANT | `panel-auth.test.ts:196-203` | `SesionPanel` row persists with only the token hash, `usuarioId`, `tenantId`, future `expiraEn`; expiry TTL 30 days (`panel-auth.ts:248-257`; schema `schema.prisma:275-287`) |

#### tenant-isolation (spec.md)

| Scenario | Status | Covering test (passed) | Evidence |
|---|---|---|---|
| Panel requests never use X-Tenant-Id | ✅ COMPLIANT | `aislamiento-panel.test.ts:155`; `panel.test.ts:165, 194` | `X-Tenant-Id: <tenant-b>` on `/api/panel/auth/sesion` and on `GET /panel` is ignored; the answer names Tenant A only; the panel surfaces are exempt from the header hooks by exact rows (`contexto-tenant.ts:141-145, 169-187`) and the tenant enters from the session row (`panel-auth.ts:144, 253, 290`; DEC-135) |
| Two-tenant panel authentication isolation | ✅ COMPLIANT | `aislamiento-panel.test.ts:165, 175, 185, 204` | B's cookie answers Tenant B even with `X-Tenant-Id: A`; each `tokenHash` resolves to the tenant that minted it; scoped reads inside A's session tenant see only A's rows; B's logout deletes only B's session, A's keeps working (`aislamiento-prisma.ts:227-260` audited lookups; `conTenantActivo` scoping `contexto-tenant.ts:85-87`) |

**16 scenarios: 16/16 COMPLIANT (all with passing runtime tests).**

### Correctness (behavior vs spec)

| Check | Result | Evidence |
|---|---|---|
| Credential hashing with `node:crypto.scrypt`, random 16-byte salt, `s1:<salt>:<key>` envelope, timing-safe comparison | PASS | `crypto-auth.ts:60-95`; 22 unit tests (`crypto-auth.test.ts:22-170`) incl. malformed-hash fail-closed cases and constant-time source pin |
| Session token: 32 random bytes base64url + SHA-256 hash stored; raw token never in DB | PASS | `crypto-auth.ts:105-118`; `panel-auth.test.ts:194-203`; `aislamiento-panel.test.ts:175-183` |
| Fail-closed, generic 401 with no account oracle | PASS | `panel-auth.ts:236-246`; `panel-auth.test.ts:206-233` |
| Strict login body: stray `tenantId` → 400 `solicitud-invalida` naming the field | PASS | `panel-auth.ts:71-80, 219-229`; `panel-auth.test.ts:242-252` |
| Panel route pre-handler hook resolves session before handler; optional mode for `GET /panel`; 401/409 exact codes | PASS | `panel-auth.ts:185-208`; `panel-auth.test.ts:300-328`; `panel.test.ts:210-220` |
| Scoped models fail closed without tenant context | PASS | `aislamiento.test.ts:1352-1385` (CH-22a L1); model-list pin `aislamiento.test.ts:1257-1275` |
| Unique email enforced by the database at runtime (duplicate `correo` → P2002, no row persisted) | PASS | `panel-auth.test.ts:339-356` (new corrective test) |

### Coherence (Design)

| Design statement | Status | Evidence |
|---|---|---|
| `Usuario`/`SesionPanel` model shapes, reverse relations on `Tenant`, additive migration | PASS | `schema.prisma:29-30, 249-287`; `migration.sql` (additive, header + rollback); migrations applied 11/11 on 5434 |
| `MODELOS_AISLADOS` adds both models | PASS (deviation: list lives in `src/aislamiento-prisma.ts:40-49`, not `contexto-tenant.ts` as cited — documented `apply-progress.md`; applied at the real location) | `aislamiento-prisma.ts:40-49`; pin `aislamiento.test.ts:1257-1275` |
| `hashearClave`/`verificarClave`/`generarTokenSesion` per §2 | PASS (deviation: `promisify(scrypt)` replaced by typed `derivarClave` wrapper — same async property, documented) | `crypto-auth.ts:36-46, 60-109` |
| Cookie `zd_panel_session`, HttpOnly/Lax/Path=//30-day TTL; three public endpoints; session hook enters context with session tenant | PASS (deviation: design names `entrarContextoTenant`; repo's actual export is `conTenantActivo` — used, documented) | `panel-auth.ts:34-39, 83-93, 141-145`; `contexto-tenant.ts:141-145` |
| `GET /panel` serves login (P-01) or shell with tenant name, `/ui/styles.css`, tenant resolved inside handler (optional-mode hook), NOT in `RUTAS_PANEL_PUBLICAS` | PASS | `panel.ts:233-244`; `contexto-tenant.ts:162-173`; `panel.test.ts:139-220` |

No unregistered architecture decision found: DEC-133 to DEC-136 are recorded in `docs/01-decisiones.md` (declared closed 2026-10-06) and no new decision surfaced during re-verification.

### TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ✅ | TDD Cycle Evidence tables present in `apply-progress.md` (PR1, PR2, PR3, corrective 4.1 lot) |
| All tasks have tests | ✅ | 14/14 implementation tasks; test files exist: `crypto-auth.test.ts`, `panel-auth.test.ts`, `aislamiento-panel.test.ts`, `panel.test.ts`, extended `aislamiento.test.ts` |
| RED confirmed (tests exist) | ✅ | 4/4 CH-22a test files verified on disk; RED phases recorded (ERR_MODULE_NOT_FOUND for 1.1/2.1/2.2/3.1, genuine failing red for the 1.4 L1 pin) |
| GREEN confirmed (tests pass) | ✅ | 42/42 CH-22a tests pass on execution (22 crypto + 11 panel-auth + 5 isolation + 4 panel); full suite 945/945 |
| Triangulation adequate | ✅ | Multi-case per behavior across the suites; the corrective 4.1 lot is a single additive test for a single spec scenario (correctly 1:1, documented as verification-gap lot, not TDD pair) |
| Safety Net for modified files | ✅ | Recorded per lot (PR1: `aislamiento.test.ts` 60/60 before edit; PR2/PR3 regression runs; corrective lot: existing 10 `panel-auth` cases preserved — 11/11 after) |
| Assertion Quality Audit | ✅ | See dedicated section below |

**TDD Compliance**: 7/7 checks passed. The corrective 4.1 lot had no RED phase by design — the constraint already existed since PR1 and forcing a RED would require dropping the unique index on the shared test database; the apply-progress documents this explicitly (noted, non-blocking).

### Test Layer Distribution

| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit | 22 | 1 (`crypto-auth.test.ts`) | node:test via tsx |
| Integration | 20 | 3 (`panel-auth.test.ts` 11, `aislamiento-panel.test.ts` 5, `panel.test.ts` 4) | node:test via tsx + app.inject against live PostgreSQL |
| E2E | 0 | 0 | none installed (manual visual review task 3.4 covers the browser flow) |
| **Total** | **42** | **4** | |

No layer uses tools outside the detected capabilities (no testing-library/playwright/cypress; human visual review 3.4 recorded for the E2E dimension).

### Changed File Coverage

Coverage analysis skipped — no coverage tool detected (`openspec/config.yaml` `coverage_threshold: 0`; no coverage tooling in the repo). Not a failure.

### Assertion Quality

**Assertion quality**: ✅ All assertions verify real behavior.

Audit of the corrective test (`panel-auth.test.ts:339-356`): the new test calls real production paths (raw `db.usuario.create` against the live database), asserts a concrete failure category (`Prisma.PrismaClientKnownRequestError` with code `P2002` via the canonical `conCodigo` matcher, not a type-only or tautological check), and proves the negative outcome with a value assertion (`count === 1`). No tautologies, ghost loops, smoke-only tests, or mock-heavy patterns in the CH-22a suites.

### Quality Metrics

**Linter**: ➖ Not available (no linter configured).
**Type Checker**: ✅ No errors (`npx tsc --noEmit` exit 0 on the current tree).

### Issues

**CRITICAL**: None — the sole previous CRITICAL (UNTESTED "Unique email constraint") is now covered by a passing DB-backed runtime test.

**WARNING** (all carried over from the prior verify, none blocking):

1. **Strict TDD configuration mismatch (informational).** `openspec/config.yaml` reports `strict_tdd: false`; the orchestrator declared `STRICT TDD MODE IS ACTIVE`, which is authoritative per the decision gates and was applied. RED→GREEN discipline is evidenced per lot in `apply-progress.md`, and `strict-tdd-verify.md` was loaded from disk for this run.
2. **Redundant index on `SesionPanel.tokenHash`** (`@@index([tokenHash])` alongside `@unique`, `schema.prisma:286` + `migration.sql:51`): two indexes over the same column. Kept faithful to `design.md`; harmless but redundant; `prisma validate` accepts it.
3. **Size-exception drift**: 1951 authored lines vs ~1700 approved budget. Revalidated by the maintainer in the closure decision of 2026-10-06 per `apply-progress.md`. Informational.
4. **tasks.md branch citations** (`ch22a/modelo-y-crypto`, `ch22a/rutas-autenticacion`) vs actual single branch `ch22a/panel-auth` — recorded in `apply-progress.md`; headers intentionally untouched.
5. **Corrective lot without RED phase (documented).** The 4.1 verification-gap test targets a constraint implemented since PR1; a genuine RED would require mutating the shared test-database schema (dropping the unique index), out of scope and destructive. Explicitly documented in `apply-progress.md`, section "Corrección 4.1". Non-blocking.

**SUGGESTION**:

6. The `Secure` cookie attribute means browsers on plain `http://localhost` will not store the cookie; documented in `panel.ts:33-35` and validated by the maintainer in task 3.4 over the local HTTPS stack (all 4 visual points OK). Keep as-is.

### Final Verdict

**PASS (READY)** — all 16/16 spec scenarios COMPLIANT with passing runtime tests (including the now-covered "Unique email constraint" P2002 test), all implementation tasks and closure task 4.1 complete: `npx tsc --noEmit` exit 0, `TEST_DB_PORT=5434 npm test` 945/945 exit 0, `npm run build` exit 0, migrations applied 11/11 on 5434. Non-blocking warnings only. Next phase per plan: open the single code PR, then run `sdd-archive` (4.2) after the merge.