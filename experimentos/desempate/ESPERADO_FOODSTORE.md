# Paso 4, Food Store — valores elegidos y resultado esperado (escrito antes de ejecutar la modificación)

**Fecha:** 2026-09-29, antes de ejecutar `scripts/p4_foodstore.sh`. Estado leído en `salidas/p4_foodstore/datos/componentes.txt` (sesión de solo lectura, `lector_zerodashboard`, 13:05:12 −03:00). Huella `salidas/p4_foodstore/datos/huella_previa.txt`, idéntica a la del paso 3 (`salidas/p3_foodstore/datos/huella_antes.txt`).

## Aplicación de la regla 5.2 del preregistro

1. **Candidatos.** Productos activos con dos o más componentes: 1, 2, 3 y 4. Los productos 5 y 6 tienen un solo componente.
2. **Producto 1, Hamburguesa Clásica**, el de menor id. Cocientes exactos, ordenados por cociente y, a igual cociente, por id como texto:

   | Insumo (id) | Existencia / cantidad | Cociente |
   |---|---|---|
   | Tomate (4) | 50 / 1 | 50 |
   | Lechuga (3) | 60 / 1 | 60 |
   | Cebolla (5) | 70 / 1 | 70 |
   | Carne vacuna (2) | 80 / 1 | 80 |
   | Pan brioche (1) | 120 / 1 | 120 |
   | Mayonesa (8) | 200 / 1 | 200 |

   **L** = Tomate (4), **S** = Lechuga (3).
3. **Existencia nueva de S.** `x = n_L · d_S / d_L = 50 · 1 / 1 = 50`. Es entera, `≥ 0` y distinta de 60, así que el producto 1 sirve. No hace falta mirar los candidatos 2, 3 y 4.
4. **Modificación.** `UPDATE ingredient SET stock_quantity = 50 WHERE id = 3 AND stock_quantity = 60 AND deleted_at IS NULL`, con guarda.

Invocación: `scripts/p4_foodstore.sh 3 60 50`.

## Resultado esperado, calculado a mano

Lechuga (3) está en las recetas de los productos 1 y 3. Los demás productos no la usan.

| Producto | Componentes con el estado modificado (existencia / cantidad = cociente) | Empatados | Stock producible | Limitante esperado |
|---|---|---|---|---|
| 1 Hamburguesa Clásica | Tomate 50/1 = 50; **Lechuga 50/1 = 50**; Cebolla 70; Carne 80; Pan 120; Mayonesa 200 | **{3, 4}** | 50 | **3 Lechuga**: `'3' < '4'` como texto. `stock_insumo_limitante = 50` |
| 3 Hamburguesa Doble | Carne vacuna 80/2 = 40; Queso cheddar 90/2 = 45; **Lechuga 50/1 = 50**; Tomate 50/1 = 50; Pan 120; Mayonesa 200 | {2} | 40 | 2 Carne vacuna, sin cambios |
| 2 Hamburguesa BBQ Bacon | sin cambios: Bacon 40/2 = 20 | {7} | 20 | 7 Bacon |
| 4 Hamburguesa Picante | sin cambios: Jalapeños 30/2 = 15 | {12} | 15 | 12 Jalapeños |
| 5 Papas Fritas | sin cambios: Papas 250/1 | {13} | 250 | 13 Papas |
| 6 Aros de Cebolla | sin cambios: Cebolla 70/1 | {5} | 70 | 5 Cebolla |

Salida esperada de la V2 dentro de la transacción, en las tres corridas. El nombre y `stock_insumo_limitante` son informativos:

```
4|Hamburguesa Picante|15|Jalapeños|30|12
2|Hamburguesa BBQ Bacon|20|Bacon|40|7
3|Hamburguesa Doble|40|Carne vacuna|80|2
1|Hamburguesa Clásica|50|Lechuga|50|3
6|Aros de Cebolla|70|Cebolla|70|5
5|Papas Fritas|250|Papas|250|13
```

Después del `ROLLBACK` se espera la salida base del paso 3 (`salidas/p3_foodstore/datos/v2_corrida1.txt`), con Tomate (4) como limitante del producto 1, y Lechuga de nuevo en 60.

Qué ejercita la modificación: un empate exacto forzado en el que el desempate por id **cambia** el insumo informado. Lechuga (3) le gana a Tomate (4), que era el limitante único antes de modificar. También ejercita que el insumo modificado, compartido con otro producto (Doble), no altere ese otro producto, porque ahí no llega al mínimo.
