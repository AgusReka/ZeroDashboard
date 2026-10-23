import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { after, before, describe, test } from 'node:test';
import { classifyConnectionError, probeConnection } from './db-probe.js';

function errorConCodigo(code: string): Error & { code: string } {
  const error = new Error('driver failure') as Error & { code: string };
  error.code = code;
  return error;
}

describe('classifyConnectionError — classification rows', () => {
  test('row 1: an explicit ETIMEDOUT from the socket layer', () => {
    const resultado = classifyConnectionError(errorConCodigo('ETIMEDOUT'));
    assert.deepEqual(resultado, { categoria: 'tiempo-agotado', codigo: 'ETIMEDOUT' });
  });

  test('row 2: ECONNREFUSED is an unreachable host/port', () => {
    const resultado = classifyConnectionError(errorConCodigo('ECONNREFUSED'));
    assert.deepEqual(resultado, { categoria: 'host-inalcanzable', codigo: 'ECONNREFUSED' });
  });

  test('row 3: ENOTFOUND is a DNS resolution failure', () => {
    const resultado = classifyConnectionError(errorConCodigo('ENOTFOUND'));
    assert.deepEqual(resultado, { categoria: 'dns-no-resuelve', codigo: 'ENOTFOUND' });
  });

  test('row 3: EAI_AGAIN is DNS, but its underscore fails the codigo allowlist', () => {
    const resultado = classifyConnectionError(errorConCodigo('EAI_AGAIN'));
    assert.deepEqual(resultado, { categoria: 'dns-no-resuelve', codigo: null });
  });

  for (const codigo of ['EHOSTUNREACH', 'ENETUNREACH', 'ECONNRESET']) {
    test(`row 4: ${codigo} is an unreachable host/port`, () => {
      const resultado = classifyConnectionError(errorConCodigo(codigo));
      assert.deepEqual(resultado, { categoria: 'host-inalcanzable', codigo });
    });
  }

  for (const codigo of ['28P01', '28000']) {
    test(`row 5: SQLSTATE ${codigo} is a credentials failure`, () => {
      const resultado = classifyConnectionError(errorConCodigo(codigo));
      assert.deepEqual(resultado, { categoria: 'credenciales-invalidas', codigo });
    });
  }

  test('row 6: SQLSTATE 3D000 is a missing database', () => {
    const resultado = classifyConnectionError(errorConCodigo('3D000'));
    assert.deepEqual(resultado, { categoria: 'base-inexistente', codigo: '3D000' });
  });

  test('row 7: any SQLSTATE class 08 falls back to the generic category', () => {
    const resultado = classifyConnectionError(errorConCodigo('08006'));
    assert.deepEqual(resultado, { categoria: 'error-desconocido', codigo: '08006' });
  });

  test('row 8: an unrecognized SQLSTATE falls back to the generic category', () => {
    const resultado = classifyConnectionError(errorConCodigo('42601'));
    assert.deepEqual(resultado, { categoria: 'error-desconocido', codigo: '42601' });
  });
});

describe('classifyConnectionError — codigo allowlist', () => {
  test('a non-Error throw is classified without a codigo', () => {
    const resultado = classifyConnectionError('boom');
    assert.deepEqual(resultado, { categoria: 'error-desconocido', codigo: null });
  });

  test('null is classified without a codigo', () => {
    const resultado = classifyConnectionError(null);
    assert.deepEqual(resultado, { categoria: 'error-desconocido', codigo: null });
  });

  test('a free-text code does not match the allowlist and yields codigo: null', () => {
    const resultado = classifyConnectionError(errorConCodigo('connection terminated unexpectedly'));
    assert.deepEqual(resultado, { categoria: 'error-desconocido', codigo: null });
  });

  test('a numeric code is not read as a codigo', () => {
    const error = new Error('driver failure') as Error & { code: number };
    error.code = 28001;
    const resultado = classifyConnectionError(error);
    assert.deepEqual(resultado, { categoria: 'error-desconocido', codigo: null });
  });
});

describe('classifyConnectionError — credential safety', () => {
  test('a credential-bearing error yields a summary with neither password nor stack', () => {
    const password = 'sup3r-s3cret-p4ss';
    const error = new Error(`password authentication failed for user "lector" (${password})`) as
      Error & { code: string; connectionParameters: Record<string, unknown> };
    error.code = '28P01';
    error.stack = `Error: password authentication failed\n    at Connection.parseE (pg/lib/connection.js:1:1) [${password}]`;
    error.connectionParameters = {
      host: '10.0.0.7',
      port: 5432,
      database: 'foodstore',
      user: 'lector',
      password,
    };

    const resultado = classifyConnectionError(error);

    assert.deepEqual(resultado, { categoria: 'credenciales-invalidas', codigo: '28P01' });
    assert.deepEqual(Object.keys(resultado).sort(), ['categoria', 'codigo']);

    const serializado = JSON.stringify(resultado);
    assert.ok(!serializado.includes(password), 'the password must not appear in the summary');
    assert.ok(!serializado.includes('connectionParameters'), 'connection parameters must not appear');
    assert.ok(!serializado.includes('parseE'), 'the stack must not appear in the summary');
    assert.ok(!serializado.includes('password authentication failed'), 'the message must not appear');
  });
});

/**
 * Row 1's budget-exhausted half lives here rather than in `classifyConnectionError`,
 * because that is where the fact is now established: `probeConnection` races its own
 * timer against `connect()`, so a won race *is* the timeout, not evidence of one.
 *
 * These cases need no PostgreSQL server: a local TCP server that accepts the handshake
 * and then answers nothing reproduces "the target never responds" exactly, and a closed
 * port reproduces a fast driver error. Neither leaves the loopback interface.
 */
describe('probeConnection — the budget is decided by the race, not by the clock', () => {
  /** Short enough to keep the suite fast, long enough to dwarf scheduling jitter. */
  const PRESUPUESTO_MS = 400;
  /** Ceiling for the whole call: the probe must not wait on its own cleanup. */
  const TECHO_MS = 2500;

  let servidor: net.Server;
  let puertoSilencioso = 0;
  const aceptados = new Set<net.Socket>();

  before(async () => {
    servidor = net.createServer((socket) => {
      aceptados.add(socket);
      socket.on('close', () => aceptados.delete(socket));
    });
    await new Promise<void>((resolve) => servidor.listen(0, '127.0.0.1', resolve));
    puertoSilencioso = (servidor.address() as net.AddressInfo).port;
  });

  after(async () => {
    for (const socket of aceptados) {
      socket.destroy();
    }
    await new Promise<void>((resolve) => servidor.close(() => resolve()));
  });

  test('a target that never answers is tiempo-agotado, within the budget', async () => {
    const iniciado = Date.now();
    const resultado = await probeConnection({
      host: '127.0.0.1',
      port: puertoSilencioso,
      database: 'inalcanzable',
      user: 'lector',
      password: 'irrelevante',
      timeoutMs: PRESUPUESTO_MS,
    });
    const transcurrido = Date.now() - iniciado;

    assert.equal(resultado.resultado, 'fallo');
    // Deterministic even when `duracionMs` reads a millisecond *under* the budget:
    // the verdict comes from which promise won, and a measured duration is never
    // compared against the budget it was measured against.
    assert.equal(resultado.categoria, 'tiempo-agotado');
    assert.equal(resultado.codigo, null);
    assert.ok(
      transcurrido < TECHO_MS,
      `the probe returned after ${transcurrido} ms, so it waited on something past its budget`,
    );
  });

  test('a driver error inside the budget is classified normally, not as a timeout', async () => {
    // Port 1 has no listener, so the OS refuses the handshake in a millisecond or two.
    const resultado = await probeConnection({
      host: '127.0.0.1',
      port: 1,
      database: 'inalcanzable',
      user: 'lector',
      password: 'irrelevante',
      timeoutMs: PRESUPUESTO_MS,
    });

    assert.equal(resultado.resultado, 'fallo');
    assert.equal(resultado.categoria, 'host-inalcanzable');
    assert.equal(resultado.codigo, 'ECONNREFUSED');
  });

  test('a lost race never leaks the credential into the result', async () => {
    const password = 'sup3r-s3cret-p4ss';
    const resultado = await probeConnection({
      host: '127.0.0.1',
      port: puertoSilencioso,
      database: 'inalcanzable',
      user: 'lector',
      password,
      timeoutMs: PRESUPUESTO_MS,
    });

    assert.equal(resultado.categoria, 'tiempo-agotado');
    assert.ok(
      !JSON.stringify(resultado).includes(password),
      'a timed-out probe must not echo the credential',
    );
  });
});

/**
 * CH-18 (DEC-111): does an agent connection that dies after login take the process down?
 * The question is answered in a child process, so a crash ends the child and never the
 * runner. The child dials the live server through a local forwarder, logs in through
 * `iniciarConexion`, then destroys every forwarder socket: (a) while the client is idle,
 * and (b) while a query is in flight, its rejection handled. It prints `SOBREVIVIO` only if
 * it is still alive half a second later. Credentials reach it through the environment; the
 * script is a fixed string and no shell runs it, as in `server.test.ts`.
 */
const objetivoSonda = {
  host: process.env.TEST_DB_HOST ?? 'localhost',
  port: Number(process.env.TEST_DB_PORT ?? '5432'),
  user: process.env.TEST_DB_USER ?? 'zerodashboard',
  password: process.env.TEST_DB_PASSWORD ?? 'change-me',
  database: process.env.TEST_DB_NAME ?? 'zerodashboard',
};

const LIMITE_SONDA_MS = 15_000;

const GUION_SONDA = `
import net from 'node:net';
const { iniciarConexion } = await import(process.env.SONDA_MODULO);
const sockets = new Set();
const reenviador = net.createServer((entrante) => {
  const saliente = net.connect({ host: process.env.SONDA_HOST, port: Number(process.env.SONDA_PUERTO) });
  for (const socket of [entrante, saliente]) {
    sockets.add(socket);
    socket.on('error', () => {});
  }
  entrante.pipe(saliente).pipe(entrante);
});
await new Promise((resolve) => reenviador.listen(0, '127.0.0.1', resolve));
const { cliente, conectado, cancelarTemporizador } = iniciarConexion({
  host: '127.0.0.1',
  port: reenviador.address().port,
  database: process.env.SONDA_BASE,
  user: process.env.SONDA_USUARIO,
  password: process.env.SONDA_CLAVE,
}, 5000);
await conectado;
cancelarTemporizador();
const cortar = () => {
  for (const socket of sockets) socket.destroy();
};
if (process.env.SONDA_ESCENARIO === 'inactiva') {
  cortar();
} else {
  const consulta = cliente.query('SELECT pg_sleep(5)').then(() => 'resuelta', () => 'rechazada');
  setTimeout(cortar, 200);
  console.log('CONSULTA ' + (await consulta));
}
await new Promise((resolve) => setTimeout(resolve, 500));
console.log('SOBREVIVIO');
process.exit(0);
`;

function alcanzable(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const cerrar = (valor: boolean): void => {
      socket.destroy();
      resolve(valor);
    };
    socket.setTimeout(1000);
    socket.once('connect', () => cerrar(true));
    socket.once('timeout', () => cerrar(false));
    socket.once('error', () => cerrar(false));
  });
}

const motivoSkipSonda: string | false = (await alcanzable(objetivoSonda.host, objetivoSonda.port))
  ? false
  : `no PostgreSQL server at ${objetivoSonda.host}:${objetivoSonda.port} — set TEST_DB_*`;

/** Runs the child in one scenario; `codigo` is `null` when it had to be killed. */
function correrSonda(escenario: 'inactiva' | 'consulta'): Promise<{ codigo: number | null; salida: string }> {
  const env: Record<string, string | undefined> = {
    ...process.env,
    SONDA_MODULO: new URL('./db-probe.ts', import.meta.url).href,
    SONDA_ESCENARIO: escenario,
    SONDA_HOST: objetivoSonda.host,
    SONDA_PUERTO: String(objetivoSonda.port),
    SONDA_BASE: objetivoSonda.database,
    SONDA_USUARIO: objetivoSonda.user,
    SONDA_CLAVE: objetivoSonda.password,
  };
  const hijo = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', GUION_SONDA], { env });
  let salida = '';
  hijo.stdout.on('data', (trozo: Buffer) => {
    salida += trozo.toString();
  });
  hijo.stderr.on('data', (trozo: Buffer) => {
    salida += trozo.toString();
  });
  return new Promise((resolve) => {
    const limite = setTimeout(() => hijo.kill(), LIMITE_SONDA_MS);
    hijo.once('exit', (codigo) => {
      clearTimeout(limite);
      resolve({ codigo, salida });
    });
  });
}

describe('agent connection dying after login (CH-18, DEC-111)', { skip: motivoSkipSonda, timeout: 3 * LIMITE_SONDA_MS }, () => {
  test('(a) every socket destroyed while the client is idle: the process stays alive', async () => {
    const { codigo, salida } = await correrSonda('inactiva');
    assert.equal(codigo, 0, salida);
    assert.match(salida, /SOBREVIVIO/);
  });

  test('(b) every socket destroyed during a query: the query rejects and the process stays alive', async () => {
    const { codigo, salida } = await correrSonda('consulta');
    assert.equal(codigo, 0, salida);
    assert.match(salida, /CONSULTA rechazada/);
    assert.match(salida, /SOBREVIVIO/);
  });
});
