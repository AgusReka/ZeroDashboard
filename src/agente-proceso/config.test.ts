import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { inspect } from 'node:util';
import type { ClientOptions } from 'ws';
import { ErrorConfig, leerConfig, type VariableAgente } from './config.js';
import { LIMITES_AGENTE } from './limites.js';
import { opcionesSocket, validarUrlServidor } from './politica-tls.js';

/** CH-19c2, cases C1-C6: configuration, URL/TLS policy and socket options (DEC-123 A6). */
const TOKEN = 'zda_' + 'A'.repeat(40) + '-_9';
const VALIDA = { AGENT_SERVER_URL: 'wss://motor.example', AGENT_TOKEN: TOKEN, AGENT_ALLOWED_TARGETS: 'replica:5432' };
/** No window of 4 characters of this value may appear in any error (not even a partial one). */
const SENTINELA = 'Qx7Zk9WvJ3';
const ventanas = [...Array(SENTINELA.length - 3).keys()].map((i) => SENTINELA.slice(i, i + 4));

function errorDe(fn: () => unknown): ErrorConfig {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof ErrorConfig, 'expected ErrorConfig');
    return error;
  }
  assert.fail('expected a configuration error');
}
const errorConfig = (env: Record<string, string | undefined>) => errorDe(() => leerConfig(env));

describe('leerConfig (CH-19c2, C1-C2)', () => {
  test('C1 a missing or empty variable names it', () => {
    for (const variable of Object.keys(VALIDA) as VariableAgente[]) {
      for (const valor of [undefined, '']) {
        const error = errorConfig({ ...VALIDA, [variable]: valor });
        assert.equal(error.variable, variable);
        assert.match(error.message, new RegExp(`^${variable} `));
      }
    }
  });

  test('C2 a token outside zda_ plus 43 base64url characters is refused', () => {
    for (const token of ['zda_short', TOKEN + 'A', TOKEN.slice(0, -1) + '=', 'zdb_' + TOKEN.slice(4), ` ${TOKEN}`]) {
      assert.equal(errorConfig({ ...VALIDA, AGENT_TOKEN: token }).variable, 'AGENT_TOKEN');
    }
  });

  test('a valid configuration reads exactly the three variables and needs no engine variable', () => {
    const leidas = new Set<string>();
    const env = new Proxy({ ...VALIDA, AGENT_ALLOWED_TARGETS: 'DB.Example.com.:5432,[::1]:6432' }, {
      get: (destino, clave) => (leidas.add(String(clave)), Reflect.get(destino, clave)),
    });
    const config = leerConfig(env);
    assert.deepEqual([...leidas].sort(), Object.keys(VALIDA).sort());
    assert.deepEqual([config.servidor.href, config.token], ['wss://motor.example/', TOKEN]);
    assert.deepEqual([...config.destinos.values()], [{ host: 'db.example.com', puerto: 5432 }, { host: '::1', puerto: 6432 }]);
  });
});

describe('validarUrlServidor (CH-19c2, C3-C4)', () => {
  test('C3 accepts wss: on any host and ws: on loopback only', () => {
    for (const url of ['wss://motor.example', 'wss://motor.example:8443/', 'ws://localhost:3000', 'ws://127.0.0.5', 'ws://127.0.0.1:3000', 'ws://[::1]:3000']) {
      assert.equal(validarUrlServidor(url).pathname, '/', url);
    }
  });

  test('C4 refuses ws: off loopback, other schemes, userinfo, fragment, query and path', () => {
    const rechazadas = ['ws://10.0.0.1', 'ws://motor.example', 'ws://localhost.:3000', 'http://x', 'https://x', 'wss://u:p@x', 'wss://@x',
      'wss://x#f', 'wss://x#', 'wss://x?a=1', 'wss://x?a', 'wss://x/ruta', 'no es una url'];
    for (const url of rechazadas) {
      assert.equal(errorDe(() => validarUrlServidor(url)).variable, 'AGENT_SERVER_URL', url);
      assert.equal(errorConfig({ ...VALIDA, AGENT_SERVER_URL: url }).variable, 'AGENT_SERVER_URL', url);
    }
  });
});

describe('configuration errors never print a value (CH-19c2, C5)', () => {
  test('C5 no error contains the input, not even part of it', () => {
    const casos: [VariableAgente, string][] = [
      ['AGENT_SERVER_URL', `wss://usuario:${SENTINELA}@motor.example`],
      ['AGENT_SERVER_URL', `wss://${SENTINELA}.example/ruta`],
      ['AGENT_SERVER_URL', `ws://${SENTINELA}:3000`],
      ['AGENT_SERVER_URL', `${SENTINELA}`],
      ['AGENT_TOKEN', `zda_${SENTINELA}`],
      ['AGENT_ALLOWED_TARGETS', `replica:5432,${SENTINELA}:99999`],
    ];
    for (const [variable, valor] of casos) {
      const error = errorConfig({ ...VALIDA, [variable]: valor });
      const texto = `${inspect(error)} ${String(error)} ${JSON.stringify(error)}`;
      assert.equal(error.variable, variable);
      assert.equal(error.cause, undefined);
      for (const parte of ventanas) assert.ok(!texto.includes(parte), `${variable} leaked "${parte}"`);
    }
  });

  test('an allowlist entry error gives the entry index only', () => {
    const error = errorConfig({ ...VALIDA, AGENT_ALLOWED_TARGETS: `replica:5432,${SENTINELA}:99999` });
    assert.match(error.message, /^AGENT_ALLOWED_TARGETS: entry 2 /);
  });
});

describe('opcionesSocket (CH-19c2, C6)', () => {
  test('C6 exactly six options; rejectUnauthorized stays true with NODE_TLS_REJECT_UNAUTHORIZED=0', () => {
    const previo = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    try {
      const opciones: ClientOptions = opcionesSocket(TOKEN, LIMITES_AGENTE.tramaControl);
      assert.deepEqual(opciones, {
        headers: { authorization: `Bearer ${TOKEN}` },
        maxPayload: 4096,
        perMessageDeflate: false,
        rejectUnauthorized: true,
        followRedirects: false,
        handshakeTimeout: 10_000,
      });
    } finally {
      if (previo === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      else process.env.NODE_TLS_REJECT_UNAUTHORIZED = previo;
    }
  });
});
