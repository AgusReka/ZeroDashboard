#!/bin/sh
# Smoke test for CH-01: brings the real Docker Compose stack up and checks
# every scenario in openspec/changes/CH-01-app-scaffolding-and-environment/
# specs/project-environment/spec.md against it. Requires Docker running and
# a local .env (copy .env.example if you don't have one yet).
set -e

fail() { echo "FAIL: $1"; docker compose down >/dev/null 2>&1 || true; exit 1; }

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
sleep 3
docker compose ps app | grep -q "Up" || fail "app container did not reach a running state"
echo "OK: db healthy, app running"

echo "== readiness check, DB reachable (Verifiable Application Skeleton) =="
check_health 200 ready

echo "== migration idempotency (Own Database via Migrations) =="
docker compose restart app >/dev/null
sleep 2
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

docker compose down >/dev/null
echo "SMOKE TEST PASSED"
