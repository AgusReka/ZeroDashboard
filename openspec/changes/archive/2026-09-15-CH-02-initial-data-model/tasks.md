# Tasks: CH-02 — Initial Data Model

Derived from `design.md`. Verification tasks map directly to the scenarios in `specs/domain-data-model/spec.md`.

## 1. Schema

- [x] 1.1 Add `Tenant`, `Conexion`, `ConsultaGuardada` models to `prisma/schema.prisma` per `design.md`
- [x] 1.2 Generate the Prisma migration (`prisma migrate dev` at implementation time, against a reachable dev database) — see `design.md`'s "Migration generation environment note" for how this was actually run
- [x] 1.3 Regenerate the Prisma client (`prisma generate`) so `src/generated/prisma` reflects the new models

## 2. Seed

- [x] 2.1 Add a seed step that inserts exactly one `Tenant` row (`nombre: "Food Store"`) only when the table is empty
- [x] 2.2 Wire the seed step into the existing CH-01 Docker entrypoint, after `prisma migrate deploy` and before the server starts — import path amended during apply, see `design.md`

## 3. Verification (maps to spec.md scenarios)

All verified against a real `docker compose up -d --build` stack (`db` + `app`), 2026-09-15.

- [x] 3.1 Fresh migration: reset the db volume, brought the stack up from scratch — logs show `Applying migration 20260915224714_init_domain_model`, then `Seed: created tenant "Food Store" (...)`. Confirmed via `psql \dt`: `Conexion`, `ConsultaGuardada`, `Tenant`, `_prisma_migrations` — exactly one `Tenant` row
- [x] 3.2 Idempotent re-run: `docker compose restart app` — logs show `No pending migrations to apply.` then `Seed skipped: 1 tenant row(s) already present.`, no error
- [x] 3.3 `Conexion` FK: valid insert referencing the seeded tenant succeeded; insert with a non-existent `tenantId` rejected with `violates foreign key constraint "Conexion_tenantId_fkey"`
- [x] 3.4 `ConsultaGuardada` FK: valid insert (no `descripcion`) referencing the seeded tenant succeeded; insert with a non-existent `tenantId` rejected with `violates foreign key constraint "ConsultaGuardada_tenantId_fkey"`. Manual verification rows from 3.3/3.4 deleted afterward, leaving only the seeded `Tenant` row
- [x] 3.5 `psql \dt` confirms exactly `Conexion`, `ConsultaGuardada`, `Tenant` as domain tables (plus Prisma's own `_prisma_migrations`) — none of `Usuario`/`Ejecucion`/`Plantilla`/`Automatizacion`/`Mapeo`

Bonus checks beyond the scenarios: `GET /health` → `200 {"status":"ready","db":"connected"}` after bring-up (CH-01's readiness check still passes against the extended schema); `npm run build` (`tsc`) is clean with the regenerated Prisma client.

## 4. Project process (per `docs/02-mapa-de-changes.md`)

- [x] 4.1 Bitácora entry for CH-02 at `docs/bitacora/` using the `docs/_plantilla.md` template — date, friction encountered, time spent

## Review Workload Forecast

One schema file edit (+~45 lines), one generated migration SQL file (Prisma-authored, not hand-written), a small seed script (~25 lines), and an entrypoint script one-line addition. Total hand-written surface well under 150 lines.

- Chained PRs recommended: No
- 400-line budget risk: Low
- Decision needed before apply: No

Delivery strategy on file: `auto-chain` (from this session's SDD Session Preflight). Forecast was well under budget — apply proceeded as a single PR-equivalent change; chaining logic did not trigger.
