# CH-16b — Cómo correr esto contra tus bases reales

Los fixtures son para probar que el SQL es correcto. Para la tesis hay que correr
las vistas contra las bases reales.

## Orden

    01_foodstore_fixture.sql    fixture de prueba (NO usar contra la base real)
    02_query_original.sql       la consulta de WF-01c del Anexo A, sin HAVING
    03_vistas_foodstore.sql     <-- ESTO va contra la base real de Food Store
    04_consulta_canonica.sql    <-- ESTO corre contra las vistas, sin modificar
    05_medusa_fixture.sql       fixture de prueba
    06_vistas_medusa.sql        <-- ESTO va contra tu Medusa real (ch16-medusa-pg)
    07_woocommerce_fixture.sql  fixture de prueba
    08_vistas_woo.sql           v_producto sobre WooCommerce (EAV)

## Contra Food Store real

    # 1. crear las vistas (quitar el SET search_path si tu esquema es public)
    psql -d foodstore -f 03_vistas_foodstore.sql

    # 2. la consulta canonica
    psql -d foodstore -f 04_consulta_canonica.sql

    # 3. la original, para comparar
    psql -d foodstore -f 02_query_original.sql

    # 4. equivalencia formal: tiene que dar 0 y 0
    #    (usar el bloque de V-3 de la bitacora)

## Contra Medusa real

    docker start ch16-medusa-pg
    psql -h localhost -p 55432 -U postgres -d medusa_db -f 06_vistas_medusa.sql
    psql -h localhost -p 55432 -U postgres -d medusa_db -f 04_consulta_canonica.sql

## Lo que hay que ajustar

- `03_vistas_foodstore.sql` asume las columnas que documenta la bitacora de WF-01.
  Si el esquema real tiene mas, ajustar la vista.
- `sku` y `unidadMedida` quedan en NULL: Food Store no los tiene. Verificar contra
  src/contrato.ts si son obligatorios.
- El `SET search_path` de cada archivo es del fixture. Quitarlo o ajustarlo.
