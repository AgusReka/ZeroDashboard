# Bitácora — CH-04: Ejecución de consultas de solo lectura

**Fecha de inicio:** 2026-09-16
**Fecha de cierre:** en curso — el apply quedó **parcial**: falta la verificación en vivo (ver "Verificación")
**Tiempo invertido:** sesión asistida por agente (Claude Code), no cronometrada minuto a minuto — completar con el tiempo real percibido antes de citar este dato en la tesis.

> Se escribe durante el desarrollo, apoyada en los registros de la sesión (comandos ejecutados y sus resultados), no reconstruida de memoria al final.

---

## Qué se construyó

Las historias A3 y B1. El sistema ejecuta por primera vez una sentencia escrita por una persona contra la base de un tenant: `POST /consultas/ejecutar` recibe `{conexionId, sql, limite, desplazamiento}`, abre un cliente PostgreSQL efímero contra la conexión guardada y devuelve `200` con la página de filas o con un veredicto de falla saneado. `GET /consola` sirve la primera superficie visual del proyecto: un documento HTML autocontenido, sin dependencias nuevas ni cambios en el build, con área de texto para la consulta, tabla de resultados, controles de página anterior y siguiente, y un único cartel de error.

La regla 3 (solo lectura en dos capas) deja de ser una intención y pasa a ser un mecanismo. La capa de aplicación son dos piernas que no se solapan: toda sentencia viaja por el protocolo extendido con un arreglo `values`, y ahí el propio protocolo de PostgreSQL rechaza un texto con más de una sentencia; y todo corre dentro de `BEGIN TRANSACTION READ ONLY`, que es lo único que detiene un CTE que borra —una sola sentencia sintácticamente, invisible para la pierna anterior—. La capa de usuario de base es una verificación de privilegios de tres piernas (`EXISTS` sobre `pg_class`/`pg_namespace` con `has_table_privilege()` y `has_schema_privilege()`) que se corre **antes** de enviar la sentencia y rechaza con motivo propio: superusuario, escritura en tabla, o `CREATE` a nivel de esquema.

El tiempo de ejecución queda acotado por dos relojes que no compiten: `statement_timeout` del lado del servidor (fijado con `set_config(..., $1, true)`, que sí acepta parámetro de bind, a diferencia de `SET LOCAL`) y el respaldo por carrera del lado del cliente, 2000 ms por encima del presupuesto. Ninguno de los dos infiere el vencimiento comparando duraciones: uno reporta el código `57014`, el otro gana una carrera. Es la lección de la fricción 2 de CH-03 aplicada por construcción.

## Decisiones tomadas

Ninguna decisión de arquitectura nueva. DEC-07, DEC-08 y DEC-09 ya estaban firmes; las que siguen son de nivel de diseño (precedente DEC-05) y están registradas en `design.md` de CH-04.

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| Un rol superusuario se bloquea de forma incondicional, en una pierna propia y evaluada primero | Confiar solo en la enumeración de privilegios, o tratar `rolsuper` como advertencia | Un superusuario saltea toda verificación de permisos, así que un resultado limpio de `has_*_privilege()` no dice nada sobre él. La enumeración igual suele atraparlo, pero falla en una base sin tablas no-sistema, y aunque acierte informa "este rol escribe en una tabla", que es una forma confusa de decir "este rol es superusuario" |
| Se confía en `has_*_privilege()` para resolver las cadenas de herencia `INHERIT` | Recorrer `pg_auth_members` a mano | Son funciones de *evaluación* de privilegios: contestan la misma pregunta que se hace el ejecutor, con la misma evaluación de máscara de acceso. Reimplementarla a mano sería reimplementarla peor. El hueco residual (`NOINHERIT` + `SET ROLE`) se documenta y lo contiene la transacción de solo lectura, que `SET ROLE` no levanta |
| Un clasificador hermano (`classifyExecutionError`) en vez de ampliar `classifyConnectionError` | Ampliar la tabla de ocho filas de CH-03 con los SQLSTATE de ejecución | La tabla de CH-03 describe una fase donde un `42601` no puede ocurrir, y está fijada por `src/db-probe.test.ts`. Fusionarlas daría una función cuyo resultado significa cosas distintas según cuándo se la llamó. Los dos saneadores compartidos sí se **movieron** (no se copiaron) a `src/pg-error.ts` |
| La consola es una ruta que devuelve un documento autocontenido | `@fastify/static` con un directorio `public/`, o un motor de plantillas, o un framework de frontend | Es la respuesta convencional y el tamaño equivocado: agrega una dependencia de runtime y, como `tsc` no copia archivos que no son TS, también un paso de build, todo para un solo archivo |
| Todo valor se asigna con `textContent`, nunca con `innerHTML` | Armar las filas concatenando HTML | Las filas son datos arbitrarios de un tercero y esta es la primera superficie de navegador del proyecto: con `innerHTML`, un `<script>` guardado en los datos del tenant se ejecutaría en la sesión de quien opera. Es un mecanismo, no una convención |

## Fricciones encontradas

| # | Fricción | Causa | Resolución | Tiempo perdido |
|---|---|---|---|---|
| 1 | **No hubo Docker en la sesión del apply.** El daemon no estaba corriendo (`failed to connect to the docker API at npipe:...`), así que ninguna de las verificaciones que necesitan un PostgreSQL vivo pudo ejecutarse | El entorno de la sesión, no el código | Se escribió el código y las pruebas completos, se corrió todo lo que no necesita servidor (tipos y unitarias), y se reportó el resto como **pendiente** en vez de darlo por verde. La suite de integración se saltea sola con un motivo cuando no hay servidor, igual que la de CH-03 | Alta en cobertura: las cinco afirmaciones más caras de este change son justamente las que solo el motor real puede confirmar |
| 2 | `additionalProperties: false` **no rechaza** propiedades desconocidas en Fastify: las borra | Fastify configura ajv con `removeAdditional`, así que el esquema se cumple recortando el cuerpo en vez de fallando | Se verificó con una prueba en proceso: la propiedad desconocida no llega al handler ni se refleja en la respuesta, que es lo que la regla 7 exige. Queda registrado porque el esquema *parece* prometer un rechazo y no lo hace — y el mismo esquema de CH-03 tiene la misma conducta | Baja — pero es exactamente el tipo de supuesto que se cita mal en una tesis si no se mide |
| 3 | `docker-compose.yml` no reenvía `QUERY_TIMEOUT_MS` ni `CONNECTION_TEST_TIMEOUT_MS` al contenedor `app` | El servicio `app` declara solo `DATABASE_URL`, `APP_PORT` y `NODE_ENV`; viene así desde CH-01 | Se documentó la variable en `.env.example` y el smoke asume el valor por defecto (15000 ms) en vez de fingir que `.env` lo cambia. **No se tocó `docker-compose.yml`**: está fuera del alcance de este change y corregirlo a las apuradas repetiría el error que CH-03 evitó al reportar en vez de parchear | Baja en tiempo, pendiente como deuda registrada |

## Verificación

| ID | Condición inicial | Acción | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|---|
| V-1 | — | `npx tsc --noEmit -p tsconfig.json` | Compila sin errores | Sin salida, código de salida 0 | **OK** |
| V-2 | — | `npx tsx --test src/db-probe.test.ts` después de mover los saneadores y extraer la carrera de conexión | 20/20, sin cambiar una línea del archivo de pruebas | 20/20 | **OK** |
| V-3 | — | `npx tsx --test src/consulta-ejecucion.test.ts` (filas del clasificador, `sanearSql`, saneamiento) | Todas en verde | 23/23 | **OK** |
| V-4 | Sin base de datos ni Docker | Arnés en proceso con `app.inject`: `GET /consola`, `sql` vacío, `limite` fuera de rango, `conexionId` inexistente | `200` HTML con área de texto, control de ejecución, tabla, paginación y cartel; `400` antes de tocar la base; `404` legible; cero `innerHTML` | Los cinco casos en verde | **OK** |
| V-5 | Stack levantado con el puerto de `db` publicado | `npm test -- src/consultas.test.ts` (16 casos de integración) | 16/16 | **No ejecutado** — sin Docker en la sesión | **PENDIENTE** |
| V-6 | Docker corriendo, `.env` local | `npm run smoke` | Sale con 0, sin credenciales en ninguna respuesta ni línea de log | **No ejecutado** | **PENDIENTE** |
| V-7 | Stack levantado | Manual: `GET /consola` en un navegador, ejecutar un `SELECT`, paginar, provocar una falla | Tabla paginada y cartel legible | **No ejecutado** | **PENDIENTE** |

Las tres verificaciones pendientes son las que cubren los escenarios que este change existe para sostener: el CTE que borra contra `25006`, las cuatro roles de DEC-08, las dos mitades de la herencia de roles, el corte por tiempo y la paginación. **Ninguna afirmación sobre el motor real debe citarse en la tesis hasta que V-5 a V-7 estén en verde.**

## Consultas ejecutadas

Ninguna consulta de negocio todavía: este change construye el instrumento, no lo usa. Las dos sentencias citables que el sistema emite por su cuenta son la verificación de privilegios y el envoltorio de paginación, ambas fijas y parametrizadas.

```sql
-- verificación de privilegios del rol conectado, emitida por la aplicación
-- dentro de la transacción de solo lectura, sin ninguna entrada del usuario
-- universo: todos los objetos no-sistema de la base de destino
SELECT
  EXISTS (SELECT 1 FROM pg_catalog.pg_roles
           WHERE rolname = current_user AND (rolsuper OR rolbypassrls))        AS es_superusuario,
  EXISTS (SELECT 1 FROM pg_catalog.pg_class c
           JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relkind IN ('r','p','v','m','f')
            AND n.nspname <> 'information_schema' AND n.nspname NOT LIKE 'pg\_%'
            AND has_table_privilege(c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE'))   AS escribe_en_tabla,
  EXISTS (SELECT 1 FROM pg_catalog.pg_namespace n
          WHERE n.nspname <> 'information_schema' AND n.nspname NOT LIKE 'pg\_%'
            AND has_schema_privilege(n.oid, 'CREATE'))                         AS crea_en_esquema;

-- envoltorio de paginación: la sentencia de la persona entra como subconsulta y
-- los límites viajan como parámetros del driver, nunca concatenados
SELECT * FROM (<sentencia saneada>) AS _consulta_usuario LIMIT $1 OFFSET $2;
```

## Notas para la tesis

- Alimenta Cap. 4 (arquitectura): las dos capas de la regla 3 como mecanismos independientes y no redundantes. El CTE que borra es el ejemplo exacto de por qué una sola capa no alcanza — es una sentencia, pasa la pierna del protocolo intacta, y solo la transacción de solo lectura lo detiene.
- Alimenta Cap. 4 también: la precedencia de bloqueo con categorías separadas (`rol-superusuario`, `rol-con-escritura-en-tabla`, `rol-con-create-en-esquema`). Un "bloqueado" genérico habría sido más corto de escribir y le habría dicho a quien opera exactamente nada sobre qué cambiar.
- Alimenta Cap. 6 (barreras/resultados): la fricción 1 es el reverso del hallazgo de CH-03. Ahí el sistema real encontró lo que el compilador no; acá el sistema real no estuvo disponible, y lo honesto fue marcar el change como parcial en vez de declarar verde lo que nunca corrió. La diferencia entre "las pruebas están escritas" y "las pruebas pasaron" es precisamente el dato que el método debe conservar.
- Alimenta Cap. 6: la fricción 2 es un caso chico y limpio de supuesto no medido. El esquema dice `additionalProperties: false` y una lectura razonable concluye "rechaza"; la conducta real es "recorta". Ninguna de las dos es insegura acá, pero la brecha entre lo que un archivo de configuración parece prometer y lo que el framework hace con él es material de la barrera de entrada técnica.
- El límite aceptado y no prevenido sigue en pie: un comentario `--` o un `/* */` sin cerrar al final de la consulta rompe el envoltorio de paginación y falla cerrado con un error de sintaxis. DEC-09 no tiene parser por diseño, así que esto se informa como límite, no se parchea con una expresión regular.
