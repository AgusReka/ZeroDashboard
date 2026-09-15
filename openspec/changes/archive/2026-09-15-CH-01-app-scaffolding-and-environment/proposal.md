# Proposal: CH-01 — Application Scaffolding and Environment

## Source

- `docs/02-mapa-de-changes.md`, release R0, CH-01 ("Esqueleto de aplicación y entorno"): Docker Compose, own database, migrations, environment-variable configuration, secrets out of the repository.
- Depends on D-3 (tech stack), resolved as DEC-05 in `docs/01-decisiones.md`: Node.js + TypeScript, own database on PostgreSQL.

## Why

R0 cannot start without a running skeleton: an application process, its own database, and a repeatable way to bring both up. CH-01 is the first change in the sequence and every other R0 change (CH-02 through CH-05) builds on it.

## What Changes

- Add a Docker Compose definition that starts the application container and its own PostgreSQL database with a single command.
- Add a minimal application skeleton (Node.js + TypeScript) that boots, connects to its own database, and reports readiness.
- Add a migration mechanism for the own database; schema changes are applied through migrations, never through manual or ad hoc statements.
- Add environment-variable-based configuration for the application (at minimum: own-database connection, application port); no such value is hardcoded.
- Add an example environment file with placeholder values; the file holding real values is excluded from version control.

## Out of Scope

- Any tenant, connection, or query feature (CH-03 onward).
- The domain data model — `docs/02-mapa-de-changes.md` explicitly requires it to be written before CH-02, not as part of CH-01.
- Choice of specific web framework and ORM/migration library. These are implementation details resolved at design time for this change, not part of this specification.

## Non-Negotiable Rules in Effect

Per `docs/00-contexto.md` §5 (see `AGENTS.md` for the full list, transcribed there):

- Rule 7 (secrets out of the repository) is directly engaged by this change.
- No other rule is engaged yet: this change introduces no tenant data, no query execution, and no client connection.

## Rollback Plan

The change is additive scaffolding with no production data and no prior state to preserve. Rollback is `docker compose down -v` plus reverting the commit; there is no migration to reverse beyond dropping the freshly created own database.

## Impact

- New capability: `project-environment` (see `specs/project-environment/spec.md`).
- No existing spec is modified — the project is greenfield and `openspec/specs/` is currently empty.
