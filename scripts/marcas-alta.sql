-- scripts/marcas-alta.sql — marcas de tiempo del alta, una fila por conexión (CH-15, G1).
--
-- Decisiones: DEC-87 (SQL versionado sobre columnas existentes, sin migración ni ruta),
-- DEC-88 (la marca de conexión es el registro, `Conexion.creadaEn`), DEC-89 (marcas y
-- una fila por `Conexion`, repitiendo el inicio del tenant), DEC-90 (sin parámetro de
-- tenant: lista todas las conexiones, incluidos los tenants desactivados), DEC-91 (esta
-- ruta), DEC-92 (solo lectura: transacción de solo lectura y archivo revisado).
--
-- Columnas:
--   tenant_id, tenant_activo, conexion_id
--   alta_inicio            Tenant.creadoEn
--   conexion_registrada    Conexion.creadaEn (registro, no prueba exitosa)
--   mapeo_inicio           mínimo de VistaCanonica.creadaEn
--   mapeo_fin              máximo de VistaCanonica.actualizadaEn
--   validacion_ultima      VistaCanonica.validadaEn más reciente (desempate: entidad, id)
--   validacion_estado      estadoValidacion de esa misma vista
--   automatizacion_creada  mínimo de Automatizacion.creadaEn (informativa)
--   primera_ejecucion      Ejecucion.iniciadaEn más temprana (desempate: id), vía la
--                          conexión de su automatización
--   primera_ejecucion_estado, primera_ejecucion_fase   de esa misma ejecución
--   primera_ejecucion_ok   Ejecucion.iniciadaEn más temprana con estado 'ok'
-- Una etapa no alcanzada es null: nunca se omite la fila ni se completa con ceros.
--
-- Límites del artefacto (detalle en docs/bitacora/CH-15-instrumentacion-de-tiempos-del-alta.md):
--   - La marca de validación es mutable: re-registrar el SQL la anula y re-validar la
--     sobrescribe. Se captura la salida al cerrar cada alta.
--   - Las marcas miden tiempo transcurrido, no esfuerzo.
--   - La conexión es el registro, no una conexión exitosa comprobada.
--   - No hay orden estricto entre marcas: mezclan el reloj de la base y el de la
--     aplicación.
--   - Sin backfill ni medición retroactiva de CH-16.
--   - Los horarios son timestamp sin zona, guardados en UTC.
--
-- Uso (autor, fuera de la aplicación; ningún módulo de src/ lo referencia), en una línea:
--   docker exec -i -e PGOPTIONS="-c default_transaction_read_only=on" zerodashboard-db-1 psql -X -v ON_ERROR_STOP=1 -P pager=off -U zerodashboard -d zerodashboard < scripts/marcas-alta.sql
--
-- El archivo es una sola sentencia SELECT, sin marcadores de parámetro ni comandos de
-- psql, para que el test (src/marcas-alta.test.ts) la ejecute sin modificarla.

WITH vistas AS (
  SELECT "conexionId"          AS conexion_id,
         min("creadaEn")       AS mapeo_inicio,
         max("actualizadaEn")  AS mapeo_fin
  FROM "VistaCanonica"
  GROUP BY "conexionId"
),
validacion AS (
  SELECT DISTINCT ON ("conexionId")
         "conexionId"        AS conexion_id,
         "validadaEn"        AS validacion_ultima,
         "estadoValidacion"  AS validacion_estado
  FROM "VistaCanonica"
  WHERE "validadaEn" IS NOT NULL
  ORDER BY "conexionId", "validadaEn" DESC, entidad, id
),
automatizaciones AS (
  SELECT "conexionId"     AS conexion_id,
         min("creadaEn")  AS automatizacion_creada
  FROM "Automatizacion"
  GROUP BY "conexionId"
),
primera AS (
  SELECT DISTINCT ON (a."conexionId")
         a."conexionId"  AS conexion_id,
         e."iniciadaEn"  AS primera_ejecucion,
         e.estado        AS primera_ejecucion_estado,
         e.fase          AS primera_ejecucion_fase
  FROM "Ejecucion" e
  JOIN "Automatizacion" a ON a.id = e."automatizacionId"
  ORDER BY a."conexionId", e."iniciadaEn", e.id
),
primera_ok AS (
  SELECT a."conexionId"       AS conexion_id,
         min(e."iniciadaEn")  AS primera_ejecucion_ok
  FROM "Ejecucion" e
  JOIN "Automatizacion" a ON a.id = e."automatizacionId"
  WHERE e.estado = 'ok'
  GROUP BY a."conexionId"
)
SELECT t.id                        AS tenant_id,
       t.activo                    AS tenant_activo,
       c.id                        AS conexion_id,
       t."creadoEn"                AS alta_inicio,
       c."creadaEn"                AS conexion_registrada,
       v.mapeo_inicio,
       v.mapeo_fin,
       val.validacion_ultima,
       val.validacion_estado,
       au.automatizacion_creada,
       p.primera_ejecucion,
       p.primera_ejecucion_estado,
       p.primera_ejecucion_fase,
       ok.primera_ejecucion_ok
FROM "Conexion" c
JOIN "Tenant" t               ON t.id = c."tenantId"
LEFT JOIN vistas v            ON v.conexion_id = c.id
LEFT JOIN validacion val      ON val.conexion_id = c.id
LEFT JOIN automatizaciones au ON au.conexion_id = c.id
LEFT JOIN primera p           ON p.conexion_id = c.id
LEFT JOIN primera_ok ok       ON ok.conexion_id = c.id
ORDER BY t."creadoEn", t.id, c."creadaEn", c.id;
