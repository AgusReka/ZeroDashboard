# Bitácora — CH-16c: Saleor como caso negativo ejecutado

**Fecha de la corrida:** [COMPLETAR]
**Instancia:** saleor-platform, imagen del servicio `api`: [COMPLETAR], versión de Saleor: [COMPLETAR]
**Base:** [nombre], PostgreSQL [versión devuelta por la sección 0]
**Datos:** `populatedb` oficial, sin modificaciones

---

## Análisis previo de código (23/09/2026)

Repositorio `saleor/saleor`, commit `4f3190d`, versión 3.23.35. Sin modelo que vincule variante con componente y cantidad. Existencia en `warehouse_stock` (variante × depósito). Atributos de referencia a variantes sin cantidad por vínculo. *(Ver PROTOCOLO_Saleor.md.)*

## Resultados sobre la instancia

| ID | Acción | Resultado esperado | Resultado obtenido | Estado |
|---|---|---|---|---|
| S-1 | `07_inventario_esquema_saleor.sql`, sección 1 | 0 tablas | [pegar] | |
| S-2 | Sección 2 | 0 columnas | [pegar] | |
| S-3 | Sección 3: claves foráneas hacia variantes | Ninguna desde otra variante ni desde un insumo | [pegar] | |
| S-4 | Sección 5: valores de atributo que referencian variantes | [sin expectativa] | [pegar] | |
| S-5 | `08_vistas_saleor.sql`: crear `v_producto` | Se crea sin error | [pegar] | |
| S-6 | Intentar derivar `v_insumo` y `v_receta_componente` | No hay origen | [describir qué se buscó] | |

## Decisiones tomadas en esta corrida

- DEC-37 — [agregación de stock entre depósitos]
- DEC-38 — [significado de `activo` en Saleor]

## Fricciones

| # | Fricción | Causa | Resolución |
|---|---|---|---|
| | | | |

## Lo que esta entrada NO sostiene

- Nada sobre las automatizaciones de stock físico y reporte diario sobre Saleor.
- La ausencia se observa en el esquema de una versión; otra versión o una extensión podrían agregar composición.
