#!/bin/sh
# Smoke test for CH-01, CH-03, CH-04, CH-05 and CH-06: brings the real Docker Compose
# stack up and checks every scenario in openspec/changes/CH-01-app-scaffolding-and-environment/
# specs/project-environment/spec.md, openspec/changes/
# CH-03-connection-registration-and-test/specs/connection-registration/spec.md,
# CH-04's query-execution specs, CH-05's saved-queries specs and CH-06's
# tenant-management / tenant-isolation specs against it.
#
# Since CH-06 every tenant-scoped call carries an X-Tenant-Id header (DEC-15). The
# script creates its own tenants through the API rather than relying on the seeded one,
# and deletes them at the end, so a developer's local data is left as it was found.
#
# Requires Docker running and a local .env (copy .env.example if you don't have one yet).
set -e

fail() { echo "FAIL: $1"; docker compose down >/dev/null 2>&1 || true; exit 1; }

# Reads one value out of .env without sourcing (and executing) the file.
env_value() { grep -E "^$1=" .env | head -1 | cut -d= -f2-; }

# The entrypoint migrates and seeds before the server listens, so a fixed sleep
# races a freshly recreated container instead of waiting for it.
wait_for_app() {
  i=0
  while [ "$i" -lt 60 ]; do
    if curl -s -o /dev/null --max-time 2 http://localhost:3000/health; then return 0; fi
    i=$((i + 1))
    sleep 1
  done
  fail "the app did not answer /health within 60s"
}

check_health() {
  expected_code="$1"
  expected_status="$2"
  body=$(curl -s -o /tmp/smoke-health.json -w '%{http_code}' http://localhost:3000/health --max-time 8)
  [ "$body" = "$expected_code" ] || fail "expected HTTP $expected_code from /health, got $body"
  grep -q "\"status\":\"$expected_status\"" /tmp/smoke-health.json || fail "expected status=$expected_status in /health body, got $(cat /tmp/smoke-health.json)"
  echo "OK: /health -> $expected_code $expected_status"
}

echo "== bring up (Reproducible Local Environment) =="
docker compose up -d --build
wait_for_app
docker compose ps app | grep -q "Up" || fail "app container did not reach a running state"
echo "OK: db healthy, app running"

echo "== readiness check, DB reachable (Verifiable Application Skeleton) =="
check_health 200 ready

echo "== migration idempotency (Own Database via Migrations) =="
docker compose restart app >/dev/null
wait_for_app
docker compose logs app 2>&1 | tail -20 | grep -q "No pending migrations to apply." || fail "second migrate run was not a no-op"
check_health 200 ready
echo "OK: migrate deploy re-run was a no-op"

echo "== degrade + recover (Verifiable Application Skeleton, failure path) =="
docker compose stop db >/dev/null
sleep 2
check_health 503 not-ready
docker compose start db >/dev/null
sleep 5
check_health 200 ready
echo "OK: degrades to 503 when db is down, recovers to 200 without restarting app"

echo "== CH-06: tenant alta, listado and the active-tenant header =="
# Two tenants, both created through the API: everything below CH-03 runs as TENANT_A,
# and TENANT_B exists to prove at the end that it sees none of A's rows.
crear_tenant() {
  code=$(curl -s -o /tmp/smoke-tenant.json -w '%{http_code}' \
    -X POST http://localhost:3000/tenants -H 'Content-Type: application/json' \
    -d "{\"nombre\":\"CH-06 smoke $1\"}" --max-time 10)
  [ "$code" = "201" ] || fail "expected HTTP 201 creating tenant '$1', got $code ($(cat /tmp/smoke-tenant.json))"
  grep -q '"activo":true' /tmp/smoke-tenant.json ||
    fail "a new tenant must be active: $(cat /tmp/smoke-tenant.json)"
  sed -n 's/.*"id":"\([^"]*\)".*/\1/p' /tmp/smoke-tenant.json
}

TENANT_A=$(crear_tenant a)
TENANT_B=$(crear_tenant b)
[ -n "$TENANT_A" ] && [ -n "$TENANT_B" ] || fail "the tenant creates returned no id"
echo "OK: two tenants created, both activo:true"

echo "-- /tenants is exempt and lists the new tenants (bootstrap) --"
code=$(curl -s -o /tmp/smoke-tenants.json -w '%{http_code}' http://localhost:3000/tenants --max-time 10)
[ "$code" = "200" ] || fail "expected HTTP 200 listing tenants with no header, got $code"
grep -q "$TENANT_A" /tmp/smoke-tenants.json || fail "tenant A is missing from the listing"
grep -q "$TENANT_B" /tmp/smoke-tenants.json || fail "tenant B is missing from the listing"
echo "OK: GET /tenants answers headerless and lists both"

echo "-- a scoped route with no active tenant is refused before the handler --"
code=$(curl -s -o /tmp/smoke-sin-tenant.json -w '%{http_code}' \
  http://localhost:3000/consultas-guardadas --max-time 10)
[ "$code" = "400" ] || fail "expected HTTP 400 with no X-Tenant-Id, got $code ($(cat /tmp/smoke-sin-tenant.json))"
grep -q '"error":"tenant-no-indicado"' /tmp/smoke-sin-tenant.json ||
  fail "expected tenant-no-indicado, got $(cat /tmp/smoke-sin-tenant.json)"
code=$(curl -s -o /tmp/smoke-sin-tenant.json -w '%{http_code}' \
  http://localhost:3000/consultas-guardadas -H 'X-Tenant-Id: no-existe-en-absoluto' --max-time 10)
[ "$code" = "404" ] || fail "expected HTTP 404 for an unknown tenant, got $code"
grep -q '"error":"tenant-no-encontrado"' /tmp/smoke-sin-tenant.json ||
  fail "expected tenant-no-encontrado, got $(cat /tmp/smoke-sin-tenant.json)"
echo "OK: no header -> 400 tenant-no-indicado; unknown id -> 404 tenant-no-encontrado"

echo "== CH-03: connection registration and test =="
DB_USER=$(env_value POSTGRES_USER)
DB_PASSWORD=$(env_value POSTGRES_PASSWORD)
DB_NAME=$(env_value POSTGRES_DB)
# The target is the Compose `db` service itself, reached by service name from
# inside the app container — no published port and no second database involved.
CREDENCIAL_INVALIDA="contrasena-incorrecta-smoke"

registrar() {
  code=$(curl -s -o /tmp/smoke-conexion.json -w '%{http_code}' \
    -X POST http://localhost:3000/conexiones -H 'Content-Type: application/json' \
    -H "X-Tenant-Id: $TENANT_A" \
    -d "{\"nombre\":\"CH-03 smoke $1\",\"motor\":\"postgres\",\"host\":\"$2\",\"puerto\":5432,\"baseDeDatos\":\"$3\",\"usuarioDb\":\"$DB_USER\",\"credencial\":\"$4\"}" \
    --max-time 10)
  [ "$code" = "201" ] || fail "expected HTTP 201 registering '$1', got $code ($(cat /tmp/smoke-conexion.json))"
  if grep -q "$4" /tmp/smoke-conexion.json; then fail "the registration response echoed the credential"; fi
  sed -n 's/.*"id":"\([^"]*\)".*/\1/p' /tmp/smoke-conexion.json
}

# probar <id> <credencial-enviada> <fragmento-json>...
probar() {
  id="$1"; credencial="$2"; shift 2
  code=$(curl -s -o /tmp/smoke-prueba.json -w '%{http_code}' \
    -X POST "http://localhost:3000/conexiones/$id/prueba" \
    -H "X-Tenant-Id: $TENANT_A" --max-time 15)
  [ "$code" = "200" ] || fail "expected HTTP 200 from the test endpoint, got $code"
  for fragmento in "$@"; do
    grep -q "$fragmento" /tmp/smoke-prueba.json ||
      fail "expected $fragmento in the test response, got $(cat /tmp/smoke-prueba.json)"
  done
  if grep -q "$credencial" /tmp/smoke-prueba.json; then fail "the test response echoed the credential"; fi
}

echo "-- reachable target (Connectivity Test Uses a Fixed PostgreSQL Probe) --"
id=$(registrar reachable db "$DB_NAME" "$DB_PASSWORD")
probar "$id" "$DB_PASSWORD" '"resultado":"ok"' '"categoria":null' '"codigo":null'
echo "OK: reachable target -> resultado ok"

echo "-- wrong password (Distinguishable Failure Categories) --"
id=$(registrar bad-password db "$DB_NAME" "$CREDENCIAL_INVALIDA")
probar "$id" "$CREDENCIAL_INVALIDA" '"resultado":"fallo"' '"categoria":"credenciales-invalidas"' '"codigo":"28P01"'
echo "OK: wrong password -> credenciales-invalidas 28P01"

echo "-- nonexistent database (Distinguishable Failure Categories) --"
id=$(registrar missing-db db base-inexistente-smoke "$DB_PASSWORD")
probar "$id" "$DB_PASSWORD" '"resultado":"fallo"' '"categoria":"base-inexistente"' '"codigo":"3D000"'
echo "OK: nonexistent database -> base-inexistente 3D000"

echo "-- unroutable host (Bounded Connection-Attempt Timeout) --"
# 192.0.2.1 is RFC 5737 TEST-NET-1: packets are dropped, not refused, so the
# attempt can only end by exhausting CONNECTION_TEST_TIMEOUT_MS (default 5000).
id=$(registrar unroutable 192.0.2.1 "$DB_NAME" "$DB_PASSWORD")
inicio=$(date +%s)
probar "$id" "$DB_PASSWORD" '"resultado":"fallo"' '"categoria":"tiempo-agotado"'
transcurrido=$(( $(date +%s) - inicio ))
[ "$transcurrido" -le 8 ] || fail "the bounded test took ${transcurrido}s, past the 5s budget plus margin"
echo "OK: unroutable host -> tiempo-agotado in ${transcurrido}s"

echo "-- credential never logged (Credential Value Never Exposed) --"
if docker compose logs app 2>&1 | grep -q -e "$CREDENCIAL_INVALIDA" -e "$DB_PASSWORD"; then
  fail "a submitted credential appeared in the app logs"
fi
echo "OK: no credential in any response body or log line"

echo "== CH-04: read-only query execution =="
LECTOR_CLAVE="ch04-smoke-lector"
ESCRITOR_CLAVE="ch04-smoke-escritor"
# The app's own query budget is the 15000 ms default: docker-compose.yml forwards
# neither QUERY_TIMEOUT_MS nor CONNECTION_TEST_TIMEOUT_MS into the app container, so
# .env cannot change it from here.
PRESUPUESTO_S=15

# A read-only role and a writer role against the same database. The Compose
# POSTGRES_USER is a superuser, so it can never be the success case: DEC-08 blocks it.
docker compose exec -T db psql -v ON_ERROR_STOP=1 -q -U "$DB_USER" -d "$DB_NAME" >/dev/null <<SQL
DROP SCHEMA IF EXISTS ch04_smoke CASCADE;
DO \$limpieza\$ DECLARE rol text; BEGIN
  FOREACH rol IN ARRAY ARRAY['ch04_smoke_lector','ch04_smoke_escritor'] LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = rol) THEN
      EXECUTE format('DROP OWNED BY %I', rol);
      EXECUTE format('DROP ROLE %I', rol);
    END IF;
  END LOOP;
END \$limpieza\$;
CREATE SCHEMA ch04_smoke;
CREATE TABLE ch04_smoke.articulo (id integer PRIMARY KEY, nombre text NOT NULL);
INSERT INTO ch04_smoke.articulo (id, nombre) VALUES (1,'Cafe'),(2,'Te'),(3,'Mate');
CREATE ROLE ch04_smoke_lector LOGIN PASSWORD '$LECTOR_CLAVE';
CREATE ROLE ch04_smoke_escritor LOGIN PASSWORD '$ESCRITOR_CLAVE';
GRANT USAGE ON SCHEMA ch04_smoke TO ch04_smoke_lector, ch04_smoke_escritor;
GRANT SELECT ON ch04_smoke.articulo TO ch04_smoke_lector, ch04_smoke_escritor;
GRANT INSERT ON ch04_smoke.articulo TO ch04_smoke_escritor;
SQL
echo "OK: fixture schema, table and two roles created"

# registrar_ch04 <etiqueta> <usuarioDb> <credencial>
registrar_ch04() {
  code=$(curl -s -o /tmp/smoke-conexion.json -w '%{http_code}' \
    -X POST http://localhost:3000/conexiones -H 'Content-Type: application/json' \
    -H "X-Tenant-Id: $TENANT_A" \
    -d "{\"nombre\":\"CH-04 smoke $1\",\"motor\":\"postgres\",\"host\":\"db\",\"puerto\":5432,\"baseDeDatos\":\"$DB_NAME\",\"usuarioDb\":\"$2\",\"credencial\":\"$3\"}" \
    --max-time 10)
  [ "$code" = "201" ] || fail "expected HTTP 201 registering '$1', got $code ($(cat /tmp/smoke-conexion.json))"
  if grep -q "$3" /tmp/smoke-conexion.json; then fail "the registration response echoed the credential"; fi
  sed -n 's/.*"id":"\([^"]*\)".*/\1/p' /tmp/smoke-conexion.json
}

# ejecutar_ch04 <id> <sql> <credencial-enviada> <fragmento-json>...
ejecutar_ch04() {
  id="$1"; sql="$2"; credencial="$3"; shift 3
  code=$(curl -s -o /tmp/smoke-consulta.json -w '%{http_code}' \
    -X POST http://localhost:3000/consultas/ejecutar -H 'Content-Type: application/json' \
    -H "X-Tenant-Id: $TENANT_A" \
    -d "{\"conexionId\":\"$id\",\"sql\":\"$sql\",\"limite\":2}" --max-time 40)
  [ "$code" = "200" ] || fail "expected HTTP 200 from /consultas/ejecutar, got $code ($(cat /tmp/smoke-consulta.json))"
  for fragmento in "$@"; do
    grep -q "$fragmento" /tmp/smoke-consulta.json ||
      fail "expected $fragmento in the execution response, got $(cat /tmp/smoke-consulta.json)"
  done
  if grep -q "$credencial" /tmp/smoke-consulta.json; then fail "the execution response echoed the credential"; fi
}

contar_articulos() {
  docker compose exec -T db psql -tA -q -U "$DB_USER" -d "$DB_NAME" \
    -c "SELECT count(*) FROM ch04_smoke.articulo;" | tr -d '[:space:]'
}

echo "-- paginated success (Paginated Execution of a Read-Only Statement) --"
id_lector=$(registrar_ch04 lector ch04_smoke_lector "$LECTOR_CLAVE")
ejecutar_ch04 "$id_lector" "SELECT id, nombre FROM ch04_smoke.articulo ORDER BY id" \
  "$LECTOR_CLAVE" '"resultado":"ok"' '"hayMas":true' '"siguienteDesplazamiento":2'
echo "OK: SELECT -> resultado ok, first page of 2 with a next offset"

echo "-- multi-statement text (Multi-Statement Text Is Rejected Before Execution) --"
ejecutar_ch04 "$id_lector" "SELECT 1; SELECT 2" \
  "$LECTOR_CLAVE" '"resultado":"fallo"' '"fase":"ejecucion"' '"categoria":"error-sintaxis"'
echo "OK: two statements in one submission -> rejected, nothing executed"

echo "-- data-modifying CTE (Data-Modifying Statements Are Rejected) --"
# Measured, not assumed: the pagination wrapper demotes the CTE to a subquery, and
# PostgreSQL refuses a data-modifying CTE outside the top level at parse-analysis
# time (0A000), before the READ ONLY transaction check (25006) can run. Both codes
# mean "this statement is not a read", so the classifier maps both to no-es-lectura
# and the operator gets one legible reason either way. The rejection is engine-
# enforced and nothing is written, which is what the row count below proves. See
# the note on the matching case in src/consultas.test.ts.
antes=$(contar_articulos)
ejecutar_ch04 "$id_lector" \
  "WITH x AS (DELETE FROM ch04_smoke.articulo RETURNING *) SELECT * FROM x" \
  "$LECTOR_CLAVE" '"resultado":"fallo"' '"fase":"ejecucion"' '"categoria":"no-es-lectura"' \
  '"codigo":"0A000"'
despues=$(contar_articulos)
[ "$antes" = "$despues" ] || fail "the CTE deleted rows: $antes before, $despues after"
echo "OK: data-modifying CTE -> rejected no-es-lectura/0A000, $despues rows still present"

echo "-- privilege block (Execution Is Blocked When the Role Holds Write Privilege) --"
id_escritor=$(registrar_ch04 escritor ch04_smoke_escritor "$ESCRITOR_CLAVE")
ejecutar_ch04 "$id_escritor" "SELECT id FROM ch04_smoke.articulo" \
  "$ESCRITOR_CLAVE" '"resultado":"fallo"' '"fase":"permisos"' '"categoria":"rol-con-escritura-en-tabla"'
echo "OK: a role with table INSERT -> blocked before the statement is sent"

echo "-- bounded execution timeout (Bounded Execution Timeout) --"
inicio=$(date +%s)
ejecutar_ch04 "$id_lector" "SELECT pg_sleep($((PRESUPUESTO_S * 2)))" \
  "$LECTOR_CLAVE" '"resultado":"fallo"' '"fase":"ejecucion"' '"categoria":"tiempo-agotado"'
transcurrido=$(( $(date +%s) - inicio ))
[ "$transcurrido" -le $((PRESUPUESTO_S + 8)) ] ||
  fail "the bounded execution took ${transcurrido}s, past the ${PRESUPUESTO_S}s budget plus margin"
echo "OK: long-running query -> tiempo-agotado in ${transcurrido}s"

echo "-- console page (Console Page Is Servable) --"
code=$(curl -s -o /tmp/smoke-consola.html -w '%{http_code}' http://localhost:3000/consola --max-time 10)
[ "$code" = "200" ] || fail "expected HTTP 200 from /consola, got $code"
grep -q "<textarea id=\"sql\"" /tmp/smoke-consola.html || fail "/consola has no SQL input control"
grep -q "id=\"ejecutar\"" /tmp/smoke-consola.html || fail "/consola has no execute control"
if grep -q "innerHTML" /tmp/smoke-consola.html; then fail "/consola must never use innerHTML"; fi
echo "OK: /consola -> 200 with a SQL input, an execute control and no innerHTML"

echo "-- credential never logged (Credential Value Never Exposed During Execution) --"
if docker compose logs app 2>&1 | grep -q -e "$LECTOR_CLAVE" -e "$ESCRITOR_CLAVE"; then
  fail "a submitted credential appeared in the app logs"
fi
echo "OK: no credential in any execution response body or log line"

echo "== CH-05: saved queries =="
# Saved queries live in the application's own database, not in a tenant's replica, so
# everything below talks to localhost:3000 and never opens an outbound connection.
GUARDADA_NOMBRE="CH-05 smoke consulta"
# Padded and terminated with a semicolon on purpose: the create stores the statement
# verbatim (rewriting an operator's statement in the database would be a silent edit),
# and the execution path re-sanitizes it on the way out. Both halves are asserted.
GUARDADA_SQL="  SELECT id, nombre FROM ch04_smoke.articulo ORDER BY id;  "
GUARDADA_NOMBRE_HOSTIL="<script>alert(1)</script>"

echo "-- empty list before anything is saved --"
# Since CH-06 the listing is scoped to the active tenant, and TENANT_A was created by
# this run seconds ago, so the literal empty case is observable on any stack — it no
# longer depends on whether a developer's own rows are in the shared table.
code=$(curl -s -o /tmp/smoke-guardadas.json -w '%{http_code}' \
  http://localhost:3000/consultas-guardadas -H "X-Tenant-Id: $TENANT_A" --max-time 10)
[ "$code" = "200" ] || fail "expected HTTP 200 from the saved-queries list, got $code"
grep -q '"consultasGuardadas":\[\]' /tmp/smoke-guardadas.json ||
  fail "expected an empty list for a brand-new tenant, got $(cat /tmp/smoke-guardadas.json)"
echo "OK: a new tenant's list -> 200 with []"

echo "-- save the statement (Saved Query Creation) --"
code=$(curl -s -o /tmp/smoke-guardada.json -w '%{http_code}' \
  -X POST http://localhost:3000/consultas-guardadas -H 'Content-Type: application/json' \
  -H "X-Tenant-Id: $TENANT_A" \
  -d "{\"nombre\":\"$GUARDADA_NOMBRE\",\"descripcion\":\"Articulos del esquema de humo\",\"sql\":\"$GUARDADA_SQL\"}" \
  --max-time 10)
[ "$code" = "201" ] || fail "expected HTTP 201 saving a query, got $code ($(cat /tmp/smoke-guardada.json))"
id_guardada=$(sed -n 's/.*"id":"\([^"]*\)".*/\1/p' /tmp/smoke-guardada.json)
[ -n "$id_guardada" ] || fail "the save response carried no id: $(cat /tmp/smoke-guardada.json)"
echo "OK: save -> 201 with an id"

echo "-- a request cannot set tenantId (rule 2) --"
code=$(curl -s -o /tmp/smoke-guardada-rechazo.json -w '%{http_code}' \
  -X POST http://localhost:3000/consultas-guardadas -H 'Content-Type: application/json' \
  -H "X-Tenant-Id: $TENANT_A" \
  -d "{\"nombre\":\"CH-05 smoke rechazo\",\"sql\":\"SELECT 1\",\"tenantId\":\"invencion-del-cliente\"}" \
  --max-time 10)
[ "$code" = "400" ] || fail "expected HTTP 400 for a body carrying tenantId, got $code ($(cat /tmp/smoke-guardada-rechazo.json))"
grep -q '"error":"solicitud-invalida"' /tmp/smoke-guardada-rechazo.json ||
  fail "expected solicitud-invalida, got $(cat /tmp/smoke-guardada-rechazo.json)"
# Same body against the connection route: CH-06 closed the same hole there, which
# CH-05's propertyNames fix had left open (it answered 201 and dropped the key).
code=$(curl -s -o /tmp/smoke-conexion-rechazo.json -w '%{http_code}' \
  -X POST http://localhost:3000/conexiones -H 'Content-Type: application/json' \
  -H "X-Tenant-Id: $TENANT_A" \
  -d "{\"nombre\":\"CH-06 smoke rechazo\",\"motor\":\"postgres\",\"host\":\"db\",\"puerto\":5432,\"baseDeDatos\":\"$DB_NAME\",\"usuarioDb\":\"$DB_USER\",\"credencial\":\"$DB_PASSWORD\",\"tenantId\":\"invencion-del-cliente\"}" \
  --max-time 10)
[ "$code" = "400" ] || fail "expected HTTP 400 registering with a body tenantId, got $code ($(cat /tmp/smoke-conexion-rechazo.json))"
echo "OK: client-supplied tenantId -> 400 solicitud-invalida on both create routes, nothing stored"

echo "-- list carries metadata only (Saved Query Listing) --"
code=$(curl -s -o /tmp/smoke-guardadas.json -w '%{http_code}' \
  http://localhost:3000/consultas-guardadas -H "X-Tenant-Id: $TENANT_A" --max-time 10)
[ "$code" = "200" ] || fail "expected HTTP 200 listing saved queries, got $code"
grep -q "\"nombre\":\"$GUARDADA_NOMBRE\"" /tmp/smoke-guardadas.json ||
  fail "the saved query did not appear in the list: $(cat /tmp/smoke-guardadas.json)"
grep -q '"truncado":false' /tmp/smoke-guardadas.json ||
  fail "expected truncado:false on a short list, got $(cat /tmp/smoke-guardadas.json)"
if grep -q '"sql"' /tmp/smoke-guardadas.json; then
  fail "the list carried a stored statement: it must be metadata only"
fi
echo "OK: list -> 200, the row is there and no sql field exists on it"

echo "-- get by id round-trips the statement verbatim (Saved Query Retrieval) --"
code=$(curl -s -o /tmp/smoke-guardada-get.json -w '%{http_code}' \
  "http://localhost:3000/consultas-guardadas/$id_guardada" -H "X-Tenant-Id: $TENANT_A" --max-time 10)
[ "$code" = "200" ] || fail "expected HTTP 200 retrieving the saved query, got $code"
sql_guardada=$(sed -n 's/.*"sql":"\([^"]*\)".*/\1/p' /tmp/smoke-guardada-get.json)
[ "$sql_guardada" = "$GUARDADA_SQL" ] ||
  fail "the stored statement did not round-trip verbatim: sent [$GUARDADA_SQL], got [$sql_guardada]"
echo "OK: get by id -> 200 with the statement byte-identical, padding and semicolon intact"

echo "-- unknown id is a legible 404, not a 500 --"
code=$(curl -s -o /tmp/smoke-guardada-404.json -w '%{http_code}' \
  http://localhost:3000/consultas-guardadas/no-existe-en-absoluto-smoke -H "X-Tenant-Id: $TENANT_A" --max-time 10)
[ "$code" = "404" ] || fail "expected HTTP 404 for an unknown saved query, got $code"
grep -q '"error":"consulta-guardada-no-encontrada"' /tmp/smoke-guardada-404.json ||
  fail "expected consulta-guardada-no-encontrada, got $(cat /tmp/smoke-guardada-404.json)"
echo "OK: unknown id -> 404 consulta-guardada-no-encontrada"

echo "-- execute exactly what came back (R0 closure: escribir, guardar y ejecutar) --"
# The statement handed to the execution path is the one the API just returned, not the
# local copy: that is what makes this a round trip rather than two separate checks.
ejecutar_ch04 "$id_lector" "$sql_guardada" "$LECTOR_CLAVE" '"resultado":"ok"' 'Cafe'
echo "OK: the retrieved statement executed -> resultado ok"

echo "-- a hostile nombre is stored and returned as data (Stored Text Is Data) --"
code=$(curl -s -o /tmp/smoke-guardada-hostil.json -w '%{http_code}' \
  -X POST http://localhost:3000/consultas-guardadas -H 'Content-Type: application/json' \
  -H "X-Tenant-Id: $TENANT_A" \
  -d "{\"nombre\":\"$GUARDADA_NOMBRE_HOSTIL\",\"sql\":\"SELECT 1\"}" --max-time 10)
[ "$code" = "201" ] || fail "expected HTTP 201 saving a query with a hostile nombre, got $code"
code=$(curl -s -o /tmp/smoke-guardadas.json -w '%{http_code}' \
  http://localhost:3000/consultas-guardadas -H "X-Tenant-Id: $TENANT_A" --max-time 10)
[ "$code" = "200" ] || fail "expected HTTP 200 listing after the hostile save, got $code"
grep -qF "$GUARDADA_NOMBRE_HOSTIL" /tmp/smoke-guardadas.json ||
  fail "the hostile nombre was altered on the way out: $(cat /tmp/smoke-guardadas.json)"
echo "OK: the name is stored and returned unchanged — escaping is the console's job, asserted next"

echo "-- console exposes the saved-query controls (Console Displays the List) --"
code=$(curl -s -o /tmp/smoke-consola.html -w '%{http_code}' http://localhost:3000/consola --max-time 10)
[ "$code" = "200" ] || fail "expected HTTP 200 from /consola, got $code"
grep -q "id=\"nombre\"" /tmp/smoke-consola.html || fail "/consola has no name input for saving"
grep -q "id=\"guardar\"" /tmp/smoke-consola.html || fail "/consola has no save control"
grep -q "id=\"guardadas\"" /tmp/smoke-consola.html || fail "/consola has no saved-queries list"
grep -q "type=\"button\"" /tmp/smoke-consola.html ||
  fail "/consola's save control must not be a submit button: it would execute instead of saving"
grep -q "textContent" /tmp/smoke-consola.html || fail "/consola renders nothing through textContent"
if grep -q "innerHTML" /tmp/smoke-consola.html; then fail "/consola must never use innerHTML"; fi
# CH-06 / T4: the tenant bar, the selector and the permanent indicator.
grep -q "id=\"barra-tenant\"" /tmp/smoke-consola.html || fail "/consola has no tenant bar"
grep -q "id=\"tenant\"" /tmp/smoke-consola.html || fail "/consola has no tenant selector"
grep -q "id=\"tenant-activo\"" /tmp/smoke-consola.html || fail "/consola has no active-tenant indicator"
grep -q "X-Tenant-Id" /tmp/smoke-consola.html || fail "/consola never sends the active tenant"
# The 503 message is gone with the response it described: leaving it would be a live
# ladder branch for a status the API can no longer produce.
if grep -q "tenant-no-inicializado" /tmp/smoke-consola.html; then
  fail "/consola still carries the removed tenant-no-inicializado message"
fi
# Regression guard, found the hard way while verifying this change: an HTML parser ends
# the inline script at the FIRST closing script sequence it sees, even one written
# inside a JS comment. The whole console is one script element, so exactly one may exist
# in the document; a second one silently truncates the page's behaviour.
cierres=$(grep -o "</script>" /tmp/smoke-consola.html | wc -l | tr -d '[:space:]')
[ "$cierres" = "1" ] ||
  fail "/consola carries $cierres closing script tags: the inline script is truncated at the first one"
echo "OK: /consola serves the tenant bar, the save control, the name input and the list, one script element, no innerHTML"

echo "== CH-06: the second tenant sees none of the first tenant's rows (T2) =="
# Same ids, different active tenant. Every one of these resolved happily a moment ago
# as TENANT_A; as TENANT_B the rows must not exist at all.
code=$(curl -s -o /tmp/smoke-b-listado.json -w '%{http_code}' \
  http://localhost:3000/consultas-guardadas -H "X-Tenant-Id: $TENANT_B" --max-time 10)
[ "$code" = "200" ] || fail "expected HTTP 200 listing as tenant B, got $code"
grep -q '"consultasGuardadas":\[\]' /tmp/smoke-b-listado.json ||
  fail "tenant B saw rows it does not own: $(cat /tmp/smoke-b-listado.json)"

code=$(curl -s -o /tmp/smoke-b-get.json -w '%{http_code}' \
  "http://localhost:3000/consultas-guardadas/$id_guardada" -H "X-Tenant-Id: $TENANT_B" --max-time 10)
[ "$code" = "404" ] || fail "tenant B reached tenant A's saved query: HTTP $code ($(cat /tmp/smoke-b-get.json))"

code=$(curl -s -o /tmp/smoke-b-prueba.json -w '%{http_code}' \
  -X POST "http://localhost:3000/conexiones/$id_lector/prueba" \
  -H "X-Tenant-Id: $TENANT_B" --max-time 15)
[ "$code" = "404" ] || fail "tenant B probed tenant A's connection: HTTP $code ($(cat /tmp/smoke-b-prueba.json))"
grep -q '"error":"conexion-no-encontrada"' /tmp/smoke-b-prueba.json ||
  fail "expected conexion-no-encontrada, got $(cat /tmp/smoke-b-prueba.json)"

code=$(curl -s -o /tmp/smoke-b-ejecutar.json -w '%{http_code}' \
  -X POST http://localhost:3000/consultas/ejecutar -H 'Content-Type: application/json' \
  -H "X-Tenant-Id: $TENANT_B" \
  -d "{\"conexionId\":\"$id_lector\",\"sql\":\"SELECT 1\"}" --max-time 20)
[ "$code" = "404" ] || fail "tenant B executed against tenant A's connection: HTTP $code ($(cat /tmp/smoke-b-ejecutar.json))"
echo "OK: tenant B -> empty list, and 404 on get-by-id, prueba and ejecutar for tenant A's ids"

echo "-- a tenant dado de baja admits no operation at all (DEC-14) --"
code=$(curl -s -o /tmp/smoke-baja.json -w '%{http_code}' \
  -X POST "http://localhost:3000/tenants/$TENANT_B/baja" --max-time 10)
[ "$code" = "200" ] || fail "expected HTTP 200 deactivating tenant B, got $code ($(cat /tmp/smoke-baja.json))"
grep -q '"activo":false' /tmp/smoke-baja.json || fail "the baja did not report activo:false"
code=$(curl -s -o /tmp/smoke-congelado.json -w '%{http_code}' \
  http://localhost:3000/consultas-guardadas -H "X-Tenant-Id: $TENANT_B" --max-time 10)
[ "$code" = "409" ] || fail "expected HTTP 409 for a deactivated tenant, got $code ($(cat /tmp/smoke-congelado.json))"
grep -q '"error":"tenant-desactivado"' /tmp/smoke-congelado.json ||
  fail "expected tenant-desactivado, got $(cat /tmp/smoke-congelado.json)"
code=$(curl -s -o /tmp/smoke-tenants.json -w '%{http_code}' http://localhost:3000/tenants --max-time 10)
if grep -q "$TENANT_B" /tmp/smoke-tenants.json; then
  fail "a deactivated tenant must not appear in the default listing"
fi
code=$(curl -s -o /tmp/smoke-tenants.json -w '%{http_code}' \
  'http://localhost:3000/tenants?incluirInactivos=true' --max-time 10)
grep -q "$TENANT_B" /tmp/smoke-tenants.json ||
  fail "?incluirInactivos=true must still show the deactivated tenant"
echo "OK: baja -> 409 on every scoped route, out of the default listing, still visible with incluirInactivos"

docker compose exec -T db psql -v ON_ERROR_STOP=1 -q -U "$DB_USER" -d "$DB_NAME" >/dev/null <<SQL
DELETE FROM "Conexion" WHERE nombre LIKE 'CH-03 smoke%' OR nombre LIKE 'CH-04 smoke%';
-- By prefix and by exact name, never a blanket delete: this database is also where a
-- developer's own saved queries live, and DEC-10 gives the product no way to restore one.
DELETE FROM "ConsultaGuardada" WHERE nombre LIKE 'CH-05 smoke%' OR nombre = '<script>alert(1)</script>';
-- CH-06's two tenants go last: the FK is RESTRICT, so anything still pointing at them
-- has to be gone first. By prefix, never a blanket delete — a developer's own tenants
-- (and the seeded one) live in this same table.
DELETE FROM "ConsultaGuardada" WHERE "tenantId" IN (SELECT id FROM "Tenant" WHERE nombre LIKE 'CH-06 smoke%');
DELETE FROM "Conexion" WHERE "tenantId" IN (SELECT id FROM "Tenant" WHERE nombre LIKE 'CH-06 smoke%');
DELETE FROM "Tenant" WHERE nombre LIKE 'CH-06 smoke%';
DROP SCHEMA IF EXISTS ch04_smoke CASCADE;
DO \$limpieza\$ DECLARE rol text; BEGIN
  FOREACH rol IN ARRAY ARRAY['ch04_smoke_lector','ch04_smoke_escritor'] LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = rol) THEN
      EXECUTE format('DROP OWNED BY %I', rol);
      EXECUTE format('DROP ROLE %I', rol);
    END IF;
  END LOOP;
END \$limpieza\$;
SQL
docker compose down >/dev/null
echo "SMOKE TEST PASSED"
