# Mapeo y validación

Mapear es decirle a la aplicación cómo armar, desde la réplica de un cliente, cada entidad del contrato canónico. Se escribe **un `SELECT` por entidad**, por conexión (DEC-30, DEC-169). Validar comprueba esos `SELECT` sin leer filas. Pantalla: **Mapeo y validación**, en Puesta en marcha.

## Camino rápido

La pantalla trae una guía plegable, «Cómo mapear», con los mismos pasos:

1. Elegir la conexión del tenant en «Conexión».
2. Por cada entidad, escribir un `SELECT` que devuelva los campos del contrato con esos nombres y tipos.
3. «Guardar» cada entidad.
4. «Validar mapeo» y revisar el resultado de cada campo.
5. Leer la tabla **Automatizaciones**: dice cuáles quedan habilitadas y por qué.

## Qué pide el contrato

La pantalla **Contrato canónico** lista cada campo, su tipo, si es obligatorio y qué automatización lo usa. Las entidades `insumo` y `receta_componente` son opcionales y pueden quedar sin mapear. Los campos con `*` son opcionales.

| Entidad | Campos (tipo) |
|---|---|
| `producto` | `id` (identificador), `nombre` (texto), `stockDisponible` (numero), `sku`* (texto), `activo` (booleano) |
| `pedido` | `id` (identificador), `fechaCreacion` (fecha), `estado` (texto), `total` (numero), `numero`* (identificador), `moneda`* (texto) |
| `item_pedido` | `id`, `pedidoId`, `productoId` (identificador), `cantidad` (numero), `precioUnitario`* (numero) |
| `insumo` | `id` (identificador), `nombre` (texto), `stockDisponible` (numero), `unidadMedida`* (texto), `codigo`* (texto) |
| `receta_componente` | `productoId`, `insumoId` (identificador), `cantidadPorUnidad` (numero) |

## Cómo escribir el SELECT

- Los nombres de las columnas son los del contrato. Los que tienen mayúsculas van entre comillas dobles: `AS "stockDisponible"`. Sin comillas, PostgreSQL los pasa a minúsculas y el campo se informa como `alias-sin-comillas`.
- Cada entidad devuelve **solo** los campos del contrato. Una columna que el contrato no define hace inválida la entidad (DEC-43).
- Un campo opcional puede faltar; se completa con `NULL::<tipo> AS campo` si conviene.
- Una sola sentencia; el `;` final es opcional.

El tipo se compara por categoría, no por tipo exacto (DEC-39):

| Tipo del contrato | Tipos de PostgreSQL aceptados |
|---|---|
| identificador | `int2`, `int4`, `int8`, `uuid`, `text`, `varchar`, `bpchar` |
| texto | `text`, `varchar`, `bpchar` |
| numero | `int2`, `int4`, `int8`, `numeric`, `float4`, `float8` |
| booleano | `bool` |
| fecha | `date`, `timestamp`, `timestamptz` |

Cualquier otro tipo (arreglos, `money`, `json`, enumerados) falla como `tipo-incorrecto`, y la consola agrega una pista: «probá castear con `::text`», `::numeric`, `::boolean` o `::timestamptz`, según el tipo esperado (DEC-45). Si el tipo está en la tabla pero es de otra categoría (por ejemplo `text` donde se espera `numero`), el veredicto es el mismo y no hay pista: se corrige con un cast explícito.

## Ejemplo de partida (CH-34)

Cada entidad trae «Ejemplo sobre la réplica de demo (food_store)». «Usar de punto de partida» lo copia al editor **solo si está vacío**; si ya hay SQL, avisa «El editor de producto ya tiene SQL. Vacialo para usar el ejemplo.». No guarda nada: hay que adaptarlo y pulsar «Guardar».

**Límite.** La consola no genera SQL ni lee la réplica para armarlo; el ejemplo es texto fijo de la réplica de demo (DEC-176).

## Estados

**De una entidad** (línea «Estado:» bajo su título):

| Estado | Cuándo |
|---|---|
| Sin mapear | No hay SQL guardado para la entidad. |
| Sin validar | Hay SQL, nunca validado. Guardar de nuevo el SQL siempre vuelve a este estado (DEC-41). |
| Válida | La última validación no encontró problemas. |
| Inválida | La consulta no corrió, o falló algún campo, o sobran columnas. |

**De una automatización** (tabla **Automatizaciones**, columna «Estado»), según las entidades que usa:

| Estado | Cuándo |
|---|---|
| `aplicable` | Todas sus entidades están válidas. |
| `inaplicable` | Falta una entidad opcional que necesita. |
| `bloqueada` | Falta una entidad obligatoria, la consulta falló, sobran columnas o un campo que usa falla. |
| `pendiente` | Hay entidades guardadas pero sin validar. |

Si se dan varias condiciones, gana `inaplicable`, luego `bloqueada` y luego `pendiente`, y se listan todos los motivos (DEC-46). La columna «Motivos» tiene el formato `entidad.campo: motivo`.

## Leer el resultado de «Validar mapeo»

Bajo cada entidad aparece una línea por problema:

| Línea | Qué hacer |
|---|---|
| `campo: ausente` | Agregar la columna con el nombre del contrato. |
| `campo: tipo-incorrecto · columna … · tipo …` | Castear la columna; seguir la pista si aparece. |
| `campo: alias-sin-comillas · columna …` | Poner el alias entre comillas dobles. |
| `campo: duplicada` | La vista devuelve dos columnas con ese nombre; dejar una. |
| «Columna sobrante: x» | Sacar `x` del `SELECT`. |
| «La consulta no corrió: <categoría>» | La sentencia falló en la réplica; ver la categoría en [Diagnóstico](08-diagnostico.md). |

La validación prueba cada `SELECT` envuelto con `LIMIT 0` dentro de una transacción de solo lectura: comprueba la estructura, no los datos (DEC-42). Si la conexión misma falla, aparece «La validación no pudo conectarse: …. Se mantiene el último resultado.» y no se escribe nada.

## Por qué importa

Una plantilla solo corre —en «Probar en el tenant activo» y en cada ejecución programada— si todas las entidades que declara están en estado «Válida» en esa conexión (DEC-71). Ver [Plantillas](05-plantillas.md).

## Siguiente paso

[Consultas](04-consultas.md).
