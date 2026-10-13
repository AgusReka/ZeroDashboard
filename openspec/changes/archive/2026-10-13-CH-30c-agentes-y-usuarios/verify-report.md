# Verify Report: CH-30c — Agents and panel users screens

**Date**: 2026-10-13. **Branches**: `ch30c/agentes`, `ch30c/usuarios`, on `master` after the planning PR #161 (PRs #162 and #163). Verified at `5ea955c`.
**Verdict**: PASS with warnings. No blockers, no critical findings.
Verified inline by the orchestrator: the Claude Code hook refuses `sdd-*` sub-agent dispatch. The review assessment was medium risk, so no independent verifier ran.

## Commands

| Command | Result |
|---|---|
| `npx tsc -p tsconfig.json --noEmit` | exit 0, no output |
| `npm run build` | ok |
| `npm test` against the dev database (`TEST_DB_PORT=5434`, password `postgres`) | 1289 tests, 1285 pass, 4 fail: the known `conexiones` false positives (W1). The `panel-automatizaciones` suite's cleanup hook failed once with the documented intermittent foreign-key error (W2); run alone it passed twice (44/44) |
| Manual visual pass | done by the user on 2026-10-13 ("veo bien la visual"), on the Docker app rebuilt from `ch30c/usuarios` |

## Spec coverage — `specs/query-console/spec.md` (delta)

| Requirement / scenario | Evidence (`consola.test.ts`, prefix `CH-30c`) |
|---|---|
| Navigation by hash: order, default, switching, unknown hash | "Agentes and Usuarios del panel come after Conexiones, before the daily work"; "Usuarios del panel sits after Agentes in Puesta en marcha"; CH-30a's hash cases over seven screens |
| Secrets are shown once: dismiss, leave, tenant switch | "Ya lo guardé removes the token from every node of the page"; "leaving the screen removes the token too"; "switching the tenant removes a shown password from every node" |
| Agents screen: no tenant, create, revoke | "with no tenant, Agentes asks for one and sends nothing"; "creating the agent shows the token once, then the agent as active with Revocar"; "Revocar asks inline, explaining the impact, before sending" |
| Connection through the agent | "a new connection can go through the tenant active agent" |
| Panel users screen: no tenant, list, create, email in use, reset, deactivate, reactivate | "with no tenant, Usuarios del panel asks for one and sends nothing"; "the list shows each user with the actions of its state"; "creating a user sends the email and name and shows the password once"; "an email in use says so and shows no password"; "Reponer clave shows the new password once"; "Desactivar asks inline first; Reactivar sends at once" |

## Warnings

- **W1** — Pre-existing: with `POSTGRES_PASSWORD=postgres` four `conexiones` tests fail.
- **W2** — Pre-existing, documented since CH-22b (#105): the cleanup of `panel-automatizaciones.test.ts` can hit `Ejecucion_automatizacionId_fkey` when a scheduler (here the Docker app running against the same database) writes a run between its two deletes. Not touched by CH-30c, which changes no backend file.
- **W3** — The agent has no name (the model has none, DEC-121); its connectivity (CH-19d1) is not shown.
