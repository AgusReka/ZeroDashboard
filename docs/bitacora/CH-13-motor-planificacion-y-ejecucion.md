# Bitácora — CH-13: Motor: planificación y ejecución

**Fecha de inicio:** 2026-09-28 (exploración, propuesta, specs, diseño y tareas)
**Fecha de cierre:** 2026-09-29 — implementado en once ramas encadenadas, verificado y archivado
**Tiempo invertido:** sesión asistida por agente (Claude Code), ciclo SDD completo (explore → propose → spec → design → tasks → apply → verify → archive). El commit de planificación es de las 20:37 del 28; los commits de implementación caen entre las 20:43 y las 21:21 del 28 (unidades 1 a 3a) y entre las 09:35 y las 10:08 del 29 (unidades 3b a 6b); el de verificación, a las 10:19 del 29. **Completar con el tiempo real percibido antes de citar este dato en la tesis**: las marcas de los commits acotan la implementación, no la exploración ni las decisiones.

> Se escribe al cierre (2026-09-29), apoyada en los artefactos archivados (`openspec/changes/archive/2026-09-29-CH-13-engine-scheduling-execution/`), en los mensajes de commit y en DEC-74 a DEC-80. No reconstruida de memoria.

---

## Qué se construyó

X1 pide que una automatización corra sola por horario; X2, que cada ejecución quede registrada con inicio, fin, duración, filas y estado. Antes de este change existía la plantilla (CH-12) y su endpoint de prueba, pero nada la asociaba a un tenant, a una conexión ni a un horario, y nada la disparaba.

- **Modelos `Automatizacion` y `Ejecucion`** (DEC-74, X2): ambos con `tenantId` y dentro de `MODELOS_AISLADOS`. `Automatizacion` guarda plantilla, conexión, valores de parámetros (JSON), cron y `activo`. `Ejecucion` guarda estado, inicio, fin, duración, filas, corte, fase, `error` y `codigoError`: solo metadatos, nunca filas del resultado ni texto del driver. Migración aditiva `20260928000000_automatizacion_ejecucion`, claves foráneas RESTRICT.
- **Configuración** (DEC-77): `ZONA_HORARIA_AUTOMATIZACIONES`, por defecto `UTC`; una zona inválida frena el arranque. `.env.example` y `docker-compose.yml` la incluyen.
- **Dependencia** (DEC-76): `cron-parser` fijada en 5.10.1, usada solo para calcular el próximo disparo.
- **Módulo puro** (`src/automatizaciones.ts`): `cronValido` acepta solo cron estándar de cinco campos (rechaza las extensiones `H`, `L`, `#`, `?` y la expresión vacía, que la librería sí acepta); `estaVencida` decide si hay un disparo en la ventana `(desde, hasta]`; `cierreDeResultado` convierte el resultado de una corrida en las columnas cerradas de `Ejecucion`.
- **Rutas** (`src/automatizaciones-rutas.ts`, DEC-78, DEC-79, DEC-80): `POST /automatizaciones`, `GET /automatizaciones`, `GET /automatizaciones/:id`, `POST /automatizaciones/:id/desactivar`, `GET /automatizaciones/:id/ejecuciones`. Todas exigen `x-tenant-id`; un `tenantId` en el cuerpo es 400; una conexión de otro tenant es 404 y no se guarda nada. Sin edición, borrado ni reactivación.
- **Planificador** (`src/planificador.ts`, DEC-75): temporizador dentro del proceso, alineado al minuto siguiente más un segundo, que se reprograma después de cada tick. Lee los `Tenant` activos de la base propia, entra al contexto de cada uno con `conTenantActivo` y corre en serie las automatizaciones activas vencidas por el pipeline de CH-12: compuerta de vistas (DEC-71), composición, preparación de valores (repetida en cada corrida), conexión y `ejecutarConsulta` de solo lectura. Una falla cierra su fila y no frena a las demás. Se arranca después de `listen` y se detiene en `onClose`.
- **Consola** (`src/consola.ts`): sección "Automatizaciones" con listado, desactivación, ejecuciones de cada automatización y formulario de alta. Todas las llamadas pasan por `pedir()` con el tenant activo.

## Decisiones tomadas

DEC-74 a DEC-80 (`docs/01-decisiones.md`), decididas por el usuario el 2026-09-28 en dos rondas: exploración (DEC-74 a DEC-77, opciones recomendadas) y propuesta (DEC-78 a DEC-80, sin recomendación del agente). Además se registraron dos resoluciones de nivel diseño bajo DEC-13, DEC-14 y DEC-71.

| Decisión | Qué fija |
|---|---|
| DEC-74 | Entidad mínima `Automatizacion` por tenant; la instanciación completa sigue en CH-21 |
| DEC-75 | El planificador corre dentro del proceso de la aplicación |
| DEC-76 | Cron estándar con una librería que solo calcula el próximo disparo |
| DEC-77 | Una zona horaria global por variable de entorno |
| DEC-78 | Alta por API con alcance de tenant y consola mínima |
| DEC-79 | Detención por flag `activo`; sin edición ni borrado |
| DEC-80 | Registro de ejecuciones por API con alcance de tenant y vista en la consola |
| Resolución 1 | El planificador es un camino de producción hacia el contexto de tenant; el id sale solo de la base propia |
| Resolución 2 | La compuerta de validación de DEC-71 se aplica también a las ejecuciones programadas |

## Fricciones encontradas

| # | Fricción | Causa | Resolución | Tiempo perdido |
|---|---|---|---|---|
| 1 | Dos rondas de preguntas frenaron la cadena automática (4 en exploración, 3 en propuesta) | AGENTS.md: ninguna decisión de arquitectura la toma un agente | Se presentaron al usuario y se registraron antes de seguir | no medido |
| 2 | El agente de exploración no pudo escribir `exploration.md` | Esa fase corre sin herramienta de escritura | El orquestador lo armó desde el resumen devuelto, no desde el análisis completo | no medido |
| 3 | El diseño llamaba `/baja` a la ruta de desactivación; la spec y DEC-79, `desactivar` | Precedente de `/tenants/:id/baja` en el diseño | Se alineó el diseño a `desactivar` antes de implementar | no medido |
| 4 | La unidad 2 se commiteó en 579 líneas | El pronóstico (~280) no contó tests ni comentarios | Se partió en 2a (245) y 2b (336) con el mismo código final; el registro de intentos de `gentle-ai` necesitó un reset auditado aprobado por el usuario | no medido |
| 5 | Al arrancar Docker, la base de Saleor ocupó el puerto 5432 con otras credenciales | Contenedor con reinicio automático de otro proyecto | Las suites en vivo fallaban (28P01) en vez de saltearse; se usó `zd-ch09-testdb` en el puerto 5434 con `TEST_DB_PORT=5434` | no medido |
| 6 | La unidad 4a (tick del planificador) quedó en 458 líneas | Los tests 4.1–4.4 necesitan el pipeline completo; no había corte coherente | El usuario aceptó `size:exception` y un segundo reset auditado | no medido |
| 7 | La unidad 4b se entregó en 423 líneas | 44 líneas de `tasks.md` y `apply-progress.md` | Esas líneas se movieron al primer commit de la unidad 5; 4b quedó en 379 | no medido |
| 8 | Las unidades 3 y 6 superaban el presupuesto (520 y 530) | Volumen de tests | Los agentes cortaron en un punto limpio (3a/3b, 6a/6b) sin necesitar reset | no medido |
| 9 | Una sonda de conexión de 1000 ms saltea suites en vivo bajo carga sin contarlas como salteadas | Diseño de los tests existentes | Se controló el total de tests en cada corrida, no solo `fail 0` | no medido |

## Límites del artefacto (aceptados)

| Límite | Origen | Notas |
|---|---|---|
| Disparos perdidos con el proceso caído no se recuperan | DEC-75 | Queda para CH-17 |
| Varios disparos dentro de un minuto atrasado cuentan como una corrida | DEC-75 | Queda para CH-17 |
| Las corridas son en serie; una lenta atrasa a las demás | DEC-75 | Queda para CH-17/CH-18 |
| Un corte del proceso a mitad de corrida deja una fila `en-curso` | DEC-75 | Queda para CH-17 |
| Una sola zona horaria para todos los tenants | DEC-77 | — |
| Sin edición: para cambiar una automatización se desactiva y se crea otra | DEC-79 | — |
| Valores guardados pueden quedar desactualizados si la plantilla se reemplaza | DEC-68 | La corrida registra `valores-invalidos` |
| Un cron guardado corrupto genera una fila de error por minuto | — | Solo alcanzable modificando la base a mano; el alta rechaza cron inválidos |
| La conexión se carga como id en texto libre en la consola | — | No hay ruta que liste conexiones |
| El registro de ejecuciones no tiene política de retención | X2 | — |

## Cambios a especificaciones existentes

- **domain-data-model**: se reemplazó la prohibición de tablas `Automatizacion` y `Ejecucion`; `Usuario` sigue prohibida.
- **tenant-isolation**: los modelos nuevos entran en la lista filtrada; el barrido T2 cubre las rutas nuevas y un tick del planificador con dos tenants; se agregó que el planificador toma el tenant solo de sus filas `Tenant`.
- **project-environment**: variable `ZONA_HORARIA_AUTOMATIZACIONES` y su entrada en el archivo de ejemplo.
- **query-console**: sección de automatizaciones.
- **automation-scheduling** y **execution-log**: specs nuevas.

## Verificación

**PASS WITH WARNINGS**: 536/536 tests contra una PostgreSQL de prueba (471 al cierre de CH-12), `tsc` sin errores, `prisma validate` válido, 23/23 requisitos y 36/36 escenarios cubiertos (34 con tests en ejecución, 2 confirmados por inspección), las 7 reglas de AGENTS.md sostenidas, 0 críticos.

- **WARNING-1**: el arranque del planificador con el servidor no tiene un test de arranque real de `src/server.ts`; el mecanismo `iniciar`/`detener` sí está probado. Ningún change anterior prueba el arranque real.
- **WARNING-2**: no hay test que lea `.env.example`; se inspeccionó a mano.
- **WARNING-3**: el mensaje propio de la consola para un 400 sobre `/cron` no tiene test; el rechazo del servidor sí.

## Pendientes fuera de CH-13

- `AGENTS.md` sigue listando D-4 y D-5 como compuertas abiertas; están cerradas (DEC-25, DEC-26). No se editó.
- Archivos sin trackear en la raíz del repo, anteriores a este change (`200`, `prisma;C`, `files.zip`). No se borraron.
- Ramas `ch13/*` sin publicar; los PRs encadenados quedan para cuando se decida.

---

**Archivado**: 2026-09-29 — specs sincronizadas, carpeta del change movida a `openspec/changes/archive/2026-09-29-CH-13-engine-scheduling-execution/`.
