# Bitácora — CH-03: Registro y prueba de conexiones

**Fecha de inicio:** 2026-09-15
**Fecha de cierre:** 2026-09-15 (sesión única, entregada en tres PR encadenados)
**Tiempo invertido:** sesión asistida por agente (Claude Code), no cronometrada minuto a minuto — completar con el tiempo real percibido antes de citar este dato en la tesis.

> Se escribe durante el desarrollo, apoyada en los registros de la sesión (comandos ejecutados y sus resultados), no reconstruida de memoria al final.

---

## Qué se construyó

La historia A1 completa: registrar la conexión a la base de un tenant y probarla con un resultado visible. Dos operaciones separadas — `POST /conexiones` persiste la fila contra el `Tenant` sembrado en CH-02 y devuelve `201`; `POST /conexiones/:id/prueba` abre un cliente PostgreSQL efímero contra el destino guardado, corre un `SELECT 1` literal y devuelve `200` con el veredicto. Una prueba que corrió es una operación exitosa aunque la conexión falle: los códigos HTTP de error quedan reservados para fallas de la petición misma (`400` de esquema, `404` de id desconocido, `503` sin tenant sembrado).

El fallo se clasifica en seis categorías distinguibles (`tiempo-agotado`, `host-inalcanzable`, `dns-no-resuelve`, `credenciales-invalidas`, `base-inexistente`, `error-desconocido`) a partir de una tabla de ocho filas. La credencial nunca sale: `ConexionPublica` es una lista blanca de `select` de Prisma que no incluye `credencial`, el error crudo del driver muere dentro de `probeConnection()`, el `codigo` publicado pasa por una lista blanca de forma (`/^[0-9A-Z]{5}$/` o `/^E[A-Z]{2,20}$/`) y el log de falla es un resumen saneado, nunca `app.log.error(error, …)` como en `src/health.ts`.

Es el primer change del proyecto entregado como cadena de PR apilados sobre `main` (motor + rutas + integración), y el primero con suite de pruebas automatizadas: 24 casos entre unitarios e integración, más una sección nueva de `scripts/smoke.sh` que recorre los cuatro escenarios contra el stack real de Docker Compose.

## Decisiones tomadas

Ninguna decisión de arquitectura nueva: las cuatro siguientes son de nivel de diseño, bajo el precedente DEC-05, y quedan registradas en `design.md` de CH-03. D-4 (motores admitidos) sigue abierta a propósito.

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| El motor guardado no interviene nunca en la prueba: se marca siempre la sonda PostgreSQL fija contra el host y puerto guardados | Marcar según `motor` con un registro de drivers, o rechazar con `422` antes de abrir el socket | Un registro de drivers resolvería D-4 por accidente y traería un driver MySQL a R0 para un tenant que no existe; la compuerta `422` contradice el escenario del spec que exige que la sonda **igual se intente**. Un destino que no habla el protocolo cae en `error-desconocido` por la misma tabla, sin categoría ni forma de respuesta nuevas |
| Dos operaciones (registrar / probar), no una combinada | Un solo `POST /conexiones` que persista y pruebe en la misma respuesta | Acoplar la persistencia a la disponibilidad de un tercero: una réplica caída un minuto bloquearía el alta. A1 pide un resultado **repetible**, no uno de una sola vez |
| Una prueba completada es `200` con el veredicto en el cuerpo | Mapear las categorías a `502`/`504`/`401`/`404` | Colapsa seis categorías distinguibles en menos códigos e invita a clientes y proxies a leer la contraseña equivocada de un tenant como una falla de transporte reintentable de *nuestra* API |
| El tenant se resuelve en el servidor, nunca lo manda el cliente | Aceptar `tenantId` en el cuerpo del alta | Aceptarlo se adelantaría a T1/T2 (CH-06) sin ninguna de sus garantías de aislamiento |
| El presupuesto de la prueba se decide por carrera, no midiendo el tiempo transcurrido (corrección durante el apply — ver fricción 2) | Comparar la duración medida contra el presupuesto, con o sin tolerancia | Ver la fricción 2: la comparación pregunta por una inferencia donde se puede tener un hecho |

## Fricciones encontradas

| # | Fricción | Causa | Resolución | Tiempo perdido |
|---|---|---|---|---|
| 1 | La sección CH-01 de `scripts/smoke.sh` tenía un `sleep 3` fijo antes del primer `/health`, pero el contenedor `app` tarda ~17s en atender (migra y siembra antes de escuchar). Bajo `set -e` el script moría ahí sin decir por qué | Una espera fija asumiendo un arranque que nunca se midió | Se reemplazó por `wait_for_app`, un sondeo acotado a 60s contra `/health` | Baja — pero la falla era muda, que es lo que la hace cara de encontrar |
| 2 | **La clasificación de `tiempo-agotado` era una carrera al filo.** La fila 1 de la tabla era `elapsedMs >= timeoutMs`, sin tolerancia. Contra un host inenrutable dentro de Compose salió `{"categoria":"error-desconocido","duracionMs":4998}` con un presupuesto de 5000 ms: un timeout genuino, mal clasificado | Una expiración de `connectionTimeoutMillis` de `pg` no trae ningún código legible por máquina, así que el diseño usó el reloj como única señal. Pero la comparación le pregunta a una duración medida si supera el presupuesto contra el que fue medida, y el instante en que el driver rechaza y el instante en que leemos el reloj son dos instantes distintos, con el reloj del invitado libre de saltar entre medio. Muestreado daba un margen de +1 a +17 ms: acertar era suerte | Se rehízo `probeConnection()` para **correr su propio temporizador contra `connect()`**. Si gana el temporizador, el presupuesto se agotó como hecho, no como inferencia, y `classifyConnectionError` dejó de recibir el reloj: ahora es función pura del error y solo ve errores que el driver produjo de verdad. `connectionTimeoutMillis` queda como respaldo del driver, a 500 ms por encima del presupuesto, para que los dos temporizadores nunca compitan entre sí | Alta — se encontró recién al probar contra Compose, y el intento anterior se cerró sin parchear porque el arreglo caía fuera de su unidad de trabajo |
| 3 | Al rehacer la carrera apareció una segunda falla, invisible en el diseño: `await client.end()` sobre un socket que todavía está conectando **no resuelve nunca**. Medido contra `pg@8.23.0`, colgado indefinidamente tanto contra una dirección inenrutable como contra un listener local mudo | `client.end()` encola un FIN que no se puede mandar hasta que el handshake TCP termine, y espera el evento `end` que por eso nunca llega. Antes no se notaba porque el que destruía el socket era el temporizador interno de `pg`, no nosotros | `end()` se sigue emitiendo en todos los caminos y su resultado se sigue descartando sin leer, pero solo se **espera** cuando el driver ya había resuelto; en el camino que gana nuestro temporizador, el socket lo recupera el respaldo. Esperarlo ahí haría que la sonda sobreviviera al presupuesto que existe para acotarla | Media — se detectó antes de escribir el código final, con un script de medición de diez líneas, no depurando la suite |
| 4 | Las pruebas de integración corren en el host, pero `docker-compose.yml` no publica el puerto de `db` (y publicarlo en el archivo versionado sería cambiar el entorno de todos para comodidad de uno) | El destino de las pruebas vive dentro de la red de Compose | La suite lee `TEST_DB_HOST`/`TEST_DB_PORT` y, si nadie contesta, se saltea entera con un motivo en vez de fallar — así `npm test` sigue corriendo sin Docker. Para las corridas en vivo se publicó el puerto con un archivo de override fuera del repositorio. `scripts/smoke.sh` no necesita nada de esto: corre dentro de la red de Compose | Baja |
| 5 | El presupuesto de 400 líneas de revisión se agotaba antes de terminar el change, tres veces seguidas | El change entero rondaba las 550–650 líneas | Se entregó como cadena de tres PR apilados sobre `main` (motor de sonda → rutas y cableado → integración, smoke y documentación), cada uno con su propio alcance, su verificación y su punto de reversión. El registro de intentos se reinicia por unidad de trabajo, así que cada eslabón se adquiere y se salda por separado, y el intento que arregló la fricción 2 quedó encadenado a la evidencia del intento que la encontró | Baja en tiempo, alta en ceremonia — pero es exactamente la restricción que hizo que la fricción 2 se reportara en vez de parchearse a las apuradas fuera de alcance |

> Las fricciones 2 y 3 son el mismo hallazgo visto dos veces: un límite de tiempo que se **infiere** después de los hechos no es un límite, es una apuesta con buenas probabilidades. La 2 se manifestó como una clasificación equivocada cada tantas corridas; la 3 habría sido un cuelgue indefinido. Ninguna de las dos la podía ver `tsc`, ninguna la podía ver una revisión de código leyendo el diseño, y la 2 pasó cuatro corridas verdes antes de fallar. Es el tercer caso del proyecto —después de la fricción 9 de CH-01 y la 5 de CH-02— en que el stack real encuentra lo que el compilador no.

## Verificación

| ID | Condición inicial | Acción | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|---|
| V-1 | Stack levantado, `Tenant` sembrado | `POST /conexiones` con los siete campos | `201` con `ConexionPublica`, sin la credencial | `201`; la respuesta no contiene el valor enviado | **OK** |
| V-2 | Conexión registrada contra el `db` de Compose | `POST /conexiones/:id/prueba` | `200 {resultado:"ok", categoria:null, codigo:null}` | Confirmado exactamente | **OK** |
| V-3 | Conexión registrada con contraseña incorrecta | Misma acción | `credenciales-invalidas`, `28P01` | Confirmado — cierra el hueco de investigación sobre los códigos exactos de `pg` | **OK** |
| V-4 | Conexión registrada contra una base inexistente | Misma acción | `base-inexistente`, `3D000` | Confirmado | **OK** |
| V-5 | Conexión registrada contra `192.0.2.1` (RFC 5737, los paquetes se descartan, no se rechazan) | Misma acción | `tiempo-agotado` dentro del presupuesto | Confirmado; **12/12 muestras** por la ruta viva dentro de Compose, todas `tiempo-agotado` | **OK** |
| V-6 | — | `npx tsx --test src/db-probe.test.ts` (20 casos: ocho filas, lista blanca de `codigo`, no-`Error`, saneamiento, y la carrera de `probeConnection` contra un listener local mudo) | 20/20 | 20/20, sin servidor PostgreSQL de por medio | **OK** |
| V-7 | Stack levantado con el puerto de `db` publicado | `npm test` **cinco veces seguidas** | 24/24 en cada corrida, incluido el caso 5.4 | 24/24 las cinco veces — la carrera quedó determinista, no acertada por suerte | **OK** |
| V-8 | — | `npx tsc --noEmit -p tsconfig.json` | Compila sin errores | Sin salida, código de salida 0 | **OK** |
| V-9 | Docker corriendo, `.env` local | `npm run smoke` (dos corridas completas) | Sale con 0, sin credenciales en ninguna respuesta ni línea de log | `SMOKE TEST PASSED` las dos veces; `unroutable host -> tiempo-agotado in 5s` | **OK** |

Los cinco requisitos de `specs/connection-registration/spec.md` quedan verificados de punta a punta. Filas de prueba borradas después de verificar (`DELETE FROM "Conexion"` → `count 0`); el override de puerto nunca tocó un archivo versionado; stack bajado limpio al cierre.

## Consultas ejecutadas

No aplica en el sentido de la plantilla. La única sentencia que este change ejecuta contra una base ajena es la sonda `SELECT 1`, literal y sin parámetros, que no produce ningún dato citable: su valor de retorno se descarta y lo único que se observa es si llegó a completarse. La primera consulta citable llega con CH-04, que es el change que ejecuta consultas de verdad.

```sql
-- ejecutada 2026-09-15 contra el destino de cada conexión registrada
-- universo: ninguno — es una sonda de conectividad, no una consulta de negocio
SELECT 1;
```

## Notas para la tesis

- Alimenta Cap. 4 (arquitectura): la separación alta/prueba, el `200` con veredicto en el cuerpo, y las cuatro barreras de contención de credenciales (lista blanca de `select`, contención del error crudo, lista blanca de forma del `codigo`, log saneado) como mecanismos y no como convenciones.
- Alimenta Cap. 6 (barreras/resultados): la fricción 2 es el mejor caso del proyecto hasta ahora para sostener que la verificación contra un sistema real no es una formalidad de cierre. El defecto pasó por diseño, revisión y cuatro corridas verdes; lo encontró una prueba de integración en vivo, con un margen de dos milisegundos. Y la distinción que dejó es transferible: donde se puede tener un hecho (quién ganó la carrera) no conviene conformarse con una inferencia (cuánto marcó el reloj).
- La fricción 5 es material de proceso citable: un presupuesto de revisión fijo obliga a partir el trabajo, y esa partición fue lo que hizo que el defecto de la fricción 2 se **reportara** en vez de parchearse fuera de alcance en la misma corrida que lo encontró. Vale la pena registrarlo como un efecto del método, no como un costo del método.
