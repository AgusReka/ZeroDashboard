# Plantillas

Una plantilla es una automatización reutilizable del catálogo: un SQL escrito contra las vistas canónicas, los parámetros que declara y las entidades que necesita. El catálogo es **global** (DEC-61): lo comparten todos los tenants. Desde CH-38 la consola también crea, edita y duplica plantillas (DEC-191). Pantalla: **Plantillas**, en Global.

## Camino rápido

1. **Plantillas** → «Ver» en la fila de una plantilla.
2. Revisar «Necesita:» y «Parámetros:».
3. En «Probar en el tenant activo», elegir una conexión, completar los parámetros y pulsar «Probar».
4. Si el resultado es el esperado, crear la automatización ([Automatizaciones](06-automatizaciones.md)).

Para crear o cambiar una plantilla: «Nueva plantilla», o «Ver» y después «Editar» o «Duplicar y editar» (ver [Crear, editar y duplicar](#crear-editar-y-duplicar-una-plantilla-ch-38)).

## El catálogo inicial

Al arrancar, la aplicación crea las plantillas que falten, sin tocar las existentes (DEC-125). Hoy son dos:

| Nombre | Automatización | Necesita | Parámetro | Tolera |
|---|---|---|---|---|
| Alerta de stock físico | `stock-fisico` | `producto`, `receta_componente` | `umbral` (numero) | 1 h |
| Alerta de stock producible | `stock-producible` | `producto`, `insumo`, `receta_componente` | `umbral` (numero) | 2 h |

El formato de entrega es `correo-html`. «Tolera» es la antigüedad de datos que la plantilla admite; se compara con la ventana declarada en [Frescura de datos](06-automatizaciones.md#frescura-de-datos). Las tolerancias iniciales son provisorias (DEC-128).

## Qué muestra la pantalla

- La tabla: «Nombre», «Automatización», «Formato», «Tolera». En el encabezado, la acción principal: «Nueva plantilla».
- El panel de «Ver»: el SQL de la plantilla como texto, las entidades que necesita, sus parámetros y los textos para el cliente (o «Sin textos para el cliente: no aparece en el panel»). Según el uso de la plantilla ofrece «Editar» o «Duplicar y editar», nunca las dos.

## Crear, editar y duplicar una plantilla (CH-38)

Las tres acciones abren el mismo pop-up (DEC-173, DEC-191): nombre, sentencia SQL, parámetros (el mismo editor y las mismas reglas que en Consultas), entidades (una casilla por entidad del contrato), automatización, formato, tolerancia de frescura en minutos y los dos textos para el cliente.

1. **Probar antes de guardar.** El pop-up trae su propio bloque de prueba: una conexión del tenant activo, un valor por parámetro declarado y «Probar». Envía `POST /plantillas/prueba` y muestra la respuesta como el panel de «Ver». No guarda nada.
2. **«Guardar» se habilita solo con una prueba exitosa de lo mismo que se guarda.** Cuenta la huella de la prueba: el SQL, la declaración de parámetros, las entidades y la conexión. Cambiar cualquiera de esos cuatro la invalida («Cambió la plantilla desde la última prueba»). Cambiar el nombre, la automatización, el formato, la tolerancia o los textos para el cliente no obliga a probar de nuevo. Mientras está cerrado, el pop-up dice por qué.
3. **«Guardar»** envía `POST /plantillas` (nueva o copia) o `PUT /plantillas/:id` (edición), siempre con los dos textos. Un `400` nombra los campos («Revisá estos campos») y, si corresponde, los términos del glosario. Al guardar con éxito, el pop-up se cierra, la lista se recarga y el panel muestra la plantilla guardada.
4. **Sin tenant activo** el pop-up abre, pero el bloque de prueba dice «Elegí un tenant para probar la plantilla» y «Guardar» queda cerrado. Cancelar y Escape preguntan antes de descartar cambios; cambiar de tenant cierra el pop-up.

### Una plantilla en uso se duplica, no se edita

Una plantilla está **en uso** cuando al menos una automatización **activa**, de cualquier tenant, la referencia (DEC-182, DEC-191). Las desactivadas no cuentan.

- El panel de «Ver» muestra «Editar» si no está en uso, y «Duplicar y editar» con el aviso «Tiene automatizaciones activas: se duplica en lugar de editarse» si lo está.
- `PUT /plantillas/:id` sobre una plantilla en uso responde `409 plantilla-en-uso` y no escribe nada. Primero se valida el cuerpo (un cuerpo inválido sigue siendo `400`) y un id desconocido sigue siendo `404`. La comprobación y la escritura son atómicas: ninguna automatización puede crearse sobre la plantilla entre una y otra.
- Si la plantilla pasó a estar en uso mientras se editaba, el pop-up muestra el aviso y ofrece «Duplicar y editar», que lo convierte en una copia con lo que hay en el formulario.
- **«Duplicar y editar»** abre el pop-up con el nombre del original más « (copia)», su SQL, parámetros, entidades, automatización, formato y tolerancia, y **sin** títulos ni descripciones. Avisa que la copia no aparece en el panel del cliente hasta que tenga los suyos. No se escribe nada hasta «Guardar».
- `GET /plantillas/:id` incluye `enUso` (booleano). También lo llevan el `201` de `POST` y el `200` de `PUT` (siempre `false`). Nunca se informa cuántas automatizaciones la usan ni de qué tenant. El listado `GET /plantillas` no lo trae.

> **Demo.** La plantilla `stock-fisico` del catálogo inicial está en uso: la semilla de la demo (`SEED_DEMO=1`) crea una automatización activa sobre ella. Para cambiarla hay que duplicarla.

## Probar en el tenant activo (CH-35)

Permite ver qué devuelve la plantilla sobre el mapeo de un tenant antes de crear una automatización (DEC-177).

1. Elegir una conexión del tenant activo. Al cambiar de tenant, el resultado se descarta.
2. Completar un campo por parámetro declarado.
3. «Probar». Se muestra la primera página; si hay más, el aviso lo dice.

Condiciones y alcance:

- Todas las entidades que la plantilla declara deben estar «Válida» en esa conexión, **incluidas las opcionales**. Si no, la prueba se frena sin conectar y nombra las entidades: «Las vistas de estas entidades no están aprobadas en esta conexión: … Mapealas y validalas en Mapeo y validación.» (DEC-71).
- No guarda nada y no crea ninguna consulta guardada.
- La prueba queda en **Auditoría** con origen «Prueba de plantilla».

## Cómo se ejecuta

La aplicación compone `WITH v_<entidad> AS (<vista canónica>), … SELECT * FROM (<plantilla>) AS _plantilla` con el SQL guardado de las vistas aprobadas (DEC-62, DEC-70). Los valores nunca entran al texto: viajan como parámetros del driver. Por eso el SQL de una plantilla no corre suelto en el editor de **Consultas**: las vistas `v_*` no existen en la réplica.

## Alta y cambio de plantillas

Por la consola (ver arriba) o por la API de la aplicación, con sesión de operador: `POST /plantillas` crea y `PUT /plantillas/:id` reemplaza en el lugar, sin versiones (DEC-68), salvo que la plantilla esté en uso (`409`). El cuerpo lleva `nombre`, `sql`, `parametros`, `entidades`, `automatizacion`, `formato` y `toleranciaFrescuraMinutos`, más los textos opcionales descritos abajo. Las rutas del catálogo no piden `X-Tenant-Id`; las de prueba sí, porque usan una conexión de un tenant:

- `POST /plantillas/:id/prueba` prueba una plantilla guardada.
- `POST /plantillas/prueba` (CH-38) prueba una que no está guardada: lleva el cuerpo de `POST /plantillas` más `conexionId` (obligatorio) y `valores` (opcional). Rechaza el cuerpo igual que `POST /plantillas` (`400`, mismo cuerpo) y después aplica las mismas compuertas que la ruta anterior: conexión del tenant (`404`), vistas aprobadas (`409`), valores (`400`) y credencial legible (`409`). Devuelve solo la primera página, no escribe ninguna plantilla y queda en Auditoría con origen «Prueba de plantilla», la sentencia compuesta y sin id de plantilla.

### Título y descripción para el cliente

El cuerpo admite además dos campos opcionales, `titulo` (hasta 80 caracteres) y `descripcion` (hasta 200). Son los textos que el panel del cliente muestra en la tarjeta de la automatización (DEC-182, DEC-190). Se recortan los espacios de los bordes antes de medir y de guardar, y un valor en blanco se guarda como `null`.

- **Solo se ofrecen las plantillas con los dos textos.** Una plantilla sin título o sin descripción no aparece en «disponibles» del panel; si ya tiene una automatización, el panel usa un texto neutro.
- **Glosario del panel.** Los textos no pueden contener, sin distinguir mayúsculas, `tenant`, `cron`, `sql`, `consulta`, `query`, `ejecución`, `réplica`, `parámetro`, `timeout` ni `plantilla`. Si alguno aparece, la API responde `400 solicitud-invalida` con el campo en `campos` (`/titulo` o `/descripcion`) y los términos hallados en `terminos`, y no escribe nada. Pasarse del largo también da `400` con el campo en `campos`.
- **Dos plantillas con el mismo título** (sin distinguir mayúsculas) se ofrecen como una sola, y si una de ellas está activa para el tenant, ninguna se ofrece.
- **`PUT` reemplaza todo el cuerpo.** Un `PUT` que omite `titulo` o `descripcion` los deja en `null`; para conservarlos hay que reenviarlos.

### Texto del mensaje (CH-39)

El cuerpo admite también `encabezadoMensaje` (hasta 200 caracteres) y `lineaMensaje` (hasta 300). Con ellos el correo deja de ser una tabla: lleva el encabezado y, debajo, **una línea por fila** del resultado (DEC-188, DEC-192). Sin ellos, el correo muestra la tabla de siempre; el asunto, el tema de color, los avisos y el pie no cambian.

- **Marcadores.** En la línea, `{columna}` se reemplaza por el valor de esa columna en cada fila. Un marcador es una `{`, uno o más caracteres que no sean `{` ni `}`, y una `}`; el nombre es lo que hay entre las llaves, tal cual: distingue mayúsculas y conserva los espacios. Cualquier otra llave es texto literal. Los valores vacíos se muestran como «—», con el mismo tope de largo que una celda de la tabla.
- **El encabezado es fijo.** No admite marcadores: no tiene una fila de la cual tomar el valor. Uno en el encabezado se rechaza.
- **La línea necesita al menos un marcador.** Sin ninguno repetiría la misma frase una vez por fila.
- **Van juntos.** Se guardan los dos o ninguno. Un valor vacío tras recortar los espacios cuenta como ausente y se guarda como `null`.
- **Glosario.** Se aplica al encabezado y al texto literal de la línea; los nombres de los marcadores no cuentan, porque son columnas.
- **Se validan contra la última prueba.** Al guardar, el cuerpo lleva `columnasPrueba`: los nombres de las columnas de la prueba exitosa (hasta 200). Cada marcador de la línea tiene que ser uno de ellos. `columnasPrueba` no se guarda ni se devuelve, y se ignora si no hay textos. `POST /plantillas/prueba` no la pide, porque esa prueba es la que produce las columnas.

El rechazo es `400 solicitud-invalida` y no escribe nada. Se aplican en este orden y gana el primero que falla:

| Paso | Rechazo | `campos` | Extra |
|---|---|---|---|
| 1 | Hay uno solo de los dos textos | el que falta | |
| 2 | Un texto pasa su tope | el que lo pasa | |
| 3 | Marcador en el encabezado | `/encabezadoMensaje` | `marcadores` |
| 4 | Línea sin marcadores | `/lineaMensaje` | |
| 5 | Término del glosario | el texto que lo contiene | `terminos` |
| 6 | Sin `columnasPrueba`, o marcador fuera de ellas | `/columnasPrueba`, o `/lineaMensaje` | `marcadores` con los nombres desconocidos, cada uno una vez |

Ambos textos vienen siempre en `GET /plantillas/:id` y en las respuestas de `POST` y `PUT` (`null` si no hay). El listado `GET /plantillas` no los trae. Como `PUT` reemplaza todo el cuerpo, un `PUT` que los omite los deja en `null`.

Ejemplo sobre `stock-fisico`, cuya consulta devuelve las columnas `Producto` y `Stock disponible`:

```json
{
  "encabezadoMensaje": "Productos con poco stock",
  "lineaMensaje": "{Producto}: quedan {Stock disponible} unidades",
  "columnasPrueba": ["Producto", "Stock disponible"]
}
```

El correo dice «Productos con poco stock» y, debajo, «Harina 000: quedan 3 unidades», «Azúcar: quedan 0 unidades», una por fila. Con `{producto}` en lugar de `{Producto}`, el guardado se rechaza: `/lineaMensaje` con `marcadores: ["producto"]`.

#### Si falta una columna: vuelve la tabla

Una plantilla se reemplaza en el lugar y su consulta puede cambiar después de guardados los textos. Si al correr, la línea nombra una columna que el resultado ya no trae, el correo se envía **como tabla** (nunca con un marcador sin reemplazar ni con un hueco) y la corrida lo registra aparte del envío:

- `mensajeRespaldo` en la ejecución es la lista de nombres que faltaban, cada uno una vez y en orden de aparición. Guarda solo nombres de columnas, nunca valores.
- Es `null` cuando el mensaje se armó con los textos, cuando la plantilla no tiene textos, cuando no se llegó a armar un mensaje (sin destinatario, sin filas, consulta fallida) y en las ejecuciones anteriores a este cambio.
- `notificacion` sigue su propia precedencia: una corrida que cae a la tabla y se envía queda `enviada`, y si el envío falla queda `fallo-envio`, en ambos casos con `mensajeRespaldo` cargado.
- `GET /automatizaciones/:id/ejecuciones` lo incluye en cada ejecución (arreglo o `null`).

## Límites

- **Límite.** El encabezado del mensaje no admite marcadores; un dato por corrida, como una cuenta de filas, queda para más adelante.
- **Límite.** No existe un borrado de plantillas en ninguna superficie (DEC-68).
- **Límite.** El único formato de entrega es el correo HTML (DEC-65).
- **Límite.** `reporte-diario` figura en el contrato como etiqueta de automatización, pero el catálogo inicial no la trae: el motor ejecuta una consulta por corrida y no envía con cero filas (DEC-126).
- **Límite.** No hay forma de convertir una plantilla en una consulta propia (DEC-177).

## Siguiente paso

[Automatizaciones](06-automatizaciones.md).
