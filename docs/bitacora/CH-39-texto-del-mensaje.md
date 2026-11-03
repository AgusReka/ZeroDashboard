# Bitácora — CH-39: Texto del mensaje

**Fecha de inicio:** 2026-10-27 (exploración y decisiones de DEC-192)
**Fecha de cierre:** pendiente (falta mergear #214, #215, #216 y #217; #217 va después de #213)
**Tiempo invertido:** sesión asistida por agente (Claude Code), con ciclo SDD completo (exploración, propuesta, specs, diseño, tareas, apply, verificación y archivo). Artefactos en OpenSpec, ritmo automático. Entrega en dos PRs apilados (CH-39a, backend, y CH-39b, consola).

| Momento | Marca |
|---|---|
| Inicio de la exploración | 2026-10-27, 21:36 |
| Mapeo del código para la exploración | 2,8 min de agente |
| Decisiones de DEC-192 elegidas por el usuario | 2026-10-27, 21:44 |
| Planificación completa en disco (propuesta, specs, diseño y 19 tareas) | 2026-10-27, 21:57, unos 21 min desde el inicio |
| Validación del diseño con contexto limpio | 1,8 min de agente |
| Primeras tareas de CH-39a (modelo, módulo de marcadores, parte de la semilla) | 2026-10-27, 22:43 a 22:44, hasta el tope de uso de la sesión |
| Pausa por el tope de uso | De 2026-10-27, 22:44 a 2026-10-29, 16:04 |
| Resto de CH-39a (código, tests y guía) | 10,8 min de agente, en un escritor delegado |
| Artefactos SDD y código de CH-39a | Commits `40a33ec` y `6b00a8d`, 16:37 |
| CH-39b (consola, 4 tareas) | 5,3 min de agente, en un escritor delegado. Commit `c24ede3`, 16:44 |
| Verificación independiente | 3,5 min de agente |
| Confirmación de las dos reglas del diseño | 2026-10-29, 16:49 |
| Archivo y specs principales | 3,2 min de agente. Commit `b645341`, 16:55 |
| DEC-192 | Commit `f584b5a`, 16:55; PR #217 |
| PRs | #215 (CH-39a), #216 (CH-39b) y #217 (DEC-192), abiertos el 2026-10-29 |

**Completar con el tiempo real percibido antes de citar este dato en la tesis**: las marcas acotan los commits y las corridas del agente, no la conversación ni la revisión. La pausa del 27 al 29 de octubre fue un tope de uso de la sesión, no trabajo.

> Se escribe el 2026-11-03, apoyada en DEC-188, en DEC-192 y en los artefactos archivados en `openspec/changes/archive/2026-10-29-CH-39-texto-del-mensaje/` (exploración, propuesta, diseño, tareas, reporte de verificación y reporte de archivo). No reconstruida de memoria.

---

## Qué se construyó

Hasta CH-39, el correo mostraba siempre una tabla con todas las columnas del resultado. DEC-188 (b) decidió que la plantilla pueda declarar un encabezado y una línea por fila con marcadores `{columna}` («Harina 000: quedan 3 unidades»). Sin esos textos, el correo sigue igual.

- **Modelo:**
  - `Plantilla.encabezadoMensaje` y `Plantilla.lineaMensaje`, opcionales.
  - `Ejecucion.mensajeRespaldo`, un arreglo JSON con nombres de columna, nunca valores.
  - Una migración aditiva (`20261028000000_mensaje_plantilla`), sin relleno y con el rollback en su encabezado. Las plantillas sembradas declaran los dos textos en `null`.
- **Marcadores:**
  - Un módulo puro, `src/plantillas/marcadores-mensaje.ts`, compartido por la validación al guardar y por el correo.
  - Un marcador es `{`, uno o más caracteres que no sean llaves, y `}`. El nombre es exacto: sin recortar y distinguiendo mayúsculas. Cualquier otra llave es texto.
- **Al guardar** (`POST /plantillas` y `PUT /plantillas/:id`), seis comprobaciones en orden, con `400 solicitud-invalida` y el campo en `campos`:
  1. Los dos textos o ninguno.
  2. Los largos: encabezado hasta 200 caracteres y línea hasta 300.
  3. El encabezado no lleva marcadores.
  4. La línea lleva al menos un marcador.
  5. El glosario del panel (DEC-137), sobre el texto sin los marcadores.
  6. Con textos, `columnasPrueba` es obligatorio y todo marcador de la línea tiene que estar ahí. Los que faltan van en `marcadores`.
- **Prueba antes de guardar:** `POST /plantillas/prueba` aplica las mismas comprobaciones menos la 6, porque la prueba es la que produce las columnas.
- **`columnasPrueba`:** es solo un dato de entrada de la comprobación. Nunca se guarda ni se devuelve.
- **Correo:**
  - Con los dos textos y todas las columnas presentes, el cuerpo es el encabezado y una línea por fila. Cada valor se escapa por separado, nunca la línea entera.
  - La parte de texto plano lleva el encabezado y las líneas, con los saltos de línea de los valores quitados.
  - El asunto, los temas, el tope de filas con su aviso, el aviso de celdas vacías y el pie no cambian.
  - Si falta una columna, el correo usa la tabla. Una función pura, `respaldoDe`, decide el respaldo para el correo y para el planificador, así que lo enviado y lo registrado no pueden diferir.
- **Registro de la ejecución:** `mensajeRespaldo` guarda los nombres que faltaron, incluso si el envío falla después. El resultado del envío (`notificacion`) sigue siendo uno solo. El listado de ejecuciones lo devuelve.
- **Consola (C-03):**
  - Dos campos en el pop-up de plantillas: «Encabezado del mensaje» y «Línea por fila», con su tope visible y una ayuda sobre `{columna}`. Quedan fuera de la huella de la prueba: editarlos no obliga a probar de nuevo.
  - «Guardar» manda `columnasPrueba` con las columnas de la última prueba aprobada.
  - Un `400` por una columna desconocida nombra el campo y las columnas.
  - «Duplicar y editar» copia los dos textos.
  - El panel lateral muestra los textos, o dice que el correo muestra la tabla.
  - La vista de ejecuciones muestra el respaldo dentro de la celda de la notificación.
- **Docs:** la sección «Texto del mensaje (CH-39)» de `docs/guia/05-plantillas.md`, con un ejemplo de `stock-fisico`, y la entrada C-03 de `guidelines/consola.md`, en las dos copias de la skill.

## Decisiones tomadas

| Decisión | Qué fija |
|---|---|
| DEC-188 (b) | Dos textos opcionales en la plantilla, con marcadores `{columna}`. Sin ellos, el correo es la tabla. Un marcador fuera de la última prueba se rechaza al guardar, y una columna ausente en la ejecución cae a la tabla |
| DEC-192 | Los cinco puntos que DEC-188 no resolvía: de dónde salen las columnas de la prueba, cómo registra el respaldo la ejecución, un texto sin el otro, glosario y largos, y qué copia «Duplicar y editar». Con dos precisiones del diseño |

Elecciones de DEC-192 (todas las recomendadas):

| Punto | Elección |
|---|---|
| Columnas de la última prueba | (a) El cuerpo del guardado trae `columnasPrueba`, y no se guarda |
| Registro del respaldo | (a) Columna nueva `Ejecucion.mensajeRespaldo` con los nombres que faltaron |
| Un texto sin el otro | (a) Los dos o ninguno |
| Glosario y largos | (a) Glosario sobre el texto sin los marcadores; encabezado hasta 200 y línea hasta 300 |
| «Duplicar y editar» | (a) Copia los textos del mensaje |

- El usuario eligió las opciones recomendadas en los cinco puntos el 2026-10-27, en la exploración. En ese mismo punto eligió entregar en dos PRs apilados (6(b)).
- Dos reglas del diseño no estaban en DEC-188: el encabezado es fijo (no lleva marcadores) y la línea lleva al menos un marcador. El usuario las confirmó el 2026-10-29, después de la verificación.
- El pronóstico de tamaño de CH-39a superaba el tope de 400 líneas. El usuario eligió `size:exception` para CH-39a (opción (a)) frente a una tercera PR (CH-39a2), el 2026-10-27.
- Decisiones del escritor de CH-39b, que la verificación juzgó aceptables:
  - El respaldo va dentro de la celda «Notificación», no en una columna nueva, para conservar las 8 celdas por fila que fija CH-17b.
  - La redacción es «falta la columna x» o «faltan las columnas a, b», y «Iba a enviarse la tabla» cuando el envío falló.
  - El `400` por un marcador en el encabezado dice «El encabezado no admite columnas».
  - La ayuda usa `class="ayuda"`, como los campos vecinos. El diseño nombraba otra clase y se corrigió antes de archivar.

## Fricciones encontradas

| # | Fricción | Causa | Resolución | Tiempo perdido |
|---|---|---|---|---|
| 1 | No se pudieron lanzar los sub-agentes de fase `sdd-*` | Un hook de Claude Code rechaza ese despacho, como en CH-37 y CH-38 | Las fases se hicieron en la conversación principal. El mapeo, la validación del diseño, la escritura, la verificación y el archivo se delegaron a agentes genéricos | no medido |
| 2 | DEC-188 y la fila de CH-39 no estaban en la rama de trabajo | Las decisiones de la v2 siguen en PRs sin mergear | Se leyeron con `git show` desde cada rama. DEC-192 se escribió en un worktree aparte, en su propia rama (#217) | no medido |
| 3 | La validación del diseño con contexto limpio dio PASS con 3 advertencias | El diseño decía que la semilla no pasaba por la validación, pero sí pasa por `rechazoDeEntrada`; la propuesta y el diseño no coincidían en cómo informa el correo el respaldo; el reparto en PRs se leía distinto en cada documento | Se corrigieron las tres antes de dar por cerrada la planificación | 1,8 min de agente más la corrección |
| 4 | El pronóstico de CH-39a fue de unas 460 líneas y el diff real, de unas 907 netas | Se subestimaron los tests (el pronóstico era de unas 200 líneas) | La PR #215 va con `size:exception`. La PR completa mide unas 1780 líneas: unas 675 de tests, unas 760 de archivos SDD y unas 320 de código. CH-39b midió unas 360 líneas contra un pronóstico de unas 235, dentro del tope | no medido |
| 5 | El apply se cortó a la mitad por el tope de uso de la sesión | La sesión llegó al límite el 2026-10-27, a las 22:44, con 1.1, 1.2, 2.1, 2.2 y parte de 1.3 hechas | Se retomó el 2026-10-29, a las 16:04, con un escritor delegado para las tareas restantes | Pausa de unas 41 h de calendario |
| 6 | El registro de intentos de SDD pidió declarar los archivos sin seguir | Hay archivos ajenos en la raíz (`0`, un acento grave, `tolerancia`) y el zip de diseño | Se excluyeron del intento y de los commits | no medido |
| 7 | Los tests con base no corrieron al terminar CH-39a | Docker Desktop estaba apagado: `test:db` falló con `ECONNREFUSED` en el puerto 5434 | El escritor entregó `partial`, con los casos de base sin verificar. El usuario encendió Docker y la suite dio 1608 de 1612 | no medido |
| 8 | El registro de intentos no cerró como aprobado | El intento de CH-39a se abrió con un tope de 500 líneas y el cambio real fue de 907 | El usuario aprobó el reinicio del intento (`gentle-ai sdd-attempt reset`) y quedó como aprobado | no medido |
| 9 | Un test fuera de la lista de tareas falló | `src/aislamiento/aislamiento.test.ts` lista todas las columnas de `Plantilla` y no conocía las dos nuevas | El escritor las sumó a la lista | no medido |
| 10 | El reporte de verificación no avanzó el estado de SDD | El estado rechaza el campo `warnings` del encabezado del reporte, como pasaba con el de CH-38 | Se dejó como está: quitarlo cambiaría el reporte al que apunta el intento cerrado | no medido |
| 11 | El reporte de verificación contaba 20 tareas y son 19 | Error de conteo del reporte | El archivador lo marcó y se corrigió | no medido |
| 12 | El commit de DEC-192 cayó en `v2/dec-191`, la rama de la PR #213 | `git worktree add -b v2/dec-192` no creó la rama nueva y se confirmó sin comprobar la rama | Antes del push, se creó `v2/dec-192` en ese commit y se devolvió `v2/dec-191` a `0c7cdf4`, donde seguía en el remoto. La PR #213 no se afectó | no medido |
| 13 | La línea de numeración del mapa seguía nombrando DEC-192 como la próxima decisión | El mapa lo fijó la PR #213 antes de escribir DEC-192 | Se enmendó el commit de DEC-192, aún sin push (`f584b5a`), para que diga DEC-193 | no medido |

## Límites del artefacto (aceptados)

| Límite | Origen | Notas |
|---|---|---|
| `columnasPrueba` viene del cliente | DEC-192 | Quien llame a la API puede mandar una lista equivocada. Es una comprobación de coherencia: la garantía es el respaldo a la tabla en la ejecución |
| Un solo texto no forma un mensaje | DEC-192 | Los dos o ninguno. Aceptar un texto solo se puede sumar después, sin migración |
| El encabezado no lleva datos de la ejecución | DEC-192 | Por ejemplo, la cantidad de filas. Queda para más adelante, como un nombre reservado |
| Sin formatos por columna, condiciones ni bucles | DEC-188 | El formato se resuelve en la consulta SQL |
| El nombre de un marcador es exacto | DEC-192 | Cuentan las mayúsculas y los espacios |
| Las plantillas sembradas y las ejecuciones anteriores no tienen textos | Migración aditiva | Las plantillas conservan la tabla y las ejecuciones previas leen `mensajeRespaldo` en `null` |
| El mensaje solo existe para el correo | Alcance | La vista previa es CH-42 y Telegram es CH-44, que reutilizan el módulo de marcadores y `respaldoDe` |
| El respaldo se ve dentro de la celda «Notificación» | Verificación | No hay una columna nueva, para no romper las 8 celdas de CH-17b |
| Un salto de línea en el texto literal de la línea o del encabezado llega a la parte de texto plano | Verificación (S3) | La línea de una fila puede ocupar varias líneas. Inofensivo, y la spec solo exige quitar CR y LF de los valores |

**Rollback:** revertir #216 y #215, en ese orden, y luego quitar las tres columnas con las sentencias del encabezado de la migración `20261028000000_mensaje_plantilla`. No hay relleno de datos.

## Verificación

- `npx tsc --noEmit`: sin errores.
- `npx prisma validate`: el esquema es válido.
- `TEST_DB_PORT=5434 TEST_DB_PASSWORD=postgres npm run test:db`: 1619 de 1623. Las 4 fallas son los falsos positivos conocidos de `conexiones.test.ts` (5.1, 5.3, 5.4 y CH-07). Contra CH-38 (1560 de 1564) hay 59 tests más, y fallan los mismos 4.
- Los tests de la consola, repetidos por el orquestador al terminar CH-39b: 353 pasan, 0 fallan.
- La verificación independiente cruzó las 12 exigencias y los 37 escenarios de las cinco specs con sus tests, y revisó las 19 tareas y el diseño. Dio PASS, sin críticos ni advertencias, con 6 sugerencias. El estado `pass-with-warnings` se debe solo a que la suite sale con código distinto de cero por las 4 fallas conocidas.
- Cobertura de escenarios: 36 cubiertos, 1 débil y 0 sin cubrir. El débil es «el cuerpo excluye los internos», que se cumple por construcción pero no tiene un test con los textos.
- Los tests existentes del correo, de Mailpit y de la vista previa de la consola pasaron sin editarse.

## Pendientes fuera de CH-39

- Las sugerencias del reporte:
  - S1: un test de que el cuerpo excluye los internos, con textos del mensaje.
  - S2: una aserción de que la redacción del respaldo no lleva acento grave.
  - S3: decidir qué pasa con los saltos de línea en el texto literal.
  - S5: un caso con `encabezadoMensaje: null` en el cuerpo.
  - S6: una línea en blanco de más en `consola.test.ts`.
- Mergear la cadena: #214 (CH-38), después #215 y #216, y #217 (DEC-192) después de #213.
- CH-42 (vista previa del mensaje) y CH-44 (Telegram), que reutilizan `marcadores-mensaje.ts` y `respaldoDe`.
