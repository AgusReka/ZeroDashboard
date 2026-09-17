import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import {
  DEFAULT_CONNECTION_TEST_TIMEOUT_MS,
  DEFAULT_QUERY_TIMEOUT_MS,
  loadConfig,
} from './config.js';
import { VARIABLE_CLAVE_MAESTRA } from './cripto-credencial.js';

/**
 * Unit cases for CH-07 tasks 1.3 and 3.1. `loadConfig()` is the single required-env
 * chokepoint the server already calls at `src/server.ts:14`, before `listen`, so
 * making it refuse an absent or malformed master key *is* the fail-closed boot check
 * DEC-17 asks for — no new boot hook was needed.
 *
 * These cases mutate `process.env` and restore a known baseline before each one. Node's
 * test runner executes each file in its own process, so nothing here can reach another
 * suite.
 */
const CLAVE_VALIDA = 'emVyb2Rhc2hib2FyZC1jbGF2ZS1kZS1wcnVlYmFzISE=';
const URL_PRUEBAS = 'postgresql://zerodashboard:change-me@localhost:5432/zerodashboard';

const VARIABLES = [
  'APP_PORT',
  'DATABASE_URL',
  VARIABLE_CLAVE_MAESTRA,
  'CONNECTION_TEST_TIMEOUT_MS',
  'QUERY_TIMEOUT_MS',
] as const;

/** A minimal environment in which `loadConfig()` is expected to succeed. */
function entornoValido(): void {
  for (const nombre of VARIABLES) {
    delete process.env[nombre];
  }
  process.env.APP_PORT = '3000';
  process.env.DATABASE_URL = URL_PRUEBAS;
  process.env[VARIABLE_CLAVE_MAESTRA] = CLAVE_VALIDA;
}

beforeEach(entornoValido);

describe('loadConfig — fail-closed master key validation at boot (DEC-17)', () => {
  test('a valid 32-byte base64 key lets the configuration load', () => {
    const config = loadConfig();
    assert.equal(config.port, 3000);
    assert.equal(config.databaseUrl, URL_PRUEBAS);
  });

  test('the loaded configuration never carries the master key', () => {
    // The key Buffer lives in cripto-credencial.ts and nowhere else. A key on AppConfig
    // would be one `app.log.info(config)` away from a log line (regla 7).
    const config = loadConfig();
    const serializado = JSON.stringify(config);

    assert.ok(!serializado.includes(CLAVE_VALIDA), 'the key must not reach AppConfig');
    assert.ok(
      !Object.keys(config).some((clave) => clave.toLowerCase().includes('key')),
      `AppConfig must carry no key-shaped field, got ${Object.keys(config).join(', ')}`,
    );
  });

  test('an unset master key refuses the boot', () => {
    delete process.env[VARIABLE_CLAVE_MAESTRA];
    assert.throws(() => loadConfig(), new RegExp(VARIABLE_CLAVE_MAESTRA));
  });

  test('an empty master key refuses the boot, exactly as an absent one does', () => {
    process.env[VARIABLE_CLAVE_MAESTRA] = '';
    assert.throws(() => loadConfig(), new RegExp(VARIABLE_CLAVE_MAESTRA));
  });

  test('a master key that is not valid base64 refuses the boot', () => {
    process.env[VARIABLE_CLAVE_MAESTRA] = 'no-es-base64-***';
    assert.throws(() => loadConfig(), new RegExp(VARIABLE_CLAVE_MAESTRA));
  });

  test('a master key that decodes to fewer than 32 bytes refuses the boot', () => {
    process.env[VARIABLE_CLAVE_MAESTRA] = Buffer.alloc(16, 5).toString('base64');
    assert.throws(() => loadConfig(), new RegExp(VARIABLE_CLAVE_MAESTRA));
  });

  test('a master key that decodes to more than 32 bytes refuses the boot', () => {
    process.env[VARIABLE_CLAVE_MAESTRA] = Buffer.alloc(48, 5).toString('base64');
    assert.throws(() => loadConfig(), new RegExp(VARIABLE_CLAVE_MAESTRA));
  });

  test('the refusal never quotes the offending key value', () => {
    const valorMalo = Buffer.alloc(16, 5).toString('base64');
    process.env[VARIABLE_CLAVE_MAESTRA] = valorMalo;
    assert.throws(
      () => loadConfig(),
      (error: unknown) => {
        const mensaje = error instanceof Error ? error.message : String(error);
        assert.ok(!mensaje.includes(valorMalo), 'the message must not quote the key');
        return true;
      },
    );
  });
});

describe('loadConfig — the timeout budgets keep their CH-03/CH-04 behaviour', () => {
  test('both budgets fall back to their defaults when unset', () => {
    const config = loadConfig();
    assert.equal(config.connectionTestTimeoutMs, DEFAULT_CONNECTION_TEST_TIMEOUT_MS);
    assert.equal(config.queryTimeoutMs, DEFAULT_QUERY_TIMEOUT_MS);
  });

  test('a configured budget is read from the environment', () => {
    process.env.QUERY_TIMEOUT_MS = '2500';
    assert.equal(loadConfig().queryTimeoutMs, 2500);
  });

  test('a non-positive-integer budget is a configuration error, not a silent fallback', () => {
    process.env.QUERY_TIMEOUT_MS = '0';
    assert.throws(() => loadConfig(), /QUERY_TIMEOUT_MS/);
    process.env.QUERY_TIMEOUT_MS = 'pronto';
    assert.throws(() => loadConfig(), /QUERY_TIMEOUT_MS/);
  });
});
