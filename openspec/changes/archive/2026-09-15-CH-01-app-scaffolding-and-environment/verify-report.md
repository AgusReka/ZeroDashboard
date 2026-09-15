```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:eb2cb82b5855ab575ff0d19d23a11366dcb18bc5b9b8a0faf1d9deb2f6dec949
verdict: pass
blockers: 0
critical_findings: 0
requirements: 5/5
scenarios: 5/5
test_command: "npm run smoke"
test_exit_code: 0
test_output_hash: sha256:c735945008a9a2933fab11f37f16a25d9c34d88fa8a427778a00521b89b3d370
build_command: "npm run build"
build_exit_code: 0
build_output_hash: sha256:cdab4d00374babb80b5108285b4b859731dcfcb446f462822a095eba9a576a8e
```

`evidence_revision` is `sha256(git rev-parse HEAD)` for commit `1f9fbcb747a94739982b5a5b0178fbd06aa49fd3` — the first commit of this repository, containing exactly what this report verifies.

# Verify Report: CH-01 — Application Scaffolding and Environment

Date: 2026-09-15
Verified against: `proposal.md`, `specs/project-environment/spec.md`, `design.md`, `tasks.md` (all 21 tasks complete).

## Requirement-by-requirement

| Requirement (spec.md) | Verified how | Result |
|---|---|---|
| Reproducible Local Environment | `docker compose up -d --build` from a checked-out tree with `.env` from `.env.example` | `db` reached `healthy`, `app` reached `running` and listening on `APP_PORT`. **PASS** |
| Own Database via Migrations | Restarted the `app` container (re-runs the entrypoint's `prisma migrate deploy`) | First run: schema loaded, no migration files, no-op. Second run: `No pending migrations to apply.`, exit 0, no error. **PASS** |
| Environment-Variable Configuration | Ran the compiled server with `APP_PORT` unset | Failed fast with `Error: Missing required environment variable: APP_PORT` before `listen()`. No source change needed to alter behavior — only env values. **PASS** |
| Secrets Excluded From the Repository | `git status` after `git init` | `.env` untracked and matched by `.gitignore`; `.env.example` contains only placeholder values (`change-me`); no real credential ever existed in this project. **PASS** |
| Verifiable Application Skeleton | `GET /health` in three states: DB reachable, DB stopped, DB restarted | `200 {"status":"ready","db":"connected"}` → `503 {"status":"not-ready","db":"unreachable"}` → `200` again on recovery, without restarting the app process. **PASS** |

All 5 requirements: **PASS**.

## Scope conformance

- No domain model, no tenant/connection/query code present — confirmed by inspection of `prisma/schema.prisma` (zero models) and `src/` (only `config.ts`, `server.ts`, `health.ts`). Matches proposal.md's "Out of Scope".
- No route beyond `GET /health`. Matches design.md.

## Deviations from design.md found and corrected during apply

1. Prisma 7's actual API (driver adapters, `prisma.config.ts`, no `datasource.url` in the schema) differs from the generic ORM description written before implementation — design.md was amended in place with a dated "Prisma 7 architecture note" once discovered, rather than left inconsistent with the code.
2. A real Dockerfile bug (missing `COPY` of `prisma.config.ts` into the runtime stage) was found on the first real `docker compose up` and fixed; design.md and the bitácora both carry the explanation so it isn't lost.

Neither deviation changes what the spec requires — both are implementation-detail corrections, already reflected in the current `design.md`/`Dockerfile`.

## Automated evidence (2026-09-15, second pass)

Turned the manual verification above into a repeatable script, `scripts/smoke.sh` (`npm run smoke`), and ran it plus the build for real:

| Command | Exit code | Output SHA-256 |
|---|---|---|
| `npm run build` | 0 | `cdab4d00374babb80b5108285b4b859731dcfcb446f462822a095eba9a576a8e` |
| `npm run smoke` (`scripts/smoke.sh`) | 0 | `c735945008a9a2933fab11f37f16a25d9c34d88fa8a427778a00521b89b3d370` |

`scripts/smoke.sh` automates the full sequence above end to end: build+bring-up, `/health` while `db` is up, restart `app` and confirm the migrate step is a no-op, stop `db` and confirm `/health` degrades to 503, restart `db` and confirm recovery to 200, then `docker compose down`. Re-running it is the fastest way to re-verify this change after any future edit.

**Not filled in:** the native `gentle-ai sdd-verify-validate` envelope (`gentle-ai.verify-result/v1`) additionally wants an `evidence_revision` anchored to a git commit. This repository has no commit yet (`git init` only, by design — committing was left as the user's decision all session, see the bitácora). `git stash create` confirms there is no `HEAD` to hash against. Rather than fabricate that field, it's left out here; see the note to the user about committing before this envelope can be completed.

## Dependency hygiene

`npm audit`: 0 vulnerabilities (after pinning `prisma@7.10.0` away from the default-resolved `8.0.0-rc.x`, and overriding two of its transitively-vulnerable, unused dependencies — `mysql2`, `deepmerge-ts`).

## Non-negotiable rules (docs/00-contexto.md §5)

Only rule 7 (secrets out of the repository) is engaged by this change — verified above. No other rule applies yet (no tenant data, no query execution, no client connection).

## Outstanding

None. All 5 spec scenarios verified against a real running stack; `docker compose down` left nothing running. No git commit exists yet (only `git init`) — committing and archiving remain separate decisions for the user.

## Verdict

**CH-01 is verified.** Ready for `sdd-archive` once the user decides to commit.
