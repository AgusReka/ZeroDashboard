# Plantillas

Una plantilla es una automatización reutilizable del catálogo: un SQL escrito contra las vistas canónicas, los parámetros que declara y las entidades que necesita. El catálogo es **global** (DEC-61): lo comparten todos los tenants y la consola solo lo muestra. Pantalla: **Plantillas**, en Global.

## Camino rápido

1. **Plantillas** → «Ver» en la fila de una plantilla.
2. Revisar «Necesita:» y «Parámetros:».
3. En «Probar en el tenant activo», elegir una conexión, completar los parámetros y pulsar «Probar».
4. Si el resultado es el esperado, crear la automatización ([Automatizaciones](06-automatizaciones.md)).

## El catálogo inicial

Al arrancar, la aplicación crea las plantillas que falten, sin tocar las existentes (DEC-125). Hoy son dos:

| Nombre | Automatización | Necesita | Parámetro | Tolera |
|---|---|---|---|---|
| Alerta de stock físico | `stock-fisico` | `producto`, `receta_componente` | `umbral` (numero) | 1 h |
| Alerta de stock producible | `stock-producible` | `producto`, `insumo`, `receta_componente` | `umbral` (numero) | 2 h |

El formato de entrega es `correo-html`. «Tolera» es la antigüedad de datos que la plantilla admite; se compara con la ventana declarada en [Frescura de datos](06-automatizaciones.md#frescura-de-datos). Las tolerancias iniciales son provisorias (DEC-128).

## Qué muestra la pantalla

- La tabla: «Nombre», «Automatización», «Formato», «Tolera».
- El panel de «Ver»: el SQL de la plantilla como texto, las entidades que necesita y sus parámetros. No se puede editar nada.

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

Solo por la API de la aplicación, con sesión de operador: `POST /plantillas` crea y `PUT /plantillas/:id` reemplaza en el lugar, sin versiones (DEC-68). El cuerpo lleva `nombre`, `sql`, `parametros`, `entidades`, `automatizacion`, `formato` y `toleranciaFrescuraMinutos`. Las rutas del catálogo no piden `X-Tenant-Id`; la de prueba (`POST /plantillas/:id/prueba`) sí, porque usa una conexión de un tenant.

### Título y descripción para el cliente

El cuerpo admite además dos campos opcionales, `titulo` (hasta 80 caracteres) y `descripcion` (hasta 200). Son los textos que el panel del cliente muestra en la tarjeta de la automatización (DEC-182, DEC-190). Se recortan los espacios de los bordes antes de medir y de guardar, y un valor en blanco se guarda como `null`.

- **Solo se ofrecen las plantillas con los dos textos.** Una plantilla sin título o sin descripción no aparece en «disponibles» del panel; si ya tiene una automatización, el panel usa un texto neutro.
- **Glosario del panel.** Los textos no pueden contener, sin distinguir mayúsculas, `tenant`, `cron`, `sql`, `consulta`, `query`, `ejecución`, `réplica`, `parámetro`, `timeout` ni `plantilla`. Si alguno aparece, la API responde `400 solicitud-invalida` con el campo en `campos` (`/titulo` o `/descripcion`) y los términos hallados en `terminos`, y no escribe nada. Pasarse del largo también da `400` con el campo en `campos`.
- **Dos plantillas con el mismo título** (sin distinguir mayúsculas) se ofrecen como una sola, y si una de ellas está activa para el tenant, ninguna se ofrece.
- **`PUT` reemplaza todo el cuerpo.** Un `PUT` que omite `titulo` o `descripcion` los deja en `null`; para conservarlos hay que reenviarlos.

## Límites

- **Límite.** La consola no crea, edita ni borra plantillas, y no existe un borrado de plantillas en ninguna superficie (DEC-68).
- **Límite.** El único formato de entrega es el correo HTML (DEC-65).
- **Límite.** `reporte-diario` figura en el contrato como etiqueta de automatización, pero el catálogo inicial no la trae: el motor ejecuta una consulta por corrida y no envía con cero filas (DEC-126).
- **Límite.** No hay forma de convertir una plantilla en una consulta propia (DEC-177).

## Siguiente paso

[Automatizaciones](06-automatizaciones.md).
