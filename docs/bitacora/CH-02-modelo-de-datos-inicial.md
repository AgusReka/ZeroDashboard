# Bitácora — CH-02: Modelo de datos inicial

**Fecha de inicio:** 2026-09-15
**Fecha de cierre:** 2026-09-15 (sesión única)
**Tiempo invertido:** sesión asistida por agente (Claude Code), no cronometrada con precisión minuto a minuto — completar con el tiempo real percibido antes de citar este dato en la tesis.

> Se escribe durante el desarrollo, apoyada en los registros de la sesión (comandos ejecutados y sus resultados), no reconstruida de memoria al final.

---

## Qué se construyó

El modelo de datos inicial de R0: tres modelos Prisma (`Tenant`, `Conexion`, `ConsultaGuardada`) sobre la base propia que CH-01 dejó preparada pero vacía a propósito. `Conexion` y `ConsultaGuardada` llevan `tenantId` obligatorio desde el día uno, aunque R0 opera contra una única fila de `Tenant` sembrada por seed ("Food Store") — el aislamiento real de tenants queda para CH-06. Se agregó un paso de seed idempotente al mismo entrypoint de Docker que CH-01 ya usaba para migraciones.

Ciclo SDD completo hasta acá: exploración → proposal → specs → design → tasks → apply, con las 4 requisitos del spec verificados contra un `docker compose up` real (stack reseteado desde cero). Todos los artefactos viven en `openspec/changes/CH-02-initial-data-model/` y están espejados en Engram. Listo para `verify`.

## Decisiones tomadas

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| Entidad `tenant` mínima desde CH-02 (**DEC-06**, registrada en `01-decisiones.md`) | Sin tenant en CH-02, agregarlo recién en CH-06 | Decisión del usuario durante la exploración: evita una migración de columna + backfill sobre datos existentes cuando llegue CH-06 |
| Sin tabla de ejecución en R0 (nivel de exploración, no ameritó entrada en `01-decisiones.md`: es alcance ya planeado, no una decisión de arquitectura nueva) | Persistir cada corrida de consulta desde ya | El registro estructurado de ejecuciones es la historia X2 (R1, depende del motor/CH-13); adelantarla habría anticipado alcance de otro release |
| Nombres de modelo/campo en español (`Tenant`, `Conexion`, `ConsultaGuardada`, `nombre`, `descripcion`, `credencial`) — nivel de diseño | Traducir todo al inglés (`Connection`, `SavedQuery`) | Mantener una sola terminología entre la documentación (que ya usa estos sustantivos como lenguaje ubicuo) y el código, por trazabilidad hacia la tesis |
| `Conexion.motor` como `String` libre, no enum | Enum `postgresql \| mysql` | D-4 (motores de base admitidos para la réplica del cliente) sigue abierta; un enum la habría resuelto por accidente |
| `Conexion.credencial` como `String` plano, sin cifrar | Cifrar ya desde este change | El cifrado (A2) es R1; se documentó explícitamente el hueco en `design.md` en vez de disimularlo con un nombre de campo que sugiriera cifrado |

## Fricciones encontradas

| # | Fricción | Causa | Resolución | Tiempo perdido |
|---|---|---|---|---|
| 1 | El dispatch a un subagente `sdd-explore` fue rechazado por el mismo hook que ya había afectado a `sdd-design` en CH-01 ("Claude Code hooks do not expose authenticated caller provenance...") | Limitación ya conocida del runtime, no un bug nuevo | Se trabajó en línea (exploración, proposal, spec, design, tasks, apply) en vez de delegar a subagentes, igual que en CH-01 | Baja — ya había un precedente documentado |
| 2 | `prisma migrate dev --skip-seed` falló: la flag no existe en esta versión de Prisma | Prisma 7 no tiene `--skip-seed` sin un `prisma db seed` configurado | Se corrió sin esa flag | Baja |
| 3 | La migración generada con `docker compose run --rm app npx prisma migrate dev ...` se aplicó correctamente a la base, pero el archivo `migration.sql` nunca llegó al host: `--rm` borra el contenedor (y su capa de escritura) al salir | El comando corrió y escribió dentro del contenedor, no en un volumen persistente | Se reseteó la base (`docker compose down -v`) y se regeneró la migración | Media |
| 4 | Segundo intento, con `-v "$(pwd)/prisma:/app/prisma"` en el mismo `docker compose run`: el bind-mount no llegó al host (un archivo de prueba escrito desde dentro del contenedor no aparecía afuera, sin ningún error) | Combinación específica Windows + Git Bash + Docker Desktop; no investigado a fondo, documentado como hallazgo en `design.md` para no repetir el camino | Se corrió `prisma migrate dev` directamente en el host (Node.js y `node_modules` ya estaban ahí desde CH-01), contra el contenedor `db` expuesto temporalmente en `localhost:5432` (línea `ports` agregada a `docker-compose.yml` y removida apenas se generó el archivo) | Media-alta — dos caminos descartados antes de encontrar el que funcionaba |
| 5 | El contenedor `app` moría al arrancar: `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/app/src/generated/prisma/client.js'` en el paso de seed, después de que la migración ya se había aplicado bien | `prisma/seed.ts` importaba desde `src/generated/prisma/...`, pero la imagen final del Dockerfile (definida en CH-01) nunca copia `src/`, solo `dist/` | Se cambió el import a `../dist/generated/prisma/client.js` — `tsc` ya compila `src/generated/prisma/*.ts` a `dist/generated/prisma/*.js` como parte del build normal, igual que hace `dist/health.js`. Documentado en `design.md` como decisión enmendada durante el apply | Media — encontrado y resuelto en la primera corrida real contra Docker, no antes |

> Las fricciones 3 y 4 son evidencia concreta de por qué generar artefactos dentro de contenedores efímeros necesita verificarse contra el sistema de archivos del host, no asumirse; ninguna de las dos falló con un error explícito, lo que las hace más difíciles de detectar que la fricción 5 (que sí falló ruidosamente). La fricción 5 repite el patrón de la fricción 9 de CH-01: un problema invisible para `tsc` y para la revisión de código, que solo aparece al correr el stack real.

## Verificación

| ID | Condición inicial | Acción | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|---|
| V-1 | Base propia reseteada (sin datos de dominio) | `docker compose up -d --build` desde cero | Se aplica la migración, se siembra un `Tenant` | Log: `Applying migration 20260915224714_init_domain_model` → `Seed: created tenant "Food Store" (...)` | **OK** |
| V-2 | Stack ya migrado y sembrado | `docker compose restart app` | Migración y seed son no-op | Log: `No pending migrations to apply.` / `Seed skipped: 1 tenant row(s) already present.` | **OK** |
| V-3 | Stack corriendo | `GET /health` | `200 { status: "ready", db: "connected" }` (chequeo de CH-01, no roto por el nuevo esquema) | Confirmado exactamente | **OK** |
| V-4 | `Tenant` sembrado, id conocido | `INSERT` en `Conexion` referenciando ese `tenantId` | Insert exitoso | `INSERT 0 1` | **OK** |
| V-5 | — | `INSERT` en `Conexion` con `tenantId` inexistente | Rechazado por FK | `ERROR: ... violates foreign key constraint "Conexion_tenantId_fkey"` | **OK** |
| V-6 | `Tenant` sembrado | `INSERT` en `ConsultaGuardada` sin `descripcion`, referenciando ese `tenantId` | Insert exitoso, `descripcion` puede quedar vacía | `INSERT 0 1` | **OK** |
| V-7 | — | `INSERT` en `ConsultaGuardada` con `tenantId` inexistente | Rechazado por FK | `ERROR: ... violates foreign key constraint "ConsultaGuardada_tenantId_fkey"` | **OK** |
| V-8 | Stack corriendo | `psql \dt` | Exactamente `Tenant`, `Conexion`, `ConsultaGuardada` (más `_prisma_migrations`) | Confirmado, sin `Usuario`/`Ejecucion`/`Plantilla`/`Automatizacion`/`Mapeo` | **OK** |
| V-9 | — | `npm run build` (`tsc`) | Compila sin errores con el cliente Prisma regenerado | Compiló sin errores | **OK** |

Los 4 requisitos de `specs/domain-data-model/spec.md` quedan verificados end-to-end. Filas de prueba de V-4/V-6 borradas después de verificar. Stack bajado limpio al cierre (`docker compose down`) — no queda nada corriendo.

## Consultas ejecutadas

No aplica en el sentido de la plantilla (consultas de negocio citables en la tesis) — las únicas sentencias SQL de esta sesión son inserts/deletes de verificación de esquema (ver tabla de Verificación), no consultas sobre datos de un tenant real. La primera consulta citable llega con CH-03/CH-05.

## Notas para la tesis

- Alimenta Cap. 4 (arquitectura): registro de DEC-06 (tenant mínimo desde CH-02) con su alternativa evaluada, y las decisiones de nivel de diseño (naming en español, `motor` sin enum, `credencial` sin cifrar) con su justificación.
- Alimenta Cap. 6 (barreras/resultados): fricciones 3–4 son un caso concreto de fricción de la cadena de herramientas (Docker + bind mounts en Windows), no del producto; la fricción 5 es otro ejemplo, sumado al de CH-01, de por qué la verificación contra un stack real encuentra bugs invisibles para el compilador.
- La decisión de exponer temporalmente el puerto de `db` para generar la migración (y revertirlo después) es un detalle de proceso, no de arquitectura — no se registró en `01-decisiones.md` por esa razón, pero queda documentada acá y en `design.md` para que no se pierda si alguien repite el paso.
