# Proposal: CH-02 — Initial Data Model

## Source

- `docs/02-mapa-de-changes.md`, release R0, CH-02 ("Modelo de datos inicial"): "Escribir el modelo antes de este change. Entidades de la sección 8 del contexto." This change *is* that model, written now — `docs/02-mapa-de-changes.md`'s own "Pendientes fuera del código" list has carried "Escribir el modelo de datos antes de CH-02" since before CH-01 started.
- `docs/00-contexto.md` §8: the eight named domain entities (`tenant`, `conexion`, `consulta_guardada`, `plantilla`, `automatizacion`, `ejecucion`, `mapeo`, `usuario`) that the model must stay consistent with, even though not all of them are in scope for this change.
- `docs/01-decisiones.md`, DEC-06 (added by this change's exploration): a minimal `tenant` entity is introduced now rather than deferred to CH-06.

## Why

CH-01 deliberately left `prisma/schema.prisma` with zero models so this change could define them. CH-03 (connection registration, story A1) and CH-05 (saved queries, story B2) both need tables to persist into; neither can be specified without this change first fixing the shape of `conexion` and `consulta_guardada`.

## What Changes

- Add three Prisma models to `prisma/schema.prisma`: `Tenant`, `Conexion`, `ConsultaGuardada`.
- Add the corresponding Prisma migration, applied through the existing `prisma migrate deploy` path (wired in CH-01's Docker entrypoint — no new migration mechanism).
- Seed exactly one `Tenant` row so `Conexion` and `ConsultaGuardada` (both `NOT NULL` foreign keys to `Tenant`) have somewhere to point in R0, ahead of CH-06's real tenant lifecycle (alta/baja, story T1).

## Out of Scope

- **Tenant isolation and lifecycle** (stories T1, T2, T4) — CH-06, R1. This change gives every relevant table a `tenantId` column so CH-06 extends instead of migrating a backfill later (DEC-06), but adds no alta/baja, no listing, no per-request tenant resolution, and no isolation enforcement. R0 operates against the single seeded row.
- **Credential encryption** (story A2) — R1. `Conexion.credencial` is a plain string column in this change. Whatever writes real credentials into it (CH-03) inherits an unencrypted column until A2 lands; this change does not claim otherwise anywhere in the schema or its naming.
- **Execution/audit log** (stories X2, A5) — R1/R2. Query execution in R0 (CH-04, story B1) is transient: shown in a paginated table, not persisted as its own entity. No `ejecucion` table in this change.
- **`usuario` / authentication** — story T3 is R2 (panel login). R0 has a single implementer (P1) operating the console directly; no login, no `usuario` table.
- **`plantilla`, `automatizacion`, `mapeo`** — R1 concepts (blocks D, X, M in `docs/mapa-historias.md`). Not modeled here.
- **Database engine choice for `Conexion.motor`** — depends on open gate D-4 (`docs/01-decisiones.md`). Stored as a plain string, not an enum, so this change does not prematurely narrow that gate.
- Choice of concrete migration file contents / naming beyond Prisma's own generated migration — implementation detail resolved at apply time, not part of this specification.

## Non-Negotiable Rules in Effect

Per `docs/00-contexto.md` §5 (see `AGENTS.md`):

- Rule 5 (minimización de datos): none of the three models stores personal data belonging to a tenant's own customers — `Conexion` holds connection metadata, `ConsultaGuardada` holds SQL text and description authored by P1.
- Rule 7 (secrets out of the repository): unaffected by this change — no seed data or migration in this change contains a real credential; the seeded `Tenant` row carries no secret.
- No other rule is newly engaged: this change adds no query execution path, no panel surface, and no motor logic.

## Rollback Plan

Additive migration against a database with no prior domain data (CH-01 shipped zero domain models). Rollback is reverting the commit and re-running `prisma migrate deploy` against a database reset to CH-01's state (or `prisma migrate reset` in a non-production environment); there is no production data to preserve at this point in the project.

## Impact

- New capability: `domain-data-model` (see `specs/domain-data-model/spec.md`).
- No existing spec is modified — `project-environment` (CH-01) is untouched.
- Unblocks CH-03 (connection registration) and CH-05 (saved queries), both of which depend on the tables this change creates.
