# Paso 3.4 — valores elegidos y resultado esperado (escrito antes de ejecutar la modificación)

**Fecha:** 2026-09-26, antes de las 13:31 (hora de Buenos Aires). Estado leído en `salidas/p3_4_estado_previo_output.txt` (13:29:41).

## Aplicación de la regla 4.1 del preregistro

1. **Insumo compartido.** Los insumos que figuran en la receta elegida de dos o más productos activos son `57` (Bolt: productos 54 Table y 64 Table Kit) y `62` (Wood Panel: productos 55 Table Top y 64 Table Kit). El de menor id es **57, Bolt**.
2. **Línea.** Las líneas con componente 57 son la 6 (lista 2, Table) y la 13 (lista 6, Table Kit). La de menor id es la **línea 6**: `product_qty` pasa de **4.00 a 12.00** (×3).
3. **Existencia.** Bolt no tiene ningún `stock_quant` en ubicaciones internas. Se inserta uno con `product_id = 57`, `location_id = 5` (el `lot_stock_id` del almacén 1), `company_id = 1`, `quantity = 7`, `reserved_quantity = 0`, `in_date = now()`.

## Resultado esperado, calculado a mano

Disponible de Bolt después de la modificación: 0 + 7 = **7**.

| Producto | Componentes (disponible / cantidad por unidad) | Stock producible esperado | Insumo limitante esperado |
|---|---|---|---|
| 54 Table | Table Leg 0/4 = 0; Bolt 7/12 = 0,583…; Screw 0/10 = 0; Table Top 5/1 = 5 | **0** | empate entre **Table Leg** y **Screw** (cociente 0); Bolt deja de empatar |
| 64 Table Kit | Bolt 7/4 = 1,75; Wood Panel 48/1 = 48 | **1** (`FLOOR(1,75)`) | **Bolt**, único; `stock_insumo_limitante = 7` |
| 8, 39, 55, 62, 63 | sin cambios | igual que en la corrida 3.1 | igual que en la corrida 3.1 |

Antes de la modificación: Table 0 con empate Table Leg / Bolt / Screw; Table Kit 0 con Bolt (cociente 0/4 = 0).

Qué ejercita la modificación: la división por una cantidad por unidad distinta de 1 en un insumo compartido (Bolt se consume 12 por Table y 4 por Table Kit), y el cambio de insumo limitante y de stock producible en el producto que comparte el insumo (Table Kit pasa de 0 a 1). En Table el mínimo sigue en 0 por otros componentes: la regla fija no lo elige a propósito y se reporta tal cual.
