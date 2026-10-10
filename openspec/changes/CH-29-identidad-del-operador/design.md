# Design: CH-29 — Operator identity in the console

Inputs: proposal.md, specs (`console-operator-auth`, `query-console` delta), DEC-151 to DEC-154. Mirrors the panel's mechanism (`src/panel-auth.ts`, DEC-133, DEC-134) without a tenant.

## 1. Modules

| File | Role |
|---|---|
| `prisma/schema.prisma` + new migration | Tables `Operador` and `SesionConsola` |
| `src/cookies.ts` (new) | `leerCookie`, moved out of `src/panel-auth.ts` unchanged; the panel imports it |
| `src/escapar-html.ts` (new) | `escaparHtml`, moved out of `src/panel.ts` unchanged; the panel and the console import it |
| `src/consola-auth.ts` (new) | Constants, cookie serializers, `resolverSesionConsola`, `EXENCIONES_OPERADOR`, `requiereOperador`, `registrarGuardOperador`, `registerConsolaAuthRoutes` (`ingresar`, `salir`) |
| `src/contexto-tenant.ts` | Two exact rows: `POST /consola/ingresar`, `POST /consola/salir` exempt from the tenant header |
| `src/rutas.ts` (new) | `registrarRutas(app, deps)`: the guard, the tenant hooks and every `register*` call, moved out of `src/server.ts` in the same order |
| `src/server.ts` | Builds config, clients, scheduler and registry, calls `registrarRutas`, listens |
| `src/operador-alta.ts` (new) | The bootstrap command; pure parts exported for tests |
| `src/consola.ts` | `GET /consola` resolves the session; login document; operator and "Salir" in the header; 401 reloads |
| `package.json` | `"operador:alta": "node dist/operador-alta.js"` |
| `scripts/smoke.sh` | Creates an operator in the container and logs in |

## 2. Schema and migration

```prisma
model Operador {
  id        String          @id @default(uuid())
  nombre    String          @unique
  claveHash String
  creadoEn  DateTime        @default(now())
  actualizadoEn DateTime    @updatedAt
  sesiones  SesionConsola[]
}

model SesionConsola {
  id         String   @id @default(uuid())
  tokenHash  String   @unique
  operadorId String
  operador   Operador @relation(fields: [operadorId], references: [id], onDelete: Cascade)
  expiraEn   DateTime
  creadaEn   DateTime @default(now())

  @@index([operadorId])
}
```

No tenant column, so neither model joins `MODELOS_AISLADOS`: like `Tenant`, they go through the extended client untouched. Migration generated with `prisma migrate diff`, rollback (`DROP TABLE`) in its header, as CH-25 did. No `activo` column: without a management UI or a deactivation command there is nothing to write it (DEC-153); a reset is the way to cut an operator off.

## 3. Pure and session layer (`src/consola-auth.ts`)

- `NOMBRE_COOKIE = 'zd_consola_session'`; `SEGUNDOS_VIDA_SESION = 12 * 60 * 60`. Twelve hours rather than the panel's thirty days: this session reaches every tenant. It is a constant, not configuration.
- `cookieDeSesion(token)` / `cookieVacia()`: `HttpOnly; Path=/; Max-Age=…; SameSite=Lax; Secure`, the panel's shape with its own name.
- `resolverSesionConsola(prisma, cabeceraCookie)` → `{ operador: { id, nombre }, sesionId } | { operador: null, motivo: 'sin-cookie' | 'token-desconocido' | 'expirada' }`. Looks up `sesionConsola.findUnique({ where: { tokenHash }, include: { operador } })`; an expired row is deleted on use. One resolution path, shared by the guard and `GET /consola`, for the panel's reason: two copies of the check are two places a hole can hide.
- `EXENCIONES_OPERADOR: ReadonlySet<string>` of `"METHOD /pattern"` rows: `GET /health`, `GET /consola`, `POST /consola/ingresar`, `GET /panel`, every row of `ESTILOS_EXENTOS` and of the panel's public rows (exported from `src/contexto-tenant.ts` for this, read-only). Built from those sets, so a new panel or stylesheet row is exempt here too without a second edit.
- `requiereOperador(metodo, patron | undefined)`: `false` only for a listed row; `undefined` (no route matched) is `true`.

## 4. Guard and routes

- `registrarGuardOperador(app, prisma)` adds one `onRequest` hook. It is called by `registrarRutas` **before** `registrarContextoTenant`, so the order is guard → tenant hook 1 → tenant hook 2 → handler, and an unauthenticated request is 401 before the tenant header is read. The guard's lookup runs outside the tenant store, which is safe because `SesionConsola` and `Operador` are not scoped models. On success it sets `request.operador = { id, nombre }` (declared on `FastifyRequest`).
- Answers: `401 { error: 'sesion-expirada' }` for an expired row; `401 { error: 'sesion-invalida' }` otherwise.
- `POST /consola/ingresar`: strict body `{ nombre (1–64), clave (≥1) }` with `propertyNames`, `attachValidation`, 400 `solicitud-invalida` with `campos` (the panel's `ingresarSchema` pattern). Unknown name → still runs `verificarClave` against a fixed dummy hash before answering 401, so the two failures take comparable time; the panel does not do this, and it costs one `scrypt`.
- `POST /consola/salir`: guarded (not exempt); deletes `request.operador`'s current session by id and clears the cookie.

## 5. Wiring extraction (`src/rutas.ts`)

`registrarRutas(app, { prisma, registro, estilos, zonaHoraria })` holds, in the current order and with their comments, every line of `src/server.ts` from `registrarContextoTenant` to `registerPanelRoutes`, plus the guard first and `registerConsolaAuthRoutes`. `src/server.ts` keeps `loadConfig`, `cargarEstilos`, the Prisma client, the notifier, the registry, the scheduler, its `onClose`, `registrarApagado` and `listen`. Behaviour is unchanged apart from the guard; the move is what lets a test build the real route table.

## 6. Bootstrap command (`src/operador-alta.ts`)

- Entry: `node dist/operador-alta.js <nombre>` through `npm run operador:alta -- <nombre>`. Reads only `DATABASE_URL` (not `loadConfig()`, which demands the server's whole environment). Builds a plain `PrismaClient`: both models are unscoped.
- Exported pure parts: `validarNombre(texto)`, `validarClave(texto)` (≥ 12), `leerClave({ entrada, salida, esTerminal })`: with a terminal, raw mode, no echo, asked twice; without one, the first line.
- `altaOReposicion(prisma, nombre, claveHash)` in one transaction: upsert by `nombre`; on update, `sesionConsola.deleteMany({ where: { operadorId } })`. Returns `'creado' | 'repuesto'`.
- Exit codes 0 / 1 / 2 as the spec says. Output names the operator and the outcome; never the password or hash.

## 7. Console (`src/consola.ts`)

- `registerConsolaRoute(app, prisma)` (gains the client). `GET /consola` stays exempt from the guard and the tenant header; it calls `resolverSesionConsola` and serves `documentoIngreso()` or `documentoConsola(nombreOperador)`.
- `documentoIngreso()`: a small document with its own script (form, `fetch('/consola/ingresar')`, `textContent` for the error, reload on 200). Built with the design skill's login pattern (P-01 of the panel is the reference) and `.zd-*` classes.
- The console header gains the escaped operator name and a "Salir" button. The script's single request helper `pedir()` and the one direct `fetch('/tenants')` call `location.reload()` on 401; both paths go through one small `siNoAutenticado(respuesta)` check.
- The guarded-ids test keeps its list; the hazard scan (one `</script>`, no backtick, no `innerHTML`) runs over both documents.

## 8. Tests

| File | Covers |
|---|---|
| `src/consola-auth.test.ts` | Pure: cookie attributes, `requiereOperador` (listed rows, look-alikes such as `/consola-falsa`, `undefined`), exemption set built from the panel and stylesheet sets |
| `src/consola-auth-rutas.test.ts` (live DB) | Login 200/401/400, token stored hashed, logout revokes, expired session deleted on use, panel and console cookies do not cross, guard 401 before tenant check |
| `src/rutas.test.ts` | Builds the app with `registrarRutas`, collects routes with `onRoute`; every non-exempt route without a cookie is 401 `sesion-invalida`; every exempt row is a registered route and is not answered by the guard |
| `src/operador-alta.test.ts` | Pure validators and `leerClave` with fake streams; `altaOReposicion` on the live DB (create, reset revokes sessions) |
| `src/consola.test.ts` | Login document vs console document by session, escaped operator name, hazard scan over both |
| `src/panel-auth.test.ts`, `src/panel.test.ts` | Unchanged, green: parity proof for the two extractions |

## 9. Trade-offs
- **A second session mechanism** next to the panel's: kept separate on purpose (DEC-04, DEC-151); only the cookie reader, the hashing and the escaping are shared.
- **No rate limiting on login**: same as the panel; out of scope, listed in the proposal.
- **The smoke cannot rely on curl's cookie jar** for a `Secure` cookie over `http://localhost`: it takes the token from `Set-Cookie` and sends `Cookie:` explicitly.
- **Moving the wiring** touches `src/server.ts` in one block; the order of registrations is load-bearing (the tenant hooks must precede every route), and `src/rutas.ts` keeps that comment.

## 10. Size forecast
PR1 ~380 (schema, migration, two extractions, pure module, tests) · PR2 ~420 (guard, routes, tenant rows, wiring move, wiring and route tests) · PR3 ~260 (command, tests, smoke) · PR4 ~320 (console). Total ~1380.
