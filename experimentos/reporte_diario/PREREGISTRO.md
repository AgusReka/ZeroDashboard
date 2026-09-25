# Preregistro — portabilidad del reporte diario (WF-03) sobre el contrato canónico

**Fecha:** 2026-09-25. **Rama:** `experimento/reporte-diario`.

Este archivo se commitea **antes** de ejecutar cualquier consulta sobre datos de pedidos. Hasta este commit solo se consultó el catálogo de las bases (`\d`, `pg_views`, `pg_get_viewdef`, valores del enum `estado_pedido_codigo`), nunca filas de pedidos.

Evaluación complementaria de una tesis ya redactada. No modifica el prototipo: ni la aplicación, ni `src/contrato.ts`, ni las pruebas, ni `v_producto`, `v_insumo` y `v_receta_componente` de Food Store y Medusa, ni `v_producto` de Saleor.

---

## 1. Las tres consultas canónicas

Fuente: Anexo C = secciones 4.1, 4.2 y 4.3 de `docs/bitacora/estudio_previo/bitacora_WF-03_reportes.md`.

Los archivos de `sql/` son el texto canónico. Se ejecutan **sin modificar** sobre todos los esquemas. El rango de fechas no es parte del texto: entra por las variables de `psql` `desde` y `hasta` (`psql -v desde=... -v hasta=...` o `\set`), que `psql` sustituye como literales entre comillas. El literal queda sin tipo y PostgreSQL lo convierte al tipo de `"fechaCreacion"` en cada esquema (`timestamp` o `timestamptz`), interpretado en la zona de la sesión.

Toda ejecución corre con `SET TIME ZONE 'America/Argentina/Buenos_Aires'` y rangos fijos `[desde, hasta)`. No se usa `CURRENT_DATE`.

SHA-256 de los archivos al momento del preregistro:

```
b635ec2dcd06b077ace2d187fcfddd33d26490907dbda0adef4c7c1230b18b46  sql/c1_ventas.sql
e8b901198a3ece44682d0daab152d1222d0ad598135acd3fe9f9b8b5b42dee5d  sql/c2_ranking.sql
52c76e9cf94038a604db636a501f98177301d16f42532d49e48039aabe08db31  sql/c2_ranking_top5.sql
dad49f4bd34a524ae187f41f356527740d6427ad3d9b1c0e551ec583b47a4f7f  sql/c3_estados.sql
```

### C1 — Ventas del día (`sql/c1_ventas.sql`)

```sql
-- C1. Ventas del dia (Anexo C, 4.1) sobre el contrato canonico.
-- Parametros psql: :desde y :hasta, rango [desde, hasta) en la zona de la sesion.
SELECT
    COUNT(*) AS cantidad_pedidos,
    COALESCE(SUM(p.total), 0) AS facturacion_total,
    COALESCE(ROUND(AVG(p.total), 2), 0) AS ticket_promedio
FROM v_pedido p
WHERE p.estado <> 'cancelado'
  AND p."fechaCreacion" >= :'desde'
  AND p."fechaCreacion" <  :'hasta';
```

### C2 — Productos más vendidos, sin `LIMIT` (`sql/c2_ranking.sql`)

```sql
-- C2. Productos mas vendidos (Anexo C, 4.2) sobre el contrato canonico, sin LIMIT.
-- Parametros psql: :desde y :hasta, rango [desde, hasta) en la zona de la sesion.
SELECT
    i."productoId",
    pr.nombre,
    SUM(i.cantidad) AS unidades_vendidas,
    COALESCE(SUM(i.cantidad * i."precioUnitario"), 0) AS total_generado
FROM v_item_pedido i
JOIN v_pedido p ON p.id = i."pedidoId"
LEFT JOIN v_producto pr ON pr.id = i."productoId"
WHERE p.estado <> 'cancelado'
  AND p."fechaCreacion" >= :'desde'
  AND p."fechaCreacion" <  :'hasta'
GROUP BY i."productoId", pr.nombre
ORDER BY unidades_vendidas DESC, i."productoId";
```

`sql/c2_ranking_top5.sql` es el mismo texto con `LIMIT 5` al final. Es solo informativa y no entra en la comparación.

### C3 — Pedidos por estado (`sql/c3_estados.sql`)

```sql
-- C3. Pedidos por estado (Anexo C, 4.3) sobre el contrato canonico. Incluye cancelados.
-- Parametros psql: :desde y :hasta, rango [desde, hasta) en la zona de la sesion.
SELECT
    p.estado,
    COUNT(*) AS cantidad
FROM v_pedido p
WHERE p."fechaCreacion" >= :'desde'
  AND p."fechaCreacion" <  :'hasta'
GROUP BY p.estado
ORDER BY cantidad DESC, p.estado;
```

### Decisiones de redacción

| Punto | Decisión |
|---|---|
| Cancelados | Asimetría del original: C1 y C2 filtran `estado <> 'cancelado'`; C3 no filtra. |
| Dominio de `estado` | Se asume la **propuesta DEC-39**: la vista de cada plataforma traduce su estado de cancelación al literal `'cancelado'`, en minúscula; los demás estados se exponen con su valor nativo. |
| Bajas lógicas | No aparecen en las consultas: son responsabilidad de las vistas. |
| Ranking | Agrupa por `productoId`; `nombre` sale de `v_producto`. Monto = `SUM(cantidad * precioUnitario)`. Orden por unidades y desempate por `productoId` (corrige el defecto de empates conocido). |
| `LEFT JOIN v_producto` | Un ítem cuyo producto ya no figura en `v_producto` (baja lógica, variante borrada) conserva sus unidades y su monto; solo pierde el nombre. Con `JOIN` desaparecería del ranking sin aviso. |
| Nulos | `COALESCE` en C1 para que un día sin pedidos devuelva `0, 0, 0`. C2 y C3 devuelven cero filas en un día vacío, igual que la nativa. |
| Orden de C3 | Se agrega `p.estado` como desempate para que el orden sea determinista. No cambia el conjunto de filas. |
| Tipos | Las consultas no castean. Que `v_item_pedido."pedidoId"` sea comparable con `v_pedido.id`, `"productoId"` con `v_producto.id` (texto), y `total` sea `numeric` es obligación de las vistas. |

---

## 2. Regla de elección del esquema independiente

Se aplica antes de mirar cualquier resultado de las consultas canónicas.

1. **Saleor.** Contar los pedidos de la instancia de Saleor (base `saleor`), por día calendario de `created_at` en `America/Argentina/Buenos_Aires`. Se cuentan las filas de `order_order` con `status <> 'draft'`: un borrador no es un pedido realizado y Saleor lo lista aparte. También se registra el conteo sin excluir borradores. Si hay **al menos un día con 2 o más pedidos**, el esquema independiente es Saleor.
2. **Medusa.** Si no, contar los pedidos de Medusa (`"order"` con `deleted_at IS NULL` y `status <> 'draft'`), por día con la misma zona. Si Medusa tiene al menos un día con 2 o más pedidos, el esquema independiente es Medusa con esos pedidos.
3. **Medusa con pedidos construidos.** Si Medusa tampoco los tiene, se crean pedidos de prueba en Medusa **por su API de tienda** (carrito → checkout con el proveedor de pago manual), nunca con `INSERT` directo. Al menos 3 pedidos el mismo día, y al menos uno se cancela desde la API de administración. Se registra cuántos, en qué día, con qué productos, y que son datos construidos para la prueba sobre una instancia real (no un *fixture*).
4. Se registra el conteo que motivó la elección.

---

## 3. Criterios de refutación

La portabilidad del reporte diario queda **refutada** si ocurre alguna de estas cosas:

- **R1.** Alguna consulta canónica necesita editar su texto para ejecutar sobre alguno de los dos esquemas.
- **R2.** En Food Store, la diferencia simétrica con la nativa no es vacía en algún día y bloque, salvo por el nombre histórico registrado antes en el paso 4.1.
- **R3.** En el esquema independiente, algún resultado difiere del cálculo manual, o la modificación controlada no produce exactamente los efectos esperados.

La inaplicabilidad de una consulta por un atributo ausente (por ejemplo, el total en Medusa, DEC-28) **no refuta**: se reporta como ausencia, clase 4.

Si después de este commit cambia el texto de una consulta canónica, la evaluación de esa consulta se considera **refutada**, y se reporta todo lo demás.

---

## 4. Procedimiento de comparación (resumen)

- **Food Store.** Cada día con pedidos, más un día sin pedidos. Las tres nativas del Anexo C con solo el rango de fechas cambiado (`CURRENT_DATE - INTERVAL '1 day'` y `CURRENT_DATE` reemplazados por las mismas fechas fijas), contra las tres canónicas.
  - Ventas: los tres valores.
  - Ranking: el conjunto `(productoId, unidades, monto)` sin `LIMIT`, cruzando la nativa (agrupada por `producto_nombre`) por el mapeo nombre → id, con las ambigüedades registradas.
  - Estados: pares `(estado, cantidad)`, con `'cancelado'` ≡ `CANCELADO`. La nativa agrupa por `descripcion` y la canónica por el código: se usa el mapeo `descripcion → codigo` de `estado_pedido`.
  - Diferencia simétrica en las dos direcciones, dentro de una misma transacción `REPEATABLE READ READ ONLY`.
- **Esquema independiente.** Cada día con pedidos: las tres canónicas contra tres consultas escritas a mano sobre las tablas nativas, sin vistas. Luego la modificación controlada dentro de una transacción terminada en `ROLLBACK`, con verificación posterior.
