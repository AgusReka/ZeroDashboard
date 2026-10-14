#!/bin/sh
# CH-31 (DEC-170): the read-only user the app connects as (rule 3, second layer). It runs once,
# on an empty volume, after 01-esquema-y-datos.sql. The password is a psql variable, so the
# shell never interpolates it into the statement.
set -e

psql -v ON_ERROR_STOP=1 -v clave="$REPLICA_DEMO_PASSWORD" \
  --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
CREATE ROLE lector_zerodashboard LOGIN PASSWORD :'clave';
GRANT CONNECT ON DATABASE food_store TO lector_zerodashboard;
GRANT USAGE ON SCHEMA public TO lector_zerodashboard;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO lector_zerodashboard;
SQL
