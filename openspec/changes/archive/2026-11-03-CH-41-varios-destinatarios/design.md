# Design: CH-41 — Several recipients per automation

Inputs: proposal.md, the five delta specs, DEC-187 (a)(i), DEC-194 (exploration decisions 1–3), DEC-174, DEC-141. Delivered as one PR with `size:exception` (exploration decision 4(a)).

## 0. What DEC-187 leaves open, recorded in DEC-194

- **How the list is typed** (1(a)): one field per surface, addresses separated by commas, semicolons or whitespace.
- **The panel cannot empty the list** (2(a)); the console can (DEC-174).
- **Duplicates are removed ignoring case**, keeping the first spelling (3(a)).
- Two consequences the specs state and DEC-194 records: the console reports a refused address by its position (`/destinatarios/<i>`) and the panel by its field (`destinatarios`); the cap of 5 counts after removing duplicates.

## 1. Model and migration

- `prisma/schema.prisma`, `Automatizacion`: `destinatarios String[] @default([])` replaces `destinatario String?`. The CH-14 comment is rewritten: a list of at most 5 addresses validated in the application, empty means no email.
- Migration `20261104000000_automatizacion_destinatarios`:
  ```sql
  ALTER TABLE "Automatizacion" ADD COLUMN "destinatarios" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
  UPDATE "Automatizacion" SET "destinatarios" = ARRAY["destinatario"] WHERE "destinatario" IS NOT NULL;
  ALTER TABLE "Automatizacion" DROP COLUMN "destinatario";
  ```
  Rollback in the header: add `destinatario TEXT`, set it to `"destinatarios"[1]`, drop `destinatarios`. A stored address is already valid (DEC-82), so the copy needs no check.
- The isolation extension needs no change: `destinatarios` is an ordinary column of a scoped model.

## 2. The list rule (`src/automatizaciones/automatizaciones-rutas.ts`)

`destinatarioDe` is replaced by:

```ts
/** CH-41 (DEC-187, DEC-194): the cap, after removing duplicates. */
export const MAX_DESTINATARIOS = 5;

export type ResolucionDestinatarios =
  | { ok: true; lista: string[] }
  | { ok: false; indices: number[]; excede: boolean };

export function destinatariosDe(valores: readonly unknown[]): ResolucionDestinatarios
```

1. For each element: not a string → its index is refused; else trim surrounding spaces and tabs only (a CR or LF stays in, as today) and check `direccionValida`.
2. Any refused index → `{ ok: false, indices, excede: false }`; the positions are the ones given, before deduplication.
3. Deduplicate ignoring case (`toLowerCase()`), keeping the first spelling and the given order.
4. More than `MAX_DESTINATARIOS` → `{ ok: false, indices: [], excede: true }`.

The schemas only check the shape: `destinatarios: { type: 'array', maxItems: 50, items: {} }`. `items: {}` keeps a non-string element for the rule to name by position; `maxItems: 50` bounds the work before the rule runs. Refusals map to fields as:
- console routes: `/destinatarios/<i>` per index, or `/destinatarios` when `excede`;
- panel route: `destinatarios` in both cases.

## 3. Console routes (`automatizaciones-rutas.ts`)

- **Create.** `RegistroAutomatizacionBody.destinatarios?: unknown[]`; `propertyNames.enum` swaps `destinatario` for `destinatarios`. The pure check runs where `direccionValida` ran, before any read; absent means `[]`. `create` writes the clean list.
- **Projection.** `AutomatizacionCompleta` swaps `destinatario` for `destinatarios`.
- **Adjust.** `ajusteOperadorSchema` swaps the key; `CuerpoAjusteOperador.destinatarios?: unknown[]`, `DatosAjusteOperador.destinatarios?: string[]`; `resolverAjusteOperador` calls `destinatariosDe` and pushes the mapped fields with the others. `[]` is a valid list (empties it). The `update` spreads `destinatarios`.

## 4. Panel route (`src/panel/panel-ajustes.ts`)

- `FilaAjustes.destinatarios: string[]`, `AjustesLeidos.destinatarios: string[]`, `CuerpoAjustes.destinatarios?: unknown`, `DatosAjustes.destinatarios?: string[]`; selects and the strict schema swap the key (`{ type: 'array', maxItems: 50, items: {} }`).
- `resolverAjustes`: `destinatarios` not an array → `campos: ['destinatarios']`; else `destinatariosDe`; a refusal, or an ok list that is empty, pushes `destinatarios` (DEC-194 2(a)).
- `proyectarAjustes` returns the stored list as it is.

## 5. Engine

- `decidirNotificacion(r, destinatarios: readonly string[], configurado, minimoFilas)`: `destinatarios.length === 0` → `sin-destinatario`, in the same row; the send branch returns `{ enviar: true, para: [...destinatarios] }`.
- `Correo.para: readonly string[]` (`correo.ts`). The notifier passes it as `to` unchanged (`notificador.ts:205`); nodemailer formats the list. Partial rejection resolves (`enviada`); full rejection throws `EENVELOPE`, already `envio-rechazado` → `fallo-envio`. No notifier code changes beyond the type.
- `planificador.ts`: `AutomatizacionACorrer.destinatarios: string[]`, the select, and the call.

## 6. Console UI (`src/consola/consola.ts`)

- **Markup.** `auto-destinatario` and `aj-destinatario` keep their ids (they are contract with the tests, guideline §7.1) and become `type="text" inputmode="email"`: an `email` input can refuse separators before the script reads it. Labels: «Correos de los destinatarios (opcional)» on create and «Correos de los destinatarios (opcional; vacío: no se envía correo)» on adjust. Hint: «Hasta 5, separados por comas.»
- **Split.** `direccionesDe(texto)`: `String(texto).split(/[,;\s]+/).filter((p) => p !== '')`. No validation, no deduplication: the server decides.
- **Create body.** `destinatarios` only when the split list is non-empty (as `destinatario` was only sent when typed). The pieces sent are kept for the 400.
- **Adjust.** `estadoAjuste().destinatarios = JSON.stringify(direccionesDe(campo))`, so «a, b» and «a;b» compare equal; the fill joins the stored list with «, »; the diff sends `cambios.destinatarios = direccionesDe(campo)` (`[]` when empty).
- **400.** `mensajeDe400DeAutomatizacion(cuerpo, enviadas)`: `/destinatarios/<i>` → «El correo «X» no es válido. Escriba direcciones como operaciones@empresa.com, separadas por comas.» with `X = enviadas[i]`; `/destinatarios` → «Hay más de 5 destinatarios. Escriba hasta 5 direcciones distintas.»
- **Preview.** «Para:» shows the split list joined by «, », or `SIN_DESTINATARIO` when empty.

## 7. Panel UI (`src/panel/panel.ts`)

- The «Enviar a» control becomes `type = 'text'`, `inputmode = 'email'`, filled with the list joined by «, », with the hint «Hasta 5 correos, separados por comas.»
- A `direccionesDe` like the console's. The body sends `destinatarios` when the split list differs from the stored one (compared as JSON).
- `ERRORES_CAMPO.destinatarios = 'Revisá los correos: escribí entre 1 y 5, separados por comas.'` The panel's 400 names the field, not the address, so the message stays generic. Copy follows `lenguaje.md` (voseo, «correo»).

## 8. Tests

- **Rule** (`automatizaciones-rutas.test.ts`, pure): trim, order, case-insensitive dedupe keeping the first spelling, positions as given, CRLF in the second element, a non-string element, 5 accepted, 6 refused, 6 with a duplicate accepted as 5, `[]` accepted.
- **Console routes**: the no-read table gains the list cases; DB cases for create with two, get, adjust with a new list, adjust with `[]`, adjust with an invalid second element, the old `destinatario` key refused (create and adjust), cross-tenant 404 with the list.
- **Migration**: the suite cannot hold a row from before the migration, because `test:db` migrates first. The copy is checked once against the development database, which has real rows with `destinatario`: count the rows with a non-null `destinatario` before `prisma migrate deploy`, then check that the same number of rows have a one-element `destinatarios` holding the same address. The result goes in the verify report, and the scenario "Existing recipients become a list" is marked as covered by that manual check, not by the suite.
- **Panel** (`panel-ajustes.test.ts`, `panel-ajustes-rutas.test.ts`): read shape, write two, refuse `[]`, refuse six, refuse the old key, the snapshot with the list.
- **Engine** (`automatizaciones.test.ts`): `decidirNotificacion` with `[]` and with two; the precedence cases pass lists.
- **Scheduler** (`planificador.test.ts`, DB): one run sends once to both addresses (the fake records `para`); the T2 tick with A's two addresses (`aislamiento.test.ts` or `planificador.test.ts`, wherever CH-14 5.11 lives).
- **Notifier** (`notificador.test.ts` if it pins `to`): the array reaches `sendMail`.
- **Console** (`consola.test.ts`): split and body on create (three separators), no key when blank, the 400 naming the typed address, the cap message, adjust prefill «a, b», unchanged when only the separator changed, `[]` when emptied, a changed list sent; exact bodies updated.
- **Fixtures**: every `destinatario:` in fixtures becomes `destinatarios: [...]`.

## 9. Docs

- `docs/guia/06-automatizaciones.md`: Anatomía «Acción», Camino rápido, Ajustar, Límites (now "up to 5 recipients in one message").
- `docs/guia/` panel section that mentions «Enviar a», if any.
- `guidelines/consola.md` (C-09 step 2 and Ajustar) and `guidelines/pantallas.md` (P-04 `destinatarios`, already named), both copies.
- `docs/01-decisiones.md`: DEC-194 on `v2/dec-194` from `master`.

## 10. Rejected alternatives

- **A JSON column.** It loses the element type the database enforces and needs a reader that tolerates other shapes.
- **Keeping `destinatario` beside the list during a transition.** Both UIs ship with the server (exploration 4(b) rejected).
- **Validating in the UIs.** A second rule to keep in step; the server already names the address.
- **`type="email" multiple`.** It accepts only commas and lets the browser refuse before the script runs.

## 11. Size forecast

| Area | Lines |
|---|---|
| Schema + migration | ~25 |
| Rule + console routes | ~60 |
| Panel route | ~30 |
| Engine, correo, notifier types, scheduler | ~15 |
| Console UI | ~45 |
| Panel UI | ~25 |
| Tests (new cases ~250, fixture churn ~200) | ~450 |
| Docs | ~40 |
| **Total** | **~690** |

`size:exception` accepted by the user on 2026-11-03.
