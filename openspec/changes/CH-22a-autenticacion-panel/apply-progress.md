# Apply Progress: CH-22a — Autenticación del Panel, Usuario, Sesión y Derivación Estricta de Tenant (T3)

**Store**: openspec. **Delivery**: single-pr con `size:exception` aprobado por el maintainer (2026-10-06, ver forecast en `tasks.md`); los grupos PR1/PR2/PR3 son unidades de trabajo y commits, no PRs separados.
**Mode**: Strict TDD (RED → GREEN por par), runner `npm test` (`tsx --test src/**/*.test.ts`).

## Estado acumulado

| Unidad | Tareas | Estado |
|--------|--------|--------|
| PR1 — Modelo de datos, migración y módulo crypto | 1.1-1.5 | **Hecho (este lote), rama `ch22a/panel-auth`** |
| PR2 — Rutas de auth, hook de sesión, aislamiento dos tenants | 2.1-2.5 | Pendiente |
| PR3 — Página `/panel` y pantalla de ingreso | 3.1-3.4 | Pendiente |
| Cierre | 4.1-4.2 | Pendiente |

No existía apply-progress previo. Este es el primer lote.

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

## Siguiente

Las tareas 1.1-1.5 están completas y marcadas en `tasks.md`. El orquestador debe correr `sdd-verify` antes de continuar con PR2 (tareas 2.1-2.5).
