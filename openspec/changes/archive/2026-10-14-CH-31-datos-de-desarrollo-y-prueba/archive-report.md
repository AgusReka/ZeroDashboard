# Archive Report: CH-31

**Change**: CH-31 — Development and test data (origin: the audit of `docs/TODO-ZD-13-10.md`, F0)
**Archived at**: 2026-10-14
**Destination**: `openspec/changes/archive/2026-10-14-CH-31-datos-de-desarrollo-y-prueba/`
**Main specs synced**: `openspec/specs/project-environment/spec.md` ("Tests Run Against Their Own Database", "Demo Replica Under an Opt-In Compose Profile", "Opt-In Demo Seed" and "Demo Variables Ship Only as Placeholders" appended); `openspec/specs/execution-audit/spec.md` ("The Demo Seed's Validation Is Audited" appended). No requirement was modified or removed.

## Artifacts

exploration.md, proposal.md, specs/project-environment/spec.md, specs/execution-audit/spec.md, design.md, tasks.md, verify-report.md, archive-report.md.

## Decisions

DEC-170 (own test database; `replica-demo` from `food_store`) and DEC-171 (opt-in demo seed that validates the mapping and creates an active automation), taken in the planning PR #169.

## Verify summary

Verdict PASS with warnings (see `verify-report.md`): `tsc` clean, build ok, 1308 of 1312 tests pass through `test:db` with the app running, and the other four are the known `conexiones` false positives; the suite leaves the development database untouched; the end-to-end demo works from an empty volume and is idempotent on restart.

## Final state

- `npm run test:db` (`scripts/test-db.mjs`): the suite on `zerodashboard_test`, with `TEST_DB_NAME` and `DATABASE_URL` set; it refuses the development database's name.
- `replica-demo` (Compose profile `demo`): `docker/replica-demo/01-esquema-y-datos.sql` (food_store, with `user` and `direccion` neutralised) and `02-lector.sh` (the read-only user from `REPLICA_DEMO_PASSWORD`). `.gitattributes` keeps `*.sh` at LF.
- `src/semilla-demo.ts`, called by `prisma/seed.ts` when `SEED_DEMO=1`; `registrarVeredictos` in `src/validacion-mapeo.ts`, shared with the validation route.

## Deviations from the design, accepted

- A view created in a run whose probe fails is deleted again, so the next start probes it instead of skipping it.
- With `SEED_DEMO=1` the order is catalog, demo, generic tenant: the automation needs the catalog.
- Existence is also checked by the unique keys (`Operador.nombre`, `Usuario.correo`, `(conexionId, entidad)`).
- The seed audits only a successful probe; a failed boot retry writes no row.

## Open items

- More realistic data for `food_store`: a further SQL file in `docker/replica-demo/`, by the owner.
- Next per the audit: close CH-22b, then CH-32a (saved queries without duplicates, a connection picker).
