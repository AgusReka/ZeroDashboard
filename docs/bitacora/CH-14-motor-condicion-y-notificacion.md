# Bitácora — CH-14: Motor: condición y notificación por correo

**Fecha de inicio:** 2026-09-29 (exploración, decisiones, propuesta, specs, diseño y tareas)
**Fecha de cierre:** 2026-09-29 — implementado en trece ramas encadenadas, verificado y archivado
**Tiempo invertido:** sesión asistida por agente (Claude Code), ciclo SDD completo (explore → propose → spec → design → tasks → apply → verify → archive), con una interrupción por límite de uso entre la unidad 5a y la 5b. El commit de planificación es de las 20:12 del 29; los de implementación caen entre las 20:13 y las 21:56 del 29. **Completar con el tiempo real percibido antes de citar este dato en la tesis**: las marcas de los commits acotan la implementación, no la exploración ni las decisiones, y varias unidades se commitearon juntas al partirlas.

> Se escribe al cierre (2026-09-29), apoyada en los artefactos del change (`openspec/changes/CH-14-engine-condition-email-notification/`), en los mensajes de commit y en DEC-81 a DEC-86. No reconstruida de memoria.

---

## Qué se construyó

X3 pide que la notificación salga solo si se cumple la condición ("sin filas, no se envía nada"); N1, que el resultado llegue por correo legible reutilizando el HTML ya validado; N2, que el correo se vea bien aunque falten datos. Antes de este change, CH-13 corría la consulta y descartaba las filas al cerrar la ejecución: nada salía del sistema.

- **Columnas nuevas** (DEC-82, DEC-83): `Automatizacion.destinatario` y `Ejecucion.notificacion`, ambas texto y nulables. Migración aditiva `20260929000000_notificacion`. Las automatizaciones de CH-13 quedan sin destinatario y registran `sin-destinatario`.
- **Dependencia** (DEC-81): `nodemailer` fijada en 10.0.12; trae sus propios tipos, no hizo falta `@types/nodemailer`.
- **Configuración** (DEC-86 y su addendum): `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, leídas solo dentro de `src/notificador.ts`, nunca en `AppConfig`. Sin `SMTP_HOST` la app arranca y las corridas registran `no-configurada`; con `SMTP_HOST` presente y el resto incompleto o inválido, el arranque falla nombrando la variable, nunca su valor. `SMTP_TIMEOUT_MS` (10000 por defecto) sí está en `AppConfig`, bajo DEC-19.
- **Mailpit** (DEC-81): servicio `mailpit` (`axllent/mailpit:v1.31.2`) bajo el perfil `correo` de Docker Compose, en los puertos de host 1026/8026 (configurables con `MAILPIT_SMTP_PORT`/`MAILPIT_UI_PORT`).
- **Renderizador puro** (`src/correo.ts`, DEC-84, DEC-85): `componerCorreo` arma HTML con estilos inline y una parte de texto plano a partir de las columnas del resultado. Escapa celdas, nombres de columna y nombre de plantilla; una celda nula, indefinida, vacía o `NaN` se muestra como `—` y un `0` sigue siendo `0`; corta celdas en 500 caracteres; avisa el corte cuando `paginacion.hayMas`. El color de acento y el emoji del asunto salen de la etiqueta `automatizacion` de la plantilla (⚠️ ámbar `stock-fisico`, 🔴 rojo `stock-producible`, 📊 azul `reporte-diario`, gris neutro para una etiqueta desconocida). `direccionValida` acepta una sola dirección, sin CR/LF, comas ni punto y coma.
- **Mapeo puro** (`src/automatizaciones.ts`): `decidirNotificacion` aplica la precedencia (consulta fallida → `null`; cero filas → `omitida-sin-filas`; sin destinatario → `sin-destinatario`; sin notificador → `no-configurada`; si no, se envía) y `cierreConNotificacion` arma el cierre. Un envío fallido deja `estado='fallo'`, `fase='notificacion'`, una categoría cerrada (`tiempo-agotado`, `servidor-inalcanzable`, `credenciales-invalidas`, `envio-rechazado`, `error-desconocido`) y conserva `filas`. `codigoError` guarda solo un código de respuesta SMTP de tres dígitos.
- **Notificador** (`src/notificador.ts`): envoltorio de nodemailer con `disableFileAccess`, `disableUrlAccess`, logger apagado, los tres timeouts de socket y un límite externo que cierra el transporte. Nunca lanza: devuelve el resultado clasificado.
- **Planificador** (`src/planificador.ts`): el paso de notificación va dentro de `correr()`, entre el resultado de la consulta y el único `update` de la fila, así la duración incluye el envío. El notificador es opcional (`null` por defecto), lo que mantiene válidos los tests de CH-13. Una excepción en el paso de envío cierra la fila como `error-interno` y no deja `en-curso`.
- **Servidor** (`src/server.ts`): arma el notificador antes de `listen` y solo loguea `correo: configurado | no-configurado`.
- **Rutas y consola**: `POST /automatizaciones` acepta `destinatario` (se recortan espacios y tabulaciones, no CR/LF; una dirección inválida es 400 sobre `/destinatario`); aparece en crear, obtener y desactivar, no en el listado. El listado de corridas expone `notificacion`. La consola suma el campo de destinatario, un mensaje legible si se rechaza y la columna "Notificación" con un texto por resultado y por categoría de error.

## Decisiones tomadas

DEC-81 a DEC-86 (`docs/01-decisiones.md`), decididas por el usuario el 2026-09-29 durante la exploración, eligiendo todas las opciones recomendadas. La validación del diseño marcó que fallar al arrancar con SMTP parcial contradecía DEC-86; el usuario eligió fallar al arrancar y se registró como addendum. Además se registraron tres resoluciones de nivel diseño bajo DEC-19, DEC-83 y DEC-86.

| Decisión | Qué fija |
|---|---|
| DEC-81 | nodemailer sobre SMTP; Mailpit bajo un perfil de Compose para desarrollo |
| DEC-82 | Una sola dirección en la automatización, nulable, sin edición |
| DEC-83 | Columna `notificacion`; un envío fallido marca la corrida como `fallo` en fase `notificacion` |
| DEC-84 | Sin filas no se envía; N2 cubre celdas nulas, ceros, vacíos y aviso de corte |
| DEC-85 | Renderizador genérico que reimplementa el diseño documentado de los workflows |
| DEC-86 | SMTP opcional; sin configurar se registra `no-configurada` |
| Addendum DEC-86 | Con `SMTP_HOST` presente, configuración incompleta o inválida frena el arranque |
| Resolución 1 | Un envío fallido conserva el conteo de filas |
| Resolución 2 | `SMTP_TIMEOUT_MS`, 10000 ms por defecto (bajo DEC-19) |
| Resolución 3 | `fase` queda en `ejecucion` salvo en un envío fallido |

## Fricciones encontradas

| # | Fricción | Causa | Resolución | Tiempo perdido |
|---|---|---|---|---|
| 1 | Seis preguntas frenaron la cadena automática después de la exploración | AGENTS.md: ninguna decisión de arquitectura la toma un agente | Se presentaron al usuario en una sola ronda y se registraron antes de proponer | no medido |
| 2 | El "HTML ya validado" no está en el repositorio | Vive como expresión de un nodo de n8n; las bitácoras WF-01 y WF-03 solo lo describen. `files.zip` resultó ser una copia vieja de los docs | DEC-85: reimplementación a partir de las bitácoras | no medido |
| 3 | El agente de exploración no pudo escribir `explore.md` | Esa fase corre sin herramienta de escritura (igual que en CH-13) | El orquestador lo escribió desde el artefacto guardado en Engram | no medido |
| 4 | La validación del diseño encontró un bloqueante y cuatro correcciones | El diseño fallaba al arrancar con SMTP parcial (contra DEC-86), y no chequeaba `formato` aunque la spec lo pedía | Addendum a DEC-86 decidido por el usuario; un único reintento del diseño que alineó specs y diseño | no medido |
| 5 | El Mailpit de otro proyecto (Saleor) ocupa los puertos 1025/8025 | Contenedor de otro proyecto con reinicio automático | El Mailpit de CH-14 usa 1026/8026 y la prueba en vivo rechaza el 1025. El texto de la tarea 4.8 se corrigió al cierre | no medido |
| 6 | Cuatro unidades superaron las 400 líneas (2: 687, 3: 454, 4: ~830, 5a: 486) | El pronóstico no contó tests ni la contabilidad de `tasks.md`/`apply-progress.md` | Se partieron en ramas apiladas (2a/2b, 3a/3b, 4a/4b/4c, 5a1/5a2), cada una bajo 400. El registro de intentos de `gentle-ai` necesitó un reset auditado por unidad; el usuario autorizó el primero y después dio autorización permanente para CH-14 | no medido |
| 7 | Las herramientas de escritura convierten el texto ` `/` ` y otros escapes en caracteres reales | Comportamiento del entorno (Git Bash y heredocs en Windows) | Se verificó cada regex; los escapes se armaron con `String.fromCharCode` o `chr(92)` | no medido |
| 8 | La sesión se cortó por límite de uso entre las unidades 5a y 5b | Límite de la cuenta | Se retomó desde el estado guardado en Engram, sin rehacer trabajo | no medido |
| 9 | `npm test` saltea la suite de Mailpit sin contarla como salteada | Una suite con `skip` no suma en `tests` ni en `skipped` | La prueba se corrió en vivo dos veces (apply de la unidad 4 y verify) con el perfil `correo` levantado | no medido |

## Límites del artefacto (aceptados)

| Límite | Origen | Notas |
|---|---|---|
| Un reporte que quiera avisar "hoy no hubo datos" no se puede expresar | DEC-84 | Se revisa en N3 |
| No es el HTML literal de n8n sino una reimplementación | DEC-85 | — |
| Un reporte con varias secciones (WF-03: tres consultas, un correo) no se reproduce | DEC-85, regla 6 | Una ejecución produce una notificación |
| Una celda con JSON anidado puede mostrar el texto `null` dentro | Diseño | Solo los valores de primer nivel se reemplazan por `—` |
| Direcciones con caracteres no ASCII se rechazan | Diseño | — |
| Gmail recorta HTML de más de ~102 KB | Diseño | Acotado por el tope de filas y de 500 caracteres por celda, no forzado |
| Si vence el límite externo, el servidor puede entregar igual el correo aunque la corrida quede como fallida | nodemailer 10 | `close()` no corta una conexión en curso; lo hacen los timeouts de socket. Queda para CH-17/CH-18 |
| Un corte del proceso entre el envío y el cierre puede duplicar o perder un correo | DEC-75 | Queda para CH-17/CH-18. Sin reintentos |
| Las corridas siguen en serie: un SMTP lento atrasa a las demás hasta `SMTP_TIMEOUT_MS` | DEC-75, resolución 2 | — |
| `Ejecucion.notificacion = null` significa tanto "la consulta falló" como "corrida anterior a CH-14" | DEC-83 | — |
| Una configuración SMTP mal cargada sin `SMTP_HOST` no se detecta al arrancar | DEC-86 | Se ve en el registro de ejecuciones como `no-configurada` |
| Primera salida de datos del tenant fuera del sistema (al relay SMTP) | DEC-81 | Coherente con la inclinación de D-1, sin cerrarla |

**Rollback:** vaciar `SMTP_HOST` corta los envíos de inmediato (las corridas registran `no-configurada`); después se revierten las ramas en orden inverso. La migración solo agrega columnas nulables.

## Cambios a especificaciones existentes

- **email-notification**: spec nueva (precedencia, fallo de envío, timeout, destinatario, contenido del cuerpo, escape, degradación, aviso de corte, asunto, texto plano, secretos, notificador inyectable).
- **automation-scheduling**: destinatario en el alta, sin edición; el pipeline notifica después de la consulta.
- **execution-log**: columna `notificacion`, fase `notificacion` y categorías cerradas de envío; el listado la expone.
- **tenant-isolation**: el destinatario sale solo de la automatización de la corrida; T2 con un tick de dos tenants.
- **query-console**: campo de destinatario, mensaje de rechazo y columna de notificación.
- **project-environment**: variables `SMTP_*` opcionales, arranque fallido con configuración parcial, Mailpit bajo perfil.

## Verificación

Primera corrida de verify: **FAIL**, con un único crítico, que era esta bitácora sin escribir (tarea 7.1). El código estaba en verde: 620/620 tests contra una PostgreSQL de prueba (613 antes de la unidad 6, 536 al cierre de CH-13), 621 con la prueba en vivo de Mailpit, `tsc` sin errores, `prisma validate` válido. 26 requisitos y 58 escenarios: 55 con tests en ejecución y 3 por inspección. Las 7 reglas de AGENTS.md se sostienen. El crítico se resolvió con esta bitácora; ver `verify-report.md`.

- **WARNING-1**: `npm test` saltea la suite de Mailpit sin contarla; tres escenarios de Compose quedan parciales.
- **WARNING-2**: ocho filas TDD pasaron en la primera corrida porque el comportamiento ya existía de unidades anteriores; cada una se compensó con una mutación de producción que las hizo fallar.
- **WARNING-3**: la consola no se probó en un navegador real (tarea 6.7). Hacer una pasada manual antes de mergear.
- **WARNING-4**: archivos sueltos sin trackear en la raíz (`0`, `run`), no commiteados.

## Pendientes fuera de CH-14

- Pasada manual de la consola en un navegador (tarea 6.7).
- `openspec/config.yaml` sigue con `strict_tdd: false` y contexto de proyecto vacío; conviene refrescarlo con `/gentle-sdd-init`.
- `AGENTS.md` sigue listando D-4 y D-5 como compuertas abiertas; están cerradas (DEC-25, DEC-26). No se editó.
- Archivos sin trackear en la raíz (`0`, `run`, `200`, `prisma;C`, `files.zip`). No se borraron.
- Ramas `ch14/*` sin publicar; los PRs encadenados quedan para cuando se decida.
