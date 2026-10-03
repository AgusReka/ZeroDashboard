import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ErrorConfig } from './config.js';
import { buscarDestino, leerDestinos, normalizarHost } from './destinos.js';

/** CH-19c2, cases L1-L5: the literal allowlist of AGENT_ALLOWED_TARGETS (DEC-123 A4). */
function rechazo(texto: string): ErrorConfig {
  try {
    leerDestinos(texto);
  } catch (error) {
    assert.ok(error instanceof ErrorConfig, texto);
    assert.equal(error.variable, 'AGENT_ALLOWED_TARGETS', texto);
    return error;
  }
  assert.fail(`accepted: ${texto}`);
}

describe('leerDestinos (CH-19c2, L1-L2)', () => {
  test('L1 accepts DNS names, IPv4 and bracketed IPv6, trimmed and normalized', () => {
    const lista = leerDestinos(' replica:6432 , DB.Example.com.:5432,10.0.0.5:5432,[::1]:5432,db-1:65535,1db:1');
    assert.deepEqual([...lista.values()], [
      { host: 'replica', puerto: 6432 },
      { host: 'db.example.com', puerto: 5432 },
      { host: '10.0.0.5', puerto: 5432 },
      { host: '::1', puerto: 5432 },
      { host: 'db-1', puerto: 65535 },
      { host: '1db', puerto: 1 },
    ]);
  });

  test('L2 refuses wildcards, CIDR, ranges, missing or out-of-range ports, empty items and loose IP forms', () => {
    const rechazadas = ['', ' ', '*:5432', '*.example.com:5432', '10.0.0.0/24:5432', '10.0.0.0/24', '10.0.0.1-10.0.0.9:5432',
      '10.0.0.1-9:5432', 'db:5432-5440', 'db', 'db:', ':5432', 'db:0', 'db:65536', 'db:05432', 'db:+1', 'a:1,,b:2', 'a:1,',
      '127.1:5432', '0x7f.0.0.1:1', '010.0.0.1:5432', '::1:5432', '[zz]:5432', '[::1]', 'db_x:5432', '-db:5432', 'db..x:5432'];
    for (const texto of rechazadas) rechazo(texto);
  });

  test('an entry error names the 1-based entry index and never the entry', () => {
    const error = rechazo('replica:5432,secreto-x:5432,otro*:1');
    assert.equal(error.message.startsWith('AGENT_ALLOWED_TARGETS: entry 3 '), true);
    assert.ok(!/secreto|otro|replica|5432/.test(error.message));
  });
});

describe('buscarDestino (CH-19c2, L3-L5)', () => {
  test('L3 case, brackets and one trailing dot normalize; the entry host is returned', () => {
    const lista = leerDestinos('DB.Example.com.:5432,[::1]:6432');
    for (const host of ['db.example.com', 'DB.EXAMPLE.COM.', 'db.example.com.']) {
      assert.deepEqual(buscarDestino(lista, host, 5432), { host: 'db.example.com', puerto: 5432 }, host);
    }
    assert.deepEqual([buscarDestino(lista, '[::1]', 6432), buscarDestino(lista, '::1', 6432)], [{ host: '::1', puerto: 6432 }, { host: '::1', puerto: 6432 }]);
    assert.deepEqual([normalizarHost('[::1]'), normalizarHost('A.B..'), normalizarHost('X.')], ['::1', 'a.b.', 'x']);
  });

  test('L4 only the listed literal matches: 127.1, another port or a CIDR do not', () => {
    const lista = leerDestinos('127.0.0.1:5432,10.0.0.5:5432');
    assert.equal(buscarDestino(lista, '127.1', 5432), null);
    assert.equal(buscarDestino(lista, '10.0.0.5', 5433), null);
    assert.equal(buscarDestino(lista, '10.0.0.0/24', 5432), null);
    assert.deepEqual(buscarDestino(lista, '10.0.0.5', 5432), { host: '10.0.0.5', puerto: 5432 });
  });

  test('L5 a port that is not an integer number, or a host that is not a string, never matches', () => {
    const lista = leerDestinos('replica:5432');
    for (const [host, puerto] of [['replica', '5432'], ['replica', 5432.5], [5432, 5432], [null, 5432], ['replica', undefined]] as const) {
      assert.equal(buscarDestino(lista, host, puerto), null, `${String(host)} ${String(puerto)}`);
    }
  });
});
