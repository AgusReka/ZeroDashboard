# Automatizaciones

Una automatización ejecuta una plantilla del catálogo contra una conexión de un tenant, según un horario, y avisa por correo si hay filas. Pantallas: **Automatizaciones** y **Frescura de datos**, en Trabajo diario.

## Anatomía

| Parte | Qué es |
|---|---|
| Disparador | Expresión cron estándar de cinco campos, interpretada en la zona horaria del despliegue (`ZONA_HORARIA_AUTOMATIZACIONES`, `UTC` si no se define; DEC-76, DEC-77). |
| Fuente | Siempre una plantilla, más una conexión y los valores de sus parámetros. Nunca una consulta guardada. |
| Condición | Una sola: con cero filas no se envía nada. El umbral es un parámetro dentro del SQL (DEC-84). |
| Acción | Un correo HTML a un solo destinatario, opcional (DEC-82). |
| Registro | Una ejecución por corrida, con metadatos y sin filas (DEC-93). |

## Camino rápido

1. Comprobar en **Mapeo y validación** que las entidades de la plantilla están «Válida».
2. **Automatizaciones** → «Nueva automatización».
3. Paso «Conexión y plantilla»: elegir la conexión y una tarjeta de plantilla → «Siguiente».
4. Paso «Parámetros y horario»: valores, «Frecuencia», «Hora (24 horas)» y, si se quiere correo, «Correo del destinatario (opcional)» → «Crear automatización».
5. El aviso informa la primera ejecución programada y la zona horaria.

Si la conexión elegida no puede correr una plantilla, su tarjeta aparece deshabilitada con el motivo: «No disponible con esta conexión: producto (vista sin validar), … Cada ejecución se frenaría antes de conectar.» (DEC-127).

**Horario.** «Todos los días», «De lunes a viernes» y «De lunes a sábado» arman el cron a partir de la hora. «Personalizado (expresión cron)» permite cualquier cron estándar de cinco campos; los alias como `@daily` y el campo de segundos se rechazan. La tabla muestra el horario en palabras cuando es uno de los tres predefinidos y, siempre, la expresión.

## Cuándo corre

- Un tick por minuto, dentro del proceso de la aplicación; ejecuta una por una las automatizaciones activas de cada tenant activo (DEC-75). Un tenant dado de baja no corre.
- **Límite.** Un disparo perdido no se recupera: si el servicio está detenido a la hora, esa ejecución se omite (DEC-95).
- Si la corrida anterior de la misma automatización sigue en curso, se registra una ejecución «Omitida» con error `solapamiento` (DEC-96).
- Al arrancar, las ejecuciones que quedaron «en-curso» se cierran como `fallo` con error `interrumpida` y no se repiten (DEC-99).
- Los fallos transitorios de **conexión** (`host-inalcanzable`, `dns-no-resuelve`, `tiempo-agotado`) se reintentan: 3 intentos y 5000 ms de pausa por defecto (`CONNECTION_RETRY_ATTEMPTS`, máximo 5; `CONNECTION_RETRY_PAUSE_MS`). Nada más se reintenta, y el correo se intenta una sola vez (DEC-97).

## Ejecuciones

«Ver ejecuciones» en la fila lista las 200 más recientes.

| Columna | Valores |
|---|---|
| Estado | `en-curso`, `ok`, `fallo`, «Omitida» |
| Notificación | «Enviada», «No enviada: sin filas», «Sin destinatario», «Correo no configurado», «Falló el envío», «Envío en curso», «Sin confirmar: puede haberse entregado» |
| Error | Una frase por categoría, más el código SQLSTATE o SMTP si existe. Ver [Diagnóstico](08-diagnostico.md). |
| Intentos | Intentos de conexión reales; `—` si no se llegó a conectar. |

Si la consulta anduvo y el correo falló, la ejecución queda en `fallo` pero conserva las filas (DEC-83). «Sin confirmar» indica que el proceso se cortó durante el envío y nadie sabe si salió (DEC-108).

El correo necesita SMTP: sin `SMTP_HOST`, cada corrida registra «Correo no configurado» y sigue (DEC-86). Para desarrollo, `docker compose --profile correo up` levanta Mailpit.

## Ajustar en el lugar

En una automatización activa, «Ajustar» abre un pop-up con tres cosas editables: los valores de los parámetros, el horario y el destinatario (DEC-174). «Guardar ajustes» envía solo lo que cambió y rige desde la próxima ejecución; un destinatario vacío deja de enviar correo. La plantilla y la conexión se muestran y no se cambian: para eso se desactiva y se crea otra.

- «Desactivar» detiene la automatización; no se puede reactivar. Sus ejecuciones pasadas siguen disponibles (DEC-79).
- El panel del cliente ajusta lo mismo, con menos opciones: «Cantidad mínima», «Hora de envío», días y correo (DEC-138).

## Frescura de datos

Pantalla para declarar cuán vieja puede estar la réplica de un tenant y compararla con la tolerancia de cada plantilla (CH-24).

| Control | Efecto |
|---|---|
| «Ventana (minutos)» + «Guardar ventana» | Declara cada cuánto se regenera la réplica. Vacía vuelve a «Sin declarar». Admite de 0 a 525 600. |
| «Marcar réplica actualizada ahora» | Registra el momento, que la pantalla muestra como «Última actualización de la réplica». |

Estado por plantilla: «Al día» (ventana menor o igual que la tolerancia), «Desactualizada» (mayor) o «Sin declarar».

**Límite.** Es informativo: no detiene ni cambia ninguna ejecución (DEC-142). El estado se calcula solo con la ventana; «Marcar réplica actualizada ahora» no entra en la comparación.

## Límites

- **Límite.** Un solo destinatario y un solo formato (correo HTML); sin otras acciones ni condiciones explícitas.
- **Límite.** Las filas de una corrida se cuentan y se descartan: no hay vista de resultados anteriores (DEC-93).

## Siguiente paso

[Usuarios y permisos](07-usuarios-y-permisos.md).
