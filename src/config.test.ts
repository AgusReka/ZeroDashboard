import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import {
  DEFAULT_CONNECTION_RETRY_ATTEMPTS,
  DEFAULT_CONNECTION_RETRY_PAUSE_MS,
  DEFAULT_CONNECTION_TEST_TIMEOUT_MS,
  DEFAULT_MAX_FILAS_CONSULTA,
  DEFAULT_QUERY_TIMEOUT_MS,
  DEFAULT_SMTP_TIMEOUT_MS,
  DEFAULT_ZONA_HORARIA,
  MAX_CONNECTION_RETRY_ATTEMPTS,
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
  'MAX_FILAS_CONSULTA',
  'ZONA_HORARIA_AUTOMATIZACIONES',
  'SMTP_TIMEOUT_MS',
  'CONNECTION_RETRY_ATTEMPTS',
  'CONNECTION_RETRY_PAUSE_MS',
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

describe('loadConfig — the row cap is configuration, not a source literal (DEC-19)', () => {
  test('maxFilasPorConsulta defaults to 200 when MAX_FILAS_CONSULTA is unset', () => {
    // 200 is what `ejecucionSchema` used to hard-code as `maximum`. The default keeps
    // today's behaviour; what changes is that the number can now be moved without an
    // edit to source, which is the whole of A4's "configurables".
    assert.equal(loadConfig().maxFilasPorConsulta, DEFAULT_MAX_FILAS_CONSULTA);
    assert.equal(DEFAULT_MAX_FILAS_CONSULTA, 200);
  });

  test('MAX_FILAS_CONSULTA overrides the default without a source change', () => {
    process.env.MAX_FILAS_CONSULTA = '5';
    assert.equal(loadConfig().maxFilasPorConsulta, 5);
  });

  test('an empty MAX_FILAS_CONSULTA falls back to the default', () => {
    process.env.MAX_FILAS_CONSULTA = '';
    assert.equal(loadConfig().maxFilasPorConsulta, 200);
  });

  test('the cap is global: it is read once from the environment, not per connection', () => {
    // DEC-19 is explicit that the cap is neither per `Conexion` nor per `Tenant`, so it
    // cannot depend on anything but the environment. Two reads with nothing else changed
    // have to agree.
    process.env.MAX_FILAS_CONSULTA = '37';
    assert.equal(loadConfig().maxFilasPorConsulta, 37);
    assert.equal(loadConfig().maxFilasPorConsulta, 37);
  });

  for (const valor of ['0', '-1', '12.5', 'muchas']) {
    test(`MAX_FILAS_CONSULTA=${valor} is a configuration error, not a silent fallback`, () => {
      process.env.MAX_FILAS_CONSULTA = valor;
      assert.throws(() => loadConfig(), /MAX_FILAS_CONSULTA/);
    });
  }
});

describe('loadConfig — one deployment-wide timezone for automation schedules (DEC-77)', () => {
  test('zonaHoraria defaults to UTC when ZONA_HORARIA_AUTOMATIZACIONES is unset', () => {
    // Same optional-with-default shape as the DEC-19 row cap: an untouched deployment
    // boots with no error and interprets every cron schedule in UTC.
    assert.equal(loadConfig().zonaHoraria, DEFAULT_ZONA_HORARIA);
    assert.equal(DEFAULT_ZONA_HORARIA, 'UTC');
  });

  test('an empty ZONA_HORARIA_AUTOMATIZACIONES falls back to the default', () => {
    process.env.ZONA_HORARIA_AUTOMATIZACIONES = '';
    assert.equal(loadConfig().zonaHoraria, 'UTC');
  });

  test('a valid IANA zone is read from the environment without a source change', () => {
    process.env.ZONA_HORARIA_AUTOMATIZACIONES = 'America/Argentina/Buenos_Aires';
    assert.equal(loadConfig().zonaHoraria, 'America/Argentina/Buenos_Aires');
  });

  for (const valor of ['Marte/Olympus_Mons', 'GMT+99', 'no es una zona']) {
    test(`ZONA_HORARIA_AUTOMATIZACIONES=${valor} stops the boot, not a silent fallback`, () => {
      // Fails closed like DEC-17: a typo in the zone would otherwise shift every
      // automation's fire time with no error anywhere.
      process.env.ZONA_HORARIA_AUTOMATIZACIONES = valor;
      assert.throws(() => loadConfig(), /ZONA_HORARIA_AUTOMATIZACIONES/);
    });
  }
});

describe('loadConfig — the SMTP send budget is configuration, not a source literal (CH-14, R2)', () => {
  test('smtpTimeoutMs defaults to 10000 when SMTP_TIMEOUT_MS is unset', () => {
    // R2 under DEC-19: a hung SMTP server must not block the sequential tick for longer
    // than this budget, and an untouched deployment gets 10 seconds.
    assert.equal(loadConfig().smtpTimeoutMs, DEFAULT_SMTP_TIMEOUT_MS);
    assert.equal(DEFAULT_SMTP_TIMEOUT_MS, 10000);
  });

  test('an empty SMTP_TIMEOUT_MS falls back to the default', () => {
    process.env.SMTP_TIMEOUT_MS = '';
    assert.equal(loadConfig().smtpTimeoutMs, 10000);
  });

  test('SMTP_TIMEOUT_MS overrides the default without a source change', () => {
    process.env.SMTP_TIMEOUT_MS = '2500';
    assert.equal(loadConfig().smtpTimeoutMs, 2500);
  });

  for (const valor of ['0', '-5', '12.5', 'lento']) {
    test(`SMTP_TIMEOUT_MS=${valor} stops the boot naming the variable, never its value`, () => {
      process.env.SMTP_TIMEOUT_MS = valor;
      assert.throws(
        () => loadConfig(),
        (error: unknown) => {
          const mensaje = error instanceof Error ? error.message : String(error);
          assert.match(mensaje, /SMTP_TIMEOUT_MS/);
          assert.ok(!mensaje.includes(valor), `the message must not quote ${valor}`);
          return true;
        },
      );
    });
  }

  test('the SMTP connection settings never reach AppConfig', () => {
    // DEC-86 / DEC-17 precedent: SMTP_HOST, SMTP_USER, SMTP_PASSWORD and friends are read
    // only by the notifier. On AppConfig they would be one `log.info(config)` away from a
    // log line; only the send budget, which is not a secret, lives here.
    process.env.SMTP_HOST = 'smtp.ejemplo.test';
    process.env.SMTP_PASSWORD = 'secreto-de-prueba';
    try {
      const config = loadConfig();
      const serializado = JSON.stringify(config);
      assert.ok(!serializado.includes('smtp.ejemplo.test'));
      assert.ok(!serializado.includes('secreto-de-prueba'));
      assert.deepEqual(
        Object.keys(config).filter((clave) => clave.toLowerCase().includes('smtp')),
        ['smtpTimeoutMs'],
      );
    } finally {
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_PASSWORD;
    }
  });
});

describe('loadConfig — the connection retry policy is configuration (CH-17b, DEC-105)', () => {
  /** Asserts the boot refusal names the variable and never quotes the offending value. */
  function rechazaSinCitar(variable: string, valor: string, patron?: RegExp): void {
    process.env[variable] = valor;
    assert.throws(
      () => loadConfig(),
      (error: unknown) => {
        const mensaje = error instanceof Error ? error.message : String(error);
        assert.match(mensaje, new RegExp(variable));
        if (patron) {
          assert.match(mensaje, patron);
        }
        assert.ok(!mensaje.includes(valor), `the message must not quote ${valor}`);
        return true;
      },
    );
  }

  test('1.3 both default when unset: 3 total attempts and a 5000 ms pause', () => {
    const config = loadConfig();
    assert.equal(config.connectionRetryAttempts, DEFAULT_CONNECTION_RETRY_ATTEMPTS);
    assert.equal(config.connectionRetryPauseMs, DEFAULT_CONNECTION_RETRY_PAUSE_MS);
    assert.equal(DEFAULT_CONNECTION_RETRY_ATTEMPTS, 3);
    assert.equal(DEFAULT_CONNECTION_RETRY_PAUSE_MS, 5000);
    assert.equal(MAX_CONNECTION_RETRY_ATTEMPTS, 5);
  });

  test('1.3 valid values override the defaults without a source change', () => {
    process.env.CONNECTION_RETRY_ATTEMPTS = '5';
    process.env.CONNECTION_RETRY_PAUSE_MS = '1000';
    const config = loadConfig();
    assert.equal(config.connectionRetryAttempts, 5);
    assert.equal(config.connectionRetryPauseMs, 1000);
  });

  test('1.3 one attempt is accepted: it is how retry is turned off', () => {
    process.env.CONNECTION_RETRY_ATTEMPTS = '1';
    assert.equal(loadConfig().connectionRetryAttempts, 1);
  });

  test('1.3 empty values fall back to the defaults', () => {
    process.env.CONNECTION_RETRY_ATTEMPTS = '';
    process.env.CONNECTION_RETRY_PAUSE_MS = '';
    const config = loadConfig();
    assert.equal(config.connectionRetryAttempts, 3);
    assert.equal(config.connectionRetryPauseMs, 5000);
  });

  test('1.3 more than 5 attempts stops the boot with the allowed range', () => {
    rechazaSinCitar('CONNECTION_RETRY_ATTEMPTS', '6', /between 1 and 5/);
  });

  for (const valor of ['0', 'abc', '12.5']) {
    test(`1.3 CONNECTION_RETRY_ATTEMPTS=${valor} stops the boot, never quoting the value`, () => {
      rechazaSinCitar('CONNECTION_RETRY_ATTEMPTS', valor);
    });
  }

  for (const valor of ['0', 'abc']) {
    test(`1.3 CONNECTION_RETRY_PAUSE_MS=${valor} stops the boot, never quoting the value`, () => {
      rechazaSinCitar('CONNECTION_RETRY_PAUSE_MS', valor);
    });
  }
});
