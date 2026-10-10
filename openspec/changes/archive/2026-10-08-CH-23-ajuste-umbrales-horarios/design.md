# Design: CH-23 — Panel threshold and schedule adjustment

Decisions: DEC-138 (in place), DEC-139 (opaque id), DEC-140 (fields), DEC-141 (contract). No new architecture decision is introduced here.

## 1. Modules

| File | Role |
|---|---|
| `src/panel-ajustes.ts` (new) | Pure half + `registerPanelAjustesRoutes(app, prisma, zonaHoraria, ahora?)` |
| `src/panel-automatizaciones.ts` | Export the day table `DIAS_PRESET`; add `id` to `ItemActiva`/`FilaAutomatizacion` and the Q1 `select` |
| `src/contexto-tenant.ts` | Two rows in `RUTAS_PANEL_PUBLICAS` |
| `src/server.ts` | Register the new routes next to `registerPanelAutomatizacionesRoutes` |
| `src/panel.ts` | "Ajustar" action and form in the shell script |

## 2. Pure layer (`panel-ajustes.ts`)

- `DIAS_PRESET: ReadonlyMap<'todos'|'lun-vie'|'lun-sab', string>` lives in `panel-automatizaciones.ts` (`'*'`, `'1-5'`, `'1-6'`); `frecuenciaDeCron` and the new helpers both derive from it, so presets cannot drift (exploration risk 3).
- `horarioDeCron(cron): { hora: string; dias: Dias } | null`: reuses the `PATRON_FRECUENCIA` rule (minute and hour ranges) and returns `HH:MM` zero-padded.
- `cronDeHorario(hora, dias): string | null`: `hora` must match `^([01]\d|2[0-3]):[0-5]\d$`; output `M H * * D` with no leading zeros, identical to the console's `cronDeFrecuencia` (`src/consola.ts:1253`); the existing vector table in `src/consola.test.ts` (`VECTORES_HORARIO`) is the oracle for a copy in the new test.
- `proyectarAjustes(fila, parametros, zona): AjustesLeidos`: written literally from named inputs, never by spreading a row. `umbral` is read only if `parametros` declares `umbral` with type `numero` and the stored value is a finite number.
- `resolverAjustes(body, fila, parametros)`: returns `{ ok: true, cron, valores, destinatario }` or `{ ok: false, campos }` / a 409 code. Order: at least one key; schedule fields vs preset cron (409 `horario-no-editable`); `umbral` declared (else 400 `umbral`); `hora` (400 `hora`); recipient via `destinatarioDe` + `direccionValida` (400 `destinatario`); `prepararSentencia` for the merged `valores` (400 `umbral`); `cronValido` on the built cron (defensive, 400 `hora`).
- When only one of `hora`/`dias` is sent, the other comes from the stored preset (`horarioDeCron`).
- Field names in `campos` are `umbral`, `hora`, `dias`, `destinatario`; no JSON-pointer paths and no `cron`.

## 3. Routes

Both: `preHandler: [levantarSesionPanel(prisma)]`, handler inside `conTenantActivo({ id: sesion.tenantId, nombre: sesion.tenantNombre }, ...)`. Params carry only `id`; no tenant ever reaches a query.

`GET`: Q1 `automatizacion.findUnique({ where: { id }, select: { activo, cron, valores, destinatario, plantillaId } })` (scoped; `null` is 404), Q2 `plantilla.findUnique({ where: { id: plantillaId }, select: { parametros: true } })` (global), then `proyectarAjustes`.

`PUT` body schema: `additionalProperties: false` + `propertyNames: { enum: [...] }` (the `registroAutomatizacionSchema` precedent, so a `tenantId` or `cron` is a 400 and not stripped); `umbral` is declared without a type so AJV cannot coerce it and `prepararSentencia` applies DEC-60; `hora` string `maxLength: 5`; `dias` enum; `destinatario` string 1..254; `minProperties: 1`. Flow: validation, Q1 + Q2 (adds `sql` to the template select), `activo` false gives 409 `automatizacion-pausada`, `resolverAjustes`, then one `automatizacion.update({ where: { id }, data: { cron?, valores?, destinatario? } })` scoped by the extension. `valores` is cast to `Prisma.InputJsonObject` as in `automatizaciones-rutas.ts:177`, sound for the same reason (`prepararSentencia` accepted it). Response: projection of the stored result plus `proximaEjecucion` from `proximaEjecucion(cron, ahora(), zona)`; an unresolvable cron cannot occur because it was just validated.

`P2025` on `update` (row deleted between read and write) maps to the same 404.

## 4. Page (`panel.ts`)

- Before writing HTML/CSS, load the `zerodashboard-design` skill (`guidelines/pantallas.md` P-04, `ui_kits/panel/Screens.jsx`).
- `tarjetaActiva` adds a ghost "Ajustar" button for `activa`/`con_falla`; it fetches the `GET`, then renders an inline form in the card (label + `zd-input`, `type="time"`, `zd-select` with "Todos los días / De lunes a viernes / De lunes a sábado", `type="email"`). Schedule fields are omitted when the read has no `hora`/`dias`; `umbral` is omitted when absent.
- Nodes and `textContent` only (no `innerHTML`), as the existing script. No `JSON` of the server is echoed.
- Save: `PUT` with only the changed fields; 200 shows `zd-banner` "Se aplican desde la próxima revisión" and re-fetches the list; 400 marks `campos` with business messages; 401 reloads; 404/409 and network errors show a neutral message ("Esta automatización ya no se puede ajustar." / "Volvé a intentar en unos minutos.").
- Glossary scan in `panel.test.ts` is extended to the new strings (no cron, SQL, "tenant", ids).

## 5. Tests

- `panel-ajustes.test.ts`: pure (vectors, projection, each `campos`/409 branch, no key leaks) and routes (200/400/401/404/409, stored result, other `valores` keys preserved).
- `aislamiento-panel.test.ts`: tenant A cannot `GET` or `PUT` tenant B's id (404, row unchanged); `X-Tenant-Id` ignored.
- `contexto-tenant.test.ts`: the two rows exempt, look-alikes and other methods still scoped.
- `panel.test.ts`: page contains the form strings and none of the forbidden terms.

## 6. Trade-offs

- A separate `/ajustes` read costs one request on opening but keeps recipient and values off the main list (DEC-141).
- Duplicated preset translation (server here, client in the console) is pinned by shared vectors, per DEC-129.
- Last write wins; no version column.

## 7. Size forecast

Production ~330 lines (`panel-ajustes.ts` ~190, page ~130, edits ~10); tests ~1.7x. Does not fit one 400-line PR; planned as three chained PRs in `tasks.md`.
