# Design: CH-43 — Telegram link

Inputs: proposal.md, the four delta specs (`telegram-link`, `client-panel-telegram`, `tenant-isolation`, `project-environment`), DEC-185, DEC-196, DEC-86, DEC-134, DEC-135. Delivered as three stacked PRs (DEC-196 6(b), split further in §14).

## 0. What the specs settle beyond DEC-196

- **Code alphabet.** Crockford base32. The input is read leniently: `O` as `0`, `I` and `L` as `1`, spaces and hyphens dropped. The panel shows the code as `XXXX XXXX`, and the deep link carries the 8 characters.
- **Any chat type links.** A private chat sends `/start <code>`, and a group sends `/start@<bot> <code>`. The link stores whatever `chat.id` the message came from. DEC-185 says "un chat vinculado" without restricting it to private chats, and a group is how a team would share the notices in CH-44.
- **A deactivated tenant's code answers as "not valid".** This mirrors the agent and panel lookups.
- **The bot is "available" only once `getMe` has answered.** Until then the panel reads `no-disponible`, so it never shows a link without a username.

## 1. Model and migration

`prisma/schema.prisma`, two models with the CH-43 comment:

```prisma
model VinculoTelegram {
  id          String   @id @default(uuid())
  tenantId    String   @unique
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  chatId      BigInt
  vinculadoEn DateTime @default(now())
}

model CodigoVinculoTelegram {
  id         String   @id @default(uuid())
  tenantId   String   @unique
  tenant     Tenant   @relation(fields: [tenantId], references: [id])
  codigoHash String   @unique
  venceEn    DateTime
  creadoEn   DateTime @default(now())
}
```

The migration is `20261105000000_vinculo_telegram`. It creates both tables with `TEXT` ids, `TIMESTAMP(3)`, `BIGINT` `chatId`, the `_key` unique indexes, and a foreign key to `"Tenant"` with `ON DELETE RESTRICT ON UPDATE CASCADE`. The rollback in the header drops both tables. `Tenant` gets the two back-relations, and nothing existing changes.

A chat id has at most 52 significant bits (Bot API, `Chat`), so `JSON.parse` reads it exactly as a `number`. It becomes `BigInt(n)` before it is stored, and it is sent back as `String(chatId)`.

## 2. Config (`src/telegram/telegram-config.ts`)

```ts
export function leerTelegram(env: NodeJS.ProcessEnv): { token: string } | null
```

- An absent or empty value (after trim) gives `null`. Any other value is the token, without a format check. A bad token is Telegram's to refuse, and the poller then backs off on `getMe` (`project-environment`, "A wrong token does not stop the application").
- This module is the only reader of the variable, as `notificador.ts` is for `SMTP_*`. The token never reaches `AppConfig`.
- `server.ts` logs `{ telegram: 'configurado' | 'no-configurado' }`.
- The variable also goes into `docker-compose.yml` (`TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN:-}`, with a comment like the SMTP block), the README table, the example env file and the `config.test.ts` reset list.

## 3. Code (`src/telegram/codigo-vinculo.ts`)

```ts
export const DURACION_CODIGO_MS = 10 * 60_000;
export function generarCodigo(): { codigo: string; codigoHash: string }   // randomInt per char
export function normalizarCodigo(texto: string): string | null            // null if not 8 valid chars
export function hashCodigo(codigo: string): string                         // SHA-256 hex
```

- Each character comes from `crypto.randomInt(32)`, so there is no modulo bias.
- `normalizarCodigo` runs before `hashCodigo`, both when creating and when receiving, so equal codes hash equally.
- A plain hash is enough against online guessing: there are about 10^12 values, each lives 10 minutes, and the per-chat cap applies.
- Offline guessing from a leaked row is possible within the code's 10-minute life. We accept that: a leaked row already means a leaked database. §13 records the alternative.

## 4. Client (`src/telegram/cliente-telegram.ts`)

```ts
export type Buscar = (url: string, init: { method: 'POST'; headers; body: string; signal: AbortSignal }) => Promise<{ status: number; text(): Promise<string> }>;
export type CategoriaTelegram = 'red' | 'tiempo-agotado' | 'respuesta-invalida' | 'rechazada' | 'conflicto' | 'abortada';
export type Resultado<T> = { ok: true; valor: T } | { ok: false; categoria: CategoriaTelegram };

export interface ClienteTelegram {
  obtenerBot(senal: AbortSignal): Promise<Resultado<{ usuario: string }>>;
  recibir(offset: number | null, senal: AbortSignal): Promise<Resultado<ActualizacionTelegram[]>>;
  responder(chatId: bigint, texto: string): Promise<Resultado<void>>;
}
export function crearClienteTelegram(token: string, buscar: Buscar = fetch): ClienteTelegram
```

- Every call is a `POST` with a JSON body to `https://api.telegram.org/bot<token>/<method>`. The URL is built inside one private function and never returned, logged or attached to an error.
- `recibir` sends `{ offset, timeout: 25, allowed_updates: ["message"] }` with a 35 s timeout, combined with the caller's signal through `AbortSignal.any`. `obtenerBot` and `responder` time out at 10 s.
- Classification:
  - A thrown `AbortError` is `abortada` when the caller aborted, and `tiempo-agotado` when the timeout fired.
  - Any other thrown error is `red`.
  - A body that is not JSON or lacks `ok` is `respuesta-invalida`.
  - `ok: false` with `error_code` 409 is `conflicto`, and any other `ok: false` is `rechazada`.
- No branch reads the error's `message`, the `description` or the body into a result. The function never throws.
- `ActualizacionTelegram` is the parsed minimum: `{ updateId: number; chatId: bigint | null; texto: string | null }`. Missing or ill-typed fields give `null`, so a malformed update is still confirmed.

## 5. Poller (`src/telegram/sondeo-telegram.ts`)

```ts
export interface DependenciasSondeo {
  cliente: ClienteTelegram;
  vincular: (chatId: bigint, codigoHash: string) => Promise<ResultadoVinculo>; // §6
  reloj: Reloj;            // the scheduler's type: ahora(), programar(ms, fn) => cancelar
  aleatorio: () => number;
  log: FastifyBaseLogger;
}
export function crearSondeoTelegram(deps: DependenciasSondeo): { iniciar(): void; detener(): Promise<void>; bot(): string | null }
```

- **Loop.** One `vuelta()` at a time, rescheduled by `reloj.programar` like the scheduler, so calls never overlap. While `bot()` is null it calls `obtenerBot`. After that it calls `recibir(offset)`, handles each update in order and sets `offset = updateId + 1`. A successful answer reschedules with delay 0.
- **Backoff.** `esperaSondeo(intento, aleatorio)` copies the agent's formula (`esperaReconexion`, equal jitter, `tope = min(60 s, 1 s · 2^(intento+1))`), so every wait falls in [1 s, 60 s]. It lives in this module because the agent is a separate build (§13). The attempt count resets on success. Each failure logs `{ evento: 'telegram-sondeo', categoria }` at `warn`.
- **Shutdown.** `detener()` sets `detenido`, cancels the timer, aborts an `AbortController` shared with the request in flight, and awaits the current `vuelta()`. An `abortada` result ends the loop without logging.
- **Message handling** (`manejarMensaje`, exported for tests):
  1. `texto` must match `^/start(@\w+)?\s+(.+)$`, or the update is ignored.
  2. A chat inside its cap window is ignored.
  3. `normalizarCodigo` returning null counts as a failure: answer "not valid".
  4. Otherwise `vincular(chatId, hashCodigo(codigo))`.
  5. `vinculado` sends the success text with the tenant name. `no-valido` counts a failure and sends the "not valid" text.
- **Cap.** The cap is a `Map<string, number[]>` of failure times per chat, pruned to the last 10 minutes. At 5 failures the chat is ignored until the oldest one ages out. The map is bounded: entries older than 10 minutes are dropped on every pass.
- **Logs.**
  - `{ evento: 'telegram-vinculo', tenantId, resultado: 'vinculado' }` on success.
  - `{ evento: 'telegram-vinculo', resultado: 'no-valido' }` on failure.
  - `{ evento: 'telegram-respuesta', categoria }` when an answer fails.
  - No chat id, code, text or username is logged (rule 5).

## 6. Linking (`src/telegram/vincular.ts`)

```ts
export type ResultadoVinculo = { vinculado: true; tenantNombre: string } | { vinculado: false };
export function crearVincular(prisma: PrismaAislado, reloj: Reloj): (chatId: bigint, codigoHash: string) => Promise<ResultadoVinculo>
```

1. Call `prisma.codigoVinculoTelegram.buscarPorHash(codigoHash)`, the unscoped lookup from §7.
2. If there is no row, `tenantActivo` is false, or `venceEn <= ahora`, return `{ vinculado: false }`.
3. Otherwise, inside `conTenantActivo({ id, nombre })`, run one interactive `$transaction` on the extended client:
   - `vinculoTelegram.deleteMany({})`
   - `vinculoTelegram.create({ data: conTenantInyectado({ chatId }) })`
   - `codigoVinculoTelegram.deleteMany({})`

`aplicarAlcance` refuses `upsert` on purpose (`aislamiento-prisma.ts:95`), and `deleteMany` + `create` uses only operations it already scopes. Two `/start` messages with the same code are handled one after the other, because the loop never overlaps. A second concurrent poller would answer `conflicto`. Even if two transactions raced, the `tenantId` unique key would refuse the second `create`, which then rolls back. That outcome is caught and treated as "not valid".

## 7. Isolation (`src/aislamiento/`)

- `MODELOS_AISLADOS` gets `VinculoTelegram` and `CodigoVinculoTelegram`.
- `codigoVinculoTelegram.buscarPorHash(codigoHash)` goes in the `model` block, next to `sesionPanel.buscarPorTokenHash`. It runs a `findUnique` on the raw client, selecting `tenantId`, `venceEn` and `tenant { nombre, activo }`. It returns `{ tenantId, tenantNombre, tenantActivo, venceEn } | null`. Its doc comment calls it the single audited unscoped read of the model.
- The `conTenantActivo` comment in `contexto-tenant.ts` names three production entries: the request hooks, the scheduler, and the Telegram poller, which enters only with the tenant the code lookup returned.

## 8. Panel API (`src/panel/panel-telegram.ts`)

```ts
export interface PuertoTelegram { bot(): string | null }   // null: token unset or getMe pending
export function registerPanelTelegramRoutes(app, { prisma, telegram, reloj }): void
```

- `telegram` is `null` when the token is unset, and otherwise it is the poller itself. It reaches the routes through `DependenciasRutas` in `src/app/rutas.ts`, registered after `registerPanelAjustesRoutes`.
- The three rows go into `RUTAS_PANEL_PUBLICAS`. Each route has `preHandler: levantarSesionPanel(prisma)`, the strict empty schema of the panel routes, and its work inside `conTenantActivo(sesion)`.
- **GET** reads both rows (scoped `findFirst`) and maps them to the four states. A code with `venceEn <= ahora` is ignored and not deleted. Expired rows are harmless, and the next `POST` replaces them.
- **POST** returns 409 `{ error: 'telegram-no-disponible' }` when `bot()` is null. Otherwise it runs `generarCodigo()` and, in one transaction, `codigoVinculoTelegram.deleteMany({})` then `create`. It answers 201 `{ codigo, enlace: 'https://t.me/' + bot + '?start=' + codigo, venceEn }`.
- **DELETE** runs `vinculoTelegram.deleteMany({})` and answers 204.
- **Logs.** `{ evento: 'telegram-codigo', tenantId }` and `{ evento: 'telegram-desvinculo', tenantId }` at `info` (DEC-196 4(a)).

## 9. Wiring (`src/server.ts`)

```ts
const configTelegram = leerTelegram(process.env);
const sondeo = configTelegram === null ? null : crearSondeoTelegram({
  cliente: crearClienteTelegram(configTelegram.token),
  vincular: crearVincular(prisma, relojDelSistema), reloj: relojDelSistema, aleatorio: Math.random, log: app.log,
});
app.addHook('onClose', async () => { await sondeo?.detener(); });
// registrarRutas(..., telegram: sondeo)
// listen().then(() => { planificador.arrancar(); sondeo?.iniciar(); })
```

`Reloj` is already exported from the scheduler module; `relojDelSistema` is not, so it gets `export` (one word), and the poller takes the same type and clock instead of new ones.

## 10. Panel UI, CH-43c (`src/panel/panel.ts`)

- **Markup.** `documentoShell` gets a `<section id="tarjeta-telegram" class="zd-card" data-change="CH-43" data-estado="existe">` before the «Mis automatizaciones» section. It holds fixed blocks: loading, error, `no-disponible`, `sin-vincular`, `codigo`, `vinculado`. The script toggles them with `hidden`, as `mostrar()` already does, so no markup is built from strings except the code and the dates, which pass through `textContent`.
- **Script.**
  - `cargarTelegram()` runs independently of `cargarLista()`, so a failure in one never blocks the other.
  - «Vincular Telegram» and «Generar otro código» `POST` and then show the code as `XXXX XXXX`, «Abrir Telegram» (`<a href=enlace target=_blank rel=noopener>`) and «Vence a las HH:MM», formatted in the tenant's zone with the existing `formatear`.
  - «Desvincular» opens an inline confirm with «Sí, desvincular» and «Cancelar», then `DELETE`.
  - A 409 from `POST` repaints the card as `no-disponible`.
- **Copy** follows the spec and the glossary, and is checked by the existing `panel.test.ts` glossary guard.
- **Design guide.** `guidelines/pantallas.md` gets P-07 «Avisos por Telegram — N5 · CH-43 · EXISTE», in both skill copies, with its data, states and actions. The panel mockup is not changed.

## 11. Tests

| File | Covers | DB |
|---|---|---|
| `src/telegram/codigo-vinculo.test.ts` | Alphabet, length, normalization (`7kq2-m9xa`, `O`/`I`/`L`), rejecting bad input, hash equality | no |
| `src/telegram/cliente-telegram.test.ts` | Request shape (method, body, `allowed_updates`), every category, update parsing (big chat id, missing fields), and the token never appearing in a result when the fake throws errors containing it | no |
| `src/telegram/sondeo-telegram.test.ts` | Offset advance, no overlap, backoff bounds and reset, `getMe` gate, ignored messages, cap, answers, `detener()` aborting an open request, no log line containing the token or chat id | no (manual clock, fake client, fake `vincular`) |
| `src/telegram/vincular-rutas.test.ts` | Link, relink, shared chat, expired code, deactivated tenant, code deleted after use, A's code never touching B | yes |
| `src/panel/panel-telegram-rutas.test.ts` | The four states, `POST` replacing a code, 409 with no bot, idempotent `DELETE`, 401 with no cookie, strict empty bodies | yes |
| `src/aislamiento/aislamiento-panel.test.ts` | The two-tenant rows from `tenant-isolation` | yes |
| `src/aislamiento/aislamiento.test.ts` | Both models fail closed, and the lookup returns only its fields | yes |
| `src/compartido/config.test.ts` | Reset list, and startup with the variable unset | no |
| `src/panel/panel.test.ts` (CH-43c) | Card markup and ids, glossary, `textContent` only | no |

No test reaches `api.telegram.org`. The client tests inject `buscar`, and the poller tests inject the client.

## 12. Docs

- `README.md` variable table: `TELEGRAM_BOT_TOKEN`, optional, how to create a bot with BotFather, and that a webhook on the bot stops the link.
- `docs/guia/06-automatizaciones.md` gets a short "Vincular Telegram" section (CH-43c). The ethical note on Telegram as a second data exit stays for CH-44, which is the first to send tenant data.
- `docs/02-mapa-de-changes.md`: the CH-43 row gets its PR numbers.
- DEC-196 moves to its own `v2/dec-196` PR from `master`.

## 13. Rejected alternatives

- **Moving the agent's `esperaReconexion` to `src/compartido/`.** It would touch `tsconfig.agente.json` and the agent build for a three-line formula. We copy it, with a comment that points to the original.
- **HMAC of the code keyed with `CREDENTIAL_MASTER_KEY`.** It closes offline guessing from a leaked row, but it ties the link to the credential key's rotation. The code lives 10 minutes and a leaked row already means a leaked database.
- **`upsert` in the isolation map.** It needs a scoped `where` and a scoped `create`. `deleteMany` + `create` in one transaction uses only operations the map already scopes.
- **Persisting the offset.** Telegram confirms each processed update through the next offset. After a restart, the worst case is one repeated `/start` whose code is already gone.
- **A `timeout` longer than 25 s.** Every `detener()` aborts the request anyway. A shorter wait limits how long a silently broken connection goes unnoticed.

## 14. Size forecast

| Slice | Code | Tests | Docs | Total |
|---|---|---|---|---|
| CH-43a: model, isolation, config, code, client, poller, linking, panel API, wiring | ~560 | ~520 | ~40 | **~1,120** |
| CH-43b: card, P-07, guide | ~170 | ~60 | ~50 | **~280** |

The exploration estimated ~1,000 in total. Writing the design moves CH-43a to about three times the budget, mostly because of the client and poller tests. **Decision needed before apply** (Single PR policy):
- (a) Keep two PRs and accept `size:exception` for CH-43a.
- (b) Split CH-43a in two:
  - CH-43a1 (~520): model, isolation, config, code and the panel API, with `bot()` stubbed as unavailable.
  - CH-43a2 (~600): client, poller, linking and wiring.

  That makes three stacked PRs. CH-43a2 still runs over 400.

**Chosen: (b)**, by the user on 2026-11-04. The three stacked slices are named after their content: CH-43a (data and panel API), CH-43b (network loop) and CH-43c (panel UI, the former CH-43b). Each slice is one subject: the data and the panel contract, the network loop, the screen. CH-43a and CH-43b still run over 400 each; the tasks forecast records it.
