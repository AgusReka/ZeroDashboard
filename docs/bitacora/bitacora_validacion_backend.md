# Bitácora — Validación de la consulta original contra `_compute_available_stock` del backend de Food Store

**Fecha:** 2026-09-24 (ejecución: 12:34:38 a 12:34:48, hora -03:00).
**Encargo:** comprobar si `02_query_original.sql` (CH-16b), que se presenta como réplica de `_compute_available_stock` del backend `foodstore-backend-fastapi`, devuelve lo mismo que esa función. Comparar también contra `04_consulta_canonica.sql`.
**Alcance:** solo lectura sobre la base `food_store` (contenedor `foodstore-backend-fastapi-db-1`). No se modificaron datos, SQL ni el backend.

---

## Resultado

**Las tres salidas coinciden en los 6 productos con receta (0 diferencias).**

| id | producto | backend | consulta original | consulta canónica | ¿coinciden? |
|---|---|---|---|---|---|
| 1 | Hamburguesa Clásica | 50 | 50 | 50 | sí |
| 2 | Hamburguesa BBQ Bacon | 20 | 20 | 20 | sí |
| 3 | Hamburguesa Doble | 40 | 40 | 40 | sí |
| 4 | Hamburguesa Picante | 15 | 15 | 15 | sí |
| 5 | Papas Fritas | 250 | 250 | 250 | sí |
| 6 | Aros de Cebolla | 70 | 70 | 70 | sí |

El insumo crítico también coincide entre la original y la canónica en los 6 casos. El backend no devuelve insumo crítico, así que ese dato no se puede comparar con el backend.

**Salvedad: la coincidencia vale para el estado actual de los datos, no demuestra que la lógica sea equivalente.** En la base no hay ninguna fila que active los filtros en los que difieren el backend y las consultas: hay 0 productos borrados, 0 productos no disponibles, 0 ingredientes borrados y 0 recetas con `quantity <= 0`. Las diferencias de lógica están detalladas en la sección "Diferencias de lógica que estos datos no activan". No se corrigió nada.

---

## 1. La función en el backend

- Repositorio: `C:\Users\messi\OneDrive\Documentos\Proyectos\FoodStore-Backend-FastAPI`, commit `bb063e6` (`bb063e6c868d9d257dc2d3729563e1af909fd41a`, 2026-06-21 23:54:22 -0300).
- Archivo: `app/modules/product/service.py`, líneas 108–138, método estático de `ProductService`.
- Se llama desde `create` (l. 186), `update` (l. 361), `get_all` (l. 526) y `get_by_id` (l. 600).

Implementación, copiada tal cual:

```python
    @staticmethod
    def _compute_available_stock(
        ingredient_map: dict[int, Ingredient],
        ingredient_items: list[tuple[int, int]],
        stock_quantity: int = 0,
    ) -> int:
        """
        Calcula el stock disponible de un producto.

        Para productos con receta: MIN(ingrediente.stock_quantity / cantidad_necesaria)
        Para productos sin receta (standalone): stock_quantity físico.

        Args:
            ingredient_map: dict[id_ingrediente -> Ingredient]
            ingredient_items: lista de tuplas (ingredient_id, quantity)
            stock_quantity: stock físico del producto (usado si no tiene receta)

        Returns:
            int: stock disponible
        """
        if not ingredient_items:
            return stock_quantity

        try:
            return min(
                ingredient_map[ing_id].stock_quantity // qty
                for ing_id, qty in ingredient_items
                if ing_id in ingredient_map and qty > 0
            )
        except (ValueError, ZeroDivisionError):
            return 0
```

La función es pura: no consulta la base. Los filtros los aplica quien arma sus argumentos. En `get_by_id` (l. 557–604), que es el camino que usa el script:

```python
            product = self._get_or_404(uow, product_id)
            ...
            ingredient_links = uow.products.get_ingredient_links_by_product_ids(
                [product.id]
            )
            ...
            ingredient_ids = [l.ingredient_id for l in ingredient_links]
            db_ingredients = uow.ingredients.get_all_in(ingredient_ids)
            ingredient_map = {ing.id: ing for ing in db_ingredients}
            ...
            available_stock = self._compute_available_stock(
                ingredient_map,
                [(link.ingredient_id, link.quantity) for link in ingredient_links],
                stock_quantity=product.stock_quantity,
            )
```

Las consultas del repositorio que alimentan esos argumentos:

- `_get_or_404` → `BaseRepository.get_by_id` → `session.get(Product, id)`: **no filtra `deleted_at` ni `available`**.
- `ProductRepository.get_ingredient_links_by_product_ids` (`app/modules/product/repository.py:181`): `select(ProductIngredientLink).where(product_id.in_(ids))`, sin más filtros.
- `IngredientRepository.get_all_in` (`app/modules/ingredient/repository.py:25`): `select(Ingredient).where(Ingredient.id.in_(ids))`: **no filtra `deleted_at`**.

## 2. El script y cómo obtiene el valor del backend

Script: `docs/bitacora/validacion_backend_stock.py` (en este repositorio, fuera del backend). No modifica el backend: agrega su carpeta a `sys.path` e importa `ProductService`.

**Se usó la importación, no el endpoint.** Llamar a `_compute_available_stock` sola habría obligado al script a reconstruir sus argumentos, que es justamente lo que se quiere validar. Por eso el script llama a `ProductService(session).get_by_id(pid).available_stock`, el mismo camino que recorre `GET /products/{id}` (`router.py:99` → `svc.get_by_id`): repositorios del backend → `_compute_available_stock`. Así no hacen falta autenticación ni el rate limit de la API.

Garantías de solo lectura y de simultaneidad:

- El engine se crea con `settings.DATABASE_URL` (el `.env` del backend: `postgres@localhost:5433/food_store`, el puerto publicado del contenedor `foodstore-backend-fastapi-db-1`) y con `options=-c default_transaction_read_only=on`.
- Todo corre en **una sola transacción `REPEATABLE READ` de solo lectura** (verificado en la salida: `isolation=repeatable read read_only=on`). La `Session` del backend se ata a esa conexión con `join_transaction_mode="create_savepoint"`, así el `commit()` del Unit of Work solo libera un savepoint. Al final, `ROLLBACK`.
- Las tres fuentes (backend, `02`, `04`) leen **la misma instantánea**: el requisito de "mismo momento" se cumple de forma estricta.
- Universo: todo producto con al menos una fila en `product_ingredient`, **sin filtrar** por `deleted_at` ni `available`, para que cualquier diferencia de filtros quedara visible. Los filtros de cada producto aparecen en la salida.
- Los dos archivos SQL se leen del disco y se ejecutan sin cambios, salvo una línea: se quita `SET search_path TO foodstore;` de `02_query_original.sql`, porque es del fixture y la base real solo tiene el esquema `public`. `README_correr.md` indica ese ajuste ("El `SET search_path` de cada archivo es del fixture. Quitarlo o ajustarlo."). El `HAVING` ya no está en el archivo.
- Las vistas canónicas (`v_producto`, `v_insumo`, `v_receta_componente`) ya existían en `public`. No se crearon ni se modificaron. Sus definiciones están en el anexo.

### Comando

```
cd /c/Users/messi/OneDrive/Documentos/Proyectos
date -Iseconds
PYTHONIOENCODING=utf-8 FoodStore-Backend-FastAPI/venv/Scripts/python.exe ZeroDashboard/docs/bitacora/validacion_backend_stock.py
```

Entorno: Python 3.14.7 (venv del backend), SQLAlchemy 2.0.54, SQLModel 0.0.42, psycopg2 2.9.13.

### Salida cruda completa

```
2026-09-24T12:34:38-03:00
### Transaccion
now()=2026-09-24 15:34:40.567762+00:00 db=food_store isolation=repeatable read read_only=on
PostgreSQL 16.15 on x86_64-pc-linux-musl, compiled by gcc (Alpine 15.2.0) 15.2.0, 64-bit

### Productos con receta (sin filtrar) (6 filas)
id | name | available | deleted_at | stock_quantity
1 | Hamburguesa Clásica | True | NULL | 50
2 | Hamburguesa BBQ Bacon | True | NULL | 30
3 | Hamburguesa Doble | True | NULL | 25
4 | Hamburguesa Picante | True | NULL | 20
5 | Papas Fritas | True | NULL | 100
6 | Aros de Cebolla | True | NULL | 80

### Recetas (product_ingredient + ingredient, sin filtrar) (26 filas)
product_id | ingredient_id | ingredient | quantity | stock_quantity | ingredient_deleted_at
1 | 1 | Pan brioche | 1 | 120 | NULL
1 | 2 | Carne vacuna | 1 | 80 | NULL
1 | 3 | Lechuga | 1 | 60 | NULL
1 | 4 | Tomate | 1 | 50 | NULL
1 | 5 | Cebolla | 1 | 70 | NULL
1 | 8 | Mayonesa | 1 | 200 | NULL
2 | 1 | Pan brioche | 1 | 120 | NULL
2 | 2 | Carne vacuna | 1 | 80 | NULL
2 | 5 | Cebolla | 1 | 70 | NULL
2 | 6 | Queso cheddar | 1 | 90 | NULL
2 | 7 | Bacon | 2 | 40 | NULL
2 | 11 | Salsa BBQ | 1 | 100 | NULL
3 | 1 | Pan brioche | 1 | 120 | NULL
3 | 2 | Carne vacuna | 2 | 80 | NULL
3 | 3 | Lechuga | 1 | 60 | NULL
3 | 4 | Tomate | 1 | 50 | NULL
3 | 6 | Queso cheddar | 2 | 90 | NULL
3 | 8 | Mayonesa | 1 | 200 | NULL
4 | 1 | Pan brioche | 1 | 120 | NULL
4 | 2 | Carne vacuna | 1 | 80 | NULL
4 | 6 | Queso cheddar | 1 | 90 | NULL
4 | 8 | Mayonesa | 1 | 200 | NULL
4 | 11 | Salsa BBQ | 1 | 100 | NULL
4 | 12 | Jalapeños | 2 | 30 | NULL
5 | 13 | Papas | 1 | 250 | NULL
6 | 5 | Cebolla | 1 | 70 | NULL

### Backend (ProductService.get_by_id(...).available_stock) (6 filas)
id | available_stock
1 | 50
2 | 20
3 | 40
4 | 15
5 | 250
6 | 70

### 02_query_original.sql (sin HAVING, sin SET search_path) (6 filas)
id | name | stock_producible | ingrediente_critico
1 | Hamburguesa Clásica | 50 | Tomate
2 | Hamburguesa BBQ Bacon | 20 | Bacon
3 | Hamburguesa Doble | 40 | Carne vacuna
4 | Hamburguesa Picante | 15 | Jalapeños
5 | Papas Fritas | 250 | Papas
6 | Aros de Cebolla | 70 | Cebolla

### 04_consulta_canonica.sql (6 filas)
id | nombre | stock_producible | insumo_limitante | stock_insumo_limitante
4 | Hamburguesa Picante | 15 | Jalapeños | 30
2 | Hamburguesa BBQ Bacon | 20 | Bacon | 40
3 | Hamburguesa Doble | 40 | Carne vacuna | 80
1 | Hamburguesa Clásica | 50 | Tomate | 50
6 | Aros de Cebolla | 70 | Cebolla | 70
5 | Papas Fritas | 250 | Papas | 250

### Comparacion
| id | producto | available | deleted_at | backend | original | canonica | coinciden |
|---|---|---|---|---|---|---|---|
| 1 | Hamburguesa Clásica | True | None | 50 | 50 | 50 | si |
| 2 | Hamburguesa BBQ Bacon | True | None | 20 | 20 | 20 | si |
| 3 | Hamburguesa Doble | True | None | 40 | 40 | 40 | si |
| 4 | Hamburguesa Picante | True | None | 15 | 15 | 15 | si |
| 5 | Papas Fritas | True | None | 250 | 250 | 250 | si |
| 6 | Aros de Cebolla | True | None | 70 | 70 | 70 | si |

Filas con diferencia: 0 de 6
```

## 3. Ejecución de los archivos SQL con `psql`

Para tener también la salida en el formato nativo de `psql`, se ejecutaron los dos archivos juntos en una transacción de solo lectura, 8 segundos después del script.

### Comando

```
cd /c/Users/messi/OneDrive/Documentos/Proyectos/ZeroDashboard/openspec/changes/CH-16b-vistas-canonicas/sql
date -Iseconds
{ echo "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;"; echo "SELECT now();"; grep -vi "^SET search_path" 02_query_original.sql; cat 04_consulta_canonica.sql; echo "ROLLBACK;"; } \
  | docker exec -i -e PGOPTIONS="-c default_transaction_read_only=on" foodstore-backend-fastapi-db-1 psql -U postgres -d food_store -v ON_ERROR_STOP=1
```

### Salida cruda completa

```
2026-09-24T12:34:48-03:00
BEGIN
              now              
-------------------------------
 2026-09-24 15:34:48.802995+00
(1 row)

 id |         name          | stock_producible | ingrediente_critico 
----+-----------------------+------------------+---------------------
  1 | Hamburguesa Clásica   |               50 | Tomate
  2 | Hamburguesa BBQ Bacon |               20 | Bacon
  3 | Hamburguesa Doble     |               40 | Carne vacuna
  4 | Hamburguesa Picante   |               15 | Jalapeños
  5 | Papas Fritas          |              250 | Papas
  6 | Aros de Cebolla       |               70 | Cebolla
(6 rows)

 id |        nombre         | stock_producible | insumo_limitante | stock_insumo_limitante 
----+-----------------------+------------------+------------------+------------------------
 4  | Hamburguesa Picante   |               15 | Jalapeños        |                     30
 2  | Hamburguesa BBQ Bacon |               20 | Bacon            |                     40
 3  | Hamburguesa Doble     |               40 | Carne vacuna     |                     80
 1  | Hamburguesa Clásica   |               50 | Tomate           |                     50
 6  | Aros de Cebolla       |               70 | Cebolla          |                     70
 5  | Papas Fritas          |              250 | Papas            |                    250
(6 rows)

ROLLBACK
```

Coincide con lo que obtuvo el script para las dos consultas.

### Cobertura de los datos (qué filtros quedaron sin ejercitar)

```
docker exec -e PGOPTIONS="-c default_transaction_read_only=on" foodstore-backend-fastapi-db-1 psql -U postgres -d food_store -c "SELECT (SELECT count(*) FROM product) AS productos, (SELECT count(*) FROM product WHERE deleted_at IS NOT NULL) AS prod_borrados, (SELECT count(*) FROM product WHERE available = false) AS prod_no_disponibles, (SELECT count(*) FROM ingredient) AS ingredientes, (SELECT count(*) FROM ingredient WHERE deleted_at IS NOT NULL) AS ing_borrados, (SELECT count(*) FROM product_ingredient WHERE quantity <= 0) AS receta_qty_no_positiva;"
```

```
 productos | prod_borrados | prod_no_disponibles | ingredientes | ing_borrados | receta_qty_no_positiva 
-----------+---------------+---------------------+--------------+--------------+------------------------
         9 |             0 |                   0 |           14 |            0 |                      0
(1 row)
```

De los 9 productos, 3 no tienen receta. El backend les devuelve su `stock_quantity` físico, y ninguna de las dos consultas los incluye. Quedan fuera del universo pedido ("producto con receta").

## 4. Comparación

La tabla está en "Resultado". Coinciden los 6 de 6.

## 5. Diferencias de lógica que estos datos no activan

No hubo diferencias en la salida, así que el paso 5 del encargo ("si hay diferencias, describir la causa y detenerse") no aplica. Pero la lectura del código muestra que las tres implementaciones **no aplican los mismos filtros**. Con los datos actuales esas ramas no se ejercitan. Se registran sin corregir nada:

| Caso | Backend (`get_by_id` → `_compute_available_stock`) | `02_query_original.sql` | `04_consulta_canonica.sql` |
|---|---|---|---|
| Producto con `deleted_at` no nulo | Lo calcula igual (`session.get` no filtra). En el listado, `get_all` lo excluye por defecto (`include_deleted=False`). | Excluido (`p.deleted_at IS NULL`) | Excluido (`v_producto` y `v_receta_componente` filtran `deleted_at`) |
| Producto con `available = false` | Lo calcula igual (ni `get_by_id` ni `get_all` sin filtro lo excluyen) | Excluido (`p.available = true`) | Excluido (`pr.activo = true`) |
| Ingrediente de la receta con `deleted_at` no nulo | **Lo cuenta**: `IngredientRepository.get_all_in` no filtra `deleted_at`, así que un ingrediente borrado sigue limitando el mínimo | Lo ignora (`i.deleted_at IS NULL` en el JOIN): sale del mínimo | Lo ignora (`v_insumo` y `v_receta_componente` filtran `deleted_at`) |
| Todos los ingredientes de la receta descartados (por ejemplo, `qty <= 0` o ausentes del mapa) | `min()` de una secuencia vacía → `ValueError` → **devuelve 0** | El producto **no aparece** (no queda ninguna fila en el GROUP BY) | El producto **no aparece** |
| División | `stock // qty` (entera, sobre `int` ≥ 0) | `FLOOR(stock::numeric / qty)` | `FLOOR(stock::numeric / qty)` |

La última fila no produce diferencias: con enteros no negativos (`ge=0` en `Ingredient.stock_quantity`, `ge=1` en `ProductIngredientLink.quantity`), la división entera y `FLOOR` de la división exacta dan lo mismo. `quantity <= 0` no puede ocurrir si se respeta la validación del modelo.

Causa probable de las divergencias posibles: **las consultas filtran `deleted_at` (de producto y de ingrediente) y `available`, y el backend no**. Hay una diferencia de fondo: si un ingrediente borrado sigue en una receta, el backend lo usa para calcular el stock y las consultas no, así que las consultas pueden informar **más** stock que el backend. Además, el backend informa 0 cuando la receta queda vacía después de filtrar, y las consultas omiten el producto.

En consecuencia, decir que la consulta original es una "réplica" de `_compute_available_stock` solo se sostiene para productos no borrados, disponibles y con todos sus ingredientes vigentes. Es el único caso que hay hoy en la base. Cualquier ajuste (en la consulta, en las vistas o en cómo se describe en la tesis) queda para que lo decida el autor.

---

## Anexo — Definición de las vistas canónicas en la base real (`\d+`, solo la definición)

```
View "public.v_producto"
 SELECT id::text AS id,
    name AS nombre,
    stock_quantity AS "stockDisponible",
    NULL::text AS sku,
    available AS activo
   FROM product p
  WHERE deleted_at IS NULL;

View "public.v_insumo"
 SELECT id::text AS id,
    name AS nombre,
    stock_quantity AS "stockDisponible",
    NULL::text AS "unidadMedida",
    NULL::text AS codigo
   FROM ingredient i
  WHERE deleted_at IS NULL;

View "public.v_receta_componente"
 SELECT pi.product_id::text AS "productoId",
    pi.ingredient_id::text AS "insumoId",
    pi.quantity AS "cantidadPorUnidad"
   FROM product_ingredient pi
     JOIN product p ON p.id = pi.product_id AND p.deleted_at IS NULL
     JOIN ingredient i ON i.id = pi.ingredient_id AND i.deleted_at IS NULL;
```

## Anexo — Notas de entorno

- Docker Desktop estaba detenido al empezar. Se lo inició, y los contenedores `foodstore-backend-fastapi-db-1` y `foodstore-backend-fastapi-api-1` arrancaron solos (`restart: unless-stopped`). No se ejecutó nada contra la API.
- `git status` del backend quedó igual que antes de la validación: no se tocó ningún archivo del backend.
