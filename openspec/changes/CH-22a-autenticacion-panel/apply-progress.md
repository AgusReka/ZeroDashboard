# Apply Progress: CH-22a — Autenticación del Panel, Usuario, Sesión y Derivación Estricta de Tenant (T3)

**Store**: openspec. **Delivery**: single-pr con `size:exception` aprobado por el maintainer (2026-10-06, ver forecast en `tasks.md`); los grupos PR1/PR2/PR3 son unidades de trabajo y commits, no PRs separados.
**Mode**: Strict TDD (RED → GREEN por par), runner `npm test` (`tsx --test src/**/*.test.ts`).

## Estado acumulado

| Unidad | Tareas | Estado |
|--------|--------|--------|
| PR1 — Modelo de datos, migración y módulo crypto | 1.1-1.5 | **Hecho (este lote), rama `ch22a/panel-auth`** |
| PR2 — Rutas de auth, hook de sesión, aislamiento dos tenants | 2.1-2.5 | **Hecho (este lote), rama `ch22a/panel-auth`** |
| PR3 — Página `/panel` y pantalla de ingreso | 3.1-3.4 | Pendiente |
| Cierre | 4.1-4.2 | Pendiente |

No existía apply-progress previo (el lote PR1 lo creó). Este archivo es acumulativo: la sección PR2 se fusiona después de la de PR1 sin tocar nada de la primera.

## PR1: Archivos tocados

| Archivo | Acción | Qué se hizo |
|---------|--------|-------------|
| `src/crypto-auth.test.ts` | Creado | 22 casos: formato `s1:salt:key`, salt aleatoria por llamada, verificación correcta/incorrecta/último carácter/unicode/salt alterada, comparación constante-time (comportamiento + pin de fuente), 9 entradas malformadas que fallan a `false`, generador de token de sesión |
| `src/crypto-auth.ts` | Creado | `hashearClave` (scrypt, salt de 16 bytes, envolvente `s1:<saltHex>:<keyHex>`), `verificarClave` (parseo validado antes de decodificar, `timingSafeEqual`, todo fallo es `false`), `generarTokenSesion` (32 bytes `base64url` + SHA-256 hex). Solo `node:crypto` (DEC-133) |
| `prisma/schema.prisma` | Modificado | Modelos `Usuario` y `SesionPanel` con la forma de `design.md` (DEC-133/DEC-134), relaciones inversas `Tenant.usuarios` y `Tenant.sesionPanel` |
| `prisma/migrations/20261006000000_usuario_sesion_panel/migration.sql` | Creado | Generado con `prisma migrate diff --from-schema/--to-schema` (Prisma 7 renombró los flags), con cabecera y rollback escritos a mano; aplicado con `migrate deploy` contra 5434 |
| `src/aislamiento-prisma.ts` | Modificado | `Usuario` y `SesionPanel` agregados a `MODELOS_AISLADOS`; docs del módulo actualizados (DEC-133/DEC-134/DEC-135) |
| `src/aislamiento.test.ts` | Modificado | Pin L0 de la lista de modelos ahora incluye `SesionPanel` y `Usuario`; caso L1 nuevo: `usuario` y `sesionPanel` fallan cerrado con `ErrorSinTenantActivo` sin contexto de tenant |

**Commits (en orden, ninguno pushed):**

1. `3238249 feat(ch22a): hash panel passwords with scrypt and mint session tokens` (tareas 1.1-1.2)
2. `0b346dc feat(ch22a): add Usuario and SesionPanel models with an additive migration` (tarea 1.3)
3. `d6f36aa feat(ch22a): scope Usuario and SesionPanel through the tenant isolation extension` (tarea 1.4)
4. Commit docs de este archivo y `tasks.md` (más abajo)

## TDD Cycle Evidence

| Tarea | RED | GREEN | REFACTOR |
|-------|-----|-------|----------|
| 1.1 Tests crypto | Escrito primero contra `./crypto-auth.js` inexistente: `ERR_MODULE_NOT_FOUND`, exit 1 | — | — |
| 1.2 `crypto-auth.ts` | — | 22 de 22 pasaron. Un pin de fuente falló primero por falso positivo (coincidía la prosa del comentario, no un import): se afinó el asertor a `from 'bcrypt'`/`from 'argon2'`, no se tocó la implementación | Constantes extraídas (`VERSION_HASH`, `LONGITUD_SALT`, `LONGITUD_CLAVE`, `LONGITUD_TOKEN`); `derivarClave` tipada sin `as` (ver desviaciones); 22/22 siguen verdes |
| 1.3 Esquema + migración | N/A (estructural: `prisma validate` + diff de esquema). Los escenarios a nivel de base (correo único, `tenantId`) quedan pinneados por el pin L0/L1 de 1.4 y serán ejercitados por los fixtures de PR2 | `migrate deploy` aplicó `20261006000000_usuario_sesion_panel` sobre 5434; `prisma generate` OK; `migrate status` → *Database schema is up to date* | — |
| 1.4 Pin L0 + L1 | L1 genuino: `aislado.usuario.findMany({})` sin contexto **pasó sin filtrar** y cayó en el puerto cerrado (`Can't reach database server at 127.0.0.1:1`) en vez de `ErrorSinTenantActivo` | `Usuario` y `SesionPanel` en `MODELOS_AISLADOS`: 61/61 en `aislamiento.test.ts` (60 de la línea base + 1 nuevo) | Docs del módulo actualizados |
| 1.5 Verificación | — | Los tres comandos, más abajo | — |

**Safety net (previo a editar)**: `TEST_DB_PORT=5434 npx tsx --test src/aislamiento.test.ts` → 60/60 pass, 0 fail. Ningún fallo preexistente.

## Work Unit Evidence (PR1)

| Evidencia | Valor |
|---|---|
| Comando de test focalizado y resultado exacto | `npx tsc --noEmit` → exit 0. `$env:TEST_DB_PORT='5434'; npx tsx --test src/crypto-auth.test.ts` → `tests 22, pass 22, fail 0`. `$env:TEST_DB_PORT='5434'; npx tsx --test src/aislamiento.test.ts` → `tests 61, pass 61, fail 0` |
| Runtime harness | Postgres vivo en contenedor `zd-ch09-testdb` en `localhost:5434`. Escenario: `prisma migrate deploy` con `DATABASE_URL` apuntando a 5434 → *All migrations have been successfully applied*; `prisma migrate status` → *Database schema is up to date* (11 migraciones). La suite completa corre contra esa misma base |
| Full suite | `$env:TEST_DB_PORT='5434'; npm test` → exit 0, `tests 925, suites 144, pass 925, fail 0, cancelled 0, skipped 0`. La línea base pre-cambio completa **no** se corrió (la safety net fue solo el archivo modificado, 60/60); neto nuevo de esta unidad: 23 tests (22 crypto + 1 caso L1 CH-22a), así que 925 es consistente con una base de 902 |
| Typecheck | `npx tsc --noEmit`: exit 0 |
| Rollback boundary | Revertir los commits `3238249`, `0b346dc`, `d6f36aa` (o los tres archivos `src/crypto-auth.*`, `prisma/schema.prisma`, `src/aislamiento-prisma.ts` + `src/aislamiento.test.ts`), y borrar `prisma/migrations/20261006000000_usuario_sesion_panel/`; en la base: `DROP TABLE "SesionPanel"; DROP TABLE "Usuario";` (ambas aditivas, sin consumidores todavía). No toca trabajo no relacionado |

## Line-Count Checkpoint (1.5)

`git diff --numstat 3c3f6dd HEAD -- src prisma`: `crypto-auth.test.ts` 172, `crypto-auth.ts` 109, `migration.sql` 60, `schema.prisma` 55, `aislamiento.test.ts` 41+3-, `aislamiento-prisma.ts` 7. **Total 447 autorizados (444 altas + 3 bajas).** Excluye artefactos SDD y los archivos ajenos ya sucios en el worktree (`.atl/*`, `docs/verificacion-tesis-2026-10-01.md`), que no se tocaron.

- El forecast estimaba ~220 para PR1; el real es 447, concentrado en tests (el módulo crypto solo probó menos de la mitad). No se comprimió nada para acercarse al número: la entrega es `single-pr` con `size:exception` del maintainer para los ~810 del cambio completo, y esta unidad queda dentro de ese alcance aprobado.
- **Decisión de workload heredada**: `single-pr` + `size:exception` aprobado (2026-10-06); `Chain strategy: n/a`. No hizo falta pedir decisión nueva.

## Desviaciones y notas

- **`MODELOS_AISLADOS` no está en `src/contexto-tenant.ts`** (lo que dicen `tasks.md` 1.4 y `design.md` §1): la lista vive en `src/aislamiento-prisma.ts:35`. Se actualizó ahí, que es el lugar real; `contexto-tenant.ts` no se tocó (su lista de exenciones es tarea 2.4 de PR2). El diseño no cambió, solo la ruta citada.
- **`promisify(scrypt)` no tipa** en este proyecto: infería `Promise<unknown>` (`TS18046`, `TS2345`). Se reemplazó por un wrapper callback `derivarClave()` con tipos explícitos, sin `as`: misma asincronía (el riesgo que el proposal mitiga con "promisify" sigue cubierto), cero casts.
- **Prisma 7**: `migrate diff --from-schema-datamodel` fue reemplazado por `--from-schema`. La migración se generó por diff de esquemas (no por `migrate dev`) precisamente para respetar la convención de timestamp fijo `20261006000000_*` del repo.
- **`@@index([tokenHash])` junto a `@unique`** en `SesionPanel` (forma textual de `design.md`) crea dos índices sobre la misma columna. `prisma validate` lo acepta; se mantuvo fiel al diseño en lugar de "mejorarlo" por cuenta propia.
- Los escenarios de `domain-data-model/spec.md` (persistir `tenantId`, rechazo de correo duplicado a nivel base) no tienen tarea propia en `tasks.md`; el pin L0/L1 de 1.4 cubre forma y aislamiento, y los fixtures de PR2 ejercitarán los inserts. Se marca para `sdd-verify`.
- El pin de fuente de `timingSafeEqual`/`scrypt` usa la técnica de texto de `src/vistas-canonicas.test.ts` (caso 2.11): el comportamiento por sí solo no distingue `===` de comparación constante-time.
- Ninguna decisión de arquitectura nueva. DEC-133 a DEC-136 no se reabrieron.

## PR2: Archivos tocados

| Archivo | Acción | Qué se hizo |
|---------|--------|-------------|
| `src/panel-auth.test.ts` | Creado | Tarea 2.1, 10 casos de integración contra la base real: login válido (200, cookie `zd_panel_session` con `HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000; Secure` y fila `SesionPanel` que guarda solo el SHA-256), clave equivocada 401 genérico sin cookie, correo desconocido 401 (sin oráculo de cuenta), usuario desactivado 401, tenant desactivado 409 `tenant-desactivado`, propiedad extra en el body 400 `solicitud-invalida` nombrando `/tenantId`, logout (fila borrada + cookie vacía `Max-Age=0` + el token deja de servir), sesión activa 200, sin cookie 401, token expirado 401 `sesion-expirada` con limpieza de la fila |
| `src/aislamiento-panel.test.ts` | Creado | Tarea 2.2, 5 casos por las rutas reales: `X-Tenant-Id: B` en `/sesion` no cambia ni filtra al tenant A (el encabezado se ignora), la cookie de B nunca entra en A, cada `tokenHash` resuelve al tenant que lo acuñó, lecturas scoped dentro del tenant de la sesión ven solo filas de A, el logout de B borra solo la sesión de B y la de A sigue viva |
| `src/panel-auth.ts` | Creado | Tarea 2.3: `ingresar`/`salir`/`sesion` bajo `/api/panel/auth`, helpers de cookie (`leerCookie`, `cookieDeSesion`, `cookieVacia`), `levantarSesionPanel(prisma)` (hook `preHandler` por ruta: token → `hashTokenSesion` → `sesionPanel.buscarPorTokenHash`; expirada se limpia en uso; 401/409 fail-closed), tenant exclusivamente desde la fila de sesión vía `conTenantActivo` (DEC-135), schema estricto `propertyNames` envuelto en `{ body }` (ver desviaciones) |
| `src/contexto-tenant.ts` | Modificado | Tarea 2.4: `RUTAS_PANEL_PUBLICAS` (filas exactas `POST /api/panel/auth/ingresar`, `POST /api/panel/auth/salir`, `GET /api/panel/auth/sesion`) cableada en `esExenta` después de `ESTILOS_EXENTOS` |
| `src/aislamiento-prisma.ts` | Modificado | Dos escape hatches auditados, espejo de `agente.buscarPorTokenHash`: `usuario.buscarPorCorreo(correo)` (login, DEC-133/DEC-135) y `sesionPanel.buscarPorTokenHash(tokenHash)` (hook, DEC-134/DEC-135). Todo lo demás de ambos modelos sigue scoped |
| `src/crypto-auth.ts` | Modificado | `hashTokenSesion(tokenPlano)`: SHA-256 hex, gemelo de `hashTokenAgente` (`src/agente-token.ts`); el token plano nunca llega a la base ni a logs (DEC-134) |
| `src/server.ts` | Modificado | Import + `registerPanelAuthRoutes(app, prisma)` después de `registrarServidorAgentes`, con el porqué en el comentario (DEC-135/DEC-136) |

**Commits (en orden, ninguno pushed):**

5. `5f5c2ce feat(ch22a): expose the panel auth surface - session-cookie login, hook, two-tenant isolation` (tareas 2.1-2.4, 947 líneas autorizadas)
6. Commit docs de este archivo y `tasks.md` (más abajo)

## TDD Cycle Evidence (PR2)

| Tarea | RED | GREEN | REFACTOR |
|-------|-----|-------|----------|
| 2.1 Tests de rutas | Escritos primero contra `./panel-auth.js` inexistente: `ERR_MODULE_NOT_FOUND`, exit 1 | — | — |
| 2.2 Aislamiento dos tenants | Escrito primero (mismo `ERR_MODULE_NOT_FOUND`); los 5 casos fijan el comportamiento esperado antes de existir el código | — | — |
| 2.3 `panel-auth.ts` | — | Primer run 9/10. El caso de propiedad extra (400) recibía 200/401: en Fastify 5 un schema de ruta **sin envolver** (`{ schema: ingresarSchema }`) no se aplica al body en absoluto. Repro diferencial A/B: envuelto en `{ body }` → 400, directo → acepta sin validar. Se adoptó la forma envuelta de `registroAutomatizacionSchema` → 10/10 | Constantes de vida de sesión y helpers de cookie extraídos; 10/10 siguen verdes |
| 2.4 Exenciones del panel | Estructural: sin `RUTAS_PANEL_PUBLICAS`, las rutas montadas bajo `registrarContextoTenant` mueren en los hooks de encabezado antes del handler — el caso `sesion` sin encabezado de `aislamiento-panel.test.ts` lo fija | Filas exactas agregadas y cableadas en `esExenta`; la suite de `contexto-tenant` (exenciones, patrón exacto, no prefijo) sigue verde | Comentario del porqué (DEC-135) en ambos lugares; sin lógica duplicada |
| 2.5 Verificación | — | Los cuatro comandos, más abajo | — |

## Work Unit Evidence (PR2)

| Evidencia | Valor |
|---|---|
| Comando de test focalizado y resultado exacto | `$env:TEST_DB_PORT='5434'; npx tsx --test src/panel-auth.test.ts` → `tests 10, pass 10, fail 0`. `$env:TEST_DB_PORT='5434'; npx tsx --test src/aislamiento-panel.test.ts` → `tests 5, pass 5, fail 0` |
| Runtime harness | Postgres vivo `zd-ch09-testdb` en `localhost:5434` (nunca 5432). Escenario: login → cookie → `GET /sesion` → logout sobre `app.inject` con la extensión real; aislamiento probado con rutas reales y lecturas directas bajo `conTenantActivo` contra esa misma base |
| Full suite | `$env:TEST_DB_PORT='5434'; npm test` → exit 0, `tests 940, suites 146, pass 940, fail 0, cancelled 0, skipped 0`. Línea base previa: 925/144; neto nuevo: 15 tests (10 + 5). Ningún fallo preexistente |
| Typecheck | `npx tsc --noEmit`: exit 0. Un pasaje: los fixtures asignaban `usuario.nombre` (nullable) a `nombre: string`; corregido con `usuario.nombre!` en ambos builders (ver desviaciones) |
| Rollback boundary | Revertir los commits de este lote (feat + docs): borrar `src/panel-auth.ts`, `src/panel-auth.test.ts`, `src/aislamiento-panel.test.ts` y revertir los 4 archivos tocados (`contexto-tenant.ts`, `aislamiento-prisma.ts`, `crypto-auth.ts`, `server.ts`). No hay DDL nuevo en este lote — nada que deshacer en la base. No toca trabajo no relacionado |

## Line-Count Checkpoint (2.5)

`git diff --numstat HEAD -- src prisma`: `aislamiento-prisma.ts` 94, `contexto-tenant.ts` 21, `crypto-auth.ts` 9, `server.ts` 6; archivos nuevos por conteo de líneas: `panel-auth.ts` 258, `panel-auth.test.ts` 330, `aislamiento-panel.test.ts` 229. **Total 947 autorizados.** Excluye artefactos SDD y los archivos ajenos ya sucios en el worktree (`.atl/*`, `docs/verificacion-tesis-2026-10-01.md`), que no se tocaron.

- El forecast estimaba ~310 para PR2; el real es 947, dominado por tests (559 de 947). No se comprimió nada para acercarse al número: la entrega sigue siendo `single-pr` con `size:exception` del maintainer, y esta unidad queda dentro de ese alcance aprobado.
- **Drift del exception a revalidar antes de PR3**: el `size:exception` se aprobó para ~810 líneas estimadas del cambio completo; PR1+PR2 reales suman 1394 autorizados y PR3 aún no arranca. Se reporta para que el maintainer revalide el alcance; no se pidió decisión nueva porque la aprobación de 2026-10-06 cubre la entrega completa y `Chain strategy` es `n/a`.
- **Decisión de workload heredada**: `single-pr` + `size:exception` aprobado (2026-10-06); no hizo falta pedir decisión nueva.

## Desviaciones y notas (PR2)

- **`entrarContextoTenant` (design.md, DEC-135) no existe en el repo**: el export real es `conTenantActivo` (`src/contexto-tenant.ts`). Se usó el nombre real — es el mecanismo que DEC-135 nombra y el que la extensión ya usa en todo el código.
- **Un schema de ruta sin envolver no valida el body en Fastify 5**: `{ schema: ingresarSchema }` no aplica validación alguna (repro: faltaba `clave` y respondía 200). La convención del repo (`registroAutomatizacionSchema`, `registroConsultaGuardadaSchema`) envuelve en `{ body }`; se adoptó esa forma y el caso 400 quedó verde. Ningún otro caso del lote ejercía validación de body, por eso pasó inadvertido hasta el caso 10.
- **`Usuario.nombre` es nullable** (`String?` en `schema.prisma`, línea 255): los fixtures de ambos tests lo asignaban a `nombre: string` (TS2322). Se corrigió con `usuario.nombre!` — la fixture acaba de escribir ese nombre en el `create`, la anulación es del fixture, no del contrato. El endpoint `sesion` puede devolver `nombre: null` para un usuario real sin nombre; ningún caso del lote lo ejerce.
- **`hashTokenSesion` se agregó a `src/crypto-auth.ts`**: el diseño no lo nombraba; es el gemelo de `hashTokenAgente` (`src/agente-token.ts`), misma construcción SHA-256 que DEC-134 exige para `SesionPanel.tokenHash`.
- **tasks.md cita ramas `ch22a/modelo-y-crypto` y `ch22a/rutas-autenticacion`**: PR1 y PR2 se hicieron ambos en `ch22a/panel-auth` (decisión del orquestador para el single-pr). No se tocaron los encabezados de tasks.md; esta nota es el registro.
- El caso 400 con propiedad extra replica el contrato de `automatizaciones-rutas.test.ts:76` y `vistas-canonicas`: body estricto, nada de tenant en el body (regla 2).
- Ninguna decisión de arquitectura nueva; DEC-133 a DEC-136 no se reabrieron.

## PR3: Servable Panel Page & Login Screen (tareas 3.1-3.3)

Lote completado el 2026-10-06 en `ch22a/panel-auth`. Strict TDD activo (declarado por el orquestador); evidencia RED→GREEN por tarea abajo.

### TDD Cycle Evidence (PR3)

| Tarea | RED (test primero, fallo observado) | GREEN (implementación pasa) | REFACTOR |
|---|---|---|---|
| 3.1 | `src/panel.test.ts` escrito antes que `src/panel.ts` existiera (4 casos: login sin sesión, shell con sesión ignorando `X-Tenant-Id`, shell sin header no filtra tenant B, cookie desconocida → login). Corrida inicial: `ERR_MODULE_NOT_FOUND` para `./panel.js`, exit 1 — fallo real por módulo inexistente | `$env:TEST_DB_PORT='5434'; npx tsx --test src/panel.test.ts` → `tests 4, suites 1, pass 4, fail 0` | — (el refactor del lote es el de 3.2) |
| 3.2 | Cubierto por el RED de 3.1: sin módulo de página no hay documento que servir | `src/panel.ts` (244 líneas) + wiring en `src/server.ts` → 4/4 verde | Extracción de `resolverSesion` dentro de `src/panel-auth.ts` con modo `{ opcional?: boolean }`: una sola ruta de resolución de sesión (regla 2, DEC-135) compartida por API y página; los códigos 401/409 exactos de PR2 se preservan y las 62 pruebas previas siguen verdes |
| 3.3 | n/a (verificación, sin código nuevo) | `npx tsc --noEmit` exit 0 · `npm test` 944/944 · `npm run build` exit 0 | — |

### Work Unit Evidence (PR3)

| Evidencia | Valor |
|---|---|
| Comando de test focalizado y resultado exacto | `$env:TEST_DB_PORT='5434'; npx tsx --test src/panel.test.ts` → `tests 4, suites 1, pass 4, fail 0, cancelled 0, skipped 0` |
| Runtime harness | Postgres vivo `zd-ch09-testdb` en `localhost:5434` (nunca 5432). Escenario: `GET /panel` sin cookie → login P-01; login real (POST `/api/panel/auth/ingresar`) → cookie → `GET /panel` sirve el shell con `tenantNombre` de la sesión; `X-Tenant-Id` de otro tenant no mueve la página; cookie desconocida → login. Mismo wiring que `src/server.ts` (registrarContextoTenant → registerPanelAuthRoutes → registerPanelRoutes) sobre `app.inject` con la extensión real |
| Regression focused | `$env:TEST_DB_PORT='5434'; npx tsx --test src/panel-auth.test.ts src/aislamiento-panel.test.ts src/contexto-tenant.test.ts` → `tests 62, suites 7, pass 62, fail 0` |
| Full suite | `$env:TEST_DB_PORT='5434'; npm test` → exit 0, `tests 944, suites 147, pass 944, fail 0, cancelled 0, skipped 0`. Línea base: 940 (PR2); neto nuevo: +4 tests. Ningún fallo preexistente |
| Typecheck / build | `npx tsc --noEmit`: exit 0. `npm run build`: exit 0 |
| Rollback boundary | Revertir los commits de este lote (feat + docs): borrar `src/panel.ts` y `src/panel.test.ts`, y revertir solo las líneas PR3 de `src/panel-auth.ts` (resolverSesion + modo opcional), `src/contexto-tenant.ts` (fila `/panel` en `esExenta`) y `src/server.ts` (import + `registerPanelRoutes`). Sin DDL nuevo — nada que deshacer en la base. No toca trabajo no relacionado |

### Line-Count Checkpoint (3.3)

`git diff --numstat HEAD -- src`: `panel-auth.ts` 77 agregadas / 27 removidas, `contexto-tenant.ts` 8/2, `server.ts` 6/0; archivos nuevos por conteo de líneas: `panel.ts` 244, `panel.test.ts` 222. **Total 557 autorizados** (suma de líneas agregadas; misma convención del checkpoint PR2). Excluye artefactos SDD y los archivos ajenos ya sucios en el worktree (`.atl/*`, `docs/verificacion-tesis-2026-10-01.md`), que no se tocaron.

- El forecast estimaba ~280 para PR3; el real es 557, dominado por el documento servido (244) y sus tests (222). No se comprimió nada para acercarse al número: la entrega sigue siendo `single-pr` con `size:exception`.
- **Drift del exception acumulado**: PR1+PR2 reales = 1394; con PR3 (557) el cambio completo suma **1951 líneas reales** vs ~810 estimadas y ~1700 del presupuesto ampliado (2026-10-06). Se reporta para que el maintainer revalide en el cierre (verify/archive); no se pidió decisión nueva — la aprobación cubre la entrega completa y `Chain strategy` es `n/a`.

## Desviaciones y notas (PR3)

- **El enlace "Olvidé mi contraseña" del mockup P-01 está ausente a propósito**: la recuperación de contraseña es R2 (fuera de alcance) y un enlace muerto en producción es peor que ninguno. Documentado en `src/panel.ts` (`DOCUMENTO_INGRESO`).
- **`GET /panel` se eximió en el bloque GET de `esExenta` (fila exacta), NO en `RUTAS_PANEL_PUBLICAS`**: el diseño lo exige así — la página resuelve el tenant desde la fila de sesión dentro de su handler (`levantarSesionPanel(prisma, { opcional: true })`), nunca desde el request; los tres endpoints de auth sí quedan en `RUTAS_PANEL_PUBLICAS`. Comentario DEC-135 agregado en `src/contexto-tenant.ts`.
- **`strict-tdd.md` no existe en disco** (buscado en skills/): la disciplina RED→GREEN se siguió según el texto de la skill `sdd-apply` y queda evidenciada arriba; `openspec/config.yaml` reporta `strict_tdd: false`. Discrepancia registrada, no bloqueante.
- **La cookie `Secure` (DEC-134) se mantiene**: sobre `http://localhost` el navegador no guardará la cookie — limitación conocida y documentada en `src/panel.ts`, diferida a la revisión visual humana (tarea 3.4), no silenciada en código.
- **El nombre del tenant viaja solo en `SesionResuelta.tenantNombre`** (`SesionPanel` trae `tenantNombre`/`tenantActivo`/`usuarioActivo`): el shell lo interpola sin lectura extra de base, escapado con `escaparHtml` (los 5 caracteres) — la fixture `Tienda & Cía <prueba>` pinnea el escape.
- **Scripts inline sin template literals**: concatenación (`var` + `+`, `\u2026`) para que los documentos vivan dentro del template literal de TypeScript sin escapar. Convención de `src/consola.ts` respetada (HTML + CSS + JS servidos como string, sin framework ni build).
- Ninguna decisión de arquitectura nueva; DEC-133 a DEC-136 no se reabrieron.

## Siguiente

Las tareas 3.1-3.3 están completas y marcadas en `tasks.md`; queda pendiente **3.4 (revisión visual humana**: login, estado de error, transición login→shell en 360 y 1280 px, temas claro/oscuro), que este lote no intenta. El orquestador debe correr `sdd-verify` sobre esta unidad (PR3) y revalidar con el maintainer el drift del `size:exception` (1951 reales acumulados vs ~1700 del presupuesto ampliado) antes del cierre.
