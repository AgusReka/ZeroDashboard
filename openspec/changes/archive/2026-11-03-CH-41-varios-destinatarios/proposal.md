# Proposal: CH-41 — Several recipients per automation

**Status**: ready for spec and design. Inputs: exploration.md, DEC-187 (a)(i), DEC-194 (exploration decisions 1–3), DEC-174, DEC-141, DEC-83, DEC-82. Story N6.

## Intent
P2 wants a notice to reach more than one person: the stock alert to the warehouse and to the owner (N6). An automation gets a list of up to 5 addresses, and each run still sends one message, with every address in «Para», and records one send outcome (DEC-187). An automation that had one address keeps it as a list of one.

## Scope

### In Scope
- **Model.** `Automatizacion.destinatarios`, a list of text, empty by default, replacing `destinatario`. One migration: add the column, copy the existing address into a one-element list where it is not null, drop `destinatario`. The rollback restores the first address.
- **One rule for the list**, shared by every surface:
  - Each address is trimmed and checked with `direccionValida`.
  - Duplicates are removed ignoring case, keeping the first spelling (DEC-194, 3(a)).
  - At most `MAX_DESTINATARIOS = 5` after removing duplicates.
  - A refusal names the offending position: `/destinatarios/<i>` in the console routes, `destinatarios` in the panel route, as each surface already reports fields.
- **Console routes.**
  - `POST /automatizaciones`: optional `destinatarios: string[]`; absent means an empty list.
  - `PUT /automatizaciones/:id/ajustes`: `destinatarios: string[]`; `[]` empties it (today's `null`, DEC-174).
  - `AutomatizacionCompleta` returns `destinatarios`.
- **Panel route (P-04, DEC-141).** `GET` and `PUT .../ajustes` read and write `destinatarios`. The panel keeps needing at least one address (DEC-194, 2(a)).
- **Engine.**
  - `decidirNotificacion` takes the list: an empty list records `sin-destinatario`, as a null address does today.
  - `Correo.para` becomes a list, and the notifier sends it as `to`.
  - The outcome does not change (DEC-187): a message accepted for at least one address is `enviada`; every address rejected is `EENVELOPE`, already `fallo-envio`/`envio-rechazado`.
- **Console UI** (`src/consola/consola.ts`):
  - Create and adjust keep one field, now «Correos de los destinatarios (opcional)», where addresses are separated by commas, semicolons, spaces or line breaks (DEC-194, 1(a)). The script splits it into the list before sending.
  - The email preview «Para:» lists the addresses.
  - A 400 names the address that failed, or says the list has more than 5.
- **Panel UI** (`src/panel/panel.ts`): the «Enviar a» field takes several addresses the same way, with its error naming the one that failed.
- **Demo seed.** The demo automation gets a one-element list.
- **Docs.**
  - `docs/guia/06-automatizaciones.md`: the list, its cap, how to type it and the outcome rules.
  - The panel guide section on P-04, if it names the recipient.
  - `guidelines/consola.md` (C-09) and `guidelines/pantallas.md` (P-04), in both copies of the design skill.
  - DEC-194 in `docs/01-decisiones.md`, on a `v2/dec-194` branch from `master`.

### Out of Scope
- Copy or blind copy (DEC-187 (ii)) and one message per address (DEC-187 (iii)).
- A tenant-wide distribution list (DEC-187 (b)).
- Recording which address the server rejected when others were accepted (DEC-187 "Se resigna").
- One field per address with «Agregar» and «Quitar» (DEC-194 1(b)): it can come later without an API change.
- Telegram (CH-43, CH-44) and the message preview (CH-42).
- Any change to the subject, the body, the minimum rows or the run record.

## Delivery (exploration decision 4(a))
One SDD change, one PR, branch `ch41/varios-destinatarios` from `master`. Estimate ~700 changed lines; `size:exception` accepted by the user on 2026-11-03, because the rename touches the server and both UIs at once.

## Capabilities

### Modified Capabilities
- `automation-scheduling`: `Automatizacion` holds `destinatarios` (cap, rule, migration); the pipeline reads the list.
- `email-notification`:
  - The precedence row for a missing recipient reads "the list is empty".
  - Recipient validation applies to each address.
  - One message carries every address in «Para»; partial rejection is `enviada`, full rejection is `fallo-envio`.
- `query-console`: the create wizard, the in-place adjust and the preview carry the list.
- `client-panel-automations`: P-04 reads and writes the list, with at least one address.
- `tenant-isolation`: the two-tenant cases that create and adjust a recipient use the list.

## Approach
- **Rule.** A pure `destinatariosDe(valores)` returns the clean list or the refused positions. Create, the console adjust and the panel adjust all call it; the panel adds the "at least one" check on top.
- **Splitting in the UIs.** One small pure function per script, `direccionesDe(texto)`, splits on `[,;\s]+` and drops empty pieces. The server is still the only judge of an address: the UI sends what it split.
- **Rename.** `destinatario` → `destinatarios` in every body, response, type, select and fixture. Both UIs ship with the server, so there is no compatibility shim.
- **Header safety.** Every element passes `direccionValida` before it is stored, and the run reads only stored values, so no CR/LF reaches the `to` header (the CH-14 Threat Matrix case, now per element).

## Affected Areas
- `prisma/schema.prisma`, new migration under `prisma/migrations/`
- `src/automatizaciones/automatizaciones.ts`, `automatizaciones-rutas.ts`, `correo.ts`, `notificador.ts`, `planificador.ts` and their tests
- `src/panel/panel-ajustes.ts`, `src/panel/panel.ts` and their tests
- `src/consola/consola.ts`, `src/consola/consola.test.ts`
- `src/semillas/semilla-demo.ts`, `src/aislamiento/aislamiento.test.ts`, `src/panel/panel-automatizaciones.test.ts`
- `docs/guia/`, both copies of `guidelines/consola.md` and `guidelines/pantallas.md`, `docs/02-mapa-de-changes.md`
- The five specs above (at archive)

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| The migration drops a column the engine and the panel read | Certain | Code and migration ship in one PR; a migration test with a pre-existing address; the rollback restores the first element |
| The rename misses a reader or a fixture | High | Typecheck catches typed readers; the DB suite catches fixtures; a final search for `destinatario\b` outside the contract guard |
| A CR/LF in one element reaches the `to` header | Low | Each element passes `direccionValida` before it is stored; a route test per surface with CRLF in the second address |
| Case-insensitive deduplication keeps the "wrong" spelling | Low | First spelling wins, stated in the guide; a test with `Ops@` then `ops@` |
| Splitting on spaces breaks a quoted display name | Low | Display names are out of scope: `direccionValida` already refuses `"`, `<` and `>` |
| Console guards (`IDS`, G3', exact bodies) and the panel field list | High | Same ids, new key in the bodies; budgeted in the estimate |
| Size ~700 lines | Certain | `size:exception` accepted; the tasks forecast still reports it |
