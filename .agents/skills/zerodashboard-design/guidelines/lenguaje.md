# Reglas de lenguaje

Español rioplatense neutro: voseo (tenés, elegí, podés) en consola, panel y correo, sin mezclar con "usted"; sin lunfardo ni modismos fuertes. Sentence case en títulos y botones. Sin emoji. Fechas dd/mm, hora 24 h, números es-AR (1.240 · 1,8 s).

## Glosario PANEL (negocio) — término técnico → término que ve el cliente
| No decir | Decir |
|---|---|
| job, tarea, cron | automatización |
| ejecución, run | revisión ("la revisión de las 08:00") |
| réplica, base de datos, conexión DB | la conexión con tu tienda · los datos de tu tienda |
| tenant | tu negocio (o el nombre del negocio) |
| query, consulta, SQL | — (no existe en el panel) |
| threshold, parámetro | mínimo · cantidad |
| schedule, cron expression | horario · días |
| timeout | tu tienda tardó demasiado en responder |
| fallida, error 500 | no pudimos… |
| filas, rows | productos · pedidos (la entidad de negocio) |
| freshness, latencia de réplica | los datos se actualizaron hace… |
| notificación duplicada | — (no se muestra; el cliente no necesita saberlo) |
| omitida por solapamiento | — (se comunica solo si afecta: "la revisión de las 14:00 no se hizo") |

## Términos permitidos solo en CONSOLA
tenant, consulta, SQL, sentencia, parámetro (`:umbral`), réplica, esquema, mapeo, contrato canónico, entidad, campo, agente, token, latido, timeout, tope de filas, solapamiento, reintento, ejecución, id (`ten_7f3a`, `ej_9041`), códigos del motor (`42P01`).

## Fórmulas
- Falla (panel): **qué no pasó** + **por qué en términos de negocio** + **qué hacemos nosotros** + **si tenés que hacer algo**. "No pudimos armar tu resumen de esta mañana. Tu tienda tardó demasiado en responder. Lo intentamos de nuevo a las 09:30; no tenés que hacer nada."
- Error (consola): **qué se rechazó** + **regla** + **dato técnico en mono**. "La consulta fue rechazada: solo se permiten lecturas. Se encontró UPDATE en la línea 3."
- Confirmación destructiva: el botón repite la acción y el objeto ("Revocar token", "Operar sobre Panadería La Espiga"); nunca "Sí" / "Aceptar".
- Vacío: qué falta + cuándo aparece + acción.

## Glosario CONSOLA — definiciones para ayudas contextuales
Los términos técnicos se pueden usar en la consola, pero se explican **la primera vez que aparecen en cada pantalla** (texto de ayuda o `<abbr title>`). Definiciones de una línea:

| Término | Ayuda |
|---|---|
| tenant | Cada cliente que operás. Todo lo que hacés en las vistas del tenant afecta solo al tenant activo. |
| réplica | Copia de solo lectura de la base del cliente. La consola nunca escribe en ella. |
| conexión | Datos de acceso a la réplica. Una vez registrada no se edita: si hay un error, se crea otra. |
| agente | Programa que instala el cliente para que lleguemos a una red privada. Uno por tenant. |
| token | Clave del agente. Se muestra una sola vez: copiala al crearlo. |
| contrato canónico | Lista de entidades y campos que todas las tiendas tienen que devolver con el mismo nombre y tipo. |
| entidad | Cada cosa del contrato: producto, stock, pedido, item_pedido… |
| mapeo | El SELECT que traduce las tablas de una tienda a una entidad del contrato. |
| vista canónica (`v_producto`…) | Vista que arma el mapeo validado; las plantillas y los reportes consultan estas vistas. |
| compuerta de vistas | Condición que exige el mapeo validado antes de probar plantillas y reportes. *(Verificar el nombre y el alcance exactos en el código antes de usarlo en la interfaz.)* |
| cron | Expresión que define cuándo corre una automatización. Mostrarla siempre junto a su lectura en texto ("Todos los días a las 08:00"). |
| SQLSTATE | Código de error del motor (p. ej. `42P01`: la tabla no existe). Va en mono, después de la explicación. |
| tope de filas | Máximo de filas que devuelve una ejecución; si se alcanza, el resultado está cortado. |
| frescura · ventana · tolerancia | Cada cuánto se actualiza la réplica (declarado a mano) y cuánta antigüedad acepta cada plantilla. |

## Errores HTTP de la consola
Nunca mostrar el código solo ("No se pudo leer /plantillas (HTTP 500)", L5805). Fórmula: **qué no se pudo** + **qué hacer** + código en mono al final.
| Caso | Texto |
|---|---|
| Sin red / no responde | "No pudimos conectar con el servidor de la consola. Revisá tu conexión y probá de nuevo." |
| 400 / 422 | El mensaje de validación del servidor, junto al campo si se puede ubicar. |
| 401 / 403 | "Tu sesión no tiene permiso para esto. Volvé a ingresar." |
| 404 | "No encontramos {objeto}. Puede que lo hayan dado de baja." |
| 409 | "{Objeto} cambió o está en uso. {Qué hacer: duplicar, recargar}." |
| 5xx | "La consola tuvo un error interno al {acción}. Probá de nuevo; si se repite, revisá el log del servidor. `HTTP 500`" |

## Fechas y horas
Una sola zona horaria en toda la consola y rotulada una vez por vista ("Hora de Buenos Aires (UTC−3)"). Mientras una vista use otra zona (Automatizaciones usa la del servidor), lo dice en su rótulo.

## Más fórmulas
- Propósito de pantalla: **qué hacés acá** + **para qué sirve en el flujo** (+ qué depende de esto). "Escribí un SELECT por entidad y validalo. Sin mapeo validado no se pueden probar plantillas ni reportes."
- Prerrequisito: título "Primero {paso}" + por qué en una frase + botón «Ir a {vista}».
- Confirmación: título "¿{Acción} {objeto}?" + consecuencia en una línea (+ "No se puede deshacer." si es irreversible) + botón con la misma acción y objeto. Niveles en `admin.md` §8.
- Botón deshabilitado: siempre con el motivo visible al lado ("Guardar se habilita con una prueba exitosa"), nunca solo en `title`.
- Comportamiento intencional: decirlo antes de que choque ("Esta plantilla la usan 3 automatizaciones: no se edita. Duplicala para hacer cambios.").
- Los textos nombran los controles tal como se llaman en pantalla.
