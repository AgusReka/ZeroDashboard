# Auditoría del mapa de cambios contra la tesis, y empates en Food Store (P14)

**Fecha:** 2026-09-26, entre las 19:31 y las 19:36 (hora local, UTC-3).
**Tipo:** auditoría de solo lectura. No se modificó ningún archivo de `master` ni de las ramas `experimento/*`. Este archivo es el único agregado, en la rama `auditoria/mapa-cambios`, creada desde `master`.
**Estado congelado:** se leyó con `git show congelamiento-tesis-2026-09-24:<ruta>`, sin hacer checkout de la etiqueta.
**Bases de datos:** solo `SELECT`, dentro de `BEGIN TRANSACTION READ ONLY` (cada salida registra `transaction_read_only = on`).

Nota sobre nombres: el pedido habla de `main`, pero en el repositorio la rama principal se llama **`master`** (no existe `main` ni local ni en `origin`). En todo este documento, "`main`" se lee como `master`.

---

## 1. Tabla de afirmaciones

| N.º | Afirmación | Evidencia | Resultado | Detalle |
|---|---|---|---|---|
| 1 | La etiqueta `congelamiento-tesis-2026-09-24` apunta a `a1704bc` y está publicada en GitHub. | `git rev-parse congelamiento-tesis-2026-09-24` → `a1704bcec01132f79f5eddfc66d9f6125bde6a02`. `git ls-remote --tags origin` → `a1704bce… refs/tags/congelamiento-tesis-2026-09-24`. | **Coincide** | Etiqueta liviana (`git cat-file -t` devuelve `commit`, no `tag`). El commit es del 2026-09-24 15:35:34 −03:00, "CH-09: document DEC-36 exception on task 4.1 byte-identity check". El remoto es `github.com/AgusReka/ZeroDashboard`. |
| 2 | En ese estado pasan 266 pruebas automatizadas, incluidas las de integración contra PostgreSQL. | `git grep -n -E "\b266\b" congelamiento-tesis-2026-09-24` → sin resultados (tampoco en `master` ni en `experimento/odoo`). Informe del congelamiento: `docs/estado_prototipo_2026-09-24.md` (en la etiqueta). Conteos registrados: `docs/bitacora/CH-08-contrato-canonico.md:55` (248/248), `docs/bitacora/bitacora_DEC-36.md:31,33,346,348` (149/149). | **No se puede verificar** | El número 266 no aparece en ningún archivo del repositorio. El informe del congelamiento no informa ningún conteo de pruebas. La última corrida con PostgreSQL registrada es la de CH-08 (2026-09-18): **248/248**. La última corrida registrada antes de la etiqueta es la de DEC-36 (2026-09-24): **149/149, con 8 suites de integración salteadas** porque no había servidor en `localhost:5432`. Es decir, la única corrida documentada del 24/09 **no** incluyó las pruebas de integración. Como referencia (no reemplaza una corrida), en la etiqueta hay 15 archivos `*.test.ts` con 242 declaraciones `test(`/`it(` contadas estáticamente; las pruebas generadas por tablas pueden sumar más en tiempo de ejecución. Siguiendo la regla, no se volvieron a correr las pruebas. |
| 3 | Mapa de cambios y estado de cada cambio al 24/09 (tabla de la tesis). | Mapa: `docs/02-mapa-de-changes.md` (93 líneas en la etiqueta). Estados: `docs/estado_prototipo_2026-09-24.md`, secciones 1.1 a 1.4 (líneas 21–79). CH-09: `openspec/changes/CH-09-tenant-schema-mapping/tasks.md:46–81`. | **Coincide en parte** | (a) El mapa **no tiene columna de estado**: solo lista ID, cambio, historias y notas. Los estados salen del informe `estado_prototipo_2026-09-24.md`. (b) CH-01 a CH-05 (R0) y CH-06 a CH-08: coinciden (archivados, con `verify-report.md`; veredictos `pass` y `pass_with_warnings`). (c) CH-09: coincide; `tasks.md` tiene 18 tareas marcadas y 8 pendientes (fases 3 y 4), sin `verify-report.md`. (d) CH-10 a CH-15 y CH-17 a CH-27: coinciden (no iniciados, sin carpeta en `openspec/changes/`). (e) CH-16: coincide. (f) CH-16b: el informe lo describe sobre Food Store, **Medusa** y WooCommerce (fixture); la tabla de la tesis omite Medusa. (g) CH-16c: existe en la etiqueta (`docs/bitacora/bitacora_CH-16c_saleor.md`, `openspec/changes/CH-16c-saleor-caso-negativo/`, commit `ab93586` del 24/09 13:41), pero el informe no lo menciona. (h) **CH-16d no existe en el estado congelado**: se agregó en `a6e605a` (2026-09-25 13:08), posterior a la etiqueta. |
| 4a | CH-16 se ejecutó antes que los cambios de los que dependía según el plan (CH-09 a CH-15). | `docs/02-mapa-de-changes.md:52` (etiqueta): "Depende de D-4 y D-5". `docs/bitacora/CH-16-mapeo-del-segundo-esquema.md:3–4` (inicio y cierre 2026-09-19) y `:207` (paso 4 omitido por falta de CH-11/12/13). Primer commit de esa bitácora: `fc54f19` (2026-09-21). Primer commit de CH-09: `51293b1` (2026-09-23, exploración). | **Coincide en parte** | El orden se confirma: CH-16 se ejecutó el 19/09 (y se commiteó el 21/09), antes de que empezara CH-09 (23/09) y sin que existieran CH-10 a CH-15. Pero el mapa **no declara** que CH-16 dependa de CH-09 a CH-15: la única dependencia escrita es "D-4 y D-5". La dependencia se infiere de la posición de CH-16 como último cambio de R1 y de la propia bitácora de CH-16, que omitió el paso 4 porque faltaban CH-11, CH-12 y CH-13. |
| 4b | CH-16b no figura en el mapa de cambios. | `git grep -n -E "CH-16[bcd]" <ref> -- docs/02-mapa-de-changes.md` sobre la etiqueta, `master` y `experimento/odoo` → sin resultados. | **Coincide** | Tampoco figura en `master` ni en las ramas de experimentos: el mapa no cambió después de la etiqueta (`git diff --stat` vacío). |
| 4c | ¿Figuran CH-16c y CH-16d? | Mismo comando que 4b. | **No figuran** | Ninguno de los dos está en el mapa, en ningún estado. Ambos tienen carpeta en `openspec/changes/` (CH-16c en la etiqueta; CH-16d solo en `master`). |
| 5 | La segunda etapa cerraba con "una automatización corriendo sola de punta a punta", y no se cumplió. | `docs/02-mapa-de-changes.md:38` y `docs/mapa-historias.md:166` (etiqueta). `docs/estado_prototipo_2026-09-24.md:179`. | **Coincide** | R0 es la primera etapa y R1 la segunda. La frase es literal en ambos documentos. El informe del congelamiento dice: "La condición de cierre de R1 no se cumple: no hay ninguna automatización corriendo sola de punta a punta". CH-12, CH-13 y CH-14 (plantillas, motor y notificación) no están iniciados. |
| 6 | El prototipo no ejecuta ninguna automatización: en el contrato son etiquetas (DEC-22), sin código que las ejecute. | `src/contrato.ts:39–42` (etiqueta): `AUTOMATIZACIONES = { STOCK_FISICO: 'stock-fisico', STOCK_PRODUCIBLE: 'stock-producible', REPORTE_DIARIO: 'reporte-diario' }`. `docs/01-decisiones.md:401` (DEC-22). `git grep -n -i -E "cron\|schedul\|setInterval\|nodemailer\|smtp\|sendmail\|planificador" <etiqueta> -- src package.json` → solo comentarios de pruebas sobre "process scheduling". `prisma/schema.prisma`: modelos `Tenant`, `Conexion`, `ConsultaGuardada`, `VistaCanonica`. | **Coincide** | No hay planificador, envío de correo ni modelos `Plantilla`, `Automatizacion` o `Ejecucion`. |
| 7 | `01-decisiones.md` tiene DEC-01 a DEC-38 en el estado congelado; DEC-39 a DEC-44 existen solo en la bitácora del reporte diario. | `git show <ref>:docs/01-decisiones.md \| grep -n -o -E "^#+ *DEC-[0-9]+"` sobre la etiqueta, `master`, `experimento/reporte-diario` y `experimento/odoo` → DEC-01 a DEC-38 en los cuatro. `git grep -n -E "DEC-(39\|4[0-9])" <ref>`. | **Coincide, con un matiz** | DEC-37 y DEC-38 (Saleor) están en la etiqueta (commit `ab93586`). DEC-39 a DEC-44 no están en `01-decisiones.md` en ninguna rama, ni en la etiqueta ni en `master` (0 menciones). Se **definen** solo en `docs/bitacora/bitacora_reporte_diario.md:500–543`, como "(propuesta)", y solo en las ramas de experimentos. Matiz: DEC-39 también se **cita** en `experimentos/reporte_diario/PREREGISTRO.md:85` y en las vistas `v_pedido_foodstore.sql` / `v_pedido_saleor.sql` (y en sus copias en `salidas/`), y `docs/bitacora/bitacora_odoo.md:228,242,272` (rama `experimento/odoo`) cita DEC-39, DEC-44 y "DEC-39 a DEC-44". Son menciones, no definiciones. |
| 8 | Existen `experimento/reporte-diario` y `experimento/odoo`, sin fusionar con `main`, con los commits `d43ac67`, `385b170` y `b163bc8`. | `git branch -a`; `git merge-base --is-ancestor <rama> master` (ambas: no); `git branch -a --contains <hash>`; `git ls-remote --heads origin`. | **Coincide, con dos matices** | `d43ac67` (2026-09-25 15:32) está en las dos ramas; `385b170` (2026-09-26 13:21) y `b163bc8` (2026-09-26 13:30) solo en `experimento/odoo`. Ninguna está fusionada con `master`. Matices: (1) `experimento/odoo` sale de `experimento/reporte-diario`: contiene sus dos commits (`d43ac67`, `0e80098`). (2) **Las dos ramas son solo locales**: `origin` publica únicamente `refs/heads/master`. Si la tesis remite a GitHub para estas ramas o commits, hoy no se pueden consultar ahí. |
| 9 | Commits de `main` posteriores a la etiqueta: no alteran el código ni el contrato evaluados. | `git log --format="%h %ad %s" --date=iso congelamiento-tesis-2026-09-24..master`; `git diff --name-only congelamiento-tesis-2026-09-24 master` (y filtrado por `src`, `*contrato*`, `*test*`). | **Coincide** | Cinco commits (lista abajo). Ninguno toca `src/`, `src/contrato.ts`, pruebas, `prisma/` ni `package.json`. Solo agregan o modifican `docs/bitacora/` y agregan `openspec/changes/CH-16d-segunda-automatizacion-y-with/` (SQL y salidas, fuera de la aplicación). |

**Commits de `master` posteriores a la etiqueta** (del más nuevo al más viejo):

| Hash | Fecha | Mensaje | Archivos |
|---|---|---|---|
| `a6e605a` | 2026-09-25 13:08:07 −03:00 | CH-16d: segunda automatizacion (stock fisico) y composicion con WITH | `docs/bitacora/bitacora_CH-16d.md` + 19 archivos en `openspec/changes/CH-16d-segunda-automatizacion-y-with/` (`sql/`, `salidas/`) |
| `333d34c` | 2026-09-24 23:35:20 −03:00 | Bitacora: columnas con datos personales en food_store | `docs/bitacora/bitacora_datos_personales_foodstore.md` |
| `43c9138` | 2026-09-24 23:11:03 −03:00 | Bitacora de reproduccion: segunda ronda de WF-01a, WF-01c y WF-03 | `docs/bitacora/bitacora_reproduccion_anexos.md` |
| `0bb9a3d` | 2026-09-24 22:52:06 −03:00 | Matriz de correspondencias: nota de receta_componente.productoId como decidida | `docs/bitacora/matriz_correspondencias.md` |
| `8081363` | 2026-09-24 22:48:09 −03:00 | Matriz de correspondencias: reclasificacion con el criterio refinado | `docs/bitacora/matriz_correspondencias.md` |

---

## 2. Discrepancias y cambios de texto propuestos (no aplicados)

Ninguna de estas propuestas se aplicó. Son texto sugerido para la tesis o para los documentos del repositorio; decide el autor.

**D-1. Las 266 pruebas no tienen respaldo en el repositorio** (afirmación 2).
Ningún archivo registra 266 pruebas. La única corrida documentada del 24/09 (DEC-36) dio 149/149 y salteó 8 suites de integración.
*Texto propuesto (opción A, si existe una corrida no registrada):* registrar en `docs/bitacora/` la corrida de `npm test` sobre `a1704bc` con PostgreSQL levantado, con fecha, comando y salida, y recién entonces citar el número.
*Texto propuesto (opción B, sin nueva corrida):* "La última corrida registrada con PostgreSQL es la del cierre de CH-08 (18/09): 248 pruebas, todas en verde. La corrida registrada el 24/09, después de DEC-36, dio 149 pruebas en verde y no incluyó las 8 suites de integración, porque no había servidor de base disponible."

**D-2. El mapa de cambios no registra estados** (afirmación 3).
La tabla de la tesis presenta estados "según el mapa de cambios", pero `docs/02-mapa-de-changes.md` no tiene columna de estado.
*Texto propuesto:* "El estado de cada cambio al 24/09 se tomó del relevamiento `docs/estado_prototipo_2026-09-24.md` y de las carpetas de `openspec/changes/`; el mapa de cambios (`docs/02-mapa-de-changes.md`) define la secuencia, no el estado."

**D-3. CH-16d figura en una tabla que describe el estado congelado** (afirmación 3).
CH-16d es del 25/09 (`a6e605a`), posterior a la etiqueta del 24/09.
*Texto propuesto:* separar la fila en dos: "CH-16, CH-16b, CH-16c — Ejecutados fuera de la aplicación (en el estado congelado)" y, aparte, "CH-16d — Stock físico y composición con `WITH`, ejecutado el 25/09, después del congelamiento (commit `a6e605a` en `master`)".

**D-4. CH-16b sin Medusa en la tabla** (afirmación 3).
*Texto propuesto:* "CH-16b: vistas canónicas sobre Food Store y Medusa (bases reales) y WooCommerce (*fixture*)".

**D-5. El informe del congelamiento es anterior a la etiqueta** (afirmaciones 2, 3 y 7).
`docs/estado_prototipo_2026-09-24.md` se commiteó en `9fd0ef6` (24/09 12:33). Después, y antes de la etiqueta (15:35), entraron `ab93586` ("P4", 13:41, con DEC-37, DEC-38 y CH-16c) y otros commits. Por eso el informe llega hasta DEC-36, no menciona CH-16c y describe como "sin commitear" cambios de DEC-36 que en la etiqueta ya están commiteados.
*Texto propuesto:* al citarlo, aclarar: "relevamiento hecho el 24/09 al mediodía, sobre el commit `9fd0ef6`; la etiqueta `a1704bc` agrega DEC-37, DEC-38 y el experimento CH-16c".

**D-6. La dependencia de CH-16 respecto de CH-09 a CH-15 no está escrita en el mapa** (afirmación 4a).
El mapa solo dice "Depende de D-4 y D-5".
*Texto propuesto:* "CH-16 se ejecutó el 19/09, antes que CH-09 a CH-15, aunque el plan lo ubicaba al final de R1. El mapa solo le declara dependencia de las compuertas D-4 y D-5; la dependencia de los cambios anteriores es implícita en el orden del plan y se hizo visible en la ejecución: el paso 4 del experimento (correr las consultas del catálogo) se omitió porque CH-11, CH-12 y CH-13 no existían."

**D-7. Ni CH-16c ni CH-16d figuran en el mapa** (afirmación 4c).
*Cambio propuesto para `docs/02-mapa-de-changes.md` (no aplicado):* agregar, debajo de CH-16, filas para CH-16b, CH-16c y CH-16d con la nota "experimento fuera de la aplicación, agregado después de planificar R1", o una sección "Experimentos agregados durante R1" que remita a sus bitácoras.

**D-8. Menciones de DEC-39 fuera de la bitácora del reporte diario** (afirmación 7).
*Texto propuesto:* "Las propuestas DEC-39 a DEC-44 se definen solo en la bitácora del reporte diario (rama `experimento/reporte-diario`); no están en `docs/01-decisiones.md` ni en `master`. El preregistro, las vistas `v_pedido` y la bitácora de Odoo las citan como propuestas."

**D-9. Ramas de experimentos no publicadas** (afirmación 8).
*Texto propuesto (si la tesis remite a GitHub):* publicar `experimento/reporte-diario` y `experimento/odoo` en `origin` antes de citarlas, o aclarar que "las ramas de experimentos están en el repositorio local y no se publicaron". Agregar que `experimento/odoo` parte de `experimento/reporte-diario`.

**D-10. `main` frente a `master`.**
*Texto propuesto:* donde la tesis o los pedidos digan `main`, usar `master`, que es el nombre real de la rama principal.

---

## 3. Empates del insumo limitante en Food Store y Medusa

### 3.1 Por qué importa

La consulta canónica (`openspec/changes/CH-16b-vistas-canonicas/sql/04_consulta_canonica.sql`) elige el insumo limitante con `(ARRAY_AGG(ins.nombre ORDER BY ins."stockDisponible"::numeric / rc."cantidadPorUnidad" ASC))[1]`, sin criterio de desempate. El orden de los componentes empatados no está garantizado. Además, ordena por el cociente **exacto**, mientras que `stock_producible` es el `FLOOR` del mínimo. Por eso se informan dos criterios:

- **empate en el mínimo con piso** (lo que pide el enunciado): componentes cuyo `FLOOR(existencia / cantidad)` es igual al mínimo;
- **empate en el mínimo exacto**: componentes cuyo cociente sin redondear es igual al mínimo. Esto es lo que vuelve ambigua la elección de la consulta canónica.

### 3.2 Food Store

Base `food_store` (contenedor `foodstore-backend-fastapi-db-1`, PostgreSQL 16.15), rol de solo lectura `lector_zerodashboard`. Solo tablas nativas (`product`, `ingredient`, `product_ingredient`), con los mismos filtros que las vistas de CH-16b (`deleted_at IS NULL`) y que la canónica (`available = true`, `quantity > 0`).

Comando (2026-09-26 19:34:09 −03:00):

```
docker exec -i foodstore-backend-fastapi-db-1 psql -U lector_zerodashboard -d food_store -v ON_ERROR_STOP=1 -P pager=off < empates_foodstore.sql
```

Consulta principal:

```sql
BEGIN TRANSACTION READ ONLY;
WITH comp AS (
  SELECT p.id AS producto_id, p.name AS producto,
         i.id AS insumo_id, i.name AS insumo,
         i.stock_quantity AS existencia, pi.quantity AS cantidad_por_unidad,
         i.stock_quantity::numeric / pi.quantity        AS cociente,
         FLOOR(i.stock_quantity::numeric / pi.quantity) AS cociente_piso
  FROM product p
  JOIN product_ingredient pi ON pi.product_id = p.id
  JOIN ingredient i          ON i.id = pi.ingredient_id
  WHERE p.deleted_at IS NULL AND i.deleted_at IS NULL
    AND p.available = true
    AND pi.quantity > 0
),
m AS (
  SELECT producto_id, COUNT(*) AS componentes,
         MIN(cociente_piso) AS min_piso, MIN(cociente) AS min_exacto
  FROM comp GROUP BY producto_id
)
SELECT c.producto_id, c.producto, m.componentes, m.min_piso,
       COUNT(*) FILTER (WHERE c.cociente_piso = m.min_piso) AS empatados_piso,
       COUNT(*) FILTER (WHERE c.cociente = m.min_exacto)    AS empatados_exacto,
       STRING_AGG(c.insumo || ' (' || c.existencia || '/' || c.cantidad_por_unidad || ')', '; ' ORDER BY c.insumo)
         FILTER (WHERE c.cociente_piso = m.min_piso) AS insumos_en_el_minimo_piso,
       STRING_AGG(c.insumo, '; ' ORDER BY c.insumo)
         FILTER (WHERE c.cociente = m.min_exacto) AS insumos_en_el_minimo_exacto
FROM comp c JOIN m USING (producto_id)
GROUP BY c.producto_id, c.producto, m.componentes, m.min_piso, m.min_exacto
ORDER BY c.producto_id;
-- (más una consulta de resumen con los mismos CTE que cuenta productos con empate)
COMMIT;
```

Salida (`transaction_read_only = on`, `now()` = 2026-09-26 22:34:10 UTC):

| producto_id | producto | componentes | mínimo (piso) | empatados (piso) | empatados (exacto) | insumo en el mínimo |
|---|---|---|---|---|---|---|
| 1 | Hamburguesa Clásica | 6 | 50 | 1 | 1 | Tomate (50/1) |
| 2 | Hamburguesa BBQ Bacon | 6 | 20 | 1 | 1 | Bacon (40/2) |
| 3 | Hamburguesa Doble | 6 | 40 | 1 | 1 | Carne vacuna (80/2) |
| 4 | Hamburguesa Picante | 6 | 15 | 1 | 1 | Jalapeños (30/2) |
| 5 | Papas Fritas | 1 | 250 | 1 | 1 | Papas (250/1) |
| 6 | Aros de Cebolla | 1 | 70 | 1 | 1 | Cebolla (70/1) |

Resumen: **6 productos activos con receta; 0 con empate en el mínimo con piso; 0 con empate en el mínimo exacto.**

El margen más chico entre el limitante y el segundo componente es de 5 unidades (Hamburguesa Doble: Carne vacuna 40, Queso cheddar 45). El detalle de los 26 componentes se obtuvo con una segunda consulta de solo lectura (19:34:19; `componentes_foodstore.sql`, mismos filtros).

**Corridas de la canónica:** no hay empates, así que no correspondía repetirla tres veces. Se corrió **una vez**, como control cruzado, envuelta en `BEGIN TRANSACTION READ ONLY; … COMMIT;` y sin modificarla (19:34:20). Devolvió los mismos limitantes: Jalapeños (15), Bacon (20), Carne vacuna (40), Tomate (50), Cebolla (70), Papas (250).

**Conclusión:** en los datos actuales de Food Store, la falta de criterio de desempate de la consulta canónica **no tiene efecto**, porque ningún producto tiene componentes empatados. El resultado vale para el estado de la base al 2026-09-26 19:34; otra carga de existencias podría producir empates.

### 3.3 Medusa

El contenedor `ch16-medusa-pg` (PostgreSQL 16.15, base `medusa_db`) estaba **detenido** (`Exited (255)`). Se arrancó con `docker start ch16-medusa-pg` (19:34:25), se consultó y se volvió a detener con `docker stop ch16-medusa-pg` (19:34:52, `Exited (0)`). Esa base no tiene un rol de solo lectura (el único rol no del sistema es `medusa`, dueño de las tablas): la protección fue la transacción `READ ONLY` (`transaction_read_only = on`). El arranque del contenedor puede haber hecho la recuperación normal de PostgreSQL al iniciar, pero no se escribió ningún dato.

Solo tablas nativas (`product_variant`, `product`, `product_variant_inventory_item`, `inventory_item`, `inventory_level`), con los mismos criterios que las vistas de CH-16: la existencia es `SUM(stocked_quantity - reserved_quantity)` por ítem, activo es `status = 'published'` y la cantidad debe ser mayor que 0.

Comando (2026-09-26 19:34:47 −03:00):

```
docker exec -i ch16-medusa-pg psql -U medusa -d medusa_db -v ON_ERROR_STOP=1 -P pager=off < empates_medusa.sql
```

Consulta (resumen):

```sql
BEGIN TRANSACTION READ ONLY;
WITH existencia AS (
  SELECT ii.id AS insumo_id, ii.title AS insumo,
         COALESCE(SUM(il.stocked_quantity - il.reserved_quantity), 0) AS existencia
  FROM inventory_item ii
  LEFT JOIN inventory_level il ON il.inventory_item_id = ii.id
  GROUP BY ii.id, ii.title
),
comp AS (
  SELECT pv.id AS producto_id, p.title || ' - ' || pv.title AS producto,
         e.insumo, e.existencia, pvi.required_quantity AS cantidad_por_unidad,
         e.existencia::numeric / pvi.required_quantity        AS cociente,
         FLOOR(e.existencia::numeric / pvi.required_quantity) AS cociente_piso
  FROM product_variant pv
  JOIN product p                          ON p.id = pv.product_id
  JOIN product_variant_inventory_item pvi ON pvi.variant_id = pv.id
  JOIN existencia e                       ON e.insumo_id = pvi.inventory_item_id
  WHERE p.status = 'published'
    AND pvi.required_quantity > 0
),
m AS (SELECT producto_id, COUNT(*) AS componentes, MIN(cociente_piso) AS mp, MIN(cociente) AS me
      FROM comp GROUP BY producto_id),
k AS (
  SELECT c.producto_id, c.producto, m.componentes, m.mp AS min_piso,
         COUNT(*) FILTER (WHERE c.cociente_piso = m.mp) AS empatados_piso,
         COUNT(*) FILTER (WHERE c.cociente = m.me)      AS empatados_exacto
  FROM comp c JOIN m USING (producto_id)
  GROUP BY c.producto_id, c.producto, m.componentes, m.mp
)
SELECT COUNT(*) AS variantes_activas_con_receta,
       COUNT(*) FILTER (WHERE componentes >= 2)      AS con_2_o_mas_componentes,
       MAX(componentes)                              AS max_componentes,
       COUNT(*) FILTER (WHERE empatados_piso >= 2)   AS con_empate_en_minimo_piso,
       COUNT(*) FILTER (WHERE empatados_exacto >= 2) AS con_empate_en_minimo_exacto
FROM k;
-- (más una consulta de detalle que lista las variantes con empate)
COMMIT;
```

Salida (`now()` = 2026-09-26 22:34:47 UTC):

| variantes activas con receta | con 2 o más componentes | máximo de componentes | con empate (piso) | con empate (exacto) |
|---|---|---|---|---|
| 20 | 0 | 1 | 0 | 0 |

La consulta de detalle devolvió 0 filas. **Se confirma lo esperado:** cada variante tiene un solo componente, así que no puede haber empates.

---

## 4. Fechas, horas y comandos

Todas las horas son locales (UTC-3) y salen de `date "+%Y-%m-%d %H:%M:%S %z"`, ejecutado antes de cada comando. Directorio: la raíz del repositorio. Los archivos SQL de la Parte B y sus salidas completas quedaron en el directorio temporal de la sesión, no en el repositorio; su contenido relevante está transcripto en la sección 3.

| Hora | Verificación | Comando |
|---|---|---|
| 19:31:32 | Ramas, etiqueta, remoto, estado | `git branch -a && git tag -l && git remote -v && git status --short && git rev-parse congelamiento-tesis-2026-09-24 congelamiento-tesis-2026-09-24^{commit}` |
| 19:31:37 | Tipo y publicación de la etiqueta; commits posteriores; contención de commits en ramas | `git cat-file -t congelamiento-tesis-2026-09-24`; `git ls-remote --tags origin`; `git log --format="%h %ad %s" --date=iso congelamiento-tesis-2026-09-24..master`; `git branch --merged master`; `git branch -a --contains d43ac67` / `385b170` / `b163bc8` |
| 19:31:44 | Archivos de cada commit posterior; fusión y publicación de ramas | `git show --stat <hash>` (×5); `git merge-base --is-ancestor experimento/odoo master`; ídem `experimento/reporte-diario`; `git log master..experimento/<rama>`; `git ls-remote --heads origin` |
| 19:31:50 | Diferencias entre la etiqueta y `master`; ubicación del contrato y el mapa | `git diff --name-only congelamiento-tesis-2026-09-24 master [-- src contrato.ts '*contrato*' '*test*' '*.spec.*' tests]`; `git ls-tree -r --name-only congelamiento-tesis-2026-09-24 \| grep -i -E "contrato\|mapa\|decisiones\|congel\|informe"` |
| 19:31:54 | Mapa de cambios congelado | `git show congelamiento-tesis-2026-09-24:docs/02-mapa-de-changes.md` |
| 19:32:00 | Inventario de `docs/` y `openspec/` en la etiqueta | `git ls-tree -r --name-only congelamiento-tesis-2026-09-24` |
| 19:32:03 | Informe del congelamiento | `git show congelamiento-tesis-2026-09-24:docs/estado_prototipo_2026-09-24.md` |
| 19:32:10 | Búsqueda de "266" y de conteos de pruebas | `git grep -n -E "\b266\b" <ref>` (etiqueta, `master`, `experimento/odoo`); `git grep -n -i -E "[0-9]+ (pruebas\|tests)…" congelamiento-tesis-2026-09-24 -- docs openspec` |
| 19:32:16 | Conteos en CH-09 y DEC-36; últimos commits de la etiqueta | `git grep … -- openspec/changes/CH-09-tenant-schema-mapping docs/bitacora/bitacora_DEC-36.md …`; `git log -8 congelamiento-tesis-2026-09-24` |
| 19:32:21 | Commit de la etiqueta; tareas de CH-09 | `git show --stat a1704bc`; `git show congelamiento-tesis-2026-09-24:openspec/changes/CH-09-tenant-schema-mapping/tasks.md \| grep -n -E "^\s*- \["` |
| 19:32:26 | Conteo estático de declaraciones de prueba | `git show <etiqueta>:<f> \| grep -c -E "^\s*(test\|it)(\.(skip\|only\|todo))?\("` sobre cada `*.test.ts` |
| 19:32:36 | DEC en `01-decisiones.md` por ref; cambios del mapa por ref | `git show <ref>:docs/01-decisiones.md \| grep -n -o -E "^#+ *DEC-[0-9]+"`; `git diff --stat congelamiento-tesis-2026-09-24 <ref> -- docs/02-mapa-de-changes.md docs/01-decisiones.md src` |
| 19:32:42 | Ubicación de DEC-39 a DEC-44 | `git grep -n -o -E "DEC-(39\|4[0-9])" <ref>` |
| 19:32:49 | Menciones y definiciones de DEC-39 a DEC-44 | `git grep -n -E "DEC-(39\|4[0-9])" experimento/odoo -- experimentos docs/bitacora/bitacora_odoo.md`; `git grep -n -E "^#+.*DEC-(39\|4[0-9])" experimento/reporte-diario -- docs/bitacora/bitacora_reporte_diario.md` |
| 19:32:55 | Automatizaciones como etiquetas; ausencia de motor | `git grep -n -E "AUTOMATIZACIONES\s*=\|stock-fisico\|…" <etiqueta> -- src/contrato.ts`; `git grep -n -i -E "cron\|schedul\|setInterval\|nodemailer\|smtp\|sendmail\|planificador" <etiqueta> -- src package.json`; `git show <etiqueta>:prisma/schema.prisma \| grep -n "^model"` |
| 19:32:58 | CH-16/16b/16c/16d en el mapa; fechas de CH-16 y CH-09 | `git grep -n -E "CH-16[bcd]?\b\|CH-16[bcd]" <ref> -- docs/02-mapa-de-changes.md`; `git log --diff-filter=A …` |
| 19:33:09 | Fechas de alta de bitácoras y carpetas de openspec | `git log --diff-filter=A …`; `git ls-tree -d --name-only <ref> openspec/changes/` |
| 19:33:14 | Historia de la bitácora de CH-16 | `git log --follow … -- docs/bitacora/CH-16-mapeo-del-segundo-esquema.md` |
| 19:33:20 | Consulta canónica y contenedores disponibles | `cat …/04_consulta_canonica.sql`; `docker ps` |
| 19:33:33 | Rol y base de Food Store | `docker inspect foodstore-backend-fastapi-db-1 …`; `docker exec … psql -U postgres -l -A -t` (lista de bases, sin transacción) |
| 19:33:43 | Tablas nativas y vistas en Food Store | `docker exec … psql -U lector_zerodashboard -d food_store -c "BEGIN READ ONLY; SELECT … information_schema …; COMMIT;"` |
| 19:34:09 | Empates en Food Store | `docker exec -i foodstore-backend-fastapi-db-1 psql -U lector_zerodashboard -d food_store -v ON_ERROR_STOP=1 -P pager=off < empates_foodstore.sql` |
| 19:34:19 | Componentes de cada producto en Food Store | ídem, con `componentes_foodstore.sql` |
| 19:34:20 | Canónica sobre Food Store, una corrida de control | ídem, con `04_consulta_canonica.sql` envuelta en `BEGIN TRANSACTION READ ONLY; … COMMIT;` |
| 19:34:25 | Arranque del contenedor de Medusa | `docker start ch16-medusa-pg` |
| 19:34:32 | Rol, vistas y definiciones en Medusa | `docker exec ch16-medusa-pg psql -U medusa -d medusa_db -c "BEGIN READ ONLY; …; COMMIT;"` |
| 19:34:47 | Empates en Medusa | `docker exec -i ch16-medusa-pg psql -U medusa -d medusa_db -v ON_ERROR_STOP=1 -P pager=off < empates_medusa.sql` |
| 19:34:52 | Detención del contenedor de Medusa (vuelta al estado previo) | `docker stop ch16-medusa-pg` |
| 19:35:09 | Fechas de DEC-37/38, DEC-36 en código e informe del congelamiento | `git log -S"### DEC-37" …`; `git log -S"DEC-36" … -- src/contrato.ts`; `git log … -- docs/estado_prototipo_2026-09-24.md` |
| 19:35:14 | Creación de la rama de auditoría | `git switch -c auditoria/mapa-cambios master` |
