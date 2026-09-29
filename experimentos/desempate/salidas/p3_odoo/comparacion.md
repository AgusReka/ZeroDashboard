## Corridas de la V2 entre si

```
d3faa35bfc707bf69e9c4b76538ca57c9d33c8583098337d7d9365d55195fa89 *v2_corrida1.txt
d3faa35bfc707bf69e9c4b76538ca57c9d33c8583098337d7d9365d55195fa89 *v2_corrida2.txt
d3faa35bfc707bf69e9c4b76538ca57c9d33c8583098337d7d9365d55195fa89 *v2_corrida3.txt
cmp v2_corrida1 v2_corrida2: identicas
cmp v2_corrida1 v2_corrida3: identicas
cmp v2_corrida2 v2_corrida3: identicas
```

## Forma de las salidas

```
v2_corrida1.txt: 7 filas, 0 filas con un numero de campos distinto de 6
v2_corrida2.txt: 7 filas, 0 filas con un numero de campos distinto de 6
v2_corrida3.txt: 7 filas, 0 filas con un numero de campos distinto de 6
manual.txt: 7 filas, 0 filas con un numero de campos distinto de 6
```

## Diferencia simetrica contra el calculo manual: (producto, stock_producible, insumo_limitante_id)

| Corrida | Filas V2 | Filas manual | Solo V2 | Solo manual |
|---|---|---|---|---|
| 1 | 7 | 7 | 0 | 0 |
| 2 | 7 | 7 | 0 | 0 |
| 3 | 7 | 7 | 0 | 0 |

```
Solo V2 (corrida 1):
Solo manual (contra corrida 1):
```

## Empates segun el calculo manual

```
producto 39: empatados {65,66}, limitante esperado 65 (con COLLATE "C": 65)
producto 54: empatados {56,57,58}, limitante esperado 56 (con COLLATE "C": 56)
producto 8: empatados {32,33}, limitante esperado 32 (con COLLATE "C": 32)
productos donde la colacion de la base y "C" eligen distinto: 0
```

## Huella del estado

```
huella antes = huella despues
mrp_bom|8|5314a322470c081fb6815184347ba0d8
mrp_bom_line|17|f9eaf5f580a56a35e08122e1ede61d75
mrp_bom_line_product_template_attribute_value_rel|0|d41d8cd98f00b204e9800998ecf8427e
product_product|66|b203f79eb681995e27262d6dd1ea51db
product_template|53|02cb75abbc039322051a9550cee81dc2
stock_location|36|886ecaccf6060991b547e526e61e9c5c
stock_quant|67|58be1be34cc120c4143dac2a88a64079
uom_uom|30|82472084b34d10ba3805c04cfa5b5e68
```
