# Consultas

La pantalla **Consultas** ejecuta SQL de solo lectura contra la réplica de un tenant y permite guardarlo, con parámetros y versiones. Es la herramienta de exploración del operador; no alimenta automatizaciones (ver la diferencia con una plantilla al final).

## Camino rápido

1. Elegir un tenant en la barra superior.
2. **Consultas** → «Nueva consulta».
3. Completar «Conexión» y «Sentencia SQL», y pulsar «Probar».
4. Si la prueba salió bien, escribir «Nombre» y pulsar «Guardar consulta».

## Ejecutar una consulta

El pop-up de «Nueva consulta» tiene todos los campos del registro:

| Campo | Notas |
|---|---|
| Nombre, Descripción (opcional) | El nombre se pide para guardar; ninguno de los dos hace falta para probar. |
| Conexión | Lista de las conexiones del tenant activo (nombre más un fragmento del id). Si no hay, enlaza a **Conexiones**. |
| Sentencia SQL | Una sola sentencia por ejecución. Un `;` final se ignora. |
| Parámetros | «Agregar parámetro» declara un `:nombre` con su tipo y su valor. |
| Filas por página | 50 por defecto. |

«Probar» ejecuta la sentencia y muestra la tabla, con «Página anterior» y «Página siguiente». La línea de estado dice cuántas filas se ven y cuánto tardó.

**Reglas de ejecución**

- La sentencia corre en una transacción de solo lectura, y solo si el rol de la conexión no puede escribir (DEC-08, DEC-09).
- Tope de filas del despliegue: 200 por defecto (`MAX_FILAS_CONSULTA`). Si las filas por página piden más que el tope y hay más resultados, se corta, se avisa «Resultado cortado en el tope configurado de N filas» y no hay página siguiente (DEC-18, DEC-19).
- Tiempo máximo: 15 000 ms por defecto (`QUERY_TIMEOUT_MS`).
- Ambos valores salen del entorno de la aplicación; `docker-compose.yml` no los reenvía, así que con Compose rigen los predeterminados (ver el [`README.md`](../../README.md)).
- Los resultados **no se guardan**: ni en la base ni en el registro de auditoría (DEC-93).

## Parámetros

Se escriben en el SQL como `:nombre` y se declaran con un tipo; el valor viaja como parámetro del driver, nunca dentro del texto (DEC-47, regla 4).

| Tipo | Valor aceptado |
|---|---|
| `texto` | Cualquier texto. |
| `numero` | Un número. |
| `booleano` | `true` o `false`. |
| `fecha` | `AAAA-MM-DD`, opcionalmente con hora. |

Un valor vacío no se envía y la consola responde que falta. Un `$1` escrito a mano se rechaza. Una consulta guardada conserva la declaración (nombres y tipos), **no los valores** (DEC-48). Los motivos de rechazo están en [Diagnóstico](08-diagnostico.md).

## Guardar

«Guardar consulta» y «Guardar como versión N» **solo se habilitan** si la última prueba de exactamente esta conexión, esta sentencia y esta declaración de parámetros salió bien, y si hay un nombre. Si se cambia la conexión, la sentencia o la declaración de parámetros, hay que probar de nuevo; el texto bajo el botón dice por qué está cerrado. Cambiar la descripción, la nota o los valores no obliga a probar otra vez.

- Consulta nueva: «Guardar consulta». Los nombres repetidos están permitidos.
- Consulta abierta con «Abrir»: solo se ofrece «Guardar como versión N», con «Nota de la versión (opcional)» de hasta 500 caracteres. Para guardar el contenido como otra consulta hay que empezar con «Nueva consulta» (DEC-172).
- Si no cambió nada respecto de la versión vigente, el servidor responde «No hay cambios respecto de la versión vigente.» (`sin-cambios`).

## Consultas guardadas y versiones

La lista muestra las 200 más recientes con «Abrir» y «Versiones». El panel de versiones permite:

| Acción | Efecto |
|---|---|
| «Comparar con la actual» | Muestra la versión elegida y la vigente lado a lado, como texto (DEC-149). |
| «Restaurar» → «Restaurar versión N» | Crea una versión nueva con el contenido de la elegida, con nota opcional. No borra nada (DEC-147). |

**Límite.** Una consulta guardada no se puede borrar ni atar a una conexión. Si se ejecuta contra una conexión con otro esquema, puede fallar o devolver datos sin sentido, y no se valida la compatibilidad (DEC-11).

## Plantilla y consulta guardada

| | Plantilla | Consulta guardada |
|---|---|---|
| Alcance | Global, de todos los tenants (DEC-61) | De un tenant |
| SQL | Escrito contra las vistas canónicas `v_<entidad>` | SQL crudo sobre las tablas de la réplica |
| Conexión | Se elige al probarla o al crear la automatización | Se elige al ejecutar (DEC-11) |
| Para qué sirve | Fuente de una automatización | Explorar y reutilizar consultas |
| Edición en la consola | Solo lectura | Se edita y versiona |

Una automatización siempre parte de una plantilla, nunca de una consulta guardada. El SQL de una plantilla no corre suelto en el editor: depende de las vistas `v_*`, que no existen en la réplica. Para ver qué devuelve sobre un tenant, usar «Probar en el tenant activo» ([Plantillas](05-plantillas.md)).

**Límite.** No hay forma de partir de una plantilla para escribir una consulta propia (DEC-177).

## Registro

Cada «Probar» queda en **Auditoría** con la sentencia ejecutada, la conexión y el operador, nunca los valores ni las filas ([Usuarios y permisos](07-usuarios-y-permisos.md)).

## Siguiente paso

[Plantillas](05-plantillas.md).
