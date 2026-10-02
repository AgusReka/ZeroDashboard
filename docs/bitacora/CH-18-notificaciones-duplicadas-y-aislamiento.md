# Bitácora — CH-18: Notificaciones duplicadas y aislamiento de fallos entre tenants (X6, X8)

**Fecha de inicio:** 2026-10-02 (exploración, DEC-107 a DEC-111, artefactos SDD y apply)
**Fecha de cierre:** pendiente (falta verify y archive)
**Tiempo invertido:** sesión asistida por agente (Claude Code), ciclo SDD con TDD estricto. Marcas de los commits del 2026-10-02: exploración y DEC-107 a DEC-111 a las 11:34; propuesta, specs y diseño a las 11:41; tareas a las 11:42; unidad 1 a las 11:50; unidad 2 a las 12:00; la unidad 3 (esta bitácora y la limpieza de comentarios) se hizo a continuación, en la misma sesión. **Completar con el tiempo real percibido antes de citar este dato en la tesis**: las marcas acotan los commits, no la exploración, las decisiones ni el trabajo previo a cada commit.

> Se escribe durante el apply de la unidad 3 (2026-10-02), apoyada en los artefactos del change (`openspec/changes/CH-18-notificaciones-duplicadas-y-aislamiento/`, en particular la evidencia del spike en `apply-progress.md`), en los mensajes de commit y en DEC-107 a DEC-111. No reconstruida de memoria.

---

## Qué se construyó

X8 pide que el fallo de un tenant no frene a los demás. X6 pide que una ejecución produzca como máximo una notificación. Antes de este change, una excepción fuera de `correr()` en un tenant (por ejemplo, en el listado de sus automatizaciones) abortaba el tick entero, y los tenants siguientes perdían su ventana (DEC-95). El envío ya ocurría una vez por corrida, pero no era un invariante declarado, y un corte del proceso o un envío vencido por tiempo dejaban el registro sin saber si el correo había salido.

- **Captura por tenant** (DEC-109; unidad 1): `ejecutarTick` en `src/planificador.ts` envuelve el paso de cada tenant en su propio `try/catch`, con el mismo patrón que el barrido de arranque (DEC-102). El fallo se registra con nivel `error` y campos cerrados (`tenantId`, `error: 'error-interno'`, `nombreError`); nunca el mensaje, la traza ni el nombre del tenant. No escribe fila, y la ventana de ese tenant para ese tick no se recupera: `anterior` ya avanzó (DEC-95).
- **Tick serial** (DEC-110; unidad 1): un tenant por vez y una automatización por vez. Una prueba de guarda retiene el primer listado y verifica que el segundo tenant espera.
- **Listener de `'error'` en la conexión del agente** (DEC-111; unidad 1): `cliente.on('error', () => {})` en `iniciarConexion` (`src/db-probe.ts`), justo después de `new pg.Client`. Se agregó porque el spike probó el cierre del proceso (ver más abajo). El error nunca se lee: la falla ya llega al llamador por el `connect` o la consulta rechazados, y ningún texto del driver cruza ese límite (regla 5).
- **Como máximo un envío por corrida** (DEC-107; unidad 2): pruebas de guarda sobre cada camino (reintento del dial, solapamiento, `detener()` durante un envío, tiempo agotado). En todos se llama al notificador una vez o ninguna.
- **Marca `enviando`** (DEC-108; unidad 2): `notificar(…, id)` escribe `notificacion = 'enviando'` en la fila de la corrida con el cliente con alcance (regla 2), después de componer el correo y antes de `notificador.enviar`. Un fallo al componer no deja marca; un fallo al escribir la marca termina en `fallo`/`notificacion`/`error-interno`/`fallo-envio` sin llamar al notificador. El cierre sobrescribe la marca con el resultado (`enviada` o `fallo-envio`), en la misma escritura de siempre.
- **Barrido a `incierta`** (DEC-108; unidad 2): el barrido de arranque hace dos escrituras por tenant. La primera cierra las filas `en-curso` con la marca como `fallo`/`interrumpida` con `notificacion = 'incierta'`; la segunda cierra el resto con `notificacion` nula, como antes. El orden importa: la segunda borraría la marca. `cerradas` es la suma y el log agrega `inciertas`.
- **Tipos** (unidad 2): `EstadoNotificacion` suma `'enviando' | 'incierta'`; `MarcaNotificacion` los agrupa y `CierreNotificado.notificacion` los excluye, así que el compilador impide cerrar una fila con cualquiera de los dos.
- **Consola** (unidad 2): etiquetas `Envío en curso` y `Sin confirmar: puede haberse entregado`. El mensaje de `notificacion:tiempo-agotado` dice ahora que el envío no se confirmó y que el correo puede haberse entregado; ya no afirma que no se envió. Los valores crudos nunca llegan a la página.
- Sin migración (`notificacion` es texto), sin SQL crudo, sin dependencias nuevas y sin paralelismo.

## Evidencia del spike (DEC-111)

DEC-111 condicionó el listener a una prueba que confirmara el cierre del proceso. La prueba corre en un proceso hijo, para que un cierre termine el hijo y nunca el runner: `node --import tsx --input-type=module --eval <script fijo>`, sin shell, con las credenciales por variables de entorno y un corte a los 15 s. El hijo marca por un reenviador `net` local, inicia sesión con `iniciarConexion` y después destruye todos los sockets del reenviador. Imprime `SOBREVIVIO` y sale con 0 si el proceso sigue vivo.

Entorno: Node v24.19.0, `pg` 8.23.0, PostgreSQL 16 (contenedor de prueba en el puerto 5434), Windows 11. No hizo falta el respaldo con la CLI de `tsx`: el módulo `.ts` se resolvió con una URL `file:` pasada por el entorno.

| Escenario | `db-probe.ts` sin cambios | Con el listener |
|---|---|---|
| (a) sockets destruidos con el cliente inactivo después del login | Cierre del proceso en 6 de 6 corridas: código 1, `Unhandled 'error' event`, `Error: Connection terminated unexpectedly`, `Emitted 'error' event on Client instance` | Sobrevive en 3 de 3 corridas y en la suite completa: código 0, `SOBREVIVIO` |
| (b) sockets destruidos 200 ms después de iniciar `SELECT pg_sleep(5)`, con el rechazo manejado | Cierre del proceso en 6 de 6 corridas: el mismo `Unhandled 'error' event` sobre la instancia de `Client`, código 1 (el proceso muere antes de imprimir el rechazo manejado) | Sobrevive en 3 de 3 corridas y en la suite completa: código 0, `CONSULTA rechazada`, `SOBREVIVIO` |

Resultado: el cierre quedó probado y es determinista, así que se agregó el listener y los dos escenarios quedaron como pruebas de regresión en `src/db-probe.test.ts`. El pool `PrismaPg` de la base propia queda fuera del alcance de este listener (ver límites).

## Decisiones tomadas

DEC-107 a DEC-111 se decidieron con el usuario el 2026-10-02, en la exploración de CH-18, eligiendo en cada caso la opción recomendada. El diseño no necesitó decisiones nuevas.

| Decisión | Qué fija |
|---|---|
| DEC-107 | «Mismo evento» es una ejecución; el envío es como máximo una vez, sin reintento ni supresión por contenido o por tiempo |
| DEC-108 | Marca `enviando` antes del envío; el barrido la cierra como `incierta`; el envío vencido por tiempo se muestra como «puede haberse entregado» |
| DEC-109 | Captura por tenant con log de campos cerrados; un fallo a nivel de tenant queda solo en el log |
| DEC-110 | El tick sigue serial; carriles, lazos por tenant y cortacircuitos quedan como límite |
| DEC-111 | La ventana de carrera de DEC-96 sigue cerrada; listener de `'error'` solo si una prueba prueba el cierre del proceso |

## Fricciones encontradas

| # | Fricción | Causa | Resolución | Tiempo perdido |
|---|---|---|---|---|
| 1 | La unidad 1 midió 358 líneas agregadas y 13 quitadas contra un pronóstico de 110–150 | El pronóstico no contó el arnés del spike (unas 125 líneas: proceso hijo, reenviador, dos escenarios) ni los artefactos `tasks.md` y `apply-progress.md` | Cubierto por el `size:exception` aceptado. No se comprimió código para entrar en el tope | no medido |
| 2 | La unidad 2 midió 503 líneas agregadas y 46 quitadas contra un pronóstico de 280–340 | La mayor parte son pruebas de integración en `src/planificador.test.ts` (unas 295 líneas) | Cubierto por el `size:exception` aceptado | no medido |
| 3 | Dos pruebas existentes cambiaron a propósito | La marca de DEC-108 cambia lo que se lee durante el envío y la forma del barrido | Prueba 5.7 de CH-14: dentro de `enviar`, `notificacion` pasa de `null` a `'enviando'`. Prueba 1.2 de CH-17a: espera dos escrituras de barrido por tenant, primero la de `incierta`. Se señalan en el PR | no medido |
| 4 | Algunas pruebas pasaron antes del paso GREEN | El código ya era serial y ya enviaba una sola vez | La prueba 1.3 y las cuatro de 2.8 quedan como guardas del comportamiento existente, no como RED | no medido |
| 5 | `npm test` fallaba contra el puerto 5432 | En esta máquina el 5432 es de la PostgreSQL de otro proyecto | Se usó el contenedor `zd-ch09-testdb` con `TEST_DB_PORT=5434` | no medido |
| 6 | La numeración de pruebas de `tasks.md` no coincide con la tabla de pruebas de `design.md` | Los dos artefactos numeraron por separado | Los nombres de las pruebas siguen `tasks.md` | no medido |
| 7 | `tasks.md` cita una plantilla de bitácora (`docs/bitacora/_plantilla.md`) que no existe | Referencia del artefacto de tareas (igual que en CH-17a y CH-17b) | Se siguió la estructura de la bitácora de CH-17b | no medido |
| 8 | `openspec/config.yaml` sigue con `strict_tdd: false` | Quedó del init del proyecto | El orquestador inyectó TDD estricto; no se editó la configuración | no medido |

## Límites del artefacto (aceptados)

Regla 6: ningún caso de esta tabla se cubrió ampliando el motor.

| Límite | Origen | Notas |
|---|---|---|
| No hay supresión por contenido ni enfriamiento por tiempo | DEC-107 (X6-D) | Dos corridas seguidas con las mismas filas envían dos correos. Suprimirlas exige estado persistido o configuración por plantilla |
| No hay tabla de notificaciones ni clave de idempotencia | DEC-108 (X6-C) | El registro del envío es la columna `notificacion` de la fila de la corrida |
| El tick sigue serial | DEC-110 (X8-B, X8-C, X8-D) | Sin carriles por tenant, sin lazos independientes y sin cortacircuitos. Una conexión caída sigue demorando a los demás tenants hasta la cota de DEC-98 (con los valores por defecto, unos 25 s) |
| El pool `PrismaPg` de la base propia no está cubierto por el listener | DEC-111 | El listener cubre solo el `pg.Client` del agente en `src/db-probe.ts`. El comportamiento del pool ante una conexión que muere no se verificó en este change |
| La ventana del tenant que falla no se recupera | DEC-95, DEC-109 | Un fallo a nivel de tenant no escribe fila: la única constancia es la línea de log con nivel `error` |
| `enviando` no garantiza que el envío haya empezado | DEC-108 | Un corte entre la escritura de la marca y `enviar` deja la fila marcada; el barrido la registra como `incierta` aunque el correo no haya salido. Es conservador a propósito |
| `incierta` no garantiza que el correo no haya salido | DEC-108 | Si el envío terminó y falló la escritura del cierre, la fila queda `en-curso`/`enviando` hasta el próximo arranque y se registra como `incierta`. No se reenvía (DEC-97) ni se re-ejecuta la corrida (DEC-99) |
| Un envío vencido por tiempo sigue registrado como `fallo-envio`/`tiempo-agotado` | DEC-108 | Solo cambia el texto de la consola («puede haberse entregado»). La misma categoría cubre el `ETIMEDOUT` de nodemailer |
| Las dos escrituras del barrido no son atómicas | DEC-102, DEC-108 | Si la segunda falla, las filas que cerró la primera quedan cerradas y el resto sigue `en-curso` hasta el próximo arranque |
| La ventana de carrera de DEC-96 sigue cerrada solo con tick serial e instancia única | DEC-75, DEC-99, DEC-111 | Sin índice único parcial: no hay defensa en base contra una segunda instancia |

**Rollback:** revertir el PR. No hay migración. El barrido anterior pone en nulo una marca `enviando`, y una fila `incierta` se muestra con el marcador `—` en la consola.

## Cambios a especificaciones existentes

Los aplica el archive sobre `openspec/specs/**`.

- **automation-scheduling**: el requisito «A Run's Failure Does Not Stop the Tick for Other Automations (Not CH-18 Isolation)» pasa a «A Failure Does Not Stop the Tick for Other Automations or Tenants» (DEC-109); se agregan el tick serial (DEC-110) y la conexión del agente que no termina el proceso (DEC-111, aplicable porque el spike probó el cierre); cambia el texto del propósito.
- **email-notification**: como máximo un envío por corrida (DEC-107); marca escrita antes del envío (DEC-108); el envío vencido por tiempo puede haberse entregado.
- **execution-log**: `enviando` e `incierta` entran al conjunto de `notificacion`; el barrido ya no deja siempre `notificacion` nula.
- **query-console**: etiquetas de `enviando` e `incierta` y texto del tiempo agotado.
- **tenant-isolation**: sin cambio de spec; las pruebas nuevas verifican el contexto propio de cada tenant y los campos cerrados del log ante un fallo.

## Verificación

Al cierre del apply de la unidad 1: 676/676 tests contra una PostgreSQL de prueba. Al cierre de la unidad 2: 687/687 (base 671 más 16 pruebas nuevas). Al cierre de la unidad 3, solo comentarios y documentación: 687/687. `npx tsc --noEmit` sin errores en cada unidad. En `prisma/` solo cambió un comentario de `schema.prisma` (unidad 3); no hay migración. Falta la corrida de verify.

## Pendientes fuera de CH-18

- Conectividad definitiva del agente (CH-19, DEC-94). El listener de DEC-111 solo endurece el `pg.Client` actual.
- Auditoría de ejecución de consultas (CH-20, A5). Los fallos a nivel de tenant quedan solo en el log (DEC-109).
- Pasada manual de la consola en un navegador para las etiquetas `Envío en curso` y `Sin confirmar: puede haberse entregado`.
