# Bitácora — CH-05: Consultas guardadas

**Fecha de inicio:** 2026-09-16
**Fecha de cierre:** 2026-09-16 — implementación completa y verificada en vivo; queda pendiente el `verify` y el archivado del change
**Tiempo invertido:** sesión asistida por agente (Claude Code), repartida en tres tandas de trabajo (módulo de rutas, suite de integración, consola + humo + documentación). No cronometrada minuto a minuto: completar con el tiempo real percibido antes de citar este dato en la tesis.

> Se escribe durante el desarrollo, apoyada en los registros de la sesión (comandos ejecutados y sus resultados), no reconstruida de memoria al final.

---

## Qué se construyó

La historia B2, y con ella el cierre del release R0. El sistema ya podía conectarse a una base ajena y ejecutar una consulta de solo lectura; ahora esa consulta se puede **guardar con un nombre y volver a usarla**. Tres rutas nuevas en `src/consultas-guardadas.ts`: `POST /consultas-guardadas` crea la fila resolviendo el tenant del lado del servidor, `GET /consultas-guardadas` devuelve el listado —solo metadatos, sin la sentencia— y `GET /consultas-guardadas/:id` devuelve la fila completa con su `sql`. No hay edición ni borrado (DEC-10) y no hay ningún vínculo con una conexión (DEC-11): la sentencia y el destino se eligen por separado en el momento de ejecutar.

La consola dejó de ser una pantalla de un solo uso. Debajo del formulario de ejecución hay una sección nueva con nombre, descripción, un botón que guarda lo que está en el editor, y la lista de lo guardado con un botón "Cargar" por fila. Cargar una consulta trae su texto al editor y deja el campo de conexión intacto, que es la consecuencia visible de DEC-11. El listado se pide al cargar la página y después de cada guardado, y el cartel de aviso ya existente se reutiliza para las dos cosas: confirmar un guardado o explicar una falla.

El listado tiene un tope duro de 200 filas con una bandera `truncado` explícita. No es pesimismo de R0: DEC-10 saca el borrado, así que esta tabla solo crece, y un `findMany` sin tope sería ilimitado a lo largo de la vida del producto. Cuando el corte ocurre, la lista lo dice; no hay paginación para ver más allá, y eso queda anotado como límite aceptado, no disimulado.

## Decisiones tomadas

Ninguna decisión de arquitectura nueva: DEC-10, DEC-11 y DEC-12 ya estaban firmes antes de empezar. Las que siguen son de nivel de diseño (precedente DEC-05) y están registradas completas en `openspec/changes/CH-05-saved-queries/design.md`.

| Decisión | Alternativa descartada | Motivo |
|---|---|---|
| `/consultas-guardadas` como colección de primer nivel | `/consultas/guardadas`, colgando de la ruta de ejecución | `consultas` en `/consultas/ejecutar` es un espacio de nombres, no una colección: no hay de qué colgar un subrecurso. Más de fondo, sugeriría que una consulta guardada es hija de una ejecución, que es justamente lo que DEC-11 niega |
| El listado lleva solo metadatos; cargar una sentencia es una segunda llamada | Mandar el `sql` en cada fila del listado | El payload del listado crecería con el largo de cada sentencia guardada, en una pantalla que muestra nombres. La carga explícita ya estaba descrita en la spec de la consola |
| Se aceptan nombres duplicados, y la interfaz se diseña sabiéndolo | Agregar una restricción de unicidad a `ConsultaGuardada.nombre` | Sería una migración, que DEC-11 descarta, y una decisión de arquitectura que ningún agente puede tomar por su cuenta. La consecuencia se lleva a la pantalla: la lista muestra la fecha al lado del nombre y el botón "Cargar" cierra sobre el `id`, nunca sobre el nombre |
| El `sql` se guarda textual, sin recortar | Guardar la sentencia ya saneada | `sanearSql` saca un `;` final: es una preocupación del camino de ejecución. Aplicarlo al guardar reescribiría en silencio la sentencia que escribió la persona. Se guarda como llegó y se vuelve a sanear al ejecutar; una prueba de ida y vuelta lo fija |
| Las lecturas no filtran por tenant | Filtrar `tenantId` en las dos rutas `GET` | Ningún camino de lectura del código filtra por tenant todavía. El aislamiento real es el contenido entero de CH-06; media implementación acá dejaría la API inconsistente y haría más difícil de revisar ese change, no más fácil |

## Fricciones encontradas

| # | Fricción | Causa | Resolución | Tiempo perdido |
|---|---|---|---|---|
| 1 | `additionalProperties: false` **no rechaza** una propiedad desconocida: la borra. Un cuerpo con `tenantId` devolvía `201`, no `400` | Fastify configura ajv con `removeAdditional`, así que ajv elimina la clave y valida lo que queda. Es la misma fricción 2 de CH-04, pero acá **sí rompió** dos escenarios de la especificación, porque acá el rechazo está escrito como criterio | Se agregó `propertyNames: { enum: [...] }` al esquema, que esa opción no afecta. Se descartó apagar `removeAdditional`: es una opción de construcción de la app, así que `src/server.ts` y cada prueba tendrían que ponerse de acuerdo, y el módulo de rutas no podría garantizar su propio contrato | Media. La seguridad nunca estuvo comprometida —el valor recortado jamás llegó a Prisma—, pero el supuesto estaba escrito en el diseño y solo se cayó al ejecutarlo |
| 2 | `camposInvalidos()` devolvía `['/']` para toda violación a nivel de clave: falta `nombre`, propiedad desconocida, lo que fuera | ajv reporta `required`, `additionalProperties` y `propertyNames` con `instancePath` vacío y deja el nombre del campo en `params` | Se corrigió en `src/conexiones.ts`: si `instancePath` no alcanza, se reconstruye el camino desde `params`. **Esto cambia la salida de CH-03 y CH-04** (`/credencial` en vez de `/`), es estrictamente más informativo, y ninguna prueba existente fijaba el valor viejo | Baja en tiempo, alta en alcance: obligó a tocar un archivo de otro change y a declararlo |
| 3 | **Un `</script>` dentro de un comentario del script embebido corta la página.** El navegador termina el elemento `<script>` en la primera secuencia de cierre que ve, aunque esté dentro de un comentario de JavaScript | Un comentario que explicaba justamente el caso hostil (`un nombre guardado que escribe una etiqueta de script`) la escribía literal | Encontrada **al verificar, no al leer**: el arnés cargó el script servido y ninguna de las funciones nuevas existía. Se reescribió el comentario sin la secuencia de cierre y se agregó una guardia en `scripts/smoke.sh` que exige exactamente un `</script>` en el documento servido | Media, y es la fricción más instructiva del change: el código compilaba, la revisión visual no lo veía, y el único que lo detectó fue el navegador —o, acá, algo que ejecutara el documento realmente servido— |
| 4 | Un acento invertido (`` ` ``) dentro del documento HTML rompe el archivo TypeScript | Toda la consola vive dentro de una plantilla de cadena de TypeScript, así que un acento invertido en un comentario HTML la termina | Lo atrapó `npm run build` con cuatro errores de sintaxis que apuntaban a líneas de HTML. Se quitaron los acentos invertidos del comentario | Baja: el compilador lo dijo enseguida y con precisión |
| 5 | No hay navegador en el entorno de la sesión, y la verificación manual de la consola es un requisito explícito de este change | Entorno, no código | Se hizo lo más cercano honesto: se pidió `/consola` a la aplicación en vivo, se extrajo su `<script>` embebido tal cual, y se **ejecutó ese código** sobre un DOM mínimo contra la API real. Diecinueve comprobaciones sobre el script que realmente se sirve, no sobre una reimplementación. Queda anotado que no es una prueba de navegador | Media, y con un residuo: lo que no cubre es el renderizado y el parseo de HTML reales. La fricción 3, que es un problema de parseo, se detectó por suerte estructural del arnés, no porque el arnés supiera parsear |
| 6 | El presupuesto de líneas declarado para la segunda tanda (600) quedó corto: la suite de integración sumó 632 | Se estimó al pedir el intento, antes de escribir las diecisiete pruebas. El propio pronóstico de `tasks.md` ya anticipaba que un archivo de pruebas nuevo pasaría las 400 líneas | El registro de intentos quedó en "requiere decisión" y bloqueó la tercera tanda hasta que el mantenedor lo reinició de forma explícita y auditada | Baja en trabajo, visible en flujo: el trabajo estaba verificado y en verde, y aun así la tanda siguiente no podía abrirse sin una decisión humana |
| 7 | `docker-compose.yml` no publica el puerto de la base, así que la suite de integración no alcanza la base desde el host | Viene así desde CH-01, y sigue siendo lo correcto para el stack | Se levantó el servicio con un archivo de override temporal **fuera del repositorio**, se corrió la suite y se borró el override. No se tocó `docker-compose.yml`: publicar el puerto de la base por defecto sería un cambio de postura del stack, no una comodidad de pruebas | Baja, recurrente. Es la segunda vez que aparece |

## Verificación

| ID | Condición inicial | Acción | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|---|
| V-1 | — | `npm run build` | Compila sin errores | Código de salida 0, sin diagnósticos | **OK** |
| V-2 | Stack levantado, puerto de `db` publicado por override temporal | `npx tsx --test src/consultas-guardadas.test.ts` | Los 17 casos de integración en verde | 17 pasan, 0 fallan | **OK** |
| V-3 | Igual que V-2 | `npm test` (suite completa, con las suites en vivo de CH-03 y CH-04 corriendo) | Sin regresiones por el cambio en `camposInvalidos` ni por la consola | 84 pasan, 0 fallan, 0 salteadas | **OK** |
| V-4 | Docker corriendo, `.env` local | `npm run smoke` | Sale con 0. Incluye la sección nueva: listado vacío, guardado, rechazo de `tenantId`, listado sin `sql`, ida y vuelta textual, `404` legible, y ejecución de la sentencia recuperada | `SMOKE TEST PASSED`, código de salida 0 | **OK** |
| V-5 | Stack levantado | Verificación de la consola: se ejecutó el `<script>` que sirve `/consola` sobre un DOM mínimo contra la API viva — listar al cargar, guardar, confirmar, listar de nuevo, cargar al editor, ejecutar, y cargar una fila inexistente | Las cuatro funciones nuevas cumplen los escenarios de `specs/query-console/spec.md` | 19 comprobaciones en verde | **OK, con reserva** — no es una prueba de navegador (ver fricción 5) |
| V-6 | Igual que V-5 | Caso hostil: guardar una consulta cuyo nombre es `<script>alert(1)</script>` y observar cómo la lista lo renderiza | El nombre aparece como texto visible; no se crea ningún nodo `script` | El nombre queda como un único nodo de texto sin hijos, y el árbol de la lista no contiene ningún elemento `script` | **OK, con reserva** — lo mismo: se verificó el mecanismo (`textContent`), no el pintado real de un navegador |
| V-7 | Después de cada corrida | Conteo de filas en la base de la aplicación | Ninguna fila de prueba sobrevive | `ConsultaGuardada` 0, `Conexion` 0 | **OK** |

Cobertura parcial declarada, no escondida: el escenario "listar cuando no hay ninguna consulta guardada" solo se observa literalmente en el humo, que corre contra una base desechable. La suite de integración comparte la base con lo que haya guardado quien desarrolla, y vaciar la tabla para observar el escenario destruiría ese dato; ahí se afirma la forma (siempre `200`, siempre un arreglo, nunca un `503`) y el `[]` literal solo cuando la tabla está realmente vacía.

## Consultas ejecutadas

Ninguna consulta de negocio: este change sigue construyendo el instrumento. La sentencia citable es la que el humo guarda y vuelve a ejecutar, porque es la que demuestra el cierre de R0 de punta a punta —escribir, guardar, recuperar y ejecutar— y porque su forma exacta es la prueba de que el texto se guarda sin retoques.

```sql
-- ejecutada 2026-09-16 sobre la base del stack local (esquema de humo ch04_smoke)
-- universo: las tres filas de la tabla de artículos que crea el propio smoke
-- se guarda con dos espacios al inicio, dos al final y un punto y coma, y se
-- recupera byte a byte idéntica antes de ejecutarse
  SELECT id, nombre FROM ch04_smoke.articulo ORDER BY id;  
```

## Notas para la tesis

- Alimenta Cap. 4 (arquitectura): el tope duro con bandera `truncado` en vez de un truncado silencioso, y el nombre elegido a propósito distinto del `hayMas` de CH-04. `hayMas` promete una página siguiente; acá no hay ninguna, y llamarlo igual habría sido prometer algo que DEC-10 no permite. Es un ejemplo chico de cómo el vocabulario de una API es parte de su contrato.
- Alimenta Cap. 4 y Cap. 6: la fricción 1 es la fricción 2 de CH-04 **una vuelta más arriba**. Ahí el supuesto no medido no rompía nada; acá rompió dos escenarios escritos. El mismo malentendido sobre la misma opción del mismo framework, con consecuencias distintas según qué se hubiera prometido por escrito. Eso es exactamente el argumento de por qué la especificación previa cambia el valor de una fricción: convierte un supuesto en algo que falla ruidosamente.
- Alimenta Cap. 6 (barreras): la fricción 3 es el mejor caso del change. Un comentario —texto que no se ejecuta, lo más inocente que hay en un archivo— rompía la página entera, y el compilador no podía verlo porque para TypeScript era una cadena válida. Solo apareció cuando algo ejecutó el documento que la aplicación realmente sirve. La distancia entre "compila", "se lee bien" y "funciona" tiene acá tres puntos distintos y medibles.
- Alimenta Cap. 6 también: la fricción 5 y su reserva. Se verificó lo más cercano posible y se dijo qué queda afuera, en vez de escribir "probado en el navegador". La diferencia entre la verificación que se hizo y la que se declara es, otra vez, el dato que el método tiene que conservar.
- Límites aceptados que quedan en pie y conviene citar como tales: las lecturas no filtran por tenant (lo cierra CH-06), pasadas 200 consultas guardadas las más viejas son inalcanzables (lo revisa B4/CH-25), una consulta guardada con un nombre equivocado no se corrige sino guardando otra (costo aceptado de DEC-10), y nada valida que una sentencia guardada sirva contra la conexión elegida al ejecutarla (costo aceptado de DEC-11).
