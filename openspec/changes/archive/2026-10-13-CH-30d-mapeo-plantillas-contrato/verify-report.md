# Verify Report: CH-30d — Mapping and validation, Templates and Contract screens

**Date**: 2026-10-13. **Branches**: `ch30d/plantillas`, `ch30d/mapeo`, on `master` after the planning PR #165 (PRs #166 and #167, stacked). Verified at `7eb01c2`.
**Verdict**: PASS with warnings. No blockers, no critical findings.
Verified inline by the orchestrator: the Claude Code hook refuses `sdd-*` sub-agent dispatch.

## Commands

| Command | Result |
|---|---|
| `npx tsc -p tsconfig.json --noEmit` | exit 0, no output |
| `npm run build` | ok |
| `npm test` against the dev database (`TEST_DB_PORT=5434`, password `postgres`), with the Docker `app` stopped | 1301 tests, 1297 pass, 4 fail: the known `conexiones` false positives (W1) |
| Manual visual pass | done by the user on 2026-10-13, accepted |

## Spec coverage — `specs/query-console/spec.md` (delta)

| Requirement / scenario | Evidence (`consola.test.ts`, prefix `CH-30d`) |
|---|---|
| Navigation by hash: order, default, switching, unknown hash | "Plantillas and Contrato follow Tenants in the Global group"; "Mapeo y validación sits between Agentes and Usuarios del panel"; CH-30a's hash cases over every screen |
| Templates screen: list, cut notice, viewing a template | "Plantillas lists the catalog with no tenant header, and says when it was cut"; "Ver shows the entities, parameters and statement of a template, as text" |
| Contract screen | "Contrato shows each entity with its fields, type, obligatoriness and automations" |
| Mapping screen: no tenant / no connection | "with no tenant Mapeo asks for one, and with no connection it asks for one too" |
| Mapping screen: entities and state | "choosing a connection shows the five entities with their state and stored SQL as text" |
| Saving an entity | "Guardar sends the entity SQL and shows it as not validated" |
| A session failure | "a session failure while validating is shown apart and keeps the last report" |
| An invalid field | "an invalid field shows its verdict, column, observed type and the cast hint" |
| Automations with reasons | "the automations show their state and every reason" |
| Successful validation | "a successful validation repaints the states and keeps what is in the editors" |

## Warnings

- **W1** — Pre-existing: with `POSTGRES_PASSWORD=postgres` four `conexiones` tests fail.
- **W2** — Observed by the user (`docs/TODO-ZD-13-10.md`): "Probar" and "Validar" can answer `409 credencial-ilegible`. It is raised by the backend when the stored credential cannot be deciphered (`cripto-credencial.ts`, CH-07) and both routes share that path. CH-30d changes no backend file and shows the refusal legibly; the root cause is not confirmed and moves to the audit of that document.
