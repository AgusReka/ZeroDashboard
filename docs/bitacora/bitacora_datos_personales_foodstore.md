# Bitácora — Columnas con datos personales en `food_store`

**Fecha:** 2026-09-24.
**Instancia:** contenedor `foodstore-backend-fastapi-db-1` (imagen `postgres:16-alpine`, PostgreSQL 16.15), base `food_store`, usuario `postgres`, esquema `public`.
**Alcance:** solo lectura. Cada bloque de consultas corrió en una transacción `BEGIN TRANSACTION READ ONLY` y se cerró con `ROLLBACK`. No se creó ni se modificó nada.
**Privacidad:** esta bitácora registra solo agregados (conteos y dominios). No se copia ningún correo, nombre ni teléfono. No se intentó identificar personas.

---

## Resultado

| Pregunta | Respuesta |
|---|---|
| Tablas con columnas cuyo nombre sugiere datos personales | Solo `user` tiene columnas personales reales: `full_name`, `email` y `username`. Aparte, la tabla `direccion` guarda un domicilio completo aunque ningún nombre de columna coincide con el patrón (ver §1.2) |
| Columnas de correo | 1: `public."user".email` |
| Filas / valores distintos | 5 filas, 5 no nulos, 5 distintos (también 5 sin distinguir mayúsculas) |
| Dominios | `example.com`: 5 |
| ¿De ejemplo o reales? | **De ejemplo.** `example.com` es un dominio reservado para documentación (RFC 2606). No hay dominios de proveedores reales |

---

## 1. Columnas candidatas (tarea 1)

### 1.1 Coincidencia por nombre de columna

Patrón (sin distinguir mayúsculas) sobre `information_schema.columns`, esquema `public`:
`email|correo|mail|phone|telefono|teléfono|address|direccion|dirección|name|nombre|dni|document`

```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema='public'
  AND column_name ~* '(email|correo|mail|phone|telefono|tel[eé]fono|address|direccion|direcci[oó]n|name|nombre|dni|document)'
ORDER BY table_name, ordinal_position;
```

| Tabla | Columna | Tipo | ¿Dato personal? |
|---|---|---|---|
| `category` | `name` | varchar | No: nombre de categoría |
| `detalle_pedido` | `producto_nombre` | varchar | No: nombre de producto |
| `forma_pago` | `nombre` | varchar | No: catálogo |
| `images` | `filename` | varchar | No: nombre de archivo |
| `ingredient` | `name` | varchar | No: nombre de ingrediente |
| `pedido` | `direccion_entrega_id` | integer | Indirecto: FK a `direccion` |
| `product` | `name` | varchar | No: nombre de producto |
| `roles` | `name` | varchar | No: nombre de rol |
| `user` | `username` | varchar | **Sí** (identificador de cuenta) |
| `user` | `full_name` | varchar | **Sí** |
| `user` | `email` | varchar | **Sí** |
| `v_insumo` (vista) | `nombre` | varchar | No: nombre de insumo |
| `v_producto` (vista) | `nombre` | varchar | No: nombre de producto |

13 filas. No hay columnas de teléfono, DNI ni documento.

### 1.2 Hallazgo fuera del patrón: la tabla `direccion`

`pedido.direccion_entrega_id` es FK a `direccion`. Ninguna columna de `direccion` coincide con el patrón, pero la tabla guarda un domicilio completo: `usuario_id`, `alias`, `calle`, `numero`, `piso_dpto`, `ciudad`, `provincia`, `codigo_postal`, `latitud`, `longitud`. Tiene **1 fila**. No se leyeron sus valores.

También se revisó la estructura de `pagos_mp` (`checkout_data` es `text` libre y podría contener datos del pagador). Tiene **0 filas**.

Conteos:

```
     t     | count
-----------+-------
 direccion |     1
 pagos_mp  |     0
 user      |     5
```

`user.full_name`: 5 filas, 5 no nulos.

---

## 2. Columnas de correo (tarea 2)

```sql
SELECT count(*) AS filas, count(email) AS no_nulos, count(DISTINCT email) AS distintos,
       count(DISTINCT lower(email)) AS distintos_ci,
       count(*) FILTER (WHERE email NOT LIKE '%@%') AS sin_arroba
FROM public."user";
```

```
 filas | no_nulos | distintos | distintos_ci | sin_arroba
-------+----------+-----------+--------------+------------
     5 |        5 |         5 |            5 |          0
```

```sql
SELECT lower(split_part(email,'@',2)) AS dominio, count(*) AS frecuencia
FROM public."user" WHERE email LIKE '%@%' GROUP BY 1 ORDER BY 2 DESC, 1;
```

```
   dominio   | frecuencia
-------------+------------
 example.com |          5
```

---

## 3. Clasificación de dominios (tarea 3)

| Dominio | Frecuencia | Clasificación |
|---|---|---|
| `example.com` | 5 | De ejemplo: reservado por la IANA para documentación (RFC 2606 / RFC 6761) |

No aparecen dominios de proveedores reales (gmail.com, hotmail.com, etc.) ni dominios corporativos.

Esto describe solo el dominio. No prueba que `full_name` o `username` sean ficticios: esas columnas no se inspeccionaron valor por valor.
