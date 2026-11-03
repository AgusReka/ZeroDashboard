# Bitácora — CH-40: Mínimo de filas por automatización

**Fecha de inicio:** 2026-11-03 (exploración y decisiones de DEC-193)
**Fecha de cierre:** 2026-11-03 (#218, #219 y #220 mergeadas)
**Tiempo invertido:** sesión asistida por agente (Claude Code), con ciclo SDD completo (exploración, propuesta, specs, diseño, tareas, apply, verificación y archivo). Artefactos en OpenSpec, ritmo automático. Entrega en una sola PR con `size:exception`.

| Momento | Marca |
|---|---|
| Antes del change | Resolución de conflictos de las PRs apiladas #214 a #217 y merge de las cadenas de CH-37 a CH-39 y de la v2 a `master` (no cuenta para CH-40) |
| Decisiones de DEC-193 elegidas por el usuario | 2026-11-03, cerca de las 11:51 (registro de Engram) |
| Planificación completa en disco (propuesta, specs, diseño y 20 tareas) | 2026-11-03, cerca de las 11:57 (registro de Engram) |
| Artefactos SDD y DEC-193 | Commits `4b02897` y `4842ab3`, 12:02 |
| Apply (modelo, motor, rutas, planificador, consola y docs) | De 12:02 a 12:33. Commits `6526ab0` y `87d9f96` |
| Pausa: Docker Desktop apagado | Los tests con base esperaron a que el usuario lo encendiera |
| Suite con base y arreglo de dos tests del panel | Commit `c4df112`, 12:39 |
| Reporte de verificación | Commit `8bf598e`, 12:51 |
| PRs | #218 (DEC-193) y #219 (CH-40), abiertas a las 12:52 y mergeadas a las 12:57 |
| Archivo y specs principales | Commit `c3873a6`, 12:59; PR #220, mergeada a las 13:00 |

**Completar con el tiempo real percibido antes de citar este dato en la tesis**: las marcas acotan los commits y los registros del agente, no la conversación ni la revisión. Las dos marcas anteriores al primer commit salen de los registros de Engram y son aproximadas.

> Se escribe el 2026-11-03, apoyada en DEC-186, en DEC-193 y en los artefactos archivados en `openspec/changes/archive/2026-11-03-CH-40-minimo-de-filas/` (exploración, propuesta, diseño, tareas, reporte de verificación y reporte de archivo). No reconstruida de memoria.

---

## Qué se construyó

Hasta CH-40, la única condición fuera del SQL era «con cero filas no se envía» (DEC-84). DEC-186 (b) sumó un mínimo de filas por automatización, para avisar solo si el resultado alcanza una cantidad («al menos 5 productos bajo stock»), algo que la consulta no expresa sin cambiar las filas que llegan al mensaje.

- **Modelo:**
  - `Automatizacion.minimoFilas`, entero, 1 por defecto.
  - Una migración aditiva (`20261103000000_automatizacion_minimo_filas`) con `DEFAULT 1`, que llena las filas existentes. Sin relleno aparte, con el rollback en su encabezado.
  - `Ejecucion.notificacion` suma el valor `omitida-bajo-minimo`, sin migración: los valores permitidos viven en el código.
- **Motor** (`decidirNotificacion`, pura):
  - Una fila de precedencia nueva después de «cero filas» y antes de «sin destinatario»: con `0 < filas < minimoFilas` y sin corte por el tope, la ejecución cierra `ok` con `omitida-bajo-minimo` y no se envía nada.
  - Con el valor por defecto en 1 esa fila nunca se cumple, así que las automatizaciones existentes no cambian.
  - Un resultado cortado por el tope de filas (`hayMas`) cuenta como alcanzado (DEC-193).
  - `MINIMO_FILAS_POR_DEFECTO` es el único lugar del código que dice 1; un test lo compara con el valor por defecto de la base.
- **Rutas:**
  - `POST /automatizaciones` y `PUT /automatizaciones/:id/ajustes` aceptan `minimoFilas`: un entero desde 1 hasta el tope de filas. Fuera de eso, `400` con `/minimoFilas` en `campos`.
  - El esquema acepta `"5"` como 5, igual que `puerto` y `limite`. La regla de DEC-60 contra la conversión es para `valores`.
  - El tope llega a las rutas desde el `loadConfig()` de `src/server.ts` (`DependenciasRutas.topeFilas`), como la zona horaria. Así el alta y el planificador usan el mismo tope.
  - El ajuste del panel sigue rechazando `minimoFilas` (DEC-186).
- **Planificador:** lee `minimoFilas` de la automatización y lo pasa a la decisión.
- **Consola (C-09 y C-10):**
  - «Mínimo de filas para avisar» en el paso 2 del alta, con 1 por defecto, y en el ajuste, que lo envía solo si cambió.
  - La vista previa del correo dice «Se envía con: N filas o más».
  - Un `400` de `/minimoFilas` se explica dentro del pop-up.
  - La vista de ejecuciones muestra «No enviada: menos filas que el mínimo».
  - El campo no tiene `max`: el tope es configuración del servidor, y su `400` nombra el campo.
- **Docs:** `docs/guia/06-automatizaciones.md` (condición, alta, ajuste, etiqueta y límites), la entrada C-09 de `guidelines/consola.md` en las dos copias de la skill, y los números de PR de CH-37 a CH-40 en `docs/02-mapa-de-changes.md`.

## Decisiones tomadas

| Decisión | Qué fija |
|---|---|
| DEC-186 (b) | Un mínimo de filas en la automatización, 1 por defecto, evaluado por el motor después de la consulta y antes de notificar. Se valida entre 1 y el tope de filas, se carga en el alta de la consola y el panel no lo ajusta |
| DEC-193 | Los dos puntos que DEC-186 no resolvía: el ajuste de la consola y el resultado cortado por el tope |

Elecciones de DEC-193 (las dos recomendadas):

| Punto | Elección |
|---|---|
| Ajuste de la consola | (a) También edita `minimoFilas`, con la misma validación y en la misma fila. DEC-174 dice que el operador ajusta lo mismo que carga en el alta |
| Resultado cortado por el tope | (a) Cuenta como alcanzado, así bajar `MAX_FILAS_CONSULTA` nunca silencia una automatización |

- El usuario eligió las dos opciones recomendadas el 2026-11-03, en la exploración. En ese mismo punto eligió una sola PR, con la condición de frenar si el pronóstico pasaba de 400 líneas.
- DEC-193 se registró en su propia rama (`v2/dec-193`, #218) antes de escribir el código, como pide `AGENTS.md`.
- El diff real pasó el tope y el usuario eligió `size:exception` para una sola PR, frente a partirla en CH-40a (backend) y CH-40b (consola).
- Decisión del apply: el tope llega como parámetro de las rutas en lugar de leerse en cada petición. Se anotó en el diseño, la spec y la propuesta antes de abrir la PR.

## Fricciones encontradas

| # | Fricción | Causa | Resolución | Tiempo perdido |
|---|---|---|---|---|
| 1 | No se pudieron lanzar los sub-agentes de fase `sdd-*` | Un hook de Claude Code rechaza ese despacho, como en CH-37 a CH-39 | Todas las fases se hicieron en la conversación principal, sin delegar | no medido |
| 2 | La PR #214 tenía conflictos de merge | `ch37/textos-cliente` se reescribió después de que `ch38` salió de ella, y `ch38` arrastraba copias viejas de los commits de CH-36 y CH-37 | `rebase --onto` de cada rama de la cadena sobre su base real; el contenido final de `ch39b` quedó idéntico | no medido (antes de CH-40) |
| 3 | La cadena de decisiones de la v2 nunca llegó a `master` | Cada PR se mergeaba en la rama de abajo | Se apuntó la PR de arriba (#217) a `master`, que trajo toda la cadena. Se activó el borrado automático de ramas en GitHub y se borraron 228 ramas mergeadas | no medido (antes de CH-40) |
| 4 | El diseño leía el tope con `loadConfig()` en cada petición | `loadConfig()` también valida la clave maestra y exige `APP_PORT`, así que cada test puro de rutas habría tenido que simular el entorno | El tope llega como parámetro desde `server.ts`, como `zonaHoraria` | no medido |
| 5 | Casi todos los tests de la consola fallaron al sumar los campos | El DOM falso de `consola.test.ts` solo crea los ids de `IDS`, así que `getElementById` devolvía `null` | Se registraron los tres ids nuevos; quedaron 8 fallas, las de los cuerpos exactos, que se esperaban | no medido |
| 6 | El pronóstico fue de unas 345 líneas y el diff real, de unas 617 | Se subestimaron los tests: unas 400 líneas contra unas 200 | El usuario aceptó `size:exception` para una sola PR | no medido |
| 7 | Los tests con base no corrieron al terminar el apply | Docker Desktop estaba apagado | Se terminó primero la parte sin base; el usuario encendió Docker y la suite corrió completa | pausa no medida |
| 8 | Dos tests del panel fallaron en la primera corrida con base | Se sumó `minimoFilas` a la instantánea de la fila, y dos expectativas literales no lo tenían | Se agregó `minimoFilas: 1`, que además prueba que el ajuste del panel no lo toca (`c4df112`) | no medido |
| 9 | Dos tests del planificador fallaron al correr varios archivos juntos | `planificador.test.ts` y `aislamiento.test.ts` en un mismo proceso se pisan sobre la base de prueba | Por separado y en `test:db` pasan; no es una falla del change | no medido |
| 10 | Un `heredoc` con el script de la consola no llegó a ejecutarse | El shell no cerró las comillas del texto | El script se escribió en un archivo del directorio temporal y se ejecutó desde ahí | no medido |

## Límites del artefacto (aceptados)

| Límite | Origen | Notas |
|---|---|---|
| El panel no ve ni ajusta el mínimo | DEC-186 | Hasta que una historia lo pida |
| Sin condiciones sobre sumas, máximos ni combinaciones | DEC-186 | Una condición más rica se escribe en la consulta de la plantilla |
| Con corte por el tope, el mínimo es aproximado | DEC-193 | Si el tope bajó por debajo del mínimo, alcanza con llenar una página para avisar |
| El mínimo no se declara en la plantilla | DEC-186 (c) | El mismo aviso con distinto mínimo no exige otra plantilla |
| La consola no conoce el tope | Diseño | El campo no tiene `max`; el servidor valida y nombra el campo |
| El mínimo solo rige para el correo | Alcance | La vista previa es CH-42, que debe reutilizar `decidirNotificacion` |

**Rollback:** revertir #219 y luego quitar la columna con la sentencia del encabezado de la migración `20261103000000_automatizacion_minimo_filas`. No hay relleno de datos. Las ejecuciones ya cerradas con `omitida-bajo-minimo` quedan con ese texto, que la consola anterior muestra como el marcador de valor desconocido.

## Verificación

- `npx tsc --noEmit`: sin errores.
- `npx prisma validate`: el esquema es válido.
- `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db`: aplicó la migración nueva y dio 1641 de 1645. Las 4 fallas son los falsos positivos conocidos de `conexiones.test.ts` (5.1, 5.3, 5.4 y CH-07); esta rama no toca `src/conexiones`.
- Los tests de la consola: 359 pasan, 0 fallan, con la guardia G3' (sin clases `zd-*` en el script).
- La verificación cruzó los 9 requisitos y los 64 escenarios de las cuatro specs con sus tests y revisó las 20 tareas. Dio PASS con 3 sugerencias. El estado `pass-with-warnings` se debe solo a que la suite sale con código distinto de cero por las 4 fallas conocidas.
- Cobertura de escenarios: 62 cubiertos, 2 débiles y 0 sin cubrir. Los débiles son los del tope bajado: se prueban a nivel unidad y de registro de rutas, no en una corrida del planificador.
- La verificación se hizo en la misma sesión que el apply (el hook impide los sub-agentes de fase), así que no es independiente, y el reporte lo dice.

## Pendientes fuera de CH-40

- Las sugerencias del reporte:
  - Un test del planificador con el tope por debajo del mínimo, cuando el planificador pueda tomar el tope del test.
  - Un test del ajuste de la consola con un rechazo de `/minimoFilas`.
  - CH-42 debe reutilizar `decidirNotificacion` para el mínimo, así la regla de `hayMas` vive en un solo lugar.
- El próximo change de la v2 según el mapa: CH-41 (varios destinatarios).
