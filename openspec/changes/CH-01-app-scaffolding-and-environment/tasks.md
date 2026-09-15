# Tasks: CH-01 — Application Scaffolding and Environment

Derived from `design.md`. Each group is completable in one sitting; verification tasks map directly to the scenarios in `specs/project-environment/spec.md`.

## 1. Repository and secrets

- [x] 1.1 `git init` at the repo root
- [x] 1.2 `.gitignore` excluding `.env`, `node_modules/`, build output (`dist/`), and Prisma's generated client output
- [x] 1.3 `.env.example` with placeholder values for all six environment variables from `design.md`
- [x] 1.4 Local `.env` created from `.env.example` for development (not committed)

## 2. Application skeleton (Node.js + TypeScript + Fastify)

- [x] 2.1 `package.json` — TypeScript, Fastify, Prisma dependencies; `build`/`start`/`dev` scripts
- [x] 2.2 `tsconfig.json`
- [x] 2.3 `src/config.ts` — loads and validates the required environment variables, fails fast on startup if one is missing
- [x] 2.4 `src/server.ts` — Fastify instance, listens on `APP_PORT`
- [x] 2.5 `src/health.ts` — `GET /health` route per `design.md`'s readiness check

## 3. Own database (PostgreSQL + Prisma)

- [x] 3.1 `prisma/schema.prisma` — `datasource`/`generator` blocks only, zero models (domain model is CH-02, not this change). Prisma 7 moved the connection URL out of the schema into `prisma.config.ts` — see `design.md`'s "Prisma 7 architecture note"
- [x] 3.2 Prisma migrations wiring configured (`prisma.config.ts` `migrations.path`); the `prisma/migrations/` folder itself is created by Prisma on the first successful `migrate deploy` against a reachable database — not run in this sandbox (no Docker/Postgres available here, see group 5)
- [x] 3.3 Wire the Prisma client into `src/health.ts` for the `SELECT 1` check (driver-adapter form: `PrismaPg` from `@prisma/adapter-pg`)

## 4. Docker Compose

- [x] 4.1 `Dockerfile` for `app` — build TypeScript, run the entrypoint script
- [x] 4.2 Entrypoint script — `prisma migrate deploy`, then start the server; non-zero exit from migrate stops the container instead of starting with an unmigrated schema
- [x] 4.3 `docker-compose.yml` — `db` (`postgres:16-alpine`, healthcheck, named volume, env from `.env`) and `app` (build context, `depends_on: db` with `condition: service_healthy`, env from `.env`, `APP_PORT` mapped)

## 5. Verification (maps to spec.md scenarios)

Docker was unavailable in the sandbox that ran the apply phase (2026-09-15, first pass). Re-run on 2026-09-15 (second pass) once Docker was installed — see `docs/bitacora/CH-01-esqueleto-de-aplicacion-y-entorno.md` for the fricción found and fixed along the way (`prisma.config.ts` was missing from the runtime image's `COPY` list).

- [x] 5.1 Clean-checkout bring-up: `docker compose up -d --build` — both `db` and `app` reached a running state (`db` healthy, `app` listening on 3000)
- [x] 5.2 Migration idempotency: `docker compose restart app` re-runs the entrypoint's `prisma migrate deploy` — second run logged `No pending migrations to apply.` and the container stayed up
- [x] 5.3 Config-by-env, fail-fast half: confirmed `src/config.ts` throws `Missing required environment variable: APP_PORT` when unset, before the server starts listening. The "change a value, restart, see it take effect" half is trivial given this and not separately re-tested
- [x] 5.4 Secrets check: `git status` after `git init` shows `.env` untracked-and-ignored (matched by `.gitignore`), `.env.example` contains only placeholder values (`change-me`, no real credentials existed to leak)
- [x] 5.5 Readiness check: both paths confirmed against the real compose stack — `GET /health` → `200 {"status":"ready","db":"connected"}` while `db` is up; stopped `db` → `503 {"status":"not-ready","db":"unreachable"}`; restarted `db` → back to `200` (recovery, bonus check beyond what the scenario required)

## 6. Project process (per `docs/02-mapa-de-changes.md`)

- [x] 6.1 Bitácora entry for CH-01 at `docs/bitacora/` using the `docs/_plantilla.md` template — date, friction encountered, time spent

## Review Workload Forecast

Rough estimate across groups 1–4 (config/build files, ~10 small new files, no generated code checked in): ~250–300 changed lines. Well under the 400-line PR budget.

- Chained PRs recommended: No
- 400-line budget risk: Low
- Decision needed before apply: No

Delivery strategy on file: `auto-chain` (from SDD Session Preflight). Since this forecast is under budget, apply proceeds as a single PR-equivalent change; chaining logic does not trigger.
