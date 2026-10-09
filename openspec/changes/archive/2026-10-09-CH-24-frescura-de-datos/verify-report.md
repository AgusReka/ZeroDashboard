# Verify Report: CH-24 — Data freshness per tenant and per template

**Date**: 2026-10-09. **Branches**: `ch24/servidor` (PR1), `ch24/consola` (PR2), stacked on `ch24/exploracion` and on the CH-23 chain.
**Verdict**: PASS with warnings. No blockers, no critical findings.
Verified inline by the orchestrator: the Claude Code hook refuses `sdd-*` sub-agent dispatch, so this is not an independent verifier run.

## Commands

| Command | Result |
|---|---|
| `npx tsc -p tsconfig.json --noEmit` | exit 0, no output |
| `npm test` against the dev database (password `postgres`), **app container stopped** | 1063 tests, 1059 pass, 4 fail: the known `conexiones` false positives (W3) |
| `conexiones.test.ts` + `tenants-frescura.test.ts` with a database password that does not collide with the fixtures | 25 of 25 pass |
| `npm test` with the app container **running** | extra failures (`CH-14 5.11`, `CH-17a 2.1`) caused by the app's real scheduler sharing the database (W4); both pass with the app stopped |
| Served bytes of `GET /consola` on the running image (read-only `curl`) | HTTP 200, one script element, no markup-assigning property, `#frescura` and its 7 ids present once, shared stylesheet linked |
| `scripts/smoke.sh` | not run: it creates data and runs `docker compose down` on failure |
| `npm run build` | not run separately; the image built from this tree contains `Frescura de datos` and the route in `dist/` |

## Spec coverage (`specs/data-freshness/spec.md`)

| Requirement / scenario | Evidence |
|---|---|
| Columns: a new tenant has no declaration | `tenants-frescura.test.ts` "a new tenant has both fields null, in the create answer and in the list" |
| Declare a window / clear it | "declaring a window stores it and the list shows it"; "the bounds are accepted and null clears the declaration" |
| Mark the replica refreshed now (server clock) | "actualizadaAhora stores the server time of the request"; `frescura.test.ts` injected clock |
| Only the sent fields change | "only the sent fields change; false leaves the refresh untouched" |
| Invalid values refused, nothing stored | "invalid values are a 400 that names the field and stores nothing" (negative, decimal, `"5"`, above the limit, boolean, `"true"`, `1`); `frescura.test.ts` rejected types |
| Forbidden keys refused | "forbidden keys, unknown keys and an empty body are refused and change nothing" |
| Unknown tenant 404, deactivated 409 | "an unknown tenant is 404 and a deactivated one is 409 with nothing stored" |
| Another tenant untouched | "declaring tenant A's freshness leaves tenant B untouched" |
| Evaluation vectors | `frescura.test.ts` (6 vectors) and `consola.test.ts` "each shared vector shows its label…" (same table) |
| Console: stale badge with icon and word | "each shared vector shows its label with an icon and a word, never a color alone" |
| Console: saving sends only the chosen fields | "saving a window sends exactly { ventanaMinutos }…", "an empty field clears the window; text that is not digits goes up as typed", "marking the replica refreshed sends exactly { actualizadaAhora: true }" |
| Console: server error keeps previous values | "a 400 keeps the previous declaration on screen…", "a tenant that is gone or deactivated shows the tenant message and reloads the list" |
| Console: no active tenant, text-only values | "with no active tenant the section says so and offers no action"; "a hostile template name is shown as text…" |
| Console: relative time | "the last refresh reads as relative time" (seconds, minutes, hours and minutes, whole hours, days, future instant) |
| The engine is not affected | `planificador.test.ts` "CH-24 a tenant whose declared window exceeds the template tolerance runs exactly like any other" |
| Manual visual pass | done by the user on 2026-10-09 ("Todo salió bien"), against the rebuilt image |

Rules: 1 and 2 hold (the route is console-only and the client panel never calls it); 6: `planificador.ts` is untouched.

## Deviations from the design

- The state badge takes local classes (`estado-frescura…`) from the console's bridge style: guard G3' forbids any shared `zd-*` class in the script.
- The tolerance comes from the catalog the automations section already reads (`cargarCatalogoPlantillas`), not from its own request: an extra request on a tenant switch would reorder the queued responses of every existing console test.
- The calls go through `pedirAutomatizacion` (the console's convention, header included), not a bare `fetch`.
- The window field is a text control, not a number control: a number control turns invalid text into an empty value and would clear the declaration by accident.
- `campos` in a 400 use the module's pointer style (`/ventanaMinutos`).
- The route tests live in `src/tenants-frescura.test.ts`, as planned in the design; `tenants.test.ts` needed no change.
- The migration `20261008000000_tenant_frescura` was applied to the user's dev database.

## Findings

- **W1 size**: PR1 ~536 and PR2 ~404 changed lines against the 400 budget (more than half are tests); both need `size:exception` or a split.
- **W2 independence**: verified by the orchestrator that wrote the code.
- **W3 environment**: with the database password `postgres`, four `conexiones.test.ts` cases fail because the response legitimately contains `"motor":"postgres"`. They pass with another password.
- **W4 shared database**: a running app container's scheduler also ticks over the test tenants in the same database and can break tick-counting cases (`CH-14 5.11`, `CH-17a 2.1`). Stop the app while running the full suite.
- **W5 docs**: `docs/02-mapa-de-changes.md` and the C-22 status in the design skill were not updated (precedent: CH-21, CH-22, CH-23).
