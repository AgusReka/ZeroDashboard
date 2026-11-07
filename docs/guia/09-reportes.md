# Reportes

Un reporte es una consulta escrita contra las vistas canónicas, como una plantilla, que en lugar de mandar un aviso se muestra en el tablero del cliente: un número, una tabla, un gráfico de barras o uno de línea (DEC-183). Declara a lo sumo un período, que el cliente elige entre los que permite P1, y asigna las columnas del resultado a los roles de su visualización, cada una con un título para el cliente (DEC-198). El catálogo es **global**: lo comparten todos los tenants. Pantalla: **Reportes**, en Global, después de Plantillas.

Este change (CH-45) define y prueba los reportes en la consola. Elegir qué reportes ve cada cliente es CH-46, y la pantalla del panel es CH-48: hasta entonces, ningún cliente ve un reporte.

## Camino rápido

1. **Reportes** → «Nuevo reporte».
2. Completar el nombre, el título para el cliente, las entidades, el SQL y, si hace falta, el período.
3. Elegir la visualización.
4. En «Probar antes de guardar», elegir una conexión del tenant activo y pulsar «Probar».
5. Con la prueba exitosa, elegir en cada fila la columna del resultado y escribir su título.
6. «Guardar».

## Escribir el SQL

El SQL lee las vistas `v_<entidad>` por su nombre, igual que una plantilla ([Plantillas](05-plantillas.md#cómo-se-ejecuta)). La aplicación compone `WITH v_<entidad> AS (<vista canónica>), … SELECT * FROM (<reporte>) AS _plantilla` con las vistas aprobadas de la conexión, y por eso el SQL de un reporte no corre suelto en **Consultas**.

- Se marcan las entidades que el reporte lee: al menos una. Antes de ejecutar, todas tienen que estar «Válida» en la conexión (DEC-71).
- El resultado tiene que traer las columnas que se van a asignar, con un nombre estable. Conviene ponerles alias: `SUM(i.cantidad) AS unidades`.
- El orden de las filas es el del SQL. Para barras y línea, ordenar por la etiqueta o por el valor con `ORDER BY`.

Ejemplo: las unidades vendidas por producto en el período elegido.

```sql
SELECT p.nombre AS producto, SUM(i.cantidad) AS unidades
FROM v_item_pedido i
JOIN v_pedido pe ON pe.id = i."pedidoId"
JOIN v_producto p ON p.id = i."productoId"
WHERE pe."fechaCreacion" >= :desde
GROUP BY p.nombre
ORDER BY unidades DESC
```

Lee `producto`, `pedido` e `item_pedido`. Los nombres de los campos son los del contrato canónico; los que tienen mayúsculas van entre comillas dobles, como en el mapeo ([Mapeo y validación](03-mapeo-y-validacion.md)). Revisarlos en **Contrato canónico**.

## El período

Un reporte tiene **cero o un** parámetro, y siempre es una fecha (DEC-198).

- **«Sin período».** El SQL no usa parámetros.
- **«Con período».** Se escribe el nombre del parámetro (`desde` por omisión) y los días, separados por comas: «30, 7». El primero es el predeterminado: el que el cliente ve primero.
  - De 1 a 6 valores distintos, cada uno de 1 a 366.
  - El nombre sigue la regla de los parámetros de Consultas: empieza con una letra o un guion bajo y sigue con letras, dígitos o guiones bajos.
  - El SQL tiene que usar ese parámetro, con `:desde`, y no puede usar otro. Si no lo usa, se rechaza con «está declarado pero la sentencia no lo usa».

La fecha la calcula la aplicación: el día de hoy en la zona horaria del despliegue (DEC-77) menos los días elegidos, como `AAAA-MM-DD`. Llega a la consulta como parámetro del driver, nunca como texto del SQL. Nadie escribe una fecha: el cliente, y también la prueba de la consola, eligen uno de los días declarados.

## Las columnas por rol

Cada visualización espera ciertas columnas. P1 asigna una columna del resultado a cada rol y le da un título para el cliente.

| Visualización | Roles, en orden | Tope de filas |
|---|---|---|
| Número | Valor | 1 |
| Barras | Etiqueta, Valor | 20 |
| Tabla | Columna 1 a Columna 10 | 50 |
| Línea | Etiqueta, Valor | 100 |

- **Una columna no se asigna dos veces.**
- **Tabla.** Lleva de 1 a 10 columnas, en el orden en que se muestran. «Agregar columna» suma una fila y «Quitar» saca una.
- **Títulos.** De 1 a 40 caracteres, sin espacios en los bordes. Pasan por el glosario del panel: no admiten `tenant`, `cron`, `sql`, `consulta`, `query`, `ejecución`, `réplica`, `parámetro`, `timeout` ni `plantilla`, sin distinguir mayúsculas.
- **Cambiar de visualización** conserva las filas cuyo rol sigue existiendo (de barras a línea, las dos; de barras a número, el valor) y deja vacías las demás.
- **Solo esas columnas llegan al cliente.** El resto del resultado no sale de la aplicación (regla 5).

### Topes

El tope de la tabla es el de su visualización. Si `maxFilasPorConsulta` del despliegue es menor, rige el menor (DEC-198). Cuando el tope corta el resultado, la prueba lo avisa: «El resultado se cortó en el tope de 20 filas de esta visualización.».

Otros topes: nombre hasta 80 caracteres (solo lo ve la consola), título para el cliente hasta 80 y descripción hasta 200 (opcional).

## Probar y guardar

El pop-up trae «Probar antes de guardar»: una conexión del tenant activo, un período entre los días escritos y «Probar». Envía `POST /reportes/prueba` y muestra **todas** las columnas y filas del resultado, la cantidad de filas y la fecha usada («Desde el 31/10/2026»). No guarda nada.

1. **Las columnas salen de la prueba.** Antes de una prueba exitosa, los selects de columna están vacíos y el pop-up dice «Probá el reporte para elegir sus columnas». Después, ofrecen las columnas de esa prueba. Una columna asignada que la prueba ya no trae vuelve a quedar vacía.
2. **«Guardar» se habilita solo con una prueba exitosa de lo mismo que se guarda.** La huella es el SQL, el período, las entidades y la conexión. Cambiar el nombre, los textos, la visualización o las columnas no obliga a probar de nuevo. Mientras está cerrado, el pop-up dice por qué: no hay prueba, la última falló o el reporte cambió desde la última prueba.
3. **«Guardar»** envía `POST /reportes` (nuevo) o `PUT /reportes/:id` («Editar»), con las columnas asignadas y `columnasPrueba`, las columnas de esa prueba. Un `400` nombra los campos («Revisá estos campos»), los términos del glosario y las columnas que no están en la prueba. Al guardar con éxito, el pop-up se cierra, la lista se recarga y el panel lateral muestra el reporte.
4. **Sin tenant activo** el pop-up abre, pero la prueba dice «Elegí un tenant para probar el reporte.» y «Guardar» queda cerrado. Cancelar y Escape preguntan antes de descartar cambios; cambiar de tenant cierra el pop-up.

### Probar en el tenant activo

El panel lateral de «Ver» muestra el reporte guardado como texto: entidades, período, SQL, textos para el cliente, visualización y columnas asignadas con su rol y título. Trae «Editar» y un bloque «Probar en el tenant activo»: conexión, período («Últimos 30 días», arranca en el predeterminado; no aparece sin período) y «Probar».

- Muestra **solo las columnas asignadas**, en su orden y con su título: lo más parecido a lo que va a ver el cliente. Debajo, las filas, la fecha usada y el corte, si hubo.
- Si el resultado ya no trae una columna asignada, por ejemplo porque se renombró en la réplica de ese tenant, el bloque nombra la columna que falta y no muestra la tabla. Es el estado de error del reporte (DEC-184): el reporte puede romperse para un solo tenant.
- Otro reporte, cerrar el panel o cambiar de tenant limpian el resultado.

Las dos pruebas quedan en **Auditoría** con origen «Prueba de reporte». La de un reporte guardado dice «Reporte <id>» en la columna Consulta; la del pop-up, «Ad hoc». La fila guarda la sentencia compuesta, sin la fecha.

## Las rutas

Con sesión de operador. Las del catálogo no piden `X-Tenant-Id`; las de prueba sí, porque usan una conexión de un tenant.

| Ruta | Qué hace |
|---|---|
| `GET /reportes` | Lista `id`, `nombre`, `titulo` y `visualizacion`, por nombre, con `truncado` |
| `GET /reportes/:id` | El reporte completo, o `404 reporte-no-encontrado` |
| `POST /reportes` | Crea (`201`) |
| `PUT /reportes/:id` | Reemplaza en el lugar (`200`), sin versiones (DEC-68) |
| `POST /reportes/prueba` | Prueba un reporte sin guardar: el cuerpo de `POST /reportes` sin `columnas`, más `conexionId` y `dias` |
| `POST /reportes/:id/prueba` | Prueba uno guardado: `conexionId` y, opcional, `dias` |

El cuerpo de `POST` y `PUT` lleva `nombre`, `titulo`, `descripcion` (opcional), `sql`, `entidades`, `visualizacion`, `columnas` (`rol`, `columna`, `titulo`), `periodo` (`{ parametro, dias }` o `null`) y `columnasPrueba`. `columnasPrueba` no se guarda ni se devuelve.

Los rechazos son `400 solicitud-invalida` y no escriben nada. Se aplican en este orden y gana el primero que falla:

| Paso | Rechazo | `campos` | Extra |
|---|---|---|---|
| 1 | Forma del cuerpo | el campo | |
| 2 | Nombre, título o descripción fuera de tope, o término del glosario | `/nombre`, `/titulo`, `/descripcion` | `terminos` |
| 3 | Período inválido | `/periodo/parametro`, `/periodo/dias` | |
| 4 | Roles que no son los del tipo, columna repetida, o título de columna inválido | `/columnas`, o `/columnas/<i>/titulo` | `terminos` |
| 5 | Sin `columnasPrueba`, o una columna asignada fuera de ella | `/columnasPrueba`, o `/columnas` | `faltantes` |
| 6 | SQL vacío | `/sql` | |
| 7 | Parámetros del SQL frente al período | el campo | `problemas` |

La prueba sin guardar no pide `columnasPrueba` (salta el paso 5) y salta el paso 4 cuando no trae columnas: la consola la envía sin columnas, porque es la que las produce. Las dos pruebas rechazan un `dias` que el reporte no declara, o uno en un reporte sin período, con `400` y `/dias`, sin conectar. Después aplican las compuertas de la prueba de plantilla: conexión del tenant (`404`), vistas aprobadas (`409 vista-canonica-no-aprobada`, con las entidades) y credencial legible (`409 credencial-ilegible`). Un `200` trae el resultado, `periodo` (`{ dias, desde }`, o `null` sin período) y, si el resultado es `ok`, `faltantes`.

## Límites

- **Límite.** Nada impide que el SQL de un reporte lea una tabla real de la réplica en lugar de una vista `v_*`: no hay analizador de SQL (DEC-09), como en las plantillas. P1 escribe el SQL, y al cliente solo llegan las columnas asignadas.
- **Límite.** Al guardar, la aplicación no ejecuta nada: comprueba las columnas asignadas contra las que le envía la consola. El error real aparece al ejecutar, en la prueba o en el tablero (DEC-198).
- **Límite.** Un período es siempre «los últimos N días»: no hay rango libre, ni mes calendario, ni un segundo parámetro.
- **Límite.** Con datos diarios, una línea de más de 100 días queda cortada.
- **Límite.** No existe un borrado de reportes (DEC-68). Qué pasa con un reporte que ya está en un tablero se decide en CH-46.
- **Límite.** La prueba de la consola muestra el resultado como tabla, sea cual sea la visualización. El gráfico llega con CH-47 y CH-48.

## Siguiente paso

[Diagnóstico](08-diagnostico.md), si una prueba falla.
