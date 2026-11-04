# Automatizaciones

Una automatización ejecuta una plantilla del catálogo contra una conexión de un tenant, según un horario, y avisa por correo si hay filas. Pantallas: **Automatizaciones** y **Frescura de datos**, en Trabajo diario.

## Anatomía

| Parte | Qué es |
|---|---|
| Disparador | Expresión cron estándar de cinco campos, interpretada en la zona horaria del despliegue (`ZONA_HORARIA_AUTOMATIZACIONES`, `UTC` si no se define; DEC-76, DEC-77). |
| Fuente | Siempre una plantilla, más una conexión y los valores de sus parámetros. Nunca una consulta guardada. |
| Condición | Con cero filas no se envía nada (DEC-84), y tampoco con menos filas que el «Mínimo de filas para avisar» de la automatización: 1 por defecto, hasta el tope de filas del motor (DEC-186, DEC-193). El umbral de un valor es un parámetro dentro del SQL. |
| Acción | Un correo HTML, a hasta 5 destinatarios en un solo mensaje, opcional (DEC-82, DEC-187). |
| Registro | Una ejecución por corrida, con metadatos y sin filas (DEC-93). |

## Camino rápido

1. Comprobar en **Mapeo y validación** que las entidades de la plantilla están «Válida».
2. **Automatizaciones** → «Nueva automatización».
3. Paso «Conexión y plantilla»: elegir la conexión y una tarjeta de plantilla → «Siguiente».
4. Paso «Parámetros y horario»: valores, «Frecuencia», «Hora (24 horas)» y, si se quiere correo, «Correos de los destinatarios (opcional)» (hasta 5, separados por comas, punto y coma o espacios) y «Mínimo de filas para avisar» (1 si no se cambia) → «Crear automatización».
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
| Notificación | «Enviada», «No enviada: sin filas», «No enviada: menos filas que el mínimo», «Sin destinatario», «Correo no configurado», «Falló el envío», «Envío en curso», «Sin confirmar: puede haberse entregado» |
| Error | Una frase por categoría, más el código SQLSTATE o SMTP si existe. Ver [Diagnóstico](08-diagnostico.md). |
| Intentos | Intentos de conexión reales; `—` si no se llegó a conectar. |

Si la consulta anduvo y el correo falló, la ejecución queda en `fallo` pero conserva las filas (DEC-83). «Sin confirmar» indica que el proceso se cortó durante el envío y nadie sabe si salió (DEC-108).

El correo necesita SMTP: sin `SMTP_HOST`, cada corrida registra «Correo no configurado» y sigue (DEC-86). Para desarrollo, `docker compose --profile correo up` levanta Mailpit.

## Ajustar en el lugar

En una automatización activa, «Ajustar» abre un pop-up con cuatro cosas editables: los valores de los parámetros, el horario, los destinatarios (DEC-174, DEC-187) y el mínimo de filas (DEC-193). «Guardar ajustes» envía solo lo que cambió y rige desde la próxima ejecución; la lista se compara dirección por dirección, así que cambiar solo el separador no cuenta como cambio, y una lista vacía deja de enviar correo. La plantilla y la conexión se muestran y no se cambian: para eso se desactiva y se crea otra.

- «Desactivar» detiene la automatización; no se puede reactivar. Sus ejecuciones pasadas siguen disponibles (DEC-79).
- El panel del cliente ajusta lo mismo, con menos opciones: «Cantidad mínima», «Hora de envío», días y correos, de 1 a 5: el panel no puede dejar la lista vacía (DEC-138, DEC-187, DEC-194).

## Vista previa del mensaje

En una automatización activa, «Vista previa» abre un pop-up que corre su consulta una vez, como la correría una ejecución: la misma compuerta de vistas, los valores guardados, la conexión de la automatización y la misma página de filas, hasta el tope del motor (DEC-189, DEC-195). Muestra:

- Si una ejecución enviaría el correo y a quién («Se enviaría a: …»), o por qué no («No se enviaría: …»).
- «Para», las filas y, si una ejecución armaría el mensaje, el «Asunto», el texto y el HTML del correo. El HTML se ve en un marco aislado, sin permisos.

No envía nada ni crea una ejecución: el pop-up solo tiene «Cerrar» y todo envío sigue siendo el programado. Un rechazo (vista sin aprobar, valores que ya no cumplen la plantilla, credencial ilegible) o una falla de la consulta se informan dentro del pop-up, como en la prueba de plantilla.

Cada vista previa que llega a correr la consulta queda en la **Auditoría** con el origen «Vista previa de automatización», la conexión, la sentencia compuesta y la plantilla. No guarda la automatización, los destinatarios ni nada del mensaje.

## Frescura de datos

Pantalla para declarar cuán vieja puede estar la réplica de un tenant y compararla con la tolerancia de cada plantilla (CH-24).

| Control | Efecto |
|---|---|
| «Ventana (minutos)» + «Guardar ventana» | Declara cada cuánto se regenera la réplica. Vacía vuelve a «Sin declarar». Admite de 0 a 525 600. |
| «Marcar réplica actualizada ahora» | Registra el momento, que la pantalla muestra como «Última actualización de la réplica». |

Estado por plantilla: «Al día» (ventana menor o igual que la tolerancia), «Desactualizada» (mayor) o «Sin declarar».

**Límite.** Es informativo: no detiene ni cambia ninguna ejecución (DEC-142). El estado se calcula solo con la ventana; «Marcar réplica actualizada ahora» no entra en la comparación.

## Límites

- **Límite.** Hasta 5 destinatarios y un solo formato (correo HTML); sin otras acciones. Las direcciones repetidas, sin distinguir mayúsculas, cuentan una vez, y el tope se mide después de quitarlas (DEC-194). La única condición fuera del SQL es el mínimo de filas: no hay condiciones sobre sumas, máximos ni combinaciones (DEC-186).
- **Límite.** Todas las direcciones van en «Para» de un mismo mensaje y se ven entre sí. Si el servidor de correo acepta al menos una, la ejecución figura «Enviada»; si las rechaza todas, «Falló el envío» (DEC-187).
- **Límite.** El mínimo de filas se ajusta solo desde la consola; el panel del cliente no lo muestra (DEC-186). Si el resultado se cortó en el tope de filas, cuenta como alcanzado (DEC-193).
- **Límite.** Las filas de una corrida se cuentan y se descartan: no hay vista de resultados anteriores (DEC-93).

## Siguiente paso

[Usuarios y permisos](07-usuarios-y-permisos.md).
