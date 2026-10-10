# Verificación de los puntos pendientes de la tesis contra el repositorio

Consulta realizada el **2026-10-01**. Los puntos 2 a 5 se verificaron entre las 10:54 y las 11:10 (-03:00); el **punto 1 se repitió a las 11:50 (-03:00)** con `master` actualizado tras fusionar el PR #50 (CH-17a). Solo lectura: no se modificaron `master` ni las ramas de experimentos, y no se hicieron commits. Repositorio: `AgusReka/ZeroDashboard`.

**Estado de `master`.** El PR #50 (CH-17a) ya está fusionado: `master` está en `e0dfe7c` e incluye CH-17a. Los datos del punto 1 corresponden a ese estado.

Lo que quedó **sin poder verificarse** está marcado como tal en cada punto.

---

## 1. Fecha de corte y estado de `master` (sección 5.1)

**Fecha de corte propuesta y confirmada:** 01/10/2026.

| Dato | Valor | Comando o fuente | Consulta |
|---|---|---|---|
| Etiqueta de congelamiento | `congelamiento-tesis-2026-09-24` → `a1704bc` (24/09/2026 15:35:34 -03:00), "CH-09: document DEC-36 exception on task 4.1 byte-identity check" | `git log -1 congelamiento-tesis-2026-09-24` | 2026-10-01 11:50 |
| **N** (commits desde la etiqueta) | **148** (de ellos, 46 son merges) | `git rev-list --count congelamiento-tesis-2026-09-24..master` y `git rev-list --merges --count ...` | 2026-10-01 11:50 |
| **M** (archivos modificados) | **200** archivos, +30.779 / −188 líneas | `git diff --stat congelamiento-tesis-2026-09-24 master` | 2026-10-01 11:50 |
| **Hash** del último commit de `master` | **`e0dfe7c`** (merge del PR #50, 01/10/2026 11:06:06 -03:00) | `git log -1 master` | 2026-10-01 11:50 |
| **Pruebas** en `master` | **648 pruebas, 648 pasan, 0 fallan, 0 canceladas, 0 omitidas** (94 suites), código de salida 0 | `TEST_DB_PORT=5434 npm test` (PostgreSQL de pruebas en el puerto 5434) | 2026-10-01 11:50 |

### Qué cambió, agrupado

Archivos modificados, por zona (distribución medida a las 10:54, antes de CH-17a; al corte suman 200 archivos, 13 más, casi todos de `openspec/` y `src/`):

| Zona | Archivos |
|---|---|
| `openspec/` (propuestas, specs, diseños, tareas, informes de verificación y archivos de cada change) | 114 |
| `src/` | 45 |
| `docs/bitacora/` | 13 |
| `prisma/` | 6 |
| `docs/` (otros: decisiones y mapa de changes) | 2 |
| `scripts/` | 1 |
| `package.json`, `package-lock.json`, `docker-compose.yml`, `.env.example`, `README.md`, `AGENTS.md` | 6 |

Commits sin merge, por change (según el prefijo del mensaje, medidos a las 10:54, antes de CH-17a): CH-09 4 (cierre), CH-10 9, CH-11 10, CH-12 10, CH-13 19, CH-14 22, CH-15 1, CH-16d 1, más commits de documentación y auditoría. CH-17a y sus decisiones (DEC-93 a DEC-102) suman los 7 commits restantes hasta los 148.

Resumen para el texto:

- **Bitácoras:** nuevas de CH-09 a CH-15, `auditoria_mapa_cambios`, `bitacora_CH-16d`, `bitacora_datos_personales_foodstore` y `bitacora_estado_repo_tesis`; modificadas `bitacora_reproduccion_anexos` y `matriz_correspondencias`.
- **Experimento CH-16d:** está en `master` (commit `a6e605a`, 25/09/2026, posterior a la etiqueta), con su bitácora y su carpeta de `openspec`.
- **Código y pruebas de CH-09 (cierre) a CH-15:** mapeo por tenant, validación de mapeo, parámetros en consultas, plantillas de automatización, motor de planificación y ejecución, condición y notificación por correo, instrumentación de tiempos del alta.
- **Planificadores:** el planificador por horario es de CH-13 (`src/planificador.ts`). La notificación por correo es de CH-14.

- **CH-17a (motor: ejecuciones interrumpidas, solapamiento y apagado ordenado):** al arrancar cierra como `fallo/interrumpida` las ejecuciones que quedaron `en-curso` (X7), no inicia una ejecución si la misma automatización sigue corriendo y deja una fila `omitida` (X4), y cierra la aplicación de forma ordenada con SIGTERM y SIGINT. Verificación: `pass_with_warnings`, 0 críticos (`openspec/changes/archive/2026-09-30-CH-17a-interrumpidas-y-solapamiento/verify-report.md`). Fusionada por el PR #50, commit de merge `e0dfe7c` (01/10/2026 14:06 UTC).

Estado de la rama principal al corte: commit `e0dfe7c`, 648 pruebas ejecutadas, 648 aprobadas, 0 fallidas.

---

## 2. Tabla 3.3: CH-10 a CH-15

Los seis changes están implementados, verificados, archivados y fusionados en `master`.

| CH | Veredicto de verificación (informe en `openspec/changes/archive/`) | Último commit de archivo | Fusionado en `master` por |
|---|---|---|---|
| CH-10 | PASS WITH WARNINGS (328/328 pruebas al verificar) | `7cc19c7` (27/09) | PR #12, merge `08e32df` (28/09) |
| CH-11 | pass | `257b100` (27/09) | PR #20, merge `c6d9780` (28/09) |
| CH-12 | pass_with_warnings | `fcd5a18` (28/09) | PR #28, merge `23184b3` (28/09) |
| CH-13 | pass_with_warnings | `68c20a5` (29/09) | PR #40, merge `a4d78db` (29/09) |
| CH-14 | `fail` en el informe literal; **veredicto efectivo al cierre: PASS WITH WARNINGS** | `6c729dc` (29/09) | PR #41, merge `9a0ca4b` (30/09) |
| CH-15 | pass_with_warnings | `087b085` (30/09); último commit de código `87c3e8e` | PR #41, merge `9a0ca4b` (30/09) |

Comandos: `ls openspec/changes/archive`, lectura de `verify-report.md` de cada change, `git log -1 -- <carpeta de archivo>` y `git log --first-parent --merges --ancestry-path <commit>..master`.

Dos precisiones para citar con exactitud:

- **CH-14:** el informe de verificación dice literalmente `fail` porque tenía un crítico (falta de la bitácora, tarea 7.1). El propio informe registra que el crítico se resolvió después con una remediación solo de documentación y fija el veredicto efectivo en PASS WITH WARNINGS (0 críticos, 4 advertencias, 4 sugerencias).
- **CH-14 y CH-15** llegaron a `master` por el mismo merge (#41) porque estaban apiladas. Ese es el merge más cercano que los contiene, no uno propio de cada uno.

Texto sugerido para la fila: "CH-10 a CH-15: implementados, verificados (PASS WITH WARNINGS salvo CH-11, que pasa sin advertencias) y fusionados en `master`; último commit de código de CH-15: `87c3e8e`; último commit de la serie: `087b085`."

---

## 3. Tabla 3.3: ramas de experimentos

Comandos: `git log -1 origin/<rama>`, `git merge-base --is-ancestor <rama> master`, `git rev-list --count master..<rama>`, `git cherry master origin/<rama>`. Consulta: 2026-10-01 ~10:55.

| Rama | Último commit | ¿Es el registrado? | Fusionada en `master` | Commits que `master` no tiene |
|---|---|---|---|---|
| `experimento/reporte-diario` | `0e80098` (25/09/2026) | Sí, coincide | **No, sin fusionar** | 2 |
| `experimento/odoo` | `c3ee7b4` (26/09/2026) | Sí, coincide | **No, sin fusionar** | 6 |
| `experimento/desempate` | `d06b7ad` (29/09/2026) | Sí, coincide | **No, sin fusionar** | 10 |

- El último commit coincide en la copia local y en `origin`.
- `git cherry` no encuentra en `master` ningún parche equivalente: tampoco hay *cherry-picks*.
- Las tres ramas están **apiladas**: `desempate` contiene a `odoo`, y `odoo` contiene a `reporte-diario`.

Texto sugerido: "Sin fusionar en `master` al 01/10/2026; último commit `<hash>`."

---

## 4. Sección 6.2: tupla comparada en la equivalencia sobre Food Store

### Lo que dice la bitácora de CH-16b

`docs/bitacora/bitacora_CH-16b_tres_esquemas.md`, fila V-3 (real), línea 38:

> "Diferencia simétrica entre `02_query_original.sql` y `04_consulta_canonica.sql` (sin modificar), comparando por `id::text`" → "`solo en ORIGINAL: 0` / `solo en CANÓNICA: 0` / `intersección: 6`"

- **La clave fue el identificador de producto (`id::text`).** Confirmado.
- **Las columnas exactas de la diferencia simétrica no están registradas.** El README (`README_correr.md`, paso 4) remite a "el bloque de V-3 de la bitácora", y ese bloque no está en la bitácora. Tampoco hay ningún script con `EXCEPT` ni `FULL JOIN` en `openspec/changes/CH-16b-vistas-canonicas/sql/`.
- **La definición de H1 no está en el repositorio:** ninguna búsqueda de `H1` en `docs/` la encuentra. No se puede verificar contra el repo qué tupla define H1.

### Problema con el texto actual

La consulta original (`02_query_original.sql`) devuelve cuatro columnas: `id, name, stock_producible, ingrediente_critico`. **No devuelve la existencia del insumo limitante.** La canónica sí (`stock_insumo_limitante`). Por eso la frase "las tres columnas de la tupla (stock producible, insumo limitante y existencia de ese insumo)" no puede describir la comparación original tal como se hizo: el lado original no tiene esa columna.

### Reejecución para fijar las columnas (evidencia nueva)

Se reejecutó la comparación contra la base real `food_store` (contenedor `foodstore-backend-fastapi-db-1`) en una transacción `READ ONLY` que termina en `ROLLBACK`. La consulta original se usó sin la línea `SET search_path` (los datos reales están en `public`) y sin el punto y coma final, para poder envolverla en una subconsulta; la canónica, sin cambios salvo el punto y coma final. Consulta: 2026-10-01 11:08 (-03:00).

| Comparación (diferencia simétrica con `EXCEPT`) | Solo original | Solo canónica | Intersección |
|---|---|---|---|
| A. solo `id::text` | 0 | 0 | 6 |
| B. `id` + `stock_producible` | 0 | 0 | 6 |
| C. `id` + `stock_producible` + insumo limitante (nombre) | 0 | 0 | 6 |

Redacción segura para el texto: "La comparación fue fila a fila, por identificador de producto, sobre el stock producible y el insumo limitante; la diferencia simétrica dio cero filas en ambos sentidos y seis en la intersección. La consulta original no devuelve la existencia del insumo, por lo que esa columna no entró en la comparación." Si se quiere afirmar la existencia del insumo, hay que comparar aparte contra `ingredient.stock_quantity` (no se hizo).

**Limitación:** la reejecución de hoy no demuestra qué columnas usó la comparación original del 21/09; demuestra que las tres combinaciones dan equivalencia hoy sobre los mismos datos.

---

## 5. Sección 6.3.3: convención de un solo nivel en el cálculo manual de Odoo

### 5.1 `m_stock_producible.sql` explota un solo nivel (confirmado)

Archivo: `experimentos/odoo/sql/manual/m_stock_producible.sql`, rama `experimento/odoo` (leído con `git show`, 45 líneas, sin `WITH RECURSIVE`).

- Líneas 22-33, CTE `consumo`: `FROM candidatas c JOIN mrp_bom_line l ON l.bom_id = c.bom`. Toma solo las líneas de la lista elegida del propio producto; no vuelve a expandir los componentes que tienen su propia lista.
- Líneas 16-21, CTE `disponible`: `SUM(q.quantity) - SUM(q.reserved_quantity)` sobre `stock_quant` en ubicaciones `usage = 'internal'`. Es la **existencia física**.
- Líneas 40-43: el cociente de cada componente usa `COALESCE(d.disp, 0) / k.por_unidad`, con `LEFT JOIN disponible d ON d.product_id = k.componente`. Para un intermedio fabricable usa su existencia física, no las unidades que se podrían fabricar.
- La bitácora de Odoo (`docs/bitacora/bitacora_odoo.md`, decisión O-5) documenta esto como límite del artefacto: "la consulta explota un solo nivel. Table → Table Top → Wood Panel → Ply Layer es una cadena de tres niveles. Para Table, el stock de Table Top es su stock físico, no lo que se podría fabricar a partir de sus componentes. Tampoco se explotan los kits anidados."

### 5.2 La cadena de tres niveles en los datos de demostración

Fuente: `experimentos/odoo/salidas/p2_exploracion_output.txt` y salida del cálculo manual.

| Nivel | Producto (`product_product.id`) | Lista de materiales | Cantidad por unidad |
|---|---|---|---|
| Final | **Table** (54) | BOM 2, `normal` | Table Top ×1, Table Leg ×4, Bolt ×4, Screw ×10 |
| Intermedio fabricable | **Table Top** (55) | BOM 3, `normal` | Wood Panel ×2 |
| Intermedio fabricable | **Wood Panel** (62) | BOM 5, `normal` | Ply Layer ×3, Wear Layer ×1 |
| Materia prima | Ply Layer (59), Wear Layer (60) | sin lista | |

Table Top y Wood Panel son los dos intermedios fabricables; tienen existencia física propia (Table Top 5, Wood Panel 48).

### 5.3 Una unidad de un solo nivel contra explosión completa (medido)

Se levantó la base de datos de Odoo del experimento (contenedor `zd-odoo-db-1`, volumen original, PostgreSQL 17.11; solo la base, sin el servidor de Odoo) y se ejecutó, en una transacción `REPEATABLE READ READ ONLY` terminada en `ROLLBACK`: (a) la consulta canónica `04_consulta_canonica.sql` (SHA-256 `979131eb…`, la misma del repositorio), (b) el cálculo manual de referencia y (c) una consulta auxiliar de explosión completa escrita para esta verificación. Hora del servidor: 2026-10-01 14:07:55 UTC (11:07:55 -03:00). El contenedor se volvió a detener al terminar. El estado de los datos coincide con el estado base registrado en `salidas/p3_stock/A/`.

Existencias físicas (todas las ubicaciones internas, disponible = cantidad − reservada): Ply Layer 20, Wear Layer 30, Wood Panel 48, Table Top 5, Table Leg 0, Bolt 0, Screw 0.

| Producto | Consulta (un nivel) | Explosión completa | Cómo sale la explosión |
|---|---|---|---|
| Wood Panel | **6** (limita Ply Layer, 20/3) | 6 | sin intermedios |
| Table Top | **24** (48 paneles / 2) | **27** | paneles disponibles = 48 físicos + 6 fabricables = 54; 54 / 2 = 27 |
| **Table** (producto final) | **0** | **0** | Table Top disponible = 5 + 27 = 32, pero Table Leg 0/4, Bolt 0/4 y Screw 0/10 limitan a 0 |

Interpretación para el texto:

- La salida de la consulta canónica para esta cadena es `Table|0|Screw|0`, `Table Top|24|Wood Panel|48.00`, `Wood Panel|6|Ply Layer|20.00`, igual que las salidas registradas del experimento.
- **Para el producto final (Table) el resultado es 0 en ambos casos.** No lo determina la profundidad de la lista sino la falta de existencia de Table Leg, Bolt y Screw. Por eso Table no sirve como ejemplo de que la convención importe.
- **La diferencia aparece en el intermedio Table Top:** 24 con un nivel, 27 con explosión completa (el panel fabricable suma 6 paneles, o 3 unidades de Table Top).
- La coincidencia del stock producible entre la consulta y el cálculo manual (7 de 7 productos) **no contrasta la decisión de un solo nivel**, porque el cálculo manual adopta la misma convención, como se confirmó en 5.1.

Limitaciones: la explosión completa no es parte del experimento original; la calculó una consulta auxiliar escrita para esta verificación (no se guardó en el repositorio) y se contrastó a mano con los valores registrados. Se usó solo el estado base; la modificación controlada de stock del experimento (P3.4) no se reprodujo.

---

## Estado en que quedó todo

- Repositorio: sin cambios en el historial ni en las ramas. Las únicas acciones sobre el árbol de trabajo fueron actualizar `master` local al remoto (`git pull`) y agregar este archivo en `docs/`, sin commitear.
- Contenedor `zd-odoo-db-1`: se arrancó para la consulta y se volvió a detener (estaba detenido antes).
- Archivos temporales de SQL: en la carpeta temporal de la sesión, fuera del repositorio.
