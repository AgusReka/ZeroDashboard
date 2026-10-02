# Bitácora — CH-17b: Reintentos de conexión acotados (X5)

**Fecha de inicio:** 2026-09-30 (DEC-97 y DEC-98, durante la exploración de CH-17); 2026-10-01 (DEC-103 a DEC-106, artefactos SDD y apply)
**Fecha de cierre:** pendiente (falta verify y archive)
**Tiempo invertido:** sesión asistida por agente (Claude Code), ciclo SDD con TDD estricto. Marcas de los commits del 2026-10-01: artefactos SDD y DEC-103 a DEC-106 a las 13:11; slice 1 a las 13:18; slices 2a y 2b a las 13:33 y 13:34 (se commitearon juntas después de partir la slice 2, así que su marca no mide la implementación); la slice 3 se implementó a continuación, en la misma sesión. **Completar con el tiempo real percibido antes de citar este dato en la tesis**: las marcas acotan los commits, no la exploración, las decisiones ni el trabajo previo a cada commit.

> Se escribe durante el apply de la slice 3 (2026-10-01), apoyada en los artefactos del change (`openspec/changes/CH-17b-reintentos-de-conexion/`), en los mensajes de commit y en DEC-97, DEC-98 y DEC-103 a DEC-106. No reconstruida de memoria.

---

## Qué se construyó

X5 pide una política de reintentos con tope para las corridas programadas. Antes de este change, una corrida que no podía conectar por un corte transitorio quedaba `fallo` y esperaba al disparo siguiente.

- **Regla de falla reintentable** (DEC-97; slice 1): `esFalloReintentable` en `src/automatizaciones.ts`, junto a `cierreDeResultado`. Solo son reintentables `host-inalcanzable`, `dns-no-resuelve` y `tiempo-agotado` de la fase de conexión. Credenciales, base inexistente, permisos, preparación, consulta (incluido su `tiempo-agotado`), `error-desconocido`, rechazos, excepciones y notificación no se reintentan.
- **Configuración** (DEC-98, DEC-105, DEC-106; slice 1): `CONNECTION_RETRY_ATTEMPTS` (1 a 5, por defecto 3) y `CONNECTION_RETRY_PAUSE_MS` (entero positivo, por defecto 5000). Un valor fuera de rango hace fallar el arranque con un mensaje que nombra la variable y nunca el valor. `.env.example` y `docker-compose.yml` las documentan sin valores reales.
- **Columna `intentos`** (DEC-98, DEC-103; slice 1): migración aditiva `20261001000000_ejecucion_intentos`, entera y nullable, sin default ni backfill.
- **Bucle de reintentos** (DEC-98; slice 2a): `conectarConReintentos` envuelve solo la llamada a `ejecutarConsulta`. El control de solapamiento, la compuerta de validación, la composición, la preparación y el destino corren una sola vez. El conteo suma uno antes de cada intento de conexión; entre intentos hay una pausa con `Reloj.programar`. La corrida escribe una sola fila, que queda `en-curso` durante las pausas y se cierra una vez, con la categoría del último intento y el `intentos` alcanzado. Cada pausa deja un `info` con campos cerrados; el `warn` de corrida fallida suma `intentos`.
- **Apagado durante una pausa** (DEC-104, DEC-106; slice 2b): `detener()` cancela la pausa pendiente; la corrida se cierra `fallo` con la categoría del último intento y el `intentos` alcanzado, sin nuevos intentos. El resto del tick en curso termina con un intento por automatización vencida. Las filas centinela (`omitida` e `interrumpida`) escriben `intentos: null`. `src/server.ts` pasa la política desde la configuración; los tests que no la inyectan siguen con `SIN_REINTENTOS` (1 intento, sin pausa).
- **Listado y consola** (DEC-103, DEC-106; slice 3): `GET /automatizaciones/:id/ejecuciones` devuelve `intentos` (entero o nulo). La vista de ejecuciones de la consola agrega la columna `Intentos` al final, después de `Error`, para no mover las columnas que los tests leen por posición; un nulo se muestra como `—`, nunca como 1 ni como `null`.
- Sin SQL crudo y sin dependencias nuevas.

## Decisiones tomadas

DEC-97 y DEC-98 se decidieron con el usuario el 2026-09-30, en la exploración de CH-17. DEC-103 a DEC-106 se decidieron con el usuario el 2026-10-01, a partir de las preguntas del diseño de CH-17b.

| Decisión | Qué fija |
|---|---|
| DEC-97 | Solo se reintentan los fallos transitorios de la fase de conexión |
| DEC-98 | Reintento dentro de la corrida, una fila con `intentos`, 3 intentos y 5 s de pausa por variable de entorno |
| DEC-103 | `intentos` cuenta intentos reales, nulo si no hubo intento; visible en el listado y en la consola |
| DEC-104 | El apagado cancela la pausa y cierra la fila con el último resultado |
| DEC-105 | Máximo de 5 intentos, validado al arrancar |
| DEC-106 | Política inyectada, nombres de variables, columna al final, ejemplos DNS relajados, el apagado solo cancela la pausa |

## Fricciones encontradas

| # | Fricción | Causa | Resolución | Tiempo perdido |
|---|---|---|---|---|
| 1 | La slice 2 midió 488 líneas en `src/` contra un pronóstico de 270–310 | El pronóstico no contó los tests de integración: unas 337 líneas entre el fixture, los ayudantes (reloj de pausas, puertos libres, reenviador `net`, listener que se cuelga) y siete tests | Se partió en dos ramas apiladas: 2a (bucle, conteo, logs, sin cablear `server.ts`) y 2b (cancelación en `detener()`, centinelas, cableado). No se comprimió código para entrar en el tope | no medido |
| 2 | Los ejemplos de la spec con `dns-no-resuelve` no se pueden reproducir en secuencia | Con destino fijo y sockets reales, un fallo DNS no puede seguir a otra categoría | DEC-106: se relajan los ejemplos; las pruebas usan `host-inalcanzable` seguido de `tiempo-agotado`. No se agregó un punto de inyección del dial | no medido |
| 3 | La lista blanca de columnas de `Ejecucion` (test 4.6 de CH-13) falló al sumar `intentos` | El test fija el conjunto exacto de columnas | Se agregó `intentos` a la lista, como hizo CH-14 con `notificacion` | no medido |
| 4 | Dos aserciones de fila completa cambiaron en la slice 3 | El test 5.1 de las rutas y el primer test de la vista de ejecuciones comparan la fila entera | Se agregó `intentos: null` y la celda `—`; las aserciones por posición quedaron iguales | no medido |
| 5 | `tasks.md` cita una plantilla de bitácora (`docs/bitacora/_plantilla.md`) que no existe | Referencia del artefacto de tareas (igual que en CH-17a) | Se siguió la estructura de las bitácoras de CH-14 y CH-17a | no medido |
| 6 | `openspec/config.yaml` sigue con `strict_tdd: false` | Quedó del init del proyecto | El orquestador inyectó TDD estricto; no se editó la configuración | no medido |

## Límites del artefacto (aceptados)

| Límite | Origen | Notas |
|---|---|---|
| Con una conexión caída, el tick serial queda bloqueado unos 3 × (timeout de conexión + 5 s) | DEC-98 | Con los valores por defecto son unos 25 s (3 intentos de hasta 5 s y 2 pausas de 5 s). Las demás automatizaciones vencidas esperan |
| La protección de los demás tenants frente a una conexión caída no está en este change | DEC-98, X8 | Aislamiento de fallos entre tenants y paralelismo: CH-18 |
| El envío de notificaciones no se reintenta | DEC-97, X6 | La spec de `email-notification` se reafirma sin cambios; la notificación es de CH-18 |
| El máximo de 5 intentos está fijo en el código | DEC-105 | Cambiarlo exige tocar el código |
| Solo se reintentan tres categorías de conexión | DEC-97 | Otro fallo transitorio espera al próximo disparo |
| Al apagar durante una pausa, una corrida recuperable se cierra como fallida | DEC-104 | El próximo disparo es el reintento |
| El apagado espera el resto del tick en curso | DEC-106 | Un intento por automatización vencida restante, sin reintentos |
| Se asume una única instancia | DEC-75, DEC-99 | Con una sola instancia el tick es serial; una segunda instancia vería la fila `en-curso` durante la pausa y escribiría `omitida` (DEC-96) |
| Una caída sin señal durante una pausa deja la fila `en-curso` | DEC-99, DEC-103 | La cierra el barrido del próximo arranque como `interrumpida`, con `intentos` nulo |

**Rollback:** revertir las ramas en orden inverso (3, 2b, 2a, 1). La migración aplicada queda: el código anterior ignora la columna nullable; un `DROP COLUMN` hacia adelante es opcional (ver el encabezado de la migración).

## Cambios a especificaciones existentes

- **execution-log**: columna `intentos` con su semántica (1 si hubo un solo intento, N tras N, nulo si no hubo intento o la fila es anterior); el listado la expone; agotado el tope, gana la categoría del último intento.
- **automation-scheduling**: bucle de reintentos acotado, pausa, cancelación en `detener()` y una sola fila por corrida.
- **project-environment**: `CONNECTION_RETRY_ATTEMPTS` y `CONNECTION_RETRY_PAUSE_MS`.
- **query-console**: columna `Intentos` con marcador para el nulo.

## Verificación

Al cierre del apply de la slice 1: 663/663 tests contra una PostgreSQL de prueba. Al cierre de la slice 2 (2a + 2b): 670/670. Al cierre de la slice 3: 671/671. `npx tsc --noEmit` sin errores en cada slice y sin diferencias en `prisma/` en la slice 3. Falta la corrida de verify.

## Pendientes fuera de CH-17b

- Aislamiento de fallos entre tenants y paralelismo (CH-18, X8).
- Reintento o reporte de fallas de notificación (CH-18, X6).
- Pasada manual de la consola en un navegador para la columna nueva.
