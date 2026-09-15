# Archive Report: CH-01 — Application Scaffolding and Environment

Archived: 2026-09-15

## Outcome

Verified — all 5 requirements in `specs/project-environment/spec.md` pass against a real Docker Compose stack (see `verify-report.md`). Merged into `openspec/specs/project-environment/spec.md` as the new `project-environment` capability (no prior main spec existed — greenfield project).

## Final state

- 21/21 tasks complete (`tasks.md`).
- `npm run build`: exit 0.
- `npm run smoke` (`scripts/smoke.sh`, automates the full Docker-based verification): exit 0.
- `npm audit`: 0 vulnerabilities.
- First commit of the repository: `1f9fbcb747a94739982b5a5b0178fbd06aa49fd3`.

## What this change delivered

The R0 skeleton required by `docs/02-mapa-de-changes.md`: Node.js + TypeScript (Fastify) application, own PostgreSQL database managed by Prisma 7 (driver-adapter architecture), Docker Compose bring-up, environment-variable configuration, and secrets kept out of the repository. `git init` ran for the first time in this project as part of this change.

Two real bugs were found and fixed along the way (not just planned and executed cleanly) — see `docs/bitacora/CH-01-esqueleto-de-aplicacion-y-entorno.md` for the full, dated friction log (9 entries): a default-resolved Prisma release candidate pulling in an unrelated dependency tree, and a Dockerfile missing `prisma.config.ts` in its runtime-stage `COPY` list, only caught once verification ran against a real Docker stack instead of stopping at "it compiles."

## What CH-01 explicitly does not include

No domain data model (required by `docs/02-mapa-de-changes.md` to be written before CH-02), no tenant/connection/query functionality. `prisma/schema.prisma` has zero models by design.

## Follow-ups for later changes

- CH-02 (data model) is the next change per `docs/02-mapa-de-changes.md` and must write the domain model before its own spec.
- The `project-environment` capability now exists in `openspec/specs/` — later changes that touch env vars, Docker Compose, or the own database should delta against it rather than redefine it.
