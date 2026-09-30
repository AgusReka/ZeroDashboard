# Design: CH-14 — Engine: Condition and Email Notification (X3, N1, N2)

## Technical Approach

Notification runs inline in `correr()` (`src/planificador.ts`), after `resultadoDeCorrida` and before the single `ejecucion.update`, which is the only point where rows exist. Three units, split by side effect:

- `src/correo.ts`: pure. Renders `{asunto, html, texto}` from `columnas/filas/hayMas` and validates addresses.
- `src/automatizaciones.ts`: pure, extended. Decides whether to send and maps the outcome to the closed `Ejecucion` columns.
- `src/notificador.ts`: side effects. Reads `SMTP_*`, wraps nodemailer, applies the timeout, and classifies errors into closed categories.

The scheduler receives an optional injected `Notificador`, the same way it receives `Reloj`. When none is passed, runs record `no-configurada` (or an earlier outcome), so existing fixtures and tests keep working. The equivalence is exact: `SMTP_HOST` absent or empty ⇔ `crearNotificadorSmtp` returns `null` ⇔ no notifier is injected ⇒ `no-configurada`. A test that injects no notifier is therefore the unset-SMTP case.

No new architecture decision appears. The design-level mechanics are already registered in `docs/01-decisiones.md`: the DEC-86 addendum (SMTP parsing) and the block "Resoluciones de nivel diseño bajo DEC-19, DEC-83 y DEC-86 (CH-14)" (R1: a send failure keeps `filas`; R2: `SMTP_TIMEOUT_MS` default `10000`; R3: `fase` stays `ejecucion` unless the send fails). No slice edits `docs/01-decisiones.md`.

## Architecture Decisions (implementation-level, within DEC-81..86)

| Topic | Choice | Rejected | Rationale |
|---|---|---|---|
| Module layout | `correo.ts` (pure render + `direccionValida`), mapping in `automatizaciones.ts`, `notificador.ts` (nodemailer) | One `notificacion.ts` doing everything | Matches the CH-13 split between pure code and I/O. The renderer and the mapping can be tested without network or DB |
| Outcome precedence | See table below; evaluated in `decidirNotificacion` | Checking SMTP before recipient | Follows the order in the proposal. The most specific reason the operator can fix wins |
| `formato` | Not branched on at runtime. `FORMATOS` has only `correo-html`, and the catalog route rejects any other value | Runtime check | An unreachable branch is noise. CH-21 (N3) adds a format branch when a second format exists |
| Close once | `cierreDeResultado` stays as is. Then `cierreConNotificacion(cierre, salida)`. `finalizadaEn` is read **after** the send, then one `update` | Updating the row twice | One write per run, and `duracionMs` includes the send (X2) |
| `fase` on success | On `enviada` and on every non-send outcome of an `ok` run, `fase` stays `'ejecucion'`, exactly what `cierreDeResultado` already yields. Only a failed send rewrites it | Setting `fase='notificacion'` on every notify attempt | R3 under DEC-86. `fase` names what failed, not the last step reached |
| Send failure | `estado='fallo'`, `fase='notificacion'`, `error` = `CategoriaEnvio`, `codigoError` = SMTP reply code or null (separate gate, see Interfaces). `filas`/`corte` are **kept** | Setting `filas=null` as query failures do | R1 under DEC-83. The query did succeed, so its row count stays true |
| Unexpected throw in the notify step | `fallo / notificacion / error-interno`, `notificacion='fallo-envio'`. Only the error name is logged | Letting it reach the per-run catch (row left `en-curso`) | The row always closes |
| Timeout | `SMTP_TIMEOUT_MS`, default `10000`, on `AppConfig` via `enteroPositivoOpcional`. Applied to nodemailer `connectionTimeout`/`greetingTimeout`/`socketTimeout` **and** to an outer `Promise.race` guard (then `transporter.close()`) | No outer guard; using `QUERY_TIMEOUT_MS` | R2 under DEC-19. The guard bounds how long the sequential tick can be blocked, whatever phase hangs |
| SMTP env | `SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, SMTP_FROM`, read only in `notificador.ts` (`leerSmtp(env)`), never on `AppConfig` | Putting them on `AppConfig` | Follows the master-key precedent (DEC-17). Keeps them one `log.info(config)` away from nothing |
| Env parsing | See the parsing rules below the table | Silent fallback on a present-but-invalid value | DEC-86 addendum: the `config.ts` rule, absent means the default, present but invalid is a configuration error |
| Address validation | `direccionValida`: trimmed, ≤254 chars, ASCII `local@domain`. Local part ≤64 chars of atext and dots, no leading, trailing, or doubled dot. Domain has ≥2 labels `[A-Za-z0-9-]`, no edge `-`, TLD ≥2 letters. Rejects whitespace, CR/LF, `,;<>"()` | A validator dependency; IDN/SMTPUTF8 support | Blocks header injection with no new dependency. Non-ASCII addresses are a documented limit |
| Nodemailer hardening | `disableFileAccess: true`, `disableUrlAccess: true`, `logger: false`, `debug: false`, TLS verification left on by default. From is `{name:'ZeroDashboard', address: SMTP_FROM}` | Defaults | Content can never make nodemailer read files or URLs. Nothing is logged by the library |
| Nodemailer version | Exact pin. Explore reported `10.0.12`: **verify at apply** with `npm view nodemailer version`, and check for bundled types (otherwise pin `@types/nodemailer` as a devDependency) | Caret range | Same approach as the `cron-parser` pin |

`SMTP_*` parsing rules (DEC-86 addendum):

- An absent or empty `SMTP_HOST` returns `null`, which is recorded as `no-configurada`.
- When `SMTP_HOST` is set:
  - `SMTP_FROM` is required and must pass `direccionValida`.
  - `SMTP_SECURE` must be `true` or `false`. It defaults to `false`.
  - `SMTP_PORT` must be a positive integer. It defaults to `465` if secure, otherwise `587`.
  - `SMTP_USER` and `SMTP_PASSWORD` are set together or not at all. Leaving both unset is valid (Mailpit).
- Any other value stops the boot. The error message names the variable, **never its value**.

**Outcome precedence** (`decidirNotificacion(resultado, destinatario, configurado)`):

| # | Condition | `notificacion` | Sends |
|---|---|---|---|
| 1 | `resultado` is not `ok` (rechazo, fallo, excepción) | `null` | no |
| 2 | `ok` with 0 rows | `omitida-sin-filas` | no |
| 3 | `destinatario === null` | `sin-destinatario` | no |
| 4 | no `Notificador` (⇔ SMTP unset) | `no-configurada` | no |
| 5 | send accepted / send failed | `enviada` / `fallo-envio` | yes, once |

**Send error categories** (`CategoriaEnvio`, disjoint by `fase='notificacion'`), from the nodemailer `code`:

| nodemailer `code` | category |
|---|---|
| `ETIMEDOUT`, outer guard | `tiempo-agotado` |
| `ECONNECTION`, `ESOCKET`, `EDNS`, `ETLS`, `EPROXY` | `servidor-inalcanzable` |
| `EAUTH`, `ENOAUTH` | `credenciales-invalidas` |
| `EENVELOPE`, `EMESSAGE`, or an SMTP 4xx/5xx `responseCode` without a known code | `envio-rechazado` |
| anything else (`EPROTOCOL`, `ESTREAM`, non-Error) | `error-desconocido` |

Neither `message` nor `response` is ever read into the result.

**Rendering (N1/N2).** Copy is in Spanish, matching the console and the original WF emails.

- **Accent and subject emoji**, from a closed map keyed by the template label:

  | Label | Accent | Emoji | Source |
  |---|---|---|---|
  | `stock-fisico` | `#f59e0b` | ⚠️ | bitácora WF-01 |
  | `stock-producible` | `#dc2626` | 🔴 | bitácora WF-01 |
  | `reporte-diario` | `#2563eb` | 📊 | design choice: WF-03 documents no emoji |
  | unknown label | `#6b7280` | none | neutral fallback, never a throw |

- **Subject**: `{emoji} {plantilla.nombre} ({n}{hayMas?'+':''})`. Control characters and CR/LF are stripped, and the subject is capped at 200 chars.
- **HTML**: table layout with inline styles, 600px max width. It has:
  - a header in the accent colour with the escaped name;
  - a line with the run date, formatted in `zonaHoraria` (DEC-77);
  - the data table;
  - notices;
  - a gray footer ("Enviado automáticamente por ZeroDashboard.").
- **Cell text** (`textoDeCelda`):
  - `null`, `undefined`, `''`, `NaN`, `±Infinity` → `—`
  - booleans → `Sí`/`No`
  - `Date` → ISO
  - bytes → `[binario]`
  - objects → `JSON.stringify`; if that fails → `—`. Nested JSON is shown verbatim, so `{"a":null}` renders with the text `null` inside it. This is a documented limit: the placeholder rule applies to the top-level cell value only (`null`, `undefined`, `''`, `NaN` map to `—`)
  - capped at 500 chars with `…`
  - short rows are padded with `—`
- **Escaping**: `escaparHtml` (`& < > " '`) is applied to every column name, cell, name, and date. A `style` attribute only ever holds values from the closed map.
- **Notices**:
  - `hayMas` → "Se muestran las primeras {n} filas; la consulta devolvió más."
  - any empty cell → "Las celdas sin valor se muestran como —."
  - zero columns → "La consulta devolvió {n} filas sin columnas."
- **`texto` part**: the same content as the HTML, with ` | `-joined rows and CR/LF in cells turned into spaces.

## Data Flow — `correr()` with notification

```
Planificador        own DB (scoped)          tenant PG     correo.ts   Notificador   SMTP
 │ ejecucion.create{en-curso}──▶
 │ resultadoDeCorrida: plantilla{sql,parametros,entidades,nombre,automatizacion}
 │   gate → compose → prepare → destino ─────▶ ejecutarConsulta (READ ONLY)
 │ cierre = cierreDeResultado(r)
 │ d = decidirNotificacion(r, automatizacion.destinatario, notificador≠null)
 │ d.enviar? ── componerCorreo(r.columnas, r.filas, r.paginacion.hayMas, plantilla, iniciadaEn, zona) ─▶
 │           └─ notificador.enviar({para, asunto, html, texto}) ────────────▶ sendMail (≤ SMTP_TIMEOUT_MS)
 │                                          ◀── {enviada} | {fallo, categoria, codigo}
 │ final = cierreConNotificacion(cierre, salida)   (throw in step → error-interno)
 │ finalizadaEn = reloj.ahora()   // duration includes the send
 │ ejecucion.update{…final, notificacion, finalizadaEn, duracionMs} ──▶  (single write)
 │ estado=fallo? log.warn{automatizacionId, fase, error, codigoError}  // never recipient/rows
```

The recipient is read from the scoped `Automatizacion` row, inside the tenant context (rule 2). After the render, rows exist only in the email and are then dropped (D-1 leaning).

## Interfaces / Contracts

```ts
// correo.ts (pure)
export interface Correo { para: string; asunto: string; html: string; texto: string }
export function componerCorreo(e: { nombre: string; automatizacion: string; columnas: string[];
  filas: unknown[][]; hayMas: boolean; fecha: Date; zona: string }): Omit<Correo, 'para'>;
export function direccionValida(valor: string): boolean;
// automatizaciones.ts (pure)
export type EstadoNotificacion = 'enviada'|'omitida-sin-filas'|'fallo-envio'|'sin-destinatario'|'no-configurada';
export type CategoriaEnvio = 'tiempo-agotado'|'servidor-inalcanzable'|'credenciales-invalidas'|'envio-rechazado'|'error-desconocido';
export type ResultadoEnvio = { resultado: 'enviada' } | { resultado: 'fallo'; categoria: CategoriaEnvio; codigo: string | null };
// notificador.ts
export interface Notificador { enviar(c: Correo): Promise<ResultadoEnvio> }   // never throws
export function notificadorDesdeTransporte(t: Transporter, o: { de: string; timeoutMs: number }): Notificador;
export function crearNotificadorSmtp(o: { timeoutMs: number }, env?: NodeJS.ProcessEnv): Notificador | null;
// planificador.ts: DependenciasPlanificador gains `notificador?: Notificador | null` (default null)
```

Type changes to the existing close contract in `automatizaciones.ts`:

- `FaseCierre` widens to `'preparacion' | FaseEjecucion | 'notificacion'`.
- `CategoriaCierre` widens to include `CategoriaEnvio`. The send categories are disjoint from the query categories, and `fase='notificacion'` tells them apart.
- `CierreEjecucion` gains a third variant, the notification failure: `{ estado: 'fallo'; fase: 'notificacion'; filas: number; corte: CorteEjecucion | null; error: CategoriaEnvio; codigoError: string | null }`. The existing query-failure variant (`filas: null`, `corte: null`) is unchanged. `corte` is carried over from the `ok` close.
- `cierreConNotificacion(cierre, salida)` returns `CierreEjecucion & { notificacion: EstadoNotificacion | null }`. It builds a fresh object from named fields, never a spread of the send result.

`codigoError` gate for a send failure. `codigoPublicable` (`pg-error.ts`) accepts SQLSTATE and Node codes, so it is **not** reused. A separate gate, `codigoSmtp(valor: unknown): string | null` in `notificador.ts`, reads only nodemailer's numeric `responseCode`. It returns the value as a string only when it matches `/^[2-5]\d\d$/`, otherwise `null`. Node codes such as `ECONNECTION` feed the category only and are never stored. `cierreConNotificacion` re-applies the same regex, so a fake notifier cannot place any other text in `codigoError`.

Migration `prisma/migrations/20260929000000_notificacion/migration.sql` is additive, with plain TEXT columns and values that live in code, like `estado`/`fase`: `ALTER TABLE "Automatizacion" ADD COLUMN "destinatario" TEXT; ALTER TABLE "Ejecucion" ADD COLUMN "notificacion" TEXT;`. Pre-CH-14 runs read as `null`.

Server wiring:

```ts
const notificador = crearNotificadorSmtp({ timeoutMs: config.smtpTimeoutMs });
```

- It runs at boot. Invalid config throws before `listen`.
- The result is passed to `crearPlanificador`.
- At boot, only `correo: 'configurado' | 'no-configurado'` is logged.

Route and console changes:

- **Routes**:
  - `POST /automatizaciones` accepts an optional `destinatario` (`string`, 1–254 chars, added to `propertyNames`). `direccionValida` failing returns `400 {campos:['/destinatario']}`.
  - `destinatario` is added to `AutomatizacionCompleta` only. The list stays minimal.
  - `notificacion` is added to `EjecucionListada`.
- **Console**:
  - `auto-destinatario` email input, sent only when not empty.
  - A rejected recipient (`400 {campos:['/destinatario']}`) is shown as a legible message naming the recipient field, never as a raw error object or stack trace.
  - A "Notificación" column, labelled Enviada / No enviada: sin filas / Sin destinatario / Correo no configurado / Falló el envío / —.
  - One message per `notificacion:{categoria}`.

## File Changes

| File | Action | Description |
|---|---|---|
| `prisma/schema.prisma`, migration | Modify/Create | Two nullable TEXT columns |
| `src/correo.ts` (+test) | Create | Renderer, escaping, notices, subject, `direccionValida` |
| `src/automatizaciones.ts` (+test) | Modify | Types, `decidirNotificacion`, `cierreConNotificacion` |
| `src/notificador.ts` (+test, +`notificador-mailpit.test.ts`) | Create | Env parsing, wrapper, timeout, classification |
| `src/planificador.ts` (+test) | Modify | Select `destinatario` and template presentation; notify step; single close |
| `src/config.ts` (+test) | Modify | `smtpTimeoutMs` |
| `src/server.ts` | Modify | Build and inject the notifier |
| `src/automatizaciones-rutas.ts`, `src/consola.ts` (+tests) | Modify | Recipient on create; notification column |
| `src/aislamiento.test.ts` | Modify | T2: per-tenant recipient |
| `docker-compose.yml`, `.env.example`, `package.json` | Modify | `mailpit` service under `profiles: ["correo"]` (`axllent/mailpit`, tag pinned at apply, 1025/8025, no `depends_on` from app); `SMTP_*: ${VAR:-}` forwarded; empty placeholders; nodemailer pin |

## Testing Strategy (strict TDD; `npm test`; live PG on `TEST_DB_PORT=5434`)

| Layer | What |
|---|---|
| Unit `correo` | Escaping of every field (`<script>` in a cell and a column name); no `null`/`undefined` text; each notice; accent/emoji per label plus fallback; subject strips CR/LF; `texto` parity; `direccionValida` table |
| Unit mapping | Every precedence row; `fase` stays `ejecucion` on `enviada` and every non-send outcome; send failure keeps `filas`/`corte`; `codigoError` gating (3-digit SMTP code kept, `ECONNECTION`/SQLSTATE/free text → `null`) |
| Transport | `jsonTransport` message shape (to/from/subject/html/text, no attachments); fake rejecting transport per code gives a category with no message text; hanging transport with a 20 ms budget gives `tiempo-agotado`; `leerSmtp` absent, partial, and invalid cases (error text has no values) |
| Scheduler (fake `Notificador`, fake `Reloj`) | 0 rows → not called; rows → called once; no recipient; `null` notifier; failure → `fallo/notificacion`; a throwing notifier → `error-interno`, row closed; duration includes a delayed send |
| T2 | A+B tick with a marker parameter per tenant: each call's `para` is its own recipient and its body holds only its own marker |
| Live (optional) | Mailpit on `localhost:1025`, skipped when unreachable |
| Routes/console | `destinatario` valid, invalid, or with CRLF → 400; rejected recipient shown as a legible message naming the field; projections; column labels |

## Threat Matrix

The generic rows (shell, subprocess, VCS/PR, executable classification) are N/A. The applicable rows:

| Case | Expected | RED test |
|---|---|---|
| CRLF or `,` in recipient | `400` at create | Routes |
| CRLF in template name | Stripped from subject | correo |
| HTML in a cell, column, or name | Escaped text | correo |
| Content references a file or URL | Not fetched (`disable*Access`) | Transport |
| SMTP text or credentials in `Ejecucion`/logs | Closed category and 3-digit code only | Transport + scheduler |
| Invalid config error reveals a value | Only the variable name | Transport |
| Cross-tenant recipient or rows | Own recipient and own rows only | T2 |
| SMTP hangs | Bounded by `SMTP_TIMEOUT_MS`; siblings still run | Transport + scheduler |
| 0 rows | Never sends | Scheduler |
| Secrets committed | `.env.example` has empty placeholders | Review |

## Migration / Rollout

Stacked-to-main. `400-line budget risk: High`.

1. Schema and migration, `config.smtpTimeoutMs`, pins, compose, and `.env.example` (~170 lines).
2. `correo.ts` (~380).
3. Mapping (~180).
4. `notificador.ts` (~330).
5. Scheduler integration:
   - 5a: planificador and tests (~300).
   - 5b: server wiring and T2 (~150).
6. Routes and console (~350).
7. Docs, verify, archive.

The design-level resolutions are already registered in `docs/01-decisiones.md` (DEC-86 addendum and the CH-14 resolutions block under DEC-19, DEC-83, and DEC-86). Slice 1 does not edit that file.

**Rollback:** unset `SMTP_HOST` so runs record `no-configurada`, then revert slices in reverse order. The down migration drops the two columns.

## Open Questions

- [ ] Verify the nodemailer version, its bundled types, and the error `code` set at apply. Verify the Mailpit tag.
- [ ] Gmail clips HTML over ~102 KB. It is bounded by `MAX_FILAS_CONSULTA` × the 500-char cell cap. This is accepted and not enforced.
