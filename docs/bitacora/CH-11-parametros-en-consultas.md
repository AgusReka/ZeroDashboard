# Bitácora — CH-11: Parámetros en consultas

**Fecha de inicio:** 2026-09-27 (exploración, propuesta, specs, diseño y tareas)
**Fecha de cierre:** 2026-09-27 — implementado en siete ramas encadenadas, verificado y archivado
**Tiempo invertido:** sesión asistida por agente (Claude Code), ciclo SDD completo (explore → propose → spec → design → tasks → apply → verify → archive). El commit de planificación es de las 15:54 del 27; los siete commits de implementación caen entre las 15:58 y las 20:21 (seis de ellos antes de las 16:30); el de verificación, a las 20:34. **Completar con el tiempo real percibido antes de citar este dato en la tesis**: las marcas de los commits acotan la implementación, no la exploración ni las decisiones.

> Se escribe al cierre (2026-09-27), apoyada en los artefactos archivados (`openspec/changes/archive/2026-09-27-CH-11-query-parameters/`), en los mensajes de commit y en DEC-47 a DEC-60. No reconstruida de memoria.

---

## Qué se construyó

B3 pedía parametrizar una consulta: parámetros declarados, sustituidos de forma segura, nunca por concatenación. Antes de este change el SQL del usuario no tenía ningún concepto de parámetro, y los únicos parámetros del driver eran los de la paginación (`LIMIT $1 OFFSET $2`).

- **Módulo puro** (`src/parametros.ts`): declaración `{nombre, tipo}` con `tipo` en `texto`, `numero`, `booleano`, `fecha` (DEC-49), todos obligatorios (DEC-50). Queda como primitiva reutilizable por la plantilla de CH-12 (DEC-52).
- **Escáner de texto plano** (DEC-47): una máquina de estados, sin analizador de SQL, que salta cadenas, cadenas `E'...'`, identificadores entre comillas, comentarios de línea y de bloque anidados y bloques `$$`/`$tag$`, y trata `::` como cast. Reescribe cada `:nombre` declarado a `$k` en el orden de la declaración; un nombre repetido usa el mismo `$k`.
- **Controles sobre el texto:** parámetro declarado sin usar (DEC-56), marcador sin declarar (DEC-57) y `$n` escrito a mano fuera de cadenas y comentarios (DEC-59) se rechazan con `400`.
- **Controles sobre los valores:** falta de valor (DEC-50), valor para un nombre no declarado (DEC-58) y forma incorrecta según el tipo (DEC-60). Todos los problemas se informan juntos, cada uno con el parámetro que lo causa (DEC-51).
- **Sentencia preparada:** `ejecutarConsulta` solo acepta una `SentenciaPreparada`, que únicamente construye `prepararSentencia`; ningún llamador puede saltarse el escáner. La reescritura solo inserta `$k`, nunca un valor (regla 4).
- **Ejecución** (`POST /consultas/ejecutar`, DEC-48, DEC-53): declaración y valores viajan en la petición y no se guardan. La paginación pasa a `$(n+1)` y `$(n+2)`; sin parámetros, la sentencia es idéntica a la anterior. Los errores de parámetro responden `400` antes de buscar la conexión.
- **Consulta guardada** (DEC-55): columna `parametros` JSONB, `NOT NULL`, por defecto `[]` (migración `20260927000000_consulta_parametros`). Guardar aplica los mismos controles sobre el texto; crear y leer por id devuelven la declaración; el listado no cambia.
- **Consola:** una fila por parámetro (nombre, tipo, valor según el tipo). Ejecutar manda declaración y valores con su tipo JSON; guardar manda solo la declaración; cargar una consulta guardada rearma las filas. Los errores muestran una línea por problema que nombra el parámetro.

## Decisiones tomadas

DEC-47 a DEC-60 (`docs/01-decisiones.md`), todas decididas por el usuario el 2026-09-27. Se presentaron en dos rondas: exploración (DEC-47 a DEC-54) y propuesta (DEC-55 a DEC-60). Las alternativas y los motivos de cada una están en ese archivo; no se repiten acá.

| Decisión | Qué fija |
|---|---|
| DEC-47 | Marcadores `:nombre`, reescritos a `$n` por transformación de texto, sin analizador |
| DEC-48 | Declaración en la consulta guardada y en la ejecución suelta (esta sin persistir) |
| DEC-49 | Vocabulario propio: `texto`, `numero`, `booleano`, `fecha` |
| DEC-50 | Todos los parámetros obligatorios, sin valores por defecto |
| DEC-51 | Validación en dos capas: forma en la aplicación, conversión final en Postgres |
| DEC-52 | Declaración y sustitución reutilizables por CH-12, sin campos de CH-12 |
| DEC-53 | Declarados en `$1…$n`; paginación en `$(n+1)` y `$(n+2)` |
| DEC-54 | Las vistas canónicas no llevan parámetros |
| DEC-55 | Columna JSON `parametros` en `ConsultaGuardada`, por defecto `[]` |
| DEC-56 | Parámetro declarado que el SQL no usa → `400` |
| DEC-57 | Marcador `:x` sin declarar → `400` |
| DEC-58 | Valor para un nombre no declarado → `400` |
| DEC-59 | `$n` escrito a mano fuera de cadenas y comentarios → siempre `400` |
| DEC-60 | `texto` cadena JSON, `numero` solo número JSON, `booleano` booleano JSON, `fecha` cadena ISO 8601 con o sin hora |

## Fricciones encontradas

| # | Fricción | Causa | Resolución | Tiempo perdido |
|---|---|---|---|---|
| 1 | Dos rondas de preguntas abiertas frenaron la cadena automática (exploración y propuesta) | AGENTS.md: ninguna decisión de arquitectura la toma un agente; la forma de guardar la declaración no la cubría DEC-48 | Cada ronda se le presentó al usuario y se registró antes de seguir | no medido |
| 2 | El agente de exploración no pudo escribir `explore.md` | Esa fase corre sin herramientas de escritura | El orquestador copió el contenido desde Engram | no medido |
| 3 | Specs y diseño diferían en tres detalles (alias `sub` de la envoltura, valores al guardar, gramática de los nombres) | Se escribieron en paralelo | Se alinearon las specs con el diseño antes de las tareas; la validación independiente del diseño lo confirmó | no medido |
| 4 | Las suites vivas fallaban con `28P01` | En esta máquina el 5432 es la base de Saleor | Se corrió con `TEST_DB_PORT=5434` contra `zd-ch09-testdb` | no medido |
| 5 | La unidad 1 (escáner y reescritura) cambió 462 líneas, sobre el tope de 400 | Máquina de estados con muchos casos borde y sus pruebas | El usuario autorizó el reset auditado del registro de intentos y la excepción de tamaño | no medido |
| 6 | Las unidades 2 y 5 tampoco entraban en 400 líneas | Validación completa: 405 líneas de código y pruebas; consola: 396 antes de la documentación | Se partieron: 2 en declaración (`ch11/2`) y valores (`ch11/3`); 5 en editor (`ch11/6`) y mensajes legibles (`ch11/7`). De cinco PRs planeados salieron siete | no medido |
| 7 | La herramienta de composición de specs no leía los deltas | Saltos de línea Windows en los archivos | Se convirtieron a `\n` antes de componer | no medido |

## Verificación

`sdd-verify`: PASS — 0 críticos, 2 advertencias, 2 sugerencias. 19/19 requisitos y 37/37 escenarios de las specs con prueba que pasa.

| Comando | Resultado |
|---|---|
| `npm test` (con `TEST_DB_PORT=5434`) | 406/406, 50 suites, 0 fallas, 0 salteadas |
| `npx tsc --noEmit` | limpio |
| `npx prisma validate` | válido |

Advertencias: un `tipo` desconocido lo rechaza el esquema de la ruta, así que ese `400` trae `campos` pero no `problemas`; y la entrada de `docs/02-mapa-de-changes.md` quedaba para el archivo.

## Consultas ejecutadas

Las pruebas de integración ejecutan consultas parametrizadas reales contra tablas de fixture en la base de pruebas del proyecto, incluidos valores como `O'Brien` y `; DROP TABLE`, que vuelven como dato con la tabla intacta. No se ejecutó nada contra las bases de Food Store, Medusa o Saleor.

## Notas para la tesis

- **Límite del artefacto (regla 6):** en `arr[lo:hi]` el escáner lee `:hi` como marcador; DEC-57 lo rechaza con `400` y la salida es escribir `lo : hi`. `arr[1:2]` no se ve afectado. Tampoco se modela `standard_conforming_strings=off`. No se amplía el escáner.
- **Comportamiento cambiado:** una consulta sin parámetros que contenga `:nombre` o un `$n` escrito a mano fuera de cadenas y comentarios ahora recibe `400` (DEC-57, DEC-59). Antes, un `$1` suelto tomaba el valor del `LIMIT`.
- **Migración:** un entorno con CH-10 aplicado necesita `prisma migrate deploy` antes de correr CH-11.
- **Para CH-12:** la declaración y `prepararSentencia` quedan como primitiva; dónde viven los valores de una ejecución automática sigue sin decidir (X1–X3, D2).

## Lo que esta entrada NO sostiene

- Ningún dato de tiempo de trabajo: las marcas de commit acotan la implementación, no el ciclo completo.
- Ninguna prueba contra datos reales de Food Store, Medusa o Saleor: las pruebas usan fixtures sobre la base de pruebas del proyecto.
