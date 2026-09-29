## Corridas de la V2 entre si

```
e1283171df182672338f0037d098e3a5a083880307e3d7b909f2120f0ab466f1 *v2_corrida1.txt
e1283171df182672338f0037d098e3a5a083880307e3d7b909f2120f0ab466f1 *v2_corrida2.txt
e1283171df182672338f0037d098e3a5a083880307e3d7b909f2120f0ab466f1 *v2_corrida3.txt
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
productos donde la colacion de la base y "C" eligen distinto: 0
```

## Huella del estado

```
huella antes = huella despues
ingredient|14|dc72bad86fef602212727f3a9b065064
product|9|78bc15a3b99f7224d3340f75e7e22430
product_ingredient|26|58fe1c6c26fafbf9c602df6e2af44028
```
