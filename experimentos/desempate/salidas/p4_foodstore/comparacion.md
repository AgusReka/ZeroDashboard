## Corridas de la V2 entre si

```
db3816c24e0b028a740dd20b54715ee82f1e6d6ffbf4d5281162011bbb96a66b *v2_corrida1.txt
db3816c24e0b028a740dd20b54715ee82f1e6d6ffbf4d5281162011bbb96a66b *v2_corrida2.txt
db3816c24e0b028a740dd20b54715ee82f1e6d6ffbf4d5281162011bbb96a66b *v2_corrida3.txt
cmp v2_corrida1 v2_corrida2: identicas
cmp v2_corrida1 v2_corrida3: identicas
cmp v2_corrida2 v2_corrida3: identicas
```

## Forma de las salidas

```
v2_corrida1.txt: 6 filas, 0 filas con un numero de campos distinto de 6
v2_corrida2.txt: 6 filas, 0 filas con un numero de campos distinto de 6
v2_corrida3.txt: 6 filas, 0 filas con un numero de campos distinto de 6
manual.txt: 6 filas, 0 filas con un numero de campos distinto de 6
```

## Diferencia simetrica contra el calculo manual: (producto, stock_producible, insumo_limitante_id)

| Corrida | Filas V2 | Filas manual | Solo V2 | Solo manual |
|---|---|---|---|---|
| 1 | 6 | 6 | 0 | 0 |
| 2 | 6 | 6 | 0 | 0 |
| 3 | 6 | 6 | 0 | 0 |

```
Solo V2 (corrida 1):
Solo manual (contra corrida 1):
```

## Empates segun el calculo manual

```
producto 1: empatados {3,4}, limitante esperado 3 (con COLLATE "C": 3)
productos donde la colacion de la base y "C" eligen distinto: 0
```

## Huella del estado

```
huella antes = huella despues
ingredient|14|dc72bad86fef602212727f3a9b065064
product|9|78bc15a3b99f7224d3340f75e7e22430
product_ingredient|26|58fe1c6c26fafbf9c602df6e2af44028
```

## Reversion

```
V2 despues del ROLLBACK = V2 base (p3_foodstore, corrida 1)
huella despues del ROLLBACK = huella del estado previo
```
