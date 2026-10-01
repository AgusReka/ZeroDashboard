# Bitácora — CH-17a: Ejecuciones interrumpidas y solapamiento (X7, X4)

**Fecha de inicio:** 2026-09-30 (exploración, decisiones, propuesta, specs, diseño, tareas y apply)
**Fecha de cierre:** pendiente (falta verify y archive)
**Tiempo invertido:** sesión asistida por agente (Claude Code), ciclo SDD con TDD estricto. El registro de DEC-95 a DEC-101 es de las 22:35 del 30; los artefactos SDD y DEC-102, de las 22:43; los dos commits de la slice 1, de las 22:51. La slice 2 se implementó después, en la misma sesión. **Completar con el tiempo real percibido antes de citar este dato en la tesis**: las marcas de los commits acotan la implementación, no la exploración ni las decisiones.

> Se escribe durante el apply de la slice 2 (2026-09-30), apoyada en los artefactos del change (`openspec/changes/CH-17a-interrumpidas-y-solapamiento/`), en los mensajes de commit y en DEC-95, DEC-96, DEC-99, DEC-100, DEC-101 y DEC-102. No reconstruida de memoria.

---

## Qué se construyó

X7 pide que una corrida cortada por un reinicio no quede `en-curso` para siempre; X4, que una corrida no arranque mientras la anterior de la misma automatización sigue en curso, y que eso quede registrado. Antes de este change, un redeploy durante una corrida dejaba la fila huérfana y nada impedía ni registraba un solapamiento.

- **Barrido al arrancar** (DEC-99, DEC-102; slice 1a): `Planificador.arrancar()` ejecuta `barrerInterrumpidas()` y después llama a `iniciar()`, que sigue siendo síncrono. El barrido lee una sola hora de arranque, recorre todos los tenants (incluidos los dados de baja, la única excepción acotada a DEC-14) y, dentro del contexto de cada uno, cierra con `updateMany` las filas `en-curso` como `fallo`/`interrumpida`, con `finalizadaEn` igual a la hora de arranque y el resto de las columnas de resultado nulas. El fallo de un tenant se registra y los demás se barren igual; si falla la lista de tenants, el servicio arranca igual. Las corridas interrumpidas no se re-ejecutan.
- **Apagado ordenado** (DEC-100, DEC-102; slice 1b): `src/apagado.ts` registra SIGTERM y SIGINT. La primera señal llama una sola vez a `app.close()`, que espera a `detener()` del planificador, y sale con código 0 (1 si el cierre falla). Una segunda señal se registra y se ignora.
- **Control de solapamiento** (DEC-96, DEC-102; slice 2): el primer paso de `correr()` busca, por el cliente con alcance de tenant, una fila `en-curso` de la misma automatización. Si existe, no se compone, no se conecta ni se envía nada: se escribe una fila `omitida`/`solapamiento` con `finalizadaEn = iniciadaEn` y `duracionMs` nulo, y se registra un aviso con campos cerrados. Si la búsqueda falla, la captura por corrida existente de `correrVencidas` lo registra y la corrida no arranca.
- **Consola**: la vista de ejecuciones muestra un mensaje legible para `solapamiento` y para `interrumpida`, y la etiqueta "Omitida" para el estado `omitida` (`ETIQUETAS_ESTADO`). Los demás estados se siguen mostrando tal cual, como pide el test 6.5 de CH-14.
- **Comentarios** (DEC-95): se corrigieron los comentarios de `src/planificador.ts`, `src/automatizaciones.ts` y `src/planificador.test.ts` que atribuían el catch-up a CH-17.
- Sin migración (`estado` y `error` son texto libre), sin SQL crudo y sin dependencias nuevas.

## Decisiones tomadas

DEC-95 a DEC-101 se decidieron con el usuario el 2026-09-30 durante la exploración de CH-17; DEC-102 fija las elecciones del diseño de CH-17a que las anteriores no cubrían. DEC-97 y DEC-98 (X5, reintentos) quedan para CH-17b.

| Decisión | Qué fija |
|---|---|
| DEC-95 | Sin catch-up de disparos perdidos: límite del artefacto |
| DEC-96 | Solapamiento detectado con una consulta a la base y registrado como `omitida`, una fila por tick |
| DEC-99 | Barrido al arrancar sobre todos los tenants, sin re-ejecutar, con arranque aunque falle |
| DEC-100 | SIGTERM y SIGINT cierran la aplicación |
| DEC-101 | CH-17 se parte en CH-17a (X7, X4) y CH-17b (X5) |
| DEC-102 | `arrancar()`, barrido tolerante por tenant, forma de la fila `omitida`, salida tras el apagado |

## Fricciones encontradas

| # | Fricción | Causa | Resolución | Tiempo perdido |
|---|---|---|---|---|
| 1 | La slice 1 llegó a 465 líneas contra un pronóstico de 230–280 | El pronóstico no contó los tests, que fueron unas 308 líneas | Se partió en dos ramas apiladas: 1a (barrido, `arrancar` y comentarios) y 1b (apagado). No se comprimió código para entrar en el tope | no medido |
| 2 | El barrido real en un test cerraría las filas `en-curso` de otros archivos de test | `node:test` corre los archivos en paralelo contra la misma base | Los tests le pasan al planificador un `Proxy` que acota `tenant.findMany` a los tenants propios del test | no medido |
| 3 | La fila `en-curso` de otro tenant que apunta a una automatización ajena rompe la limpieza del test | `after` borra por tenant en orden de creación y la clave foránea de `Ejecucion` apunta a la automatización | El tenant con la fila cruzada se crea primero, así sus filas se borran antes | no medido |
| 4 | `tasks.md` cita una plantilla de bitácora (`docs/bitacora/_plantilla.md`) que no existe | Referencia del artefacto de tareas | Se siguió la estructura de las bitácoras de CH-14 y CH-15 | no medido |
| 5 | `openspec/config.yaml` sigue con `strict_tdd: false` | Quedó del init del proyecto | El orquestador inyectó TDD estricto; no se editó la configuración | no medido |

## Límites del artefacto (aceptados)

| Límite | Origen | Notas |
|---|---|---|
| Sin catch-up: los disparos perdidos durante una caída o una corrida larga no se ejecutan ni dejan rastro | DEC-95, regla 6 | Un tick evalúa la ventana `(anterior, ahora]` y corre una vez aunque caigan varios disparos |
| Se asume una única instancia: el barrido de una segunda instancia cerraría como `interrumpida` las corridas vivas de la primera | DEC-75, DEC-99 | La seguridad con varias instancias queda fuera de alcance |
| Una fila que queda `en-curso` en un proceso vivo (por ejemplo, si falla el `update` final) no se limpia hasta el próximo arranque | DEC-99 | Mientras tanto la automatización produce una fila `omitida` por tick (DEC-96); no hay reaper por tick |
| Entre la búsqueda de solapamiento y la creación de la fila hay una ventana de carrera | DEC-96 | Aceptable mientras el tick sea serial; se reabre si CH-18 agrega paralelismo |
| Un barrido que falla deja filas zombi hasta el arranque siguiente | DEC-99, DEC-102 | El servicio arranca igual (fail-open) |
| Una segunda señal se ignora: un cierre colgado solo se corta con `kill -9` | DEC-102 | El período de gracia de Docker y el barrido siguiente cubren ese caso |
| Una caída sin señal (`kill -9`) sigue dejando la fila huérfana | DEC-100 | La cierra el barrido del próximo arranque |

**Rollback:** revertir las ramas en orden inverso (2, 1b, 1a). No hay cambios de esquema; las filas `omitida` e `interrumpida` ya escritas siguen siendo texto legible.

## Cambios a especificaciones existentes

- **execution-log**: `omitida` se suma al conjunto de `estado`; `solapamiento` e `interrumpida` al de `error`. El salto por solapamiento y el cierre por barrido son resultados registrados.
- **automation-scheduling**: control de solapamiento, barrido antes del primer tick, apagado por señal y límite de no catch-up.
- **tenant-isolation**: el barrido entra al contexto de cada tenant, incluidos los dados de baja; la búsqueda de solapamiento es por tenant.
- **query-console**: mensajes legibles para `solapamiento` e `interrumpida` y etiqueta para `omitida`.

## Verificación

Al cierre del apply de la slice 2: 648/648 tests contra una PostgreSQL de prueba (645 al cierre de la slice 1) y `npx tsc --noEmit` sin errores. Sin diferencias en `prisma/`. Falta la corrida de verify.

## Pendientes fuera de CH-17a

- X5, reintentos (CH-17b, DEC-97 y DEC-98).
- Aislamiento de fallos entre tenants y paralelismo (CH-18); reabre la ventana de carrera de DEC-96.
- Pasada manual de la consola en un navegador para las filas nuevas.
- Archivo `run` sin trackear en la raíz; no se borró.
