# Exploration: CH-40 — Minimum rows per automation

Status: **decided** (2026-11-03): 1(a), 2(a), 3(a), the recommended options, chosen by the user; 1 and 2 to be registered as DEC-193 (1 as a precision of DEC-186), 3 is delivery only. Store: openspec. Story X9. Decision: DEC-186 (b): "a minimum of rows on the automation (`minimoFilas`, integer, default 1), evaluated by the engine after the query and before notifying." Depends on CH-36 only (merged). No research phase: DEC-186 already fixed the option and the shape, and nothing here depends on an external source.

DEC-186 "Forma":
- A new column with a migration, validated as an integer between 1 and the engine's row cap.
- When there are rows but fewer than the minimum, the run records `omitida-bajo-minimo`, distinct from `omitida-sin-filas`.
- Loaded in the console's create form; adjusting it from the panel stays out until a story asks for it.
- Resigned: no conditions on aggregated values outside the SQL, no combinations (AND, OR).

X9 (`mapa-historias.md:114`): "Minimum per automation, 1 by default (same as today). With rows but below the minimum, the run is recorded as skipped by the minimum (DEC-186)."

## What exists (verified)

| Piece | State |
|---|---|
| Model | `Automatizacion` (`prisma/schema.prisma:196-212`), doc comment `:180-195`: `valores, cron, activo, creadaEn, destinatario`. Last migration `20261028000000_mensaje_plantilla` (CH-39). |
| Decision | `decidirNotificacion(r, destinatario, configurado)` (`src/automatizaciones/automatizaciones.ts:349-367`), pure. Precedence: query not ok → `null`; `r.filas.length === 0` → `omitida-sin-filas`; no recipient → `sin-destinatario`; no SMTP → `no-configurada`; else send. Only caller: `planificador.ts:355` in `notificar`. |
| Outcome types | `EstadoNotificacion` (`automatizaciones.ts:313-320`) and `OmisionNotificacion` (`:330-333`, the skip subset). `cierreConNotificacion` (`:424-446`) writes any string omission as it comes, so a new omission needs only the type, no new branch. |
| Row cap | The scheduler asks for `limite = topeFilas = loadConfig().maxFilasPorConsulta` (`planificador.ts:258-270`; env `MAX_FILAS_CONSULTA`, default 200, `src/compartido/config.ts:161`). So `r.filas.length ≤ topeFilas`, and with more rows it is exactly `topeFilas` with `paginacion.hayMas = true` (`consulta-ejecucion.ts:494-505`). |
| Scheduler input | `AutomatizacionACorrer` (`planificador.ts:182-191`) and its select (`:~495-503`) carry `destinatario`; `minimoFilas` must be added to both. |
| Run record | `Ejecucion.notificacion` is free TEXT typed in code (schema comment `:224-235`); a new value needs no migration, as CH-18 did. Listing `EjecucionListada` already exposes `notificacion` and `filas`. |
| Create route | `POST /automatizaciones` (`automatizaciones-rutas.ts:240-310`): strict schema `registroAutomatizacionSchema` (`:91-104`, `propertyNames.enum` of 5 keys), pure checks first (`cronValido`, `direccionValida`), then template, connection, `prepararSentencia`, `create` with `AutomatizacionCompleta` (`:38`, which adds `valores, destinatario` to the summary). |
| Operator adjust | CH-33 (DEC-174): `ajusteOperadorSchema` (`:196-208`, keys `valores, cron, destinatario`, `minProperties: 1`) and its resolver (`CuerpoAjusteOperador` `:119-124`, `DatosAjusteOperador` `:127-131`). DEC-174's precision: "the operator edits the same things it loads at creation". |
| Panel adjust | `panel-ajustes.ts` (P-04): `umbral, hora, dias, destinatario`. Out of scope per DEC-186. The panel's run summary (`panel-automatizaciones.ts:321-352`) reads only `estado`, never `notificacion`: unaffected. |
| Console | Create form `consola.ts:~880-920` (`auto-destinatario` `:907`, the email schematic `:911-916`); body built at `:2847-2848`; 400 field messages `:2877`. Adjust form `aj-*` (`:967`), filled at `:2970-2985`, dirty check `:2932`, diff `:3037`. Run labels `ETIQUETAS_NOTIFICACION` (`:1163-1171`): any value without a label shows the placeholder. |
| Demo seed | `semilla-demo.ts:319` creates automations without the field: the default 1 covers them. |

### Specs affected

- `email-notification`: "Notification Outcome Precedence Is Deterministic" (new row between zero rows and missing recipient, plus scenarios).
- `execution-log`: "Ejecucion Records the Notification Outcome" (permitted set) and "Runs Listing Exposes the Notification Outcome".
- `automation-scheduling`: "Automatizacion Binds a Plantilla…" (new column, default, range) and "Run Pipeline Applies the Condition and Notifies After Query Success".
- `query-console`: "Console Displays Automations and Supports Creating One" (new field), "Console Displays an Automation's Runs" (label), and "Console Adjusts an Automation in Place" if decision 1 is (a).
- `domain-data-model` only if it lists `Automatizacion` columns (check in spec phase).

### Tests that pin it

- `automatizaciones.test.ts`: precedence (`:455-460`, `:506-507`), the closed value set (`:594`, `:603` `permitidos`).
- `planificador.test.ts` (DB): zero-row close (`:656`), `:1509`; the automation fixtures.
- `automatizaciones-rutas.test.ts`: create schema/400 cases, listing values (`:420`, `:460`), adjust cases.
- `consola.test.ts`: `IDS`/`IDS_OCULTOS`, G3', exact create/adjust request bodies, the run label case (`:2367`).
- `aislamiento.test.ts` and `contrato.test.ts` build automations; a defaulted column keeps them green.

## Shape that fits

- **Model.** `Automatizacion.minimoFilas Int @default(1)`, one migration, no backfill (the default fills existing rows). Not nullable: DEC-186 states 1 as "same as today", so there is no "unset".
- **Validation.** Optional `minimoFilas` in the create body; an integer, `1 ≤ n ≤ maxFilasPorConsulta`, checked in the handler with the other pure checks (`400`, `campos: ['/minimoFilas']`). AJV's `type: 'integer'` coerces `"5"` to `5`; whether to accept that or check `Number.isInteger` on the raw value is a design detail (the DEC-60 precedent avoided coercion for `valores`).
- **Decision.** `decidirNotificacion` takes the minimum. New precedence row right after zero rows and before the missing recipient: both are "the condition did not hold", which is a property of the result, not of delivery. With `minimoFilas = 1` the new row can never match (zero rows already won), so every current automation behaves exactly as today (DEC-84).
- **Outcome.** `omitida-bajo-minimo` joins `EstadoNotificacion` and `OmisionNotificacion`; console label along the lines of "No enviada: menos filas que el mínimo". The run already shows `filas`.
- **Console.** A number field in the create form, default 1, `min=1` (the cap lives in the server's config; the server's 400 names the field). The email schematic can say when the email is sent ("se envía con N filas o más").
- **Unchanged.** The panel, the renderer, the subject, the row cap, `RegistroEjecucion`, templates. CH-42 (preview, DEC-189) will read `minimoFilas` to say whether the notice would go out.

## Decisions (chosen by the user on 2026-11-03: 1(a), 2(a), 3(a))

1. **Console adjust.** DEC-186 says "loaded in the console's create form" and keeps the panel out. DEC-174 says the operator adjusts in place "the same things it loads at creation", so the two decisions disagree for the console. (a) The operator adjust also takes `minimoFilas` (same validation, same row, history kept). (b) Create only: changing it means deactivating and creating a new automation, which loses the run history that DEC-174 exists to keep. *Recommended: (a): keeps DEC-174's parity between create and adjust, and the cost is one more key in an existing route and form. Register it as a precision of DEC-186.*
2. **A result cut by the row cap.** The minimum is compared with `r.filas.length`, which never exceeds `maxFilasPorConsulta`. At creation `minimoFilas ≤ cap`, so it always works; but if `MAX_FILAS_CONSULTA` is lowered later, an automation with a higher minimum could never notify. (a) A page cut by the cap (`hayMas = true`) counts as reaching the minimum: the result had more rows than were read, and the email already says "+". (b) Compare `filas.length` only, and document that lowering the cap can silence automations. *Recommended: (a): one extra condition, no silent failure after a config change.*
3. **Delivery.** Rough size: migration + schema ~15, decision + types ~20, create route ~20, scheduler ~5, console create + label ~35, tests ~170, specs ~60, guide (`docs/guia/`) ~10 → **~335 changed lines**. Decision 1(a) adds ~25 code + ~45 tests + ~10 spec → **~415**. The session chose Single PR (400 budget). (a) One PR; if the tasks forecast lands above 400, stop and ask for `size:exception`. (b) Split now: CH-40a backend (model, decision, routes, scheduler, specs) and CH-40b console (create, adjust, label). *Recommended: (a): the change is one concept and the estimate is at the edge; the tasks phase gives the real forecast before apply.*

## Risks

- The precedence change touches a pure function many tests pin; every existing case keeps its outcome only because the default is 1, so the migration default and the decision default must be the same value.
- `maxFilasPorConsulta` is read at request time: a create validated against one cap and a run under another is exactly decision 2.
- The console guards (`IDS`, `IDS_OCULTOS`, G3', exact request bodies) break on any new id or body key; G3' forbids new `zd-*` tokens in the script. A number `<input>` needs the existing `zd-input` class in the markup only.
- The adjust route is in the T2 isolation sweep: a new key must not open a cross-tenant write (the scoped lookup already covers it, but the two-tenant test must include the key).
- Strict Fastify schemas drop unlisted properties under `removeAdditional`; `minimoFilas` must be listed in both `properties` and `propertyNames.enum`.
- New decisions here would be registered as DEC-193 (and a precision of DEC-186 if 1(a)).
