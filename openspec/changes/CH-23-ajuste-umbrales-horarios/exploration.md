# Exploration: CH-23 — Panel: threshold and schedule adjustment (P2h, screen P-04)

Store: openspec. Pace: automatic. Delivery: single PR (400-line budget; split into route + form if it exceeds it, per `docs/02-mapa-de-changes.md`).
Explored inline: the Claude Code hook refused sub-agent SDD dispatch.

## Confirmed product decisions (user, 2026-10-08)

- DEC-138: in-place edit from the panel only; amends DEC-79 and DEC-82 for the panel surface. The console and `/automatizaciones` keep having no edit route.
- DEC-139: the panel list exposes an opaque `id` per active automation; the adjust route is addressed by it.
- DEC-140: P-04 edits `umbral`, hour, days and a single recipient.

## What exists and can be reused

| Need | Reuse | Where |
|---|---|---|
| Session, tenant from the cookie only | `levantarSesionPanel`, `conTenantActivo` | `src/panel-auth.ts`, `src/panel-automatizaciones.ts:253` |
| Tenant-scoped `update` by id | `update` is in the isolation extension's unique-op set (another tenant's id is `null`/P2025, as unknown) | `src/aislamiento-prisma.ts:74` |
| Cron validity against the scheduler | `cronValido(cron, zona)`, `proximaEjecucion` | `src/automatizaciones.ts` |
| Value rules against the template | `prepararSentencia(sanearSql(plantilla.sql), plantilla.parametros, valores)` | `src/automatizaciones-rutas.ts:160` |
| Recipient rules | `destinatarioDe`, `direccionValida` | `src/automatizaciones-rutas.ts:100`, `src/correo.ts` |
| Strict body schema (`additionalProperties:false` + `propertyNames`) | `registroAutomatizacionSchema` pattern | `src/automatizaciones-rutas.ts:81` |
| Cron to readable text | `frecuenciaDeCron` (inverse map of the three day sets) | `src/panel-automatizaciones.ts:71` |
| Client-side preset table | `DIAS_FRECUENCIA` (console only; the panel must not send cron) | `src/consola.ts:1235` |
| Panel UI | Inline HTML/JS string with `zd-*` classes and `textContent` nodes | `src/panel.ts:201-375` |
| Route exemption from `X-Tenant-Id` | Closed set `RUTAS_PANEL_PUBLICAS`, keys are `METHOD pattern` | `src/contexto-tenant.ts:141` |

## Findings

1. **"Rige desde la próxima ejecución" is free.** `correrVencidas` re-reads `cron` and `valores` from the database on every tick (`src/planificador.ts:467-486`), and `valores` is re-validated on every run (`:181`). No rescheduling is needed. The window start is `max(creadaEn, desde)`, so a new schedule cannot fire retroactively.
2. **Edge: a save during a tick window.** If the new hour falls inside the current `(anterior, ahora]` window, the scheduler can fire it once right after the save. DEC-95 already says the schedule is a time, not a promise; document it, do not engineer around it (rule 6).
3. **The list does not carry current values.** `ItemActiva` has no `id`, no `umbral`, no hour/days, no recipient (`valores`, `destinatario` are excluded by DEC-137). The form needs them to prefill.
4. **Only `umbral` is a client-editable parameter.** Both stock templates declare exactly `umbral: numero` (`src/catalogo-inicial.ts:48,72`). Other declared parameters (none today) must be preserved untouched.
5. **Stored cron may not be a preset.** The console accepts any five-field cron ("personalizado"); `frecuenciaDeCron` returns `null` for those and the list already omits `frecuencia`.
6. **Auth and CSRF.** The cookie is `HttpOnly; SameSite=Lax; Secure`; a cross-site POST does not carry it, and Fastify only parses JSON bodies, so a form post cannot reach the handler. No CSRF token is needed beyond that, but the route must not accept `application/x-www-form-urlencoded`.
7. **Size.** The adjust route, its pure helpers, the read of current values, the form in `panel.ts`, and the two-tenant test are roughly 250-300 production lines; tests are multiplied by ~1.7. It will most likely exceed 400 together, so the tasks phase should plan a route PR and a form PR (the map allows this).

## Proposed contract (to confirm; becomes the next DEC, the P-04 equivalent of DEC-137)

- **Read:** `GET /api/panel/automatizaciones/:id/ajustes` returns only `{ umbral?: number, hora?: "HH:MM", dias?: "todos"|"lun-vie"|"lun-sab", destinatario: string|null, zonaHoraria }`. `umbral` appears only if the template declares it; `hora`/`dias` only if the stored cron is one of the three presets. The list gains only `id` (DEC-139).
- **Write:** `PUT /api/panel/automatizaciones/:id/ajustes` with a strict body `{ umbral?, hora?, dias?, destinatario? }`; no `tenantId`, no `cron`, no `sql`, no `valores` map (rule 1, rule 2). The server builds the cron from `{hora, dias}` (DEC-129 note), merges `umbral` into the stored `valores`, validates the result with `prepararSentencia`, the cron with `cronValido`, and the recipient with `direccionValida`, then does one scoped `update`. Response: the same fields as the read plus `proximaEjecucion`.
- **Errors:** 400 `solicitud-invalida` with `campos` (business field names, no cron paths); 404 `automatizacion-no-encontrada` (also other tenant's id); 409 for a paused automation and for a schedule change on a non-preset cron.
- **Copy:** success banner "Se aplican desde la próxima revisión" (P-04); labels in business language, no SQL, no cron, no technical terms.
- **Exemption:** add `GET` and `PUT /api/panel/automatizaciones/:id/ajustes` to `RUTAS_PANEL_PUBLICAS`.

## Open design points (not architecture; defaults proposed)

- Paused automations: not adjustable (409), as "Activar" belongs to another change. Default: reject.
- Non-preset cron: schedule fields hidden in the form and a `hora`/`dias` in the body answers 409. Default: reject, never overwrite silently.
- Concurrency: last write wins; there is no version column and none is justified for one administrator per tenant.
- Audit/DEC-93: nothing about rows is persisted; only the automation row changes.

## Approaches

| Approach | Notes |
|---|---|
| A. Dedicated `/ajustes` read + write pair (recommended) | Keeps the list lean and the allow-list explicit; one extra GET on opening the form |
| B. Put current values in the list item | One fewer route, but widens the list contract for every card and exposes the recipient on the main screen |

Recommendation: A, planned as route PR then form PR.

## Risks

- Rule 2: the new write route is the first panel mutation; the two-tenant test must cover read and write by foreign id, and the isolation sweep (T2) must list the new rows.
- Rule 1/4: no SQL fields exist in the body and `valores` is rebuilt server-side from `umbral` only.
- Contract drift: `frecuenciaDeCron` and the new `dias` table must share one mapping to avoid disagreeing presets.

## Next

Confirm the contract above (next DEC), then propose, spec, design, tasks.
