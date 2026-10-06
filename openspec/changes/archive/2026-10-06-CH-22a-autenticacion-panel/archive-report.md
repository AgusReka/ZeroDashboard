# Archive Report: CH-22a — Panel Authentication, Client User, Session and Strict Tenant Derivation (T3)

**Archive Date**: 2026-10-06  
**Change Name**: CH-22a-autenticacion-panel  
**Status**: COMPLETE  
**Final Commits on Master**:
- PR #99: `docs(ch22a)` DEC-133 a DEC-136 y planificacion (merge commit `8523e38`, branch `ch22a/exploracion`)
- PR #100: `feat(ch22a)` autenticación del panel (merge commit `0c1b17b`, branch `ch22a/panel-auth`)

## Executive Summary

CH-22a delivered client panel authentication (T3) and closed with a single code PR (#100) carrying a maintainer-approved `size:exception` — 1951 authored code lines per the line-count checkpoints in `apply-progress.md` (~1954 in the orchestrator launch prompt; the artifacts' git-numstat total of 1951 is authoritative here). All implementation commits `3238249..39580e3` plus the corrective test are verified present on `master` behind the `0c1b17b` merge.

What shipped:

- **Login session via cookie**: `POST /api/panel/auth/ingresar` validates credentials against `Usuario` and sets an `HttpOnly`, `Secure`, `SameSite=Lax` cookie (`zd_panel_session`, 30-day TTL, `Path=/`); only the SHA-256 token hash is persisted in `SesionPanel` (DEC-133, DEC-134). Logout revokes the session row and clears the cookie; expired sessions fail closed with `401`.
- **Tenant resolved server-side from the session**: all panel routes derive the active tenant exclusively from the validated `SesionPanel` row; `X-Tenant-Id` headers and URL parameters are ignored on panel routes (Rule 2, DEC-135). Two-tenant isolation is proven by automated tests over the real routes.
- **Login screen and shell served by the panel server**: `GET /panel` renders the P-01 login form unauthenticated, or the authenticated shell with the tenant business name (DEC-04, DEC-136). Manual visual review (task 3.4) by the maintainer: 4/4 points OK on 360/1280 px, light/dark themes, login→shell→Salir flow and 401 page, against the local HTTPS stack (cookie `Secure`, DEC-134).
- **Non-negotiable rules preserved**: strict read-only enforcement, parameterized queries (no SQL concatenation), no client-supplied tenant id on panel surfaces, data minimization, and the engine-pattern boundary (rules 1–6).

DEC-133 to DEC-136 were approved and closed on 2026-10-06; no new architecture decision surfaced during verification. Gate D-6 (AI-assistant usage declaration) stays open and does not block code.

## Merged Artifacts

### Spec Artifacts

| Spec | Action | Location | What changed |
|------|--------|----------|--------------|
| `client-panel-auth` | Created (new spec) | `openspec/specs/client-panel-auth/spec.md` | New capability spec, 3 requirements / 11 scenarios: client user credential validation (DEC-133), session management via HttpOnly cookie (DEC-134), servable panel surface (DEC-04, DEC-136). |
| `domain-data-model` | Modified | `openspec/specs/domain-data-model/spec.md` | Added requirements: `Usuario` client user model (DEC-133, includes the unique-email constraint scenario) and `SesionPanel` panel session model (DEC-134). 3 scenarios added; all pre-existing requirements preserved. |
| `tenant-isolation` | Modified | `openspec/specs/tenant-isolation/spec.md` | Added requirement: panel tenant derivation is session-locked (Rule 2, DEC-135) — tenant identity on panel routes derives from the authenticated session, not the request header. 2 scenarios added; all pre-existing requirements preserved. |

Composition was performed with the native `gentle-ai sdd-archive-compose` command (byte-preserving for unrelated requirements; deltas were parsed through line-ending-normalized copies because the native parser rejects CRLF deltas on Windows — content proven byte-identical modulo CR with `diff --strip-trailing-cr`). The new `client-panel-auth` spec was copied mechanically with `cp`/`diff -r`/`mv`.

### Change Folder

**Archived to**: `openspec/changes/archive/2026-10-06-CH-22a-autenticacion-panel/`

**Contents** (9 files, verified `diff -r` empty against the pre-move snapshot):

- `proposal.md` — intent, scope, capabilities, approach, affected areas, risks, rollback
- `exploration.md` — prior exploration and DEC evidence input
- `design.md` — data model, crypto module, session/route handlers, panel UI, PR strategy
- `tasks.md` — work breakdown by PR; all tasks `[x]` including 4.2 Archive (marked by this phase)
- `apply-progress.md` — cumulative implementation progress, TDD evidence, deviations, line-count checkpoints, 3.4 manual review record, corrective 4.1 lot
- `verify-report.md` — final verification report (verdict PASS)
- `archive-report.md` — this file
- `specs/` — delta specs for `client-panel-auth`, `domain-data-model`, `tenant-isolation`

## Implementation Summary

### Delivery

`single-pr` with a maintainer-approved `size:exception` (2026-10-06; preflight decision recorded in `tasks.md`). PR1/PR2/PR3 were kept as work units and commits, not separate PRs, all on branch `ch22a/panel-auth`. The docs PR (#99, `ch22a/exploracion`) carried exploration, DEC-133..136, proposal, deltas, design, and tasks.

Implementation commits on `ch22a/panel-auth` (all merged via PR #100, `0c1b17b`):

| Commit | Unit | Content |
|--------|------|---------|
| `3238249` | PR1 | `feat(ch22a): hash panel passwords with scrypt and mint session tokens` |
| `0b346dc` | PR1 | `feat(ch22a): add Usuario and SesionPanel models with an additive migration` |
| `d6f36aa` | PR1 | `feat(ch22a): scope Usuario and SesionPanel through the tenant isolation extension` |
| `5f5c2ce` | PR2 | `feat(ch22a): expose the panel auth surface - session-cookie login, hook, two-tenant isolation` |
| `4a5ac14` | PR3 | `feat(ch22a): servable panel page and login screen` |
| `515cd23` | 4.1 | `test(ch22a): cubrir escenario unique email constraint (P2002)` (corrective slice) |
| `39580e3` | 4.1 | `docs(ch22a): registrar verificacion final 4.1 PASS (16/16 escenarios, 945/945)` |

Line-count checkpoints (git `diff --numstat`, `src` + `prisma`, docs excluded): PR1 447, PR2 947, PR3 557 → **1951 authored lines total** vs ~1700 approved ledger budget. The drift was revalidated by the maintainer in the closure decision of 2026-10-06 (informational, verify-report WARNING 3).

### Final-State Facts vs Intermediate Snapshots

`apply-progress.md` and the pre-corrective verify state are intermediate snapshots. At close: the sole CRITICAL of the prior verify (domain-data-model "Unique email constraint" untested) was remediated by commit `515cd23` (DB-backed P2002 runtime test) and the re-verification passed; task 3.4 was completed by the maintainer (4/4 visual points OK); both PRs merged to `master` on 2026-10-06. `master` is verified to contain `3238249..39580e3` (all implementation commits plus the corrective test).

## Verification Status

- **Verify report** (`verify-report.md`): verdict `pass`, 6/6 requirements, **16/16 scenarios COMPLIANT**, 0 blockers, 0 CRITICAL (evidence_revision `sha256:60997e28…`)
- **Full suite**: `TEST_DB_PORT=5434 npm test` → **945/945** pass, exit 0 (CH-22a suites: crypto 22/22, panel auth routes 11/11, two-tenant isolation 5/5, `GET /panel` 4/4; corrective P2002 test included)
- **Type check**: `npx tsc --noEmit` exit 0 (clean, 0-byte output)
- **Build**: `npm run build` exit 0
- **Runtime harness**: live PostgreSQL `zd-ch09-testdb` on 127.0.0.1:5434; migrations applied 11/11 (proves `20261006000000_usuario_sesion_panel` applied)
- **Attempt ledger** (runtime-attempt authority, complete): PR1 533 ✓, PR2 1018 ✓, PR3 634 ✓, `correccion-4.1-unique-email` 58 ✓ (complete), `verify-4.1-final` 313 ✗ (superseded fail), `verify-4.1-final-rerun` 150 ✓ (complete). Ledger objectives `correccion-4.1-unique-email` and `verify-4.1-final-rerun` are complete. RDD was off for this change; delivery followed ordinary repository policy (human merge).

## Open Gates

- **D-6** (declaración de uso de asistentes de IA) remains **open** — does not block code (`docs/01-decisiones.md`).
- Non-blocking warnings carried by the final verify report: `strict_tdd` config mismatch (informational), redundant index on `SesionPanel.tokenHash` (harmless, faithful to `design.md`), size-exception drift revalidated by the maintainer, `tasks.md` branch citations vs actual single branch (documented in apply-progress), corrective lot without artificial RED phase (documented).