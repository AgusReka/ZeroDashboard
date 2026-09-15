# Archive Report: CH-02 — Initial Data Model

Archived: 2026-09-15

## Outcome

Verified — all 4 requirements in `specs/domain-data-model/spec.md` pass against a real Docker Compose stack (see `verify-report.md`). Merged into `openspec/specs/domain-data-model/spec.md` as the new `domain-data-model` capability (no prior main spec existed for it).

## Final state

- 6/6 tasks complete (`tasks.md`).
- `npm run build`: exit 0.
- Fresh `docker compose up -d --build` (db volume reset): migration applied, seed created one `Tenant` row.
- `docker compose restart app`: migration and seed both no-op, idempotent.
- FK enforcement confirmed on `Conexion` and `ConsultaGuardada` (valid insert succeeds, invalid `tenantId` rejected).
- Implementation commit: `10a3049` ("CH-02: modelo de datos inicial").

## What this change delivered

The domain data model required by `docs/02-mapa-de-changes.md` before CH-02 could close: three Prisma models (`Tenant`, `Conexion`, `ConsultaGuardada`) on the own database CH-01 left empty on purpose. `Conexion` and `ConsultaGuardada` carry a required `tenantId` from day one (DEC-06, `docs/01-decisiones.md`) so CH-06 extends the schema instead of migrating a backfill later. A single `Tenant` row ("Food Store") is seeded idempotently by the same Docker entrypoint CH-01 already used for migrations.

Two real bugs were found and fixed during apply, both documented in `design.md` as dated amendments and in `docs/bitacora/CH-02-modelo-de-datos-inicial.md`: the seed script's import path resolved in the build stage but not the runtime image (fixed: import from `dist/` not `src/`), and generating the migration file inside a Docker container (`--rm` or bind-mounted) either lost the file or silently failed to reach the host under this Windows/Git-Bash/Docker-Desktop combination (worked around by running `prisma migrate dev` directly on the host against a temporarily port-exposed `db` container).

## What CH-02 explicitly does not include

- Tenant isolation, lifecycle, or alta/baja (stories T1, T2, T4) — CH-06, R1.
- Credential encryption (story A2) — R1. `Conexion.credencial` is a plain, unencrypted string; the gap is documented, not hidden.
- Execution/audit log (stories X2, A5) — R1/R2. Query execution in R0 stays transient.
- `usuario` / authentication (story T3) — R2.
- `plantilla`, `automatizacion`, `mapeo` — R1 concepts.
- Any resolution of open gate D-4 (`Conexion.motor` is a free string, not an enum).

## Follow-ups for later changes

- CH-03 (connection registration, story A1) and CH-05 (saved queries, story B2) can now build directly on `Conexion` and `ConsultaGuardada`.
- The `domain-data-model` capability now exists in `openspec/specs/` — CH-06 onward should delta against it (adding tenant lifecycle fields, encryption, etc.) rather than redefine it.
- CH-06 should revisit `Tenant`'s shape (soft-delete field, etc.) per DEC-06's accepted scope debt.
