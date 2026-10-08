# Verify Report: CH-23 — Panel threshold and schedule adjustment

**Date**: 2026-10-08. **Branches**: `ch23/capa-pura` (PR1), `ch23/rutas` (PR2), `ch23/formulario` (PR3), stacked on `ch23/artefactos`.
**Verdict**: PASS with warnings. No blockers, no critical findings.
Verified inline by the orchestrator: the Claude Code hook refuses `sdd-*` sub-agent dispatch, so this is not an independent verifier run.

## Commands

| Command | Result |
|---|---|
| `npx tsc -p tsconfig.json --noEmit` | exit 0, no output |
| `TEST_DB_PORT=5434 TEST_DB_PASSWORD=<non-colliding> npm test` equivalent over the affected suites (`panel`, `panel-ajustes`, `panel-ajustes-rutas`, `panel-automatizaciones`, `contexto-tenant`, `conexiones`, `planificador`, `aislamiento-panel`) | all pass except `2.16` (see W3) |
| `npm test` against the live dev database with password `postgres` | 1031 tests, 1025 pass, 6 fail: `2.16` plus 5 false positives caused by the password (see W4) |
| `npm run build` | not run separately |

## Spec coverage (delta `specs/client-panel-automations/spec.md`)

| Requirement / scenario | Evidence |
|---|---|
| List items carry an opaque id | `panel-automatizaciones.test.ts` "1.4 the item has exactly the allow-listed keys" (pure) and "2.10" (live: `activas[0].id` equals the stored id) |
| Read: preset schedule as hour and days | `panel-ajustes.test.ts` projection; `panel-ajustes-rutas.test.ts` "GET returns the preset schedule…" |
| Read: custom cron hides the schedule | same two files, "custom cron" cases (keys are only `destinatario`, `umbral`, `zonaHoraria`; no cron text) |
| Update: valid update stored | route test "PUT stores the cron built on the server…" (stored cron `15 9 * * 1-6`, merged `valores`, trimmed recipient, `proximaEjecucion`) |
| Update: only the sent fields change | route test "PUT with only hora…" and unit "only the sent fields are written" |
| Update: invalid values name business fields | route test "PUT with an invalid value…" (`campos: [hora, destinatario]` plus `umbral` for a non-number); unit "every offender is named together" |
| Update: forbidden keys refused | route test "PUT refuses tenantId, cron, sql, valores, activo, unknown keys and an empty body" (400 each, row unchanged) |
| Update: unknown or foreign id is a 404 identical to unknown | route tests "Tenant A's session reads and writes nothing of Tenant B…" and "X-Tenant-Id is ignored…" |
| Update: paused is 409 | route test "PUT on a paused automation is 409…" |
| Update: schedule over a custom cron is 409 | same test; the umbral of that automation stays adjustable |
| Update: umbral on a template without it | unit test only (`resolverAjustes`, "umbral must be a finite JSON number… template must declare it"); no live-route case |
| Session and tenant only; exemption rows | route test "both routes answer 401 without a cookie…"; `contexto-tenant.test.ts` CH-23 block (rows exact, look-alikes and other methods still scoped) |
| Form: successful save, field errors | `panel.test.ts` (every string, body limited to the four fields, script compiles); **manual visual check by the user on 2026-10-08: "todo salió bien"** |

Rules: 1 (no SQL from the client) and 2 (tenant only from the session) hold by construction and by the tests above; 6 (engine untouched): no change in `planificador.ts`.

## Deviations from the design

- `horarioDeCron` became `horarioPresetDeCron`, exported from `panel-automatizaciones.ts` and shared with `frecuenciaDeCron`.
- The two-tenant proof lives in `src/panel-ajustes-rutas.test.ts`, not in `aislamiento-panel.test.ts`.
- `umbral: {}` had to be listed in the `PUT` schema `properties`: with `additionalProperties: false` Fastify stripped it silently (found by the live-database run, fixed in PR2).
- Task 4.1 (updating `02-mapa-de-changes.md` and the design skill's P-04 status) was not done: the CH-21 and CH-22 closes did not do it either.

## Findings

- **W1 size**: PR1 ~430 and PR2 ~549 changed lines against the 400 budget (about half are tests); both need `size:exception` or a split.
- **W2 form is not covered by a DOM test**: only string-level checks, a compile check and the manual visual pass.
- **W3 pre-existing, unrelated**: `aislamiento-panel.test.ts` "2.16" asserts tenant B has no automations, but "2.14" creates one for B first. Fails with or without CH-23.
- **W4 environment**: with a database password containing the word `postgres`, `conexiones.test.ts` and one `planificador.test.ts` case fail because the response legitimately contains `"motor":"postgres"`. Pass with another password.
- **W5 independence**: verified by the same orchestrator that wrote the code.
