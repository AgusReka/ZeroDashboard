# Preregistro — replicación sobre Odoo Community: stock producible y reporte diario

**Fecha:** 2026-09-26. **Rama:** `experimento/odoo` (no se fusiona).

Este archivo se commitea **antes** de leer cualquier fila de productos, listas de materiales, existencias o pedidos de Odoo. Hasta este commit no existe todavía la instancia de Odoo: no se leyó ninguna fila de ninguna tabla de Odoo.

Evaluación complementaria de una tesis ya redactada. No modifica el prototipo congelado: ni `src/`, ni `src/contrato.ts`, ni las pruebas, ni ninguna vista de Food Store, Medusa o Saleor. Todo lo nuevo va en `experimentos/odoo/` y en `docs/bitacora/bitacora_odoo.md`.

---

## 1. Consultas canónicas

Se ejecutan **desde su ruta original, sin copiarlas ni modificarlas**, con el rol de solo lectura. SHA-256 al momento del preregistro:

```
979131ebbf5055a6a267221db8c2de80ae7ccbaa3d56c091e24d900d66359c90  openspec/changes/CH-16b-vistas-canonicas/sql/04_consulta_canonica.sql
b635ec2dcd06b077ace2d187fcfddd33d26490907dbda0adef4c7c1230b18b46  experimentos/reporte_diario/sql/c1_ventas.sql
e8b901198a3ece44682d0daab152d1222d0ad598135acd3fe9f9b8b5b42dee5d  experimentos/reporte_diario/sql/c2_ranking.sql
52c76e9cf94038a604db636a501f98177301d16f42532d49e48039aabe08db31  experimentos/reporte_diario/sql/c2_ranking_top5.sql
dad49f4bd34a524ae187f41f356527740d6427ad3d9b1c0e551ec583b47a4f7f  experimentos/reporte_diario/sql/c3_estados.sql
```

- **Stock producible** (`04_consulta_canonica.sql`): la consulta de CH-16 y CH-16b, la misma que corrió sobre Food Store y Medusa.
- **Reporte diario** (`c1_ventas.sql`, `c2_ranking.sql`, `c3_estados.sql`): las del P12 (`experimentos/reporte_diario/PREREGISTRO.md`). El rango entra por las variables de `psql` `desde` y `hasta`, sin tocar el texto. `c2_ranking_top5.sql` es solo informativa y no entra en la comparación.

Si una consulta canónica necesita cambiar su texto para ejecutar, **no se cambia**: se registra el error exacto como refutación (R1). Antes de cada corrida se recalcula el SHA-256 y se compara con esta lista.

Toda ejecución de las consultas del reporte diario corre con `SET TIME ZONE 'America/Argentina/Buenos_Aires'` y rangos fijos `[desde, hasta)`. No se usa `CURRENT_DATE`.

---

## 2. Criterios de refutación

- **R1.** Alguna consulta canónica necesita editar su texto para ejecutar sobre Odoo.
- **R2.** El stock producible difiere del cálculo manual, o la modificación controlada no produce exactamente el resultado esperado.
- **R3.** Algún resultado del reporte diario difiere del cálculo manual, o la modificación controlada no produce exactamente los efectos esperados.

Que un atributo no tenga correspondencia (clase 4) no refuta nada: se reporta como tal.

Si después de este commit cambia el texto de una consulta canónica (su SHA-256 deja de coincidir), la evaluación de esa consulta se considera refutada y se reporta todo lo demás.

---

## 3. Procedimiento de comparación

- **Stock producible.** La canónica, con el rol de solo lectura, contra una consulta escrita a mano sobre las tablas nativas de Odoo (`product_product`, `product_template`, `mrp_bom`, `mrp_bom_line`, `stock_quant`, `stock_location`, `uom_uom`), sin vistas. Diferencia simétrica en las dos direcciones sobre la tupla `(producto, stock_producible, insumo_limitante)`, con las dos consultas dentro de una misma instantánea.
- **Reporte diario.** Para cada día calendario (zona `America/Argentina/Buenos_Aires`) con al menos un pedido en `v_pedido`, más un día vacío: C1, C2 y C3 contra tres consultas manuales sobre `sale_order` y `sale_order_line` (más las tablas de producto y moneda que hagan falta), sin vistas. Diferencia simétrica en las dos direcciones:
  - C1: `(cantidad_pedidos, facturacion_total, ticket_promedio)`;
  - C2: `(productoId, nombre, unidades_vendidas, total_generado)`;
  - C3: `(estado, cantidad)`.
- **Día vacío.** El día calendario anterior al primer día con pedidos en `v_pedido`. Se verifica con un conteo que efectivamente no tiene pedidos; si tuviera, se retrocede de a un día hasta encontrar uno vacío.
- Las consultas manuales replican las decisiones de significado de las vistas. Verifican la composición vista + consulta canónica, no esas decisiones: eso se declara en la bitácora.

---

## 4. Regla de modificación controlada

Ambas modificaciones corren en **una transacción terminada en `ROLLBACK`**. Después se verifica, **desde una sesión nueva**, que el estado volvió al anterior: las filas tocadas y las salidas de las consultas canónicas, comparadas con las de antes.

### 4.1 Stock producible

Elección por regla fija, aplicada sobre el estado leído antes de modificar:

1. **Insumo compartido.** Entre los insumos que aparecen en la receta elegida de **dos o más** productos activos, el de menor `product_product.id`. Si ningún insumo se comparte, se anota como dato no representativo y se toma el componente de menor `product_product.id` de cualquier receta.
2. **Línea a modificar.** Entre las líneas de las recetas elegidas que tienen como componente a ese insumo, la de menor `mrp_bom_line.id`. Su `product_qty` pasa a **3 veces** su valor original.
3. **Existencia a modificar.** Al mismo insumo se le suman **7 unidades** (en la unidad de medida del insumo) en el `stock_quant` de menor `id` en una ubicación interna. Si no tiene ninguno, se inserta un `stock_quant` con `quantity = 7` y `reserved_quantity = 0` en la ubicación de existencias (`lot_stock_id`) del almacén de menor `id`.

Los valores concretos (ids, cantidades originales y nuevas) y el resultado esperado de cada producto afectado se **escriben en la bitácora antes de ejecutar** la modificación, calculados a mano a partir del estado leído. Se verifica que la canónica, dentro de la transacción, devuelva exactamente ese `stock_producible` e `insumo_limitante` para cada producto afectado y que los demás productos no cambien.

### 4.2 Reporte diario

1. **Día.** El día con más pedidos no cancelados en `v_pedido`; si hay empate, el más antiguo.
2. **Pedido.** El de menor `sale_order.id` entre los no cancelados de ese día.
3. **Modificación.** `UPDATE sale_order SET state = 'cancel'` sobre ese pedido, con una guarda que aborta la transacción si el `UPDATE` no aplicó.

Efectos esperados, calculados a partir de la salida "antes" y de las líneas del pedido:

- C1: `cantidad_pedidos − 1`, `facturacion_total − amount_total` del pedido, `ticket_promedio` recalculado;
- C2: cada producto del pedido pierde sus unidades y su monto (`Σ cantidad × precioUnitario` de sus líneas); si queda en cero unidades, sale del ranking;
- C3: el estado del pedido `− 1` y `'cancelado'` `+ 1`.

Los demás días no deben cambiar.
