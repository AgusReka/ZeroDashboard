BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT now() AS instante, current_setting('transaction_isolation') AS aislamiento, current_setting('transaction_read_only') AS solo_lectura, current_setting('search_path') AS search_path;
-- 11_consulta_canonica_stock_fisico.sql (con umbral), texto sin modificar
-- ============================================================
-- CONSULTA CANÓNICA: stock físico (WF-01a), productos sin receta.
-- Versión canónica de la consulta de la sección 4.2 de
-- docs/bitacora/estudio_previo/bitacora_WF-01.md.
-- Solo usa v_producto y v_receta_componente. Umbral: <= 20.
-- ============================================================
SELECT pr.id, pr.nombre, pr."stockDisponible"
FROM v_producto pr
WHERE pr.activo = true
  AND pr."stockDisponible" <= 20
  AND NOT EXISTS (SELECT 1 FROM v_receta_componente rc WHERE rc."productoId" = pr.id)
ORDER BY pr."stockDisponible" ASC;
-- 12_consulta_canonica_stock_fisico_sin_umbral.sql, texto sin modificar
-- ============================================================
-- Variante de 11_consulta_canonica_stock_fisico.sql SIN la
-- condición de umbral, para comparar conjuntos no vacíos.
-- Única diferencia con 11: se quita la línea del umbral.
-- ============================================================
SELECT pr.id, pr.nombre, pr."stockDisponible"
FROM v_producto pr
WHERE pr.activo = true
  AND NOT EXISTS (SELECT 1 FROM v_receta_componente rc WHERE rc."productoId" = pr.id)
ORDER BY pr."stockDisponible" ASC;
-- conteos de variantes con receta
SELECT (SELECT count(*) FROM v_producto) AS variantes_en_v_producto,
       (SELECT count(*) FROM v_producto pr WHERE EXISTS (SELECT 1 FROM v_receta_componente rc WHERE rc."productoId" = pr.id)) AS variantes_con_al_menos_una_fila_en_v_receta_componente,
       (SELECT count(*) FROM v_producto pr WHERE NOT EXISTS (SELECT 1 FROM v_receta_componente rc WHERE rc."productoId" = pr.id)) AS variantes_sin_filas_en_v_receta_componente,
       (SELECT count(DISTINCT rc."productoId") FROM v_receta_componente rc) AS productoid_distintos_en_v_receta_componente,
       (SELECT count(*) FROM v_receta_componente) AS filas_v_receta_componente;
ROLLBACK;
