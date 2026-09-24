# Protocolo — Saleor como caso negativo ejecutado (CH-16c)

**Objetivo.** Establecer por inspección de una instancia real, y no solo por documentación, que una plataforma sin estructura de composición no permite escribir `v_insumo` ni `v_receta_componente`, y que por lo tanto la automatización de stock producible es inaplicable. Esto convierte el lado negativo de H2 de análisis documental (WooCommerce) en observación sobre una instancia.

**No requiere el prototipo.** Todo se ejecuta con Docker y `psql`, igual que CH-16b.

---

## Lo que ya se sabe por el código fuente (verificado el 23/09/2026)

Revisión del repositorio oficial `github.com/saleor/saleor`, commit `4f3190d` (17/09/2026), versión `3.23.35`:

- No hay ningún modelo de producto, inventario o depósito que relacione una variante con otra variante, ni con un insumo, junto con una cantidad por unidad.
- La existencia se registra en `warehouse_stock`, por variante y por depósito (`quantity`, `quantity_allocated`).
- Existe un mecanismo genérico que podría **aproximar** una composición por convención: los atributos de tipo referencia (`attribute_attributevalue.reference_variant_id`) pueden vincular un producto con variantes. Pero no guardan una cantidad por vínculo, así que no alcanzan para calcular stock producible.

Esto es análisis de código, no evidencia sobre una instancia. La corrida que sigue es la que convierte la afirmación en observación.

---

## Pasos

1. **Levantar Saleor con datos de demostración** (según el README de `saleor-platform`):
   ```
   git clone https://github.com/saleor/saleor-platform.git
   cd saleor-platform
   docker compose run --rm api python3 manage.py migrate
   docker compose run --rm api python3 manage.py populatedb --createsuperuser
   docker compose up
   ```
   Anotar la versión de Saleor que quedó corriendo (imagen del servicio `api`). Mirar en `docker-compose.yml` el nombre del servicio de base de datos, el usuario, la contraseña y el puerto.

2. **Relevar el esquema** (solo lectura):
   ```
   psql -h localhost -p <puerto> -U <usuario> -d <base> -f 07_inventario_esquema_saleor.sql > salida_07_<fecha>.txt
   ```
   Resultado esperado según el código: secciones 1 y 2 vacías; en la sección 3, solo claves foráneas desde stock, pedidos, carrito, descuentos, canales y medios, ninguna desde otra variante. **Si aparece algo distinto, eso es un resultado: registralo tal cual, no lo corrijas.**

3. **Crear `v_producto`** con un rol que tenga `CREATE`:
   ```
   psql ... -f 08_vistas_saleor.sql > salida_08_<fecha>.txt
   ```
   Antes, registrá en docs/01-decisiones.md las decisiones que aplica el archivo: granularidad por variante (sigue a DEC-27), agregación entre depósitos (DEC-37) y significado de `activo` (DEC-38), confirmadas el 24/09/2026.

4. **No crear `v_insumo` ni `v_receta_componente`.** Registrar por qué: qué se buscó en el paso 2 y qué no se encontró.

5. **No reportar como evidencia** el error `relation "v_receta_componente" does not exist` si ejecutás la consulta canónica: ese error lo produce tu decisión de no crear la vista (mismo criterio que V-8 en CH-16b).

6. **Clasificar** cada atributo del contrato para Saleor con el criterio de la sección 6.4.1 y agregar la columna a la Tabla 6.2.

---

## Hallazgo lateral que tenés que resolver aunque no corras Saleor

La consulta canónica (`04_consulta_canonica.sql`) filtra `WHERE pr.activo = true`. Pero:

- el contrato declara `producto.activo` **opcional**;
- la revisión de DEC-29 enumeró los atributos que la consulta lee y **no incluyó `activo`**.

Consecuencia: en una plataforma que no pueda poblar `activo`, la vista lo dejaría en `NULL`, la condición `NULL = true` no se cumple y la consulta devuelve **cero filas, sin ningún error**. Eso es exactamente el tipo de falla silenciosa que la tesis dice que el diseño evita.

Hay dos salidas, y la decisión es tuya:

- **(a)** Aplicar el criterio de DEC-29 con coherencia: `activo` pasa a obligatorio para `stock-producible`, porque la automatización no produce un resultado correcto sin él.
- **(b)** Cambiar la consulta a `WHERE COALESCE(pr.activo, true)` y declarar que la ausencia de `activo` se interpreta como "activo". Eso cambia el texto de la consulta, así que la portabilidad sobre Food Store y Medusa se tendría que volver a correr.

En Saleor esto no se manifiesta porque la vista define `activo`, pero en el texto de la tesis la inconsistencia está igual.

---

## Qué registrar en la bitácora

Para cada paso: fecha y hora, comando exacto, salida cruda completa y versión de Saleor. Plantilla en `bitacora_CH-16c_saleor.md`.

---

## Corrida de validación de los scripts (23/09/2026, entorno del asistente)

Para no entregarte scripts sin probar, se ejecutaron sobre una instancia real de Saleor levantada **sin Docker**: repositorio oficial, commit `4f3190d`, versión 3.23.35, migraciones completas y `populatedb` oficial, sobre PostgreSQL 16.13. Salidas crudas completas: `salida_07_validacion_2026-09-23.txt` y `salida_08_validacion_2026-09-23.txt`.

Resultados:

- **Sección 1:** 0 tablas con nombres de composición.
- **Sección 2:** una sola coincidencia (`site_sitesettings.limit_quantity_per_checkout`), que es un límite de compra y no tiene relación con la composición.
- **Sección 3:** 13 claves foráneas apuntan a variantes, desde atributos, carrito, descuentos, pedidos, producto (variante por defecto), canales, traducciones, medios y stock. **Ninguna vincula una variante con un componente.**
- **Sección 5:** `attribute_attributevalue` tiene una columna `reference_variant_id` y otra `numeric` en la misma fila, pero ningún valor de los datos de demostración referencia variantes (0 filas).
  - La cantidad por vínculo no está prevista por el modelo de atributos: cada atributo tiene un único tipo de entrada.
  - Sin embargo, el esquema no impide que una fila tenga ambas columnas cargadas. La afirmación correcta es "no hay una estructura **prevista** para cantidad por componente", no "es imposible almacenarla".
- **Datos de demostración:** 29 productos, 81 variantes, 8 depósitos y 648 filas de stock.
- **`v_producto`:** se crea sin error. Tiene 81 filas, todas activas, y 67 con SKU.
  - En los datos de demostración, varias variantes tienen como nombre un identificador codificado en base64 (por ejemplo, "Apple Juice - UHJvZHVjdFZhcmlhbnQ6Mzg0"). Es otro caso de datos no representativos, no un problema de esquema.

**Cómo usar esta corrida.** Es una corrida real, pero se hizo en el entorno del asistente y no con `saleor-platform`. Sirve como referencia para comparar: la tesis cita la corrida del autor con `saleor-platform` (decisión D5 del plan de entrega, prompt P4). Si tu corrida difiere de esta en algún conteo, registrá la diferencia tal cual.

Las decisiones DEC-37 y DEC-38 del archivo 08 las tomó el autor el 24/09/2026.
