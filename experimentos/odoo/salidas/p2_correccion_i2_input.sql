SELECT now() AS hora_servidor, current_user;
DROP TABLE zd_prueba;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SELECT has_schema_privilege('zd_odoo_lectura', 'public', 'CREATE') AS lectura_create,
       has_schema_privilege('zd_odoo_creador', 'public', 'CREATE') AS creador_create,
       has_schema_privilege('odoo', 'public', 'CREATE') AS odoo_create;
