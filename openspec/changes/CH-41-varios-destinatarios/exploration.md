# Exploration: CH-41 — Several recipients per automation

Status: **decided** (2026-11-03): 1(a), 2(a), 3(a), 4(a), the recommended options, chosen by the user; 1–3 to be registered as DEC-194, 4 is delivery only (one PR with `size:exception`, accepted up front). Store: openspec. Story N6. Decision: DEC-187 (a) with (i) and a cap of 5: "a list of validated addresses on the automation, with a fixed cap in code, replacing `destinatario` with a migration that keeps the existing value; one message with every address in «Para»." Depends on CH-36 only (merged). No research phase: the one external fact (how nodemailer reports partial rejection) was checked against its documentation and matches DEC-187.

DEC-187 "Forma":
- Each address is validated with `direccionValida`, trimmed and deduplicated. An empty list records `sin-destinatario`, as today.
- The console's create form and the panel's P-04 edit the list.
- The send outcome does not change: if the SMTP server accepts the message it is `enviada`; every address rejected is `fallo-envio` with the DEC-83 category.
- Telegram does not change (DEC-185).
- Resigned: an address rejected among accepted ones is not recorded separately; the migration touches a column in use by the engine and the panel.

N6 (`mapa-historias.md:128`): "Up to 5 validated addresses per automation, in one message with all of them in «Para» (DEC-187, which reopens DEC-82 and DEC-130)."

## What exists (verified)

| Piece | State |
|---|---|
| Model | `Automatizacion.destinatario String?` (`prisma/schema.prisma`, CH-14 comment). Nullable: null records `sin-destinatario`. |
| Validation | `direccionValida` (`src/automatizaciones/correo.ts:30`): one RFC 5322 dot-atom address, no whitespace or `,;<>"()`, length caps. `destinatarioDe` (`automatizaciones-rutas.ts:~120`) trims spaces and tabs only, so CR/LF reaches the gate and is refused. A comma-separated value is refused today. |
| Decision | `decidirNotificacion(r, destinatario, configurado, minimoFilas)` returns `{ enviar: true, para: string }`; `destinatario === null` → `sin-destinatario` (row 4 of the precedence table since CH-40). |
| Message | `Correo.para: string` (`correo.ts:169-171`); the notifier sends `to: c.para` (`notificador.ts:205`). The notifier re-validates only the sender (`:80`). |
| Send outcomes | nodemailer resolves when at least one recipient is accepted (`info.rejected` lists the rest) and throws `EENVELOPE` when every recipient is rejected (nodemailer docs, "Handling partial failures" and "EENVELOPE"). `CATEGORIA_POR_CODIGO` already maps `EENVELOPE` → `envio-rechazado` (`notificador.ts:146`). So DEC-187's outcome rule needs no new code. |
| Console routes | Create body `destinatario?: string` (`automatizaciones-rutas.ts`, schema `maxLength 254`); operator adjust `destinatario?: string \| null`, where `null` clears it (DEC-174). `AutomatizacionCompleta` returns it. |
| Panel routes | `panel-ajustes.ts`: `FilaAjustes`, `AjustesLeidos`, `CuerpoAjustes`, `DatosAjustes` carry one `destinatario`; `resolverAjustes` refuses an empty or invalid value (`campos: ['destinatario']`), so **the panel cannot clear the recipient today**, while the console can. |
| Console UI | Create `auto-destinatario` (one `type="email"` input) and the preview line «Para:» (`SIN_DESTINATARIO`); adjust `aj-destinatario`; 400 message «Escriba una sola dirección… sin espacios, comas ni punto y coma». |
| Panel UI | `panel.ts:~462-473`: one `type="email"` input labelled «Enviar a»; `ERRORES_CAMPO.destinatario`; the body sends `destinatario` only when it changed. |
| Design guide | `guidelines/pantallas.md` P-04 already lists `destinatarios` as a datum, but no screen or mockup shows a list: the console mockup (`ui_kits/consola/automatizaciones.js:48`) has one email input. **The list UI is not designed.** |
| Demo seed | `semilla-demo.ts:319` sets `destinatario: entorno.correoPanel`. |
| Reach | `destinatario` appears ~250 times in 18 source files: most are test fixtures (`consola.test.ts` 45, `planificador.test.ts` 41, `automatizaciones-rutas.test.ts` 41, `aislamiento.test.ts` 13, panel tests 25). |

### Specs affected

- `automation-scheduling`: "Automatizacion Binds a Plantilla…" (`destinatarios`, cap, migration), "Run Pipeline…" scenario with null recipient.
- `email-notification`: precedence row 4 (empty list), "Recipient Is Validated and Header-Safe (DEC-82)" (each address), "Rows with recipient and SMTP configured send exactly once" (one message, every address in «Para»), a partial-rejection scenario.
- `query-console`: create and adjust (the list field, the 400 message), the preview «Para».
- `client-panel-automations`: "Adjust Form (P-04)" (read and write the list).
- `tenant-isolation`: the T2 sweep cases that create and adjust with a recipient.
- `execution-log`: one mention of `sin-destinatario` (check in spec phase).

## Shape that fits

- **Model.** `Automatizacion.destinatarios String[] @default([])` (PostgreSQL `text[]`, a Prisma scalar list). Migration: add the column, copy `ARRAY["destinatario"]` where it is not null, drop `destinatario`. The rollback copies the first element back. A JSON column would also work but loses the element type the database can enforce.
- **One rule, shared.** A pure `destinatariosDe(valores: unknown[]): { ok: true; lista } | { ok: false; indices }` in `automatizaciones-rutas.ts` (or `correo.ts`): trim each, validate each with `direccionValida`, deduplicate (decision 3), cap at `MAX_DESTINATARIOS = 5` after deduplication. Create, console adjust and panel adjust all call it. A refusal names `/destinatarios/<i>` (console, JSON pointers) or `destinatarios` (panel, field names), as each surface already does.
- **API.** `destinatario` becomes `destinatarios: string[]` in every body and response (create, get, console adjust, panel read and write). Both UIs ship with the server, so there is no external caller to keep compatible. The console adjust's `null` becomes `[]`.
- **Engine.** `decidirNotificacion(r, destinatarios, configurado, minimoFilas)`: an empty list → `sin-destinatario`; send returns `para: string[]`. `Correo.para: string[]`; the notifier passes the array as `to`. Nothing else changes: partial rejection resolves `enviada`, full rejection is `EENVELOPE` → `fallo-envio`/`envio-rechazado`.
- **UIs.** Decision 1. Either way the preview «Para:» lists the addresses, and an address the server refuses is named back in the message.
- **Unchanged.** Subject, body, minimum rows, the run record (`notificacion` stays one value), Telegram, the panel's other fields.

## Decisions (chosen by the user on 2026-11-03: 1(a), 2(a), 3(a), 4(a))

1. **How the list is typed, in the console and in P-04.** Neither surface has a design for it. (a) One field where the addresses are separated by commas, semicolons, spaces or line breaks, split into the list before sending, like the «Para» of a mail client. The server's refusal index maps back to the typed address, which the message names. Same control in both surfaces, no dynamic markup (the console's G3' guard forbids `zd-*` classes in the script). (b) Up to five fields, with «Agregar otro correo» and «Quitar». Each field gets its own error, but the console needs five fixed inputs in its markup and the panel a repeated field group. *Recommended: (a): one control, one parser shared by both surfaces, and the error still names the bad address; (b) can come later without an API change.*
2. **Emptying the list from the panel.** Today P-04 refuses an empty recipient, and only the console can clear it (DEC-174). (a) The panel keeps needing at least one address; the console can still empty the list. (b) The panel can empty it too, which stops the email from the client side. *Recommended: (a): it keeps today's rule, and a client who wants no email can ask the operator, who sees the `sin-destinatario` runs.*
3. **Duplicates that differ only in case** (`Ops@empresa.com` and `ops@empresa.com`). (a) Deduplicate ignoring case, keeping the first spelling. (b) Deduplicate exact matches only. The local part is case-sensitive in the RFC, but mail servers treat it as case-insensitive in practice, and a duplicate means one person gets the message twice in one send. *Recommended: (a).*
4. **Delivery.** Rough size: migration + schema ~25, shared rule ~30, routes (create, console adjust, panel) ~60, engine + notifier ~15, console UI ~40, panel UI ~35, tests ~450 (much of it fixture churn from `destinatario` to `destinatarios`), docs ~40 → **~700 changed lines**. The session chose Single PR (400 budget). (a) One PR with `size:exception`, as CH-40: the key rename touches the server and both UIs at once, so a first PR alone would break the UIs. (b) Two stacked PRs: CH-41a backend that still accepts `destinatario` as a one-address list during the transition, and CH-41b both UIs, which drops the old key. Smaller reviews, but temporary compatibility code to write and remove. *Recommended: (a).*

## Risks

- The migration drops a column the engine and the panel read; code and migration must ship together, and the rollback must restore the first address.
- ~250 references, most in tests: the rename is mechanical but wide, and fixtures that build automations directly (`planificador.test.ts`, `aislamiento.test.ts`) must use the new column.
- Header safety: nodemailer formats the `to` array, but every element must pass `direccionValida` first, or a CRLF in one address could reach the header (the CH-14 Threat Matrix case, now per element).
- The console guards (`IDS`, G3', exact request bodies) and the panel's field-name list (`panel.test.ts:296`) break on any rename.
- `contrato.test.ts:232` forbids `destinatario` as a canonical-contract field name; it is a contract guard, not an automation field, and stays as is.
- New decisions here would be registered as DEC-194.
