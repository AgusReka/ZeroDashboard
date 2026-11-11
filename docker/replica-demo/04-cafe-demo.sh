#!/bin/sh
# CH-49 (DEC-206): the second demo database, for the second tenant. It runs once, on an empty
# volume, after 03-datos-recientes.sql. The data file sits in a subfolder because the image only
# runs the top-level files of this directory: it must not run on food_store. The password is a
# psql variable, as in 02-lector.sh.
set -e

psql -v ON_ERROR_STOP=1 -v clave="$REPLICA_DEMO_PASSWORD" \
  --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
CREATE DATABASE cafe_demo;
REVOKE CONNECT ON DATABASE cafe_demo FROM PUBLIC;
CREATE ROLE lector_cafe_demo LOGIN PASSWORD :'clave';
GRANT CONNECT ON DATABASE cafe_demo TO lector_cafe_demo;
SQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname cafe_demo \
  -f /docker-entrypoint-initdb.d/cafe/esquema-y-datos.sql

# Read-only (rule 3, second layer): tables and views, nothing else.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname cafe_demo <<'SQL'
GRANT USAGE ON SCHEMA public TO lector_cafe_demo;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO lector_cafe_demo;
SQL
