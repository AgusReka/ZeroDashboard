# Bitácora — CH-37: Textos para el cliente en la plantilla

**Fecha de inicio:** 2026-10-24 (exploración y decisiones de DEC-190)
**Fecha de cierre:** pendiente (falta mergear #210 y #211, sobre la cadena #199 a #209)
**Tiempo invertido:** sesión asistida por agente (Claude Code), con ciclo SDD completo (exploración, propuesta, specs, diseño, tareas, apply, verificación y archivo). Artefactos en OpenSpec, ritmo automático.

| Momento | Marca |
|---|---|
| Mapeo del código para la exploración | 3,4 min de agente |
| Decisiones de DEC-190 elegidas por el usuario | 2026-10-24 |
| DEC-190 | Commit `1044fef`, 2026-10-27 19:01; PR #210 |
| Validación del diseño con contexto limpio | 2,7 min de agente |
| Artefactos SDD | Commit `7a5e762`, 19:15 |
| Implementación de las 14 tareas | 6,9 min de agente, en un escritor delegado |
| Código | Commit `bed9a14`, 19:36; PR #211 abierto a las 19:36 |
| Verificación independiente | 3,0 min de agente; refuerzo de tests en `c13bf11`, 19:45 |
| Archivo y specs principales | Commit `0b756fa`, 19:48 |

**Completar con el tiempo real percibido antes de citar este dato en la tesis**: las marcas acotan los commits y las corridas del agente, no la conversación ni la revisión.

> Se escribe el 2026-10-27, apoyada en DEC-182, en DEC-190 y en los artefactos archivados en `openspec/changes/archive/2026-10-27-CH-37-textos-para-el-cliente/` (exploración, diseño, informe del escritor y reporte de verificación). No reconstruida de memoria.

---

## Qué se construyó

Hasta CH-37, los textos que el cliente ve en el panel estaban fijos en el código. Vivían en `COPY_NEGOCIO` y estaban indexados por la etiqueta `automatizacion`. Esa etiqueta es una lista cerrada de tres valores, así que una plantilla nueva nunca habría llegado al panel. CH-37 es el requisito previo de CH-38.

- **Modelo y migración:**
  - `Plantilla` suma `titulo` y `descripcion`, opcionales.
  - La migración `20261027000000_plantilla_textos_cliente` agrega las columnas y carga los dos textos de DEC-137 por etiqueta en las filas existentes de `stock-fisico` y `stock-producible`.
- **Semilla:** las dos entradas del catálogo traen los textos. Sigue sin actualizar filas existentes (DEC-125).
- **Panel:**
  - `GET /api/panel/automatizaciones` lee los textos desde la plantilla. Desaparecen `COPY_NEGOCIO` y `copyDe`.
  - Si una plantilla no tiene los dos textos, se muestra el texto neutro.
  - «Disponibles» se deduplica por título normalizado, y gana el `id` menor.
  - Una automatización activa oculta las plantillas con su mismo título.
  - El orden es por título (colación `es`) y después por `id`.
  - La forma de la respuesta y el front no cambian.
- **Rutas de plantillas:**
  - `POST` y `PUT /plantillas` aceptan los dos campos.
  - Se recortan los espacios, y si quedan vacíos se guardan como `null`.
  - Topes de 80 y 200 caracteres, medidos después de recortar.
  - Un término del glosario del panel se rechaza con `400` y `terminos`.
  - `GET /plantillas/:id` los devuelve, y el resumen de `GET /plantillas` no cambia.
- **Glosario compartido:** la lista de términos prohibidos pasa a `src/compartido/glosario-panel.ts`. La usan las rutas, la semilla y el test del panel.
- **Docs:** `docs/guia/05-plantillas.md`.

## Decisiones tomadas

| Decisión | Qué fija |
|---|---|
| DEC-182 (a) | Texto de negocio en `Plantilla`, con migración. Tomada en la planificación de la v2 |
| DEC-190 | Carga por etiqueta en la migración, deduplicación y ocultamiento por título, rutas que aceptan los textos en este change y orden por título. Enmienda la regla de «disponibles» de DEC-137 |

El usuario eligió las cuatro opciones recomendadas de DEC-190 el 2026-10-24, en la exploración. También eligió entregar todo en una sola PR con `size:exception` en lugar de tres PRs encadenadas (2026-10-27).

## Fricciones encontradas

| # | Fricción | Causa | Resolución | Tiempo perdido |
|---|---|---|---|---|
| 1 | No se pudieron lanzar los sub-agentes de fase `sdd-*` | Un hook de Claude Code rechaza ese despacho | Las fases se hicieron en la conversación principal. El mapeo, la escritura y la verificación se delegaron a agentes genéricos | no medido |
| 2 | Las decisiones de la v2 y el código de CH-36 estaban en dos cadenas de PRs sin mergear | La documentación de la v2 y la reorganización de `src/` se abrieron por separado | Se leyeron con `git show` desde cada rama. DEC-190 fue en su propia rama (#210), y el código salió de `ch36/comentarios` (#211) | no medido |
| 3 | El pronóstico de tamaño fue de unas 395 líneas y el diff real, de unas 855 | Se subestimaron los tests: unas 600 líneas, por los casos nuevos y el aislamiento entre archivos | El usuario aceptó una PR con `size:exception`. Se creó la etiqueta en el repo, y el responsable reinició el presupuesto de intentos de SDD | no medido |
| 4 | Los tests con base fallaban en lugar de saltearse | Docker estaba apagado, y un Postgres ajeno respondía en 5432, así que la conexión andaba pero la autenticación fallaba (P1000) | Se usó un puerto libre para saltearlos mientras tanto. Con Docker arriba, el contenedor `zerodashboard-db-1` seguía detenido y hubo que levantarlo con `docker compose up -d db` | no medido |
| 5 | La deduplicación por título hacía inestables los tests con base | `test:db` corre todos los archivos en paralelo sobre la misma base, y `Plantilla` es global | Detectado al validar el diseño. Cada archivo marca los títulos que crea, los tests del panel filtran por esa marca, y el test de la migración corre sus `UPDATE` en una transacción que se revierte | no medido |
| 6 | `test:db` encontró un test que no estaba en el plan | `aislamiento.test.ts` fija la lista exacta de columnas de `Plantilla` | Se le sumaron las dos columnas. La aserción que importa, que no haya `tenantId`, no cambió | no medido |
| 7 | `prisma migrate diff` no aceptó las opciones del diseño | Prisma 7.10 reemplazó `--from-schema-datamodel` por `--from-schema`, y ordena las columnas alfabéticamente | Se usaron las opciones nuevas. En la migración, `descripcion` va antes que `titulo` | no medido |
| 8 | La verificación independiente encontró tests débiles | Un test de «gana el `id` menor» que pasaba aunque se ordenara por el título crudo, un caso de la spec sin cubrir (la gemela del operador en la migración) y un test de forma sin textos | Se reforzaron los tres antes del reporte | no medido |
| 9 | El reporte de verificación exige un sobre YAML con salida 0 | `test:db` completo sale con 1 por los falsos positivos conocidos | El comando del sobre son los siete archivos de CH-37 contra la base de prueba. La corrida completa queda anotada en el reporte | no medido |

## Límites del artefacto (aceptados)

| Límite | Origen | Notas |
|---|---|---|
| El control del glosario busca el término dentro del texto, sobre 10 palabras | Spec de CH-37 | «ejecuciones» pasa; «sincronización» se rechaza por «cron». `lenguaje.md` prohíbe más términos. Ampliarlo es una decisión sobre DEC-04 |
| Un texto cargado por SQL directo no pasa por el control | DEC-190 | Solo validan las rutas y la semilla |
| `PUT` sin los textos los borra | DEC-190 | Reemplazo completo, como el resto de los campos |
| Los topes cuentan unidades UTF-16 | Implementación | Un emoji cuenta como dos. Para texto en castellano no cambia nada |
| La consulta Q4 del panel no tiene tope de filas | Diseño, §4.2 | El catálogo es global y chico, y con un tope una plantilla activa podría dejar de ocultar a sus gemelas |
| Las dos tarjetas de la semilla cambian de orden en el panel | DEC-190 | Orden por título |
| El catálogo puede acumular copias con la misma consulta y distinto título | DEC-182, DEC-190 | Se muestran como ofertas distintas |

**Rollback:** revertir #211. La migración se deshace con el bloque `Rollback` de su encabezado: dos `DROP COLUMN`, después de revertir el código.

## Verificación

- `npx tsc --noEmit`: sin errores.
- `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db`: 1515 de 1519. Las 4 fallas son los falsos positivos conocidos de `conexiones.test.ts` (5.1, 5.3, 5.4 y CH-07). Contra la línea base de CH-36 (1495 de 1499) hay 20 tests más, y fallan los mismos 4.
- Después del refuerzo de tests, los siete archivos de CH-37 contra `zerodashboard_test` dan 164 de 164 pasando, sin saltear ninguno.
- La verificación independiente cruzó los 22 escenarios de las tres specs con sus tests y revisó las reglas 1, 2, 4, 5 y 6. Dio PASS con advertencias, y las advertencias se corrigieron.
- La migración no se aplicó a la base de desarrollo. La carga por etiqueta está probada con sus `UPDATE` reales, dentro de una transacción que se revierte.

## Pendientes fuera de CH-37

- Decidir si se amplía la lista del glosario del panel (DEC-04).
- Mergear la cadena: #199 a #209, después #210 (DEC-190) y #211 (CH-37).
- CH-38: pantalla de plantillas en la consola. Para los textos, ahora solo necesita el front.
