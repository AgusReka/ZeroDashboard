# Bitácora — CH-38: Pantalla de plantillas en la consola

**Fecha de inicio:** 2026-10-27 (exploración y decisiones de DEC-191)
**Fecha de cierre:** pendiente (falta mergear #213 y #214, sobre la cadena #199 a #211)
**Tiempo invertido:** sesión asistida por agente (Claude Code), con ciclo SDD completo (exploración, propuesta, specs, diseño, tareas, apply, verificación y archivo). Artefactos en OpenSpec, ritmo automático.

| Momento | Marca |
|---|---|
| Mapeo del código para la exploración | 2,7 min de agente |
| Decisiones de DEC-191 elegidas por el usuario | 2026-10-27 |
| DEC-191 | Commit `972eb53`, 20:13; PR #213 |
| Precisión del diseño en DEC-191 | Commit `0c7cdf4`, 20:45 |
| Artefactos SDD | Commit `603bbc5`, 20:53 |
| Implementación de las 15 tareas | 18,9 min de agente, en un escritor delegado |
| Verificación independiente | 3,6 min de agente |
| Código, tests y reporte | Commits `a461b4a`, `14ad58e` y `42bf930`, 21:23; PR #214 abierto a las 21:24 |
| Archivo y specs principales | Commit `cec579d`, 21:29 |

**Completar con el tiempo real percibido antes de citar este dato en la tesis**: las marcas acotan los commits y las corridas del agente, no la conversación ni la revisión.

> Se escribe el 2026-10-27, apoyada en DEC-182, en DEC-191 y en los artefactos archivados en `openspec/changes/archive/2026-10-27-CH-38-pantalla-de-plantillas/` (exploración, diseño, informe del escritor y reporte de verificación). No reconstruida de memoria.

---

## Qué se construyó

Hasta CH-38, una plantilla solo se creaba o se cambiaba por API, y la consola la mostraba en solo lectura. Además, `PUT` reemplazaba una plantilla global sin mirar si alguna automatización la usaba, así que una corrección cambiaba en silencio lo que corría en todos los tenants. DEC-182 (b) decidió que una plantilla en uso no se edita: se duplica.

- **Plantilla en uso:**
  - Una plantilla está en uso si tiene al menos una automatización con `activo = true`, en cualquier tenant.
  - `PUT /plantillas/:id` responde `409 plantilla-en-uso` si está en uso. Antes valida el cuerpo (`400`) y busca la plantilla (`404`).
  - En una sola transacción, bloquea la fila de la plantilla (`SELECT … FOR UPDATE`), comprueba el uso y escribe. Dar de alta una automatización toma `FOR KEY SHARE` sobre su plantilla por la clave foránea, así que no queda ventana de carrera.
  - `GET /plantillas/:id` y las respuestas de `POST` y `PUT` devuelven `enUso`.
- **Aislamiento:**
  - El uso se lee con dos métodos tipados de `extenderConAislamiento`, sobre el cliente sin aislar, como `agente.buscarPorTokenHash`: `automatizacion.plantillaEnUso` y `automatizacion.reemplazarPlantillaLibre`.
  - Responden sí o no, o devuelven la plantilla reemplazada. Nunca filas, cantidades ni ids de tenant.
  - Las rutas del catálogo los reciben como un puerto armado en `rutas.ts`, nunca un cliente.
- **Prueba antes de guardar:** `POST /plantillas/prueba` prueba una plantilla sin guardarla. Exige `X-Tenant-Id`, pasa por las mismas validaciones y compuertas que la prueba de una plantilla guardada, y se audita con `plantillaId: null`.
- **Consola (C-03):**
  - «Nueva plantilla» en el encabezado.
  - El panel lateral muestra los textos para el cliente y ofrece «Editar» o «Duplicar y editar» según `enUso`.
  - Un pop-up sirve para crear, editar y duplicar. «Guardar» se habilita solo después de una prueba aprobada con la misma consulta, parámetros, entidades y conexión.
  - «Duplicar y editar» copia todo menos el título y la descripción para el cliente, y suma «(copia)» al nombre.
  - El editor de parámetros y el bloque de resultado se comparten con Consultas, sin cambiar su comportamiento.
- **Docs:** `docs/guia/05-plantillas.md` y la entrada C-03 de `guidelines/consola.md`, en las dos copias de la skill.

## Decisiones tomadas

| Decisión | Qué fija |
|---|---|
| DEC-182 (b) | Una plantilla en uso no se edita: se duplica. Tomada en la planificación de la v2 |
| DEC-191 | Qué es «en uso», cómo se lee entre tenants, la prueba antes de guardar y qué copia «Duplicar y editar». Con una precisión del diseño: la lectura vive en la extensión, responde sí o no y el reemplazo bloquea la fila |

El usuario eligió las opciones recomendadas en tres de los cuatro puntos de DEC-191 el 2026-10-27, en la exploración. En «en uso» eligió solo las automatizaciones activas, frente a la recomendada (cualquier automatización). También eligió entregar todo en una sola PR con `size:exception`.

## Fricciones encontradas

| # | Fricción | Causa | Resolución | Tiempo perdido |
|---|---|---|---|---|
| 1 | No se pudieron lanzar los sub-agentes de fase `sdd-*` | Un hook de Claude Code rechaza ese despacho, como en CH-37 | Las fases se hicieron en la conversación principal. El mapeo, la escritura y la verificación se delegaron a agentes genéricos | no medido |
| 2 | DEC-182 y la fila de CH-38 no estaban en la rama de trabajo | Las decisiones de la v2 siguen en PRs sin mergear (#203, #205, #207) | Se leyeron con `git show` desde cada rama. DEC-191 se escribió en un worktree aparte, en su propia rama (#213) | no medido |
| 3 | La redacción de DEC-191 no coincidía con el código | Decía que la función se armaba en `rutas.ts` con el cliente sin aislar, pero `server.ts` no conserva ese cliente, a propósito | Se siguió el precedente de las lecturas sin tenant en la extensión, y la decisión se enmendó antes de las tareas (`0c7cdf4`), con aprobación del usuario | no medido |
| 4 | El pronóstico de tamaño fue de unas 900 líneas y el diff real, de unas 2400 sin los artefactos SDD | Se subestimaron los tests (unas 1400 líneas) y la consola (unas 780) | La PR va con `size:exception`. El registro de intentos de SDD frenó al pasar el tope de 1000 líneas, y el responsable lo reinició | no medido |
| 5 | Un test corrido a mano fallaba con P1000 | Sin las variables de la base de prueba, los tests apuntan a la base de desarrollo con otra clave | Se corre con `TEST_DB_PORT`, `TEST_DB_PASSWORD`, `TEST_DB_NAME` y `DATABASE_URL` de `zerodashboard_test` | no medido |
| 6 | Importar `PlantillaCompleta` en la extensión de aislamiento armaba un ciclo | `plantillas-rutas.ts` llega a `aislamiento-prisma.ts` a través de `consultas-guardadas.ts` | Las proyecciones pasaron a `src/plantillas/plantillas.ts`, como preveía la tarea | no medido |
| 7 | Después de un `409`, «Duplicar y editar» conservaba los textos para el cliente | El diseño decía «con los valores actuales del formulario» sin aclarar los textos | Se corrigió según DEC-191 (una copia empieza sin textos), con su aserción, antes de la verificación | no medido |
| 8 | El escritor dejó un archivo vacío llamado `({` en la raíz | Un heredoc de la consola de comandos mal interpretado | Se borró. El inventario de archivos sin seguir cambió, y `gentle-ai` pidió el hash nuevo | no medido |
| 9 | Un salto de línea en el script de la consola rompía el script | El HTML y el script viven en una plantilla de texto de TypeScript | En el fuente TS se escribe `'\\n'` | no medido |

## Límites del artefacto (aceptados)

| Límite | Origen | Notas |
|---|---|---|
| «En uso» cuenta solo automatizaciones activas | DEC-191 | Depende de que no exista la reactivación (DEC-79). Si algún día se agrega, la regla se revisa |
| Una automatización desactivada queda apuntando a una plantilla que puede decir otra cosa | DEC-191 | La auditoría conserva la sentencia compuesta de cada ejecución (DEC-160) |
| Una tarjeta pausada del panel muestra los textos actuales de su plantilla | DEC-191 | Si la plantilla se edita mientras está pausada, el cliente ve el texto nuevo |
| Para crear una plantilla hace falta un tenant activo con una conexión y vistas aprobadas | DEC-191 | La prueba corre contra la réplica de un cliente. El pop-up dice por qué «Guardar» está deshabilitado |
| El catálogo acumula copias y no hay borrado | DEC-182, DEC-68 | Una copia sin textos no aparece en el panel del cliente |
| En la demo, la plantilla `stock-fisico` está en uso | Semilla de demo | La consola muestra «Duplicar y editar», no «Editar» |
| El test de la carrera detecta el bloqueo con una espera de 750 ms | Implementación | Tiene tope de tiempo: falla en lugar de colgarse |

**Rollback:** revertir #214. No hay migración.

## Verificación

- `npx tsc --noEmit`: sin errores.
- `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db`: 1560 de 1564. Las 4 fallas son los falsos positivos conocidos de `conexiones.test.ts` (5.1, 5.3, 5.4 y CH-07). Contra CH-37 (1515 de 1519) hay 45 tests más, y fallan los mismos 4.
- La verificación independiente cruzó los 30 escenarios de las cuatro specs con sus tests y revisó el aislamiento (regla 2), la parametrización (regla 4) y el guard G3' de la consola. Dio PASS, sin críticos ni advertencias, con 5 sugerencias sobre la fuerza de algunos tests.
- Los tests existentes de Consultas pasaron sin editarse después de compartir el editor de parámetros.

## Pendientes fuera de CH-38

- Las sugerencias S1 a S3 del reporte: tests del cuerpo con `terminos` y del tamaño de página de `POST /plantillas/prueba`, y de que un rechazo no deje fila de auditoría.
- Mergear la cadena: #199 a #211, después #213 (DEC-191) y #214 (CH-38).
- CH-39: texto del mensaje, que se carga en este mismo pop-up.
