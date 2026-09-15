# Bitácora — CH-01: Esqueleto de aplicación y entorno

**Fecha de inicio:** 2026-09-15
**Fecha de cierre:** 2026-09-15 (dos sesiones el mismo día: apply inicial sin Docker, y cierre de verificación una vez instalado Docker)
**Tiempo invertido:** sesión asistida por agente (Claude Code), no cronometrada con precisión minuto a minuto — completar con el tiempo real percibido antes de citar este dato en la tesis.

> Se escribe durante el desarrollo, apoyada en los registros de la sesión (comandos ejecutados y sus resultados), no reconstruida de memoria al final.

---

## Qué se construyó

El esqueleto de aplicación y entorno de R0: un proceso Node.js + TypeScript (Fastify) con un endpoint de salud (`GET /health`), su base propia en PostgreSQL gestionada por Prisma, y `docker compose up` como único comando para levantar ambos. Se inicializó git por primera vez en el repositorio (no existía), con `.gitignore`/`.dockerignore` y `.env.example` para mantener los secretos fuera del control de versiones. El esquema de Prisma arranca sin modelos: el modelo de dominio es responsabilidad de CH-02, no de este change.

Ciclo SDD completo hasta acá: proposal → specs → design → tasks → apply, con las 5 escenarios del spec verificados contra un `docker compose up` real. Todos los artefactos viven en `openspec/changes/CH-01-app-scaffolding-and-environment/` y están espejados en Engram. Listo para `verify`.

## Decisiones tomadas

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| Stack: Node.js + TypeScript, base propia en PostgreSQL (**DEC-05**, registrada en `01-decisiones.md`, cierra D-3) | Python, .NET/C# | El autor confirmó que es el stack que domina |
| Framework web: Fastify (nivel de diseño, no una nueva entrada en 01-decisiones.md — DEC-05 delega esto explícitamente) | Express, NestJS | TypeScript nativo, validación de esquema integrada, menos estructura impuesta que NestJS |
| ORM/migraciones: Prisma **7.10.0 estable**, fijado | Prisma `8.0.0-rc.x` (resuelto por npm por defecto) | La RC arrastra `@prisma/composer-cli` → `alchemy` → `workerd` (runtime de Cloudflare Workers, sin relación con el proyecto) con 8 vulnerabilidades altas |

## Fricciones encontradas

| # | Fricción | Causa | Resolución | Tiempo perdido |
|---|---|---|---|---|
| 1 | El dispatch a un subagente `sdd-design` fue rechazado por un hook | "Claude Code hooks do not expose authenticated caller provenance, so parent-confirmed preflight cannot be transported safely" — el runtime no puede transportar el preflight de SDD confirmado por el orquestador hacia un child dispatch autenticado | El propio error indicó seguir en línea; el orquestador escribió `design.md`/`tasks.md` directamente en vez de delegar | Baja — el error fue inmediato y con salida clara |
| 2 | `gentle-ai sdd-attempt acquire` (autoridad de ejecución nativa) requiere un repositorio git | El ledger de intentos vive en el directorio común de git | Se corrió `git init` (que de todos modos era la tarea 1.1 de CH-01) | Ninguna, coincidía con una tarea ya planeada |
| 3 | El mismo comando, ya con git, pidió declarar un inventario de archivos sin trackear vía `gentle-ai review status --contract gentle-ai.review-integration/v2` | El ledger de intentos está acoplado al sistema de revisión (RDD) | Se verificó `gentle-ai review mode status`: RDD está apagado (`off`, decidido a nivel global). Por instrucción explícita del proyecto, RDD es opt-in y no se activa ni se rodea en nombre del usuario, así que se abandonó la autoridad nativa de intentos y se continuó con verificación manual (grupo 5 de `tasks.md`) | Media — requirió decidir no seguir por ese camino en vez de forzarlo |
| 4 | `npm install -D prisma` resolvió `prisma@8.0.0-rc.15` por defecto | La RC no está marcada de forma que `npm install <pkg>` sin versión la evite | Se fijó `prisma@7.10.0` explícitamente, alineado con `@prisma/client` | Baja |
| 5 | Prisma 7 cambió su arquitectura de configuración respecto de lo asumido al escribir `design.md`: `datasource.url` ya no existe en `schema.prisma`; el cliente requiere un *driver adapter* explícito (`@prisma/adapter-pg`) en vez de leer `DATABASE_URL` implícitamente | Breaking change de la v7, no documentado en la memoria de entrenamiento del agente con esta forma exacta | `npx prisma init` generó de regalo la documentación de referencia correcta (bundle de skills que el propio Prisma instala) — se leyó esa referencia, se corrigió `schema.prisma`, se agregó `prisma.config.ts`, se instalaron `@prisma/adapter-pg` + `pg`, y se actualizó `design.md` con una nota explícita de arquitectura para que quede documentado | Media-alta — fue la fricción más costosa de esta sesión |
| 6 | `prisma@7.10.0` arrastra transitivamente `mysql2` y `deepmerge-ts` con vulnerabilidades altas, sin que el proyecto use ninguno de los dos directamente (solo se usa el provider `postgresql`) | Prisma empaqueta soporte para múltiples motores en su CLI | `npm audit` limpio después de fijar `overrides` en `package.json` (`mysql2@3.24.4`, `deepmerge-ts@8.0.2`) | Baja |
| 7 | `prisma init` también instaló bundles de "skills" para asistentes de IA (`.claude/skills`, `.windsurf/skills`, `.agents/skills`, `skills-lock.json`) — ruido ajeno al proyecto | Comportamiento por defecto de `prisma init` en esta versión | Se borraron `.agents/` y `.windsurf/`; `.claude/` no se pudo borrar (el clasificador de modo automático de Claude Code lo bloquea por tratarse de un directorio `.claude`, categorizado como "Irreversible Local Destruction" independientemente del contenido) — se optó por excluirlo vía `.gitignore` en vez de insistir | Baja |
| 8 | No había Docker ni PostgreSQL instalados en el entorno de la primera sesión (sandbox de ejecución del agente) | Restricción del entorno, no del proyecto | La verificación 5.1/5.2/5.6 quedó pendiente esa sesión. **Resuelta en una segunda sesión el mismo día**, una vez que el usuario instaló Docker — ver fricción 9 y la tabla de Verificación actualizada | Alta en su momento; terminó siendo temporal |
| 9 | Con Docker ya disponible, el primer `docker compose up --build` levantó `db` pero el contenedor `app` moría con exit code 1: `Error: The datasource.url property is required in your Prisma config file when using prisma migrate deploy`, pese a que `DATABASE_URL` sí llegaba bien inyectada por Compose (confirmado con `docker compose config`) | El `Dockerfile` copiaba `./prisma` (el directorio con `schema.prisma`) a la imagen final, pero **no copiaba `prisma.config.ts`**, que vive en la raíz del repo, no dentro de `prisma/`. Sin ese archivo, la CLI de Prisma cae a una resolución solo-por-schema, y el schema (correctamente, por el diseño de Prisma 7) ya no tiene `url` — de ahí el mensaje exacto | Se agregó `COPY --from=build /app/prisma.config.ts ./prisma.config.ts` al Dockerfile; con eso el contenedor `app` levantó, migró (no-op, cero migraciones) y sirvió `/health` en `200`. Documentado también en `design.md` | Media — bug real de un archivo, no de diseño; se encontró y resolvió en la primera corrida real contra Docker |

> Fricciones 1, 2 y 3 son material directo para el capítulo de barreras técnicas: la propia herramienta de desarrollo asistido por IA tropezó con capas de autenticación/autorización pensadas para otro contexto de ejecución. La fricción 9 es un buen ejemplo de por qué la verificación real (Docker corriendo) encuentra cosas que la revisión de código sola no encuentra: el código "se veía bien" y compilaba, pero fallaba al primer `docker compose up`.

## Verificación

| ID | Condición inicial | Acción | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|---|
| V-1 | `.env` creado desde el ejemplo, Docker instalado | `docker compose up -d --build` | Ambos contenedores llegan a estado `running` | `db` healthy, `app` `Up` y escuchando en 3000 (tras corregir la fricción 9) | **OK** |
| V-2 | Stack ya migrado (cero migraciones de dominio) | `docker compose restart app` (re-corre `prisma migrate deploy`) | La segunda corrida es no-op, exit 0 | Log: `No pending migrations to apply.`; contenedor siguió arriba | **OK** |
| V-3 | `src/config.ts` sin `APP_PORT` en el entorno | Arrancar el proceso compilado | Falla rápido con mensaje claro, antes de escuchar en ningún puerto | `Error: Missing required environment variable: APP_PORT`, proceso no llega a `listen()` | **OK** |
| V-4 | Repo recién clonado (recién inicializado con `git init`) | `git status` | `.env` no aparece como trackeable; `.env.example` solo tiene placeholders | Confirmado — `.env` cae bajo `.gitignore`, `.env.example` usa `change-me` | **OK** |
| V-5 | Servidor compilado corriendo, `DATABASE_URL` apuntando a un host inalcanzable desde ese entorno (`db`, solo resuelve dentro de la red de Compose) | `GET /health` | `503 { status: "not-ready", db: "unreachable" }` | Confirmado exactamente | **OK** |
| V-6 | Stack real corriendo (`db` healthy, `app` up) | `GET /health` | `200 { status: "ready", db: "connected" }` | Confirmado exactamente | **OK** |
| V-7 | `npm install` completo | `npm audit` | 0 vulnerabilidades | 0 vulnerabilidades tras fijar `overrides` (fricción 6) | **OK** |
| V-8 | — | `npm run build` (`tsc`) | Compila sin errores | Compiló sin errores, generó `dist/` | **OK** |
| V-9 | Stack corriendo, `GET /health` en `200` | `docker compose stop db` → `GET /health` | Degrada a `503 { status: "not-ready", db: "unreachable" }` | Confirmado | **OK** |
| V-10 (bonus, no exigido por el spec) | Continuación de V-9 | `docker compose start db` → `GET /health` | Vuelve a `200 { status: "ready", db: "connected" }` sin reiniciar `app` | Confirmado — recuperación automática, sin reinicio manual del proceso | **OK** |

Las 5 requisitos de `specs/project-environment/spec.md` quedan verificados end-to-end. Stack bajado limpio al cierre (`docker compose down`) — no queda nada corriendo.

## Consultas ejecutadas

No aplica — CH-01 no introduce modelo de dominio ni consultas (ver `prisma/schema.prisma`: cero modelos, por diseño). La primera consulta citable llega con CH-02/CH-03.

## Notas para la tesis

- Alimenta Cap. 4 (arquitectura): registro de DEC-05 y de las decisiones de framework/ORM delegadas a nivel de diseño, con alternativas evaluadas.
- Alimenta Cap. 3 (instrumentos) y Cap. 6 (barreras): las fricciones 1–3 documentan fricción propia de la cadena de herramientas de desarrollo asistido (no del producto); la fricción 8 documenta el límite de lo verificable sin un entorno con Docker disponible, y cómo se resolvió apenas se corrigió esa condición.
- La fricción 5 (cambio de arquitectura de Prisma 7) es un caso concreto de "documentación/entrenamiento desactualizado frente a la versión real instalada" — vale la pena como ejemplo en la discusión metodológica sobre uso de asistentes de IA (D-6).
- La fricción 9 es evidencia concreta a favor de exigir verificación de ejecución real (no solo compilación/tipado) antes de dar un change por cerrado: el bug (archivo faltante en el `COPY` del Dockerfile) era invisible para `tsc` y para una revisión de código superficial, y solo apareció al correr `docker compose up` de verdad.
