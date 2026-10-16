# Diagnóstico

Catálogo de lo que la consola y la API pueden responder cuando algo falla, con su causa y qué hacer. La consola muestra una frase por cada caso; nunca texto crudo del driver ni del servidor de correo. Primero se ubica el tipo de aviso, luego la tabla.

| Si el aviso es… | Ver |
|---|---|
| Una frase sobre el tenant o la sesión | [Tenant y sesión](#tenant-y-sesión) |
| Un resultado de ejecución con `fase` y `categoria` | [Ejecución de SQL](#ejecución-de-sql) |
| Un código en kebab-case (`credencial-ilegible`, `sin-cambios`…) | [Errores de la API](#errores-de-la-api) |
| La columna «Error» de una ejecución programada | [Ejecuciones programadas](#ejecuciones-programadas) |

## Tenant y sesión

| `error` | HTTP | Mensaje de la consola | Causa y acción |
|---|---|---|---|
| `tenant-no-indicado` | 400 | «La consola no envió un tenant activo. Elegí uno en la barra superior.» | La solicitud no trae `X-Tenant-Id`. En la consola, elegir un tenant; en la API, enviar la cabecera. |
| `tenant-no-encontrado` | 404 | «El tenant seleccionado ya no existe. Se actualizó la lista; elegí otro.» | El id no existe. Elegir otro. |
| `tenant-desactivado` | 409 | «El tenant seleccionado está dado de baja y no admite ninguna operación. Elegí otro.» | La baja es irreversible (DEC-14). Crear otro tenant si hace falta. |
| `sesion-invalida` / `sesion-expirada` | 401 | La consola recarga y muestra el ingreso. | Sin cookie, cookie desconocida o vencida (12 h). Volver a ingresar. |
| `nombre-o-clave-incorrectos` | 401 | «Nombre o clave incorrectos.» | Nombre inexistente o clave errónea, indistinguibles. Reponer con `operador:alta` si se perdió. |
| `correo-o-clave-incorrectos` | 401 | «El correo o la contraseña no coinciden.» | Ingreso al panel. Reponer la clave desde **Usuarios del panel**. |
| `confirmacion-no-coincide` | 409 | «El nombre no coincide con el del tenant. No se dio de baja.» | El nombre escrito difiere del guardado. Copiarlo exacto. |

Sin tenant elegido, la consola no envía nada: «Elegí un tenant en la barra superior antes de operar. No se envió ninguna solicitud.»

## Ejecución de SQL

Las respuestas de ejecución, prueba de plantilla y validación llevan `fase` y `categoria`; la consola agrega `(SQLSTATE x)` o el código de Node si existe.

**`fase: conexion`** (no se pudo llegar al destino)

| `categoria` | Causa | Qué hacer |
|---|---|---|
| `tiempo-agotado` | No contestó en `CONNECTION_TEST_TIMEOUT_MS` (5000 ms). | Revisar red, firewall y que el agente esté en marcha. |
| `host-inalcanzable` | Conexión rechazada o ruta inexistente. | Revisar servidor y puerto; desde Docker, `localhost` no es la máquina. |
| `dns-no-resuelve` | El nombre del servidor no se resuelve. | Corregir el servidor de la conexión. |
| `credenciales-invalidas` | El destino rechazó usuario o contraseña. | Registrar la conexión de nuevo con las credenciales correctas. |
| `base-inexistente` | La base no existe en el destino. | Corregir «Base de datos». |
| `error-desconocido` | Otro motivo. Con código `ESINAGENTE`: la conexión es por agente y no hay agente conectado. | Levantar el agente y revisar su token. |

**`fase: permisos`** (la consulta no se envía; DEC-08)

| `categoria` | Causa | Qué hacer |
|---|---|---|
| `rol-superusuario` | El rol es superusuario o tiene `BYPASSRLS`. | Usar un rol de solo lectura. |
| `rol-con-escritura-en-tabla` | El rol puede hacer `INSERT`, `UPDATE`, `DELETE` o `TRUNCATE` en alguna tabla. | Quitar esos permisos al rol. |
| `rol-con-create-en-esquema` | El rol puede crear objetos en un esquema. | Revocar `CREATE` al rol. |

**`fase: ejecucion`** (la consulta se envió y el motor respondió)

| `categoria` | Causa | Qué hacer |
|---|---|---|
| `tiempo-agotado` | Superó `QUERY_TIMEOUT_MS` (15 000 ms) y se canceló. | Acotar la consulta. |
| `no-es-lectura` | Escribe o cambia la estructura; la transacción es de solo lectura. | Usar solo `SELECT`. |
| `permiso-denegado` | El rol no puede leer algún objeto. | Otorgar `SELECT` sobre esos objetos. |
| `error-sintaxis` | SQL inválido, o más de una sentencia. | Corregir; una sentencia por ejecución. |
| `error-datos` | Válida, pero falló con los datos (por ejemplo, división por cero). | Revisar los datos o los valores. |
| `error-desconocido` | Otro motivo. | Ver el código SQLSTATE. |

**`fase: notificacion`** (la consulta corrió; falló el correo)

| `categoria` | Qué significa |
|---|---|
| `tiempo-agotado` | No se confirmó el envío: el correo puede haberse entregado. |
| `servidor-inalcanzable` | No se alcanza el servidor SMTP. |
| `credenciales-invalidas` | El SMTP rechazó las credenciales (`SMTP_USER`, `SMTP_PASSWORD`). |
| `envio-rechazado` | El SMTP rechazó el mensaje o el destinatario. |
| `error-desconocido` | Otro motivo. |

## Errores de la API

| `error` | HTTP | Causa y acción |
|---|---|---|
| `solicitud-invalida` | 400 | Cuerpo inválido. `campos` lista los campos como `/cron`, `/destinatario`, `/sql`, `/nota`, `/nombre`. Con `problemas`, cada uno trae el parámetro y un `motivo` (lista siguiente). En el panel, los campos son `umbral`, `hora`, `dias` y `destinatario`. |
| `credencial-ilegible` | 409 | «La credencial guardada para esta conexión no se pudo descifrar. Si la conexión se registró antes de que el cifrado entrara en vigencia, hay que volver a registrarla.» También aplica si cambió `CREDENTIAL_MASTER_KEY`. Registrar la conexión de nuevo (DEC-20). |
| `conexion-no-encontrada` | 404 | La conexión no existe **para el tenant activo**. |
| `agente-no-encontrado` | 404 | El agente no existe o no es de este tenant. |
| `agente-existente` | 409 | «El tenant ya tiene un agente activo.» Revocarlo antes de emitir otro. |
| `agente-revocado` | 409 | Ya estaba revocado. |
| `consulta-guardada-no-encontrada`, `version-no-encontrada` | 404 | La consulta o la versión ya no existen; la consola actualiza la lista. |
| `sin-cambios` | 409 | Se guardó una versión idéntica a la vigente: «No hay cambios respecto de la versión vigente.» |
| `conflicto-de-edicion` | 409 | Otra edición se guardó antes: «Volvé a cargar la consulta e intentá de nuevo.» |
| `version-vigente` | 409 | Se pidió restaurar la versión vigente. |
| `vista-canonica-no-encontrada` | 404 | La entidad no tiene SQL guardado en esa conexión. |
| `vista-canonica-no-aprobada` | 409 | La plantilla necesita entidades que no están «Válida». La respuesta lista las `entidades`. Mapearlas y validarlas. |
| `plantilla-no-encontrada` | 404 | La plantilla ya no existe en el catálogo. |
| `automatizacion-no-encontrada` | 404 | No existe para el tenant activo. |
| `automatizacion-desactivada` | 409 | Ya estaba desactivada; no se reactiva ni se ajusta. |
| `correo-en-uso` | 409 | El correo ya existe en el sistema. |
| `usuario-no-encontrado` | 404 | El usuario no es de este tenant. |
| `usuario-inactivo` / `usuario-activo` | 409 | Se desactivó uno ya inactivo, o se reactivó uno ya activo. |
| `horario-no-editable` | 409 | Panel: el horario guardado es personalizado y el cliente no lo cambia. Ajustarlo desde la consola. |
| `automatizacion-pausada` | 409 | Panel: la automatización está desactivada. |

Parámetros (`problemas[].motivo`): `nombre-invalido` (debe empezar con letra o guion bajo), `nombre-duplicado`, `tipo-desconocido` (texto, numero, booleano o fecha), `posicional-a-mano` (usar `:nombre`), `sin-declarar`, `sin-usar`, `valor-faltante`, `valor-no-declarado`, `valor-invalido`.

`GET /health` responde 503 `{"status":"not-ready","db":"unreachable"}` si la base propia no contesta.

## Ejecuciones programadas

La columna «Error» de una ejecución muestra una frase; la columna «Estado», `fallo` u «Omitida».

| `error` | Mensaje | Qué hacer |
|---|---|---|
| `vista-canonica-no-aprobada` | «La corrida se frenó antes de conectar. Entidades sin una validación de vista canónica aprobada: …» | Validar el mapeo; alguien guardó de nuevo una vista. |
| `valores-invalidos` | «Los valores guardados ya no cumplen la declaración actual de la plantilla.» | La plantilla cambió; usar «Ajustar». |
| `conexion-no-encontrada` | «La conexión de la automatización ya no existe.» | Desactivar y crear otra. |
| `credencial-ilegible` | «La credencial guardada de la conexión no se pudo descifrar.» | Registrar la conexión de nuevo. |
| `solapamiento` | «No se ejecutó: la corrida anterior de esta automatización seguía en curso.» | Revisar la duración de la consulta. |
| `interrumpida` | «La corrida se interrumpió por un reinicio del servicio y no se volvió a ejecutar.» | Ninguna: se ejecuta en el próximo horario. |
| `error-interno` | «La corrida falló por un error interno de la aplicación.» | Revisar los registros de la aplicación. |

Las demás combinaciones `fase`/`error` son las de las tablas de ejecución de SQL.
