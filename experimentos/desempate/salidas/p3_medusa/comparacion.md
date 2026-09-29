## Corridas de la V2 entre si

```
1938b55b3f46b476aa888ef61a15a0446803fd12d070d8bd3d436be0135e6a1b *v2_corrida1.txt
1938b55b3f46b476aa888ef61a15a0446803fd12d070d8bd3d436be0135e6a1b *v2_corrida2.txt
1938b55b3f46b476aa888ef61a15a0446803fd12d070d8bd3d436be0135e6a1b *v2_corrida3.txt
cmp v2_corrida1 v2_corrida2: identicas
cmp v2_corrida1 v2_corrida3: identicas
cmp v2_corrida2 v2_corrida3: identicas
```

## Forma de las salidas

```
v2_corrida1.txt: 20 filas, 0 filas con un numero de campos distinto de 6
v2_corrida2.txt: 20 filas, 0 filas con un numero de campos distinto de 6
v2_corrida3.txt: 20 filas, 0 filas con un numero de campos distinto de 6
manual.txt: 20 filas, 0 filas con un numero de campos distinto de 6
```

## Diferencia simetrica contra el calculo manual: (producto, stock_producible, insumo_limitante_id)

| Corrida | Filas V2 | Filas manual | Solo V2 | Solo manual |
|---|---|---|---|---|
| 1 | 20 | 20 | 0 | 0 |
| 2 | 20 | 20 | 0 | 0 |
| 3 | 20 | 20 | 0 | 0 |

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
inventory_item|20|d1492ad2de64555f7a3dc0614cfafe67
inventory_level|20|2cb006138e99b2951f5dc013565dc1f8
product|4|509e2215351a589ab288653e310bf806
product_variant|20|cbc7ab901170cf874a3e06c64236aacf
product_variant_inventory_item|20|b12aa75427dc039d5b2a2913948fa39f
```
