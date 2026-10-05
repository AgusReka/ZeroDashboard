# Reglas de lenguaje

Español rioplatense neutro: voseo (tenés, elegí, podés), sin lunfardo ni modismos fuertes. Sentence case en títulos y botones. Sin emoji. Fechas dd/mm, hora 24 h, números es-AR (1.240 · 1,8 s).

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
