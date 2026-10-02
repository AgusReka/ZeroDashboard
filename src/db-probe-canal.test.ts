import assert from 'node:assert/strict';
import net from 'node:net';
import { Duplex } from 'node:stream';
import { after, before, describe, test } from 'node:test';
import pg from 'pg';
import { ejecutarConsulta, type ResultadoEjecucion } from './consulta-ejecucion.js';
import {
  cerrarCliente,
  iniciarConexion,
  probeConnection,
  type AbrirCanal,
  type CanalDuplex,
} from './db-probe.js';
import { prepararSentencia, type SentenciaPreparada } from './parametros.js';

/**
 * CH-19a spike: does `pg.Client` over an injected duplex keep every guarantee a direct
 * dial has? The fake below follows the design's "Fake Duplex Contract", which also binds
 * the 19c1 channel. The live cases relay bytes to the test PostgreSQL (TEST_DB_*, see
 * `src/conexiones.test.ts`'s header); the others need no server. If C2 or Q1 fails, the
 * stream seam is refuted and DEC-112 goes back to the user.
 */
const objetivo = {
  host: process.env.TEST_DB_HOST ?? 'localhost',
  port: Number(process.env.TEST_DB_PORT ?? '5432'),
  user: process.env.TEST_DB_USER ?? 'zerodashboard',
  password: process.env.TEST_DB_PASSWORD ?? 'change-me',
  database: process.env.TEST_DB_NAME ?? 'zerodashboard',
};

// `ejecutarConsulta` reads its budgets through `loadConfig()`, which demands these.
process.env.APP_PORT ??= '3000';
process.env.DATABASE_URL ??=
  `postgresql://${encodeURIComponent(objetivo.user)}:${encodeURIComponent(objetivo.password)}` +
  `@${objetivo.host}:${objetivo.port}/${objetivo.database}`;
process.env.CREDENTIAL_MASTER_KEY ??= 'emVyb2Rhc2hib2FyZC1jbGF2ZS1kZS1wcnVlYmFzISE=';

/** Nobody listens on port 1, so a destination that pg actually dialled would fail. */
const SIN_DIAL = { host: '127.0.0.1', port: 1 };
const PRESUPUESTO_MS = 400;
const TECHO_MS = 2500;
const ESQUEMA = 'ch19a_pruebas';
const TABLA = `${ESQUEMA}.articulo`;
const CLAVES = { lector: 'clave-lector-ch19a', escritor: 'clave-escritor-ch19a' };

/** `relevo` relays to the live server, `silencio` never answers, `rechazo` is refused. */
type ModoCanal = 'relevo' | 'silencio' | 'rechazo';

class CanalFalso extends Duplex implements CanalDuplex {
  private extremo: net.Socket | null = null;
  private terminado = false;
  /** Test-only hook: sees each chunk pg writes. The seam itself never reads them. */
  alEscribir: ((trozo: Buffer) => void) | null = null;

  constructor(private readonly modo: ModoCanal) {
    super();
  }

  setNoDelay(): this {
    return this;
  }

  /** pg's `connect(port, host)`; the arguments are ignored, as the agent will ignore them. */
  connect(): this {
    if (this.modo === 'relevo') {
      const extremo = net.connect({ host: objetivo.host, port: objetivo.port });
      this.extremo = extremo;
      extremo.once('connect', () => this.emit('connect'));
      extremo.on('data', (trozo: Buffer) => {
        if (!this.terminado) this.push(trozo);
      });
      extremo.on('error', () => {});
      // No half-open: the far side closing always reaches `'close'` here.
      extremo.on('close', () => this.destroy());
    } else if (this.modo === 'rechazo') {
      setImmediate(() => this.destroy(Object.assign(new Error('rechazado'), { code: 'ECONNREFUSED' })));
    }
    return this;
  }

  override _read(): void {}

  override _write(trozo: Buffer, _codificacion: BufferEncoding, listo: (error?: Error | null) => void): void {
    this.alEscribir?.(trozo);
    this.extremo?.write(trozo);
    listo();
  }

  /** pg's `end()` while connecting: ending the readable side lets `autoDestroy` close. */
  override _final(listo: (error?: Error | null) => void): void {
    this.terminado = true;
    this.push(null);
    this.extremo?.end();
    listo();
  }

  override _destroy(error: Error | null, listo: (error?: Error | null) => void): void {
    this.terminado = true;
    this.extremo?.destroy();
    listo(error);
  }
}

/** A factory that opens a fresh fake per call and keeps every instance it opened. */
function fabrica(
  modo: ModoCanal,
  alAbrir?: (canal: CanalFalso) => void,
): { abrir: AbrirCanal; abiertos: CanalFalso[] } {
  const abiertos: CanalFalso[] = [];
  return {
    abiertos,
    abrir: () => {
      const canal = new CanalFalso(modo);
      abiertos.push(canal);
      alAbrir?.(canal);
      return canal;
    },
  };
}

function preparar(sql: string): SentenciaPreparada {
  const preparada = prepararSentencia(sql, undefined, undefined);
  assert.ok(preparada.ok);
  return preparada.valor;
}

/** Rejects after `ms`, so a hang fails the case instead of the whole run. */
function techo(ms: number): Promise<never> {
  return new Promise((_, rechazar) => {
    setTimeout(() => rechazar(new Error(`no answer within ${ms} ms`)), ms).unref();
  });
}

describe('channel seam without a server (CH-19a, C1 and C3-C5)', () => {
  test('C1 without a channel the client dials TCP and no factory is called', async () => {
    const { abiertos } = fabrica('relevo');
    const { cliente, conectado, cancelarTemporizador } = iniciarConexion(
      { ...SIN_DIAL, database: 'x', user: 'x', password: 'x' },
      PRESUPUESTO_MS,
    );
    await conectado.catch(() => undefined);
    cancelarTemporizador();
    assert.ok(cliente.connection.stream instanceof net.Socket);
    assert.equal(abiertos.length, 0);
    await cerrarCliente(cliente, true);
  });

  test('C3 a silent channel is tiempo-agotado within the budget, probe and engine', async () => {
    const sonda = fabrica('silencio');
    let iniciado = Date.now();
    const probe = await probeConnection({
      ...SIN_DIAL, database: 'x', user: 'x', password: 'x', canal: sonda.abrir, timeoutMs: PRESUPUESTO_MS,
    });
    assert.deepEqual([probe.categoria, probe.codigo, sonda.abiertos.length], ['tiempo-agotado', null, 1]);
    assert.ok(Date.now() - iniciado < TECHO_MS, 'the probe must return within its budget');

    const motor = fabrica('silencio');
    iniciado = Date.now();
    const ejecucion = await ejecutarConsulta({
      ...SIN_DIAL, database: 'x', user: 'x', password: 'x', canal: motor.abrir,
      sentencia: preparar('SELECT 1'), limite: 1, desplazamiento: 0, connectTimeoutMs: PRESUPUESTO_MS,
    });
    assert.ok(ejecucion.resultado === 'fallo', JSON.stringify(ejecucion));
    assert.deepEqual([ejecucion.fase, ejecucion.categoria, ejecucion.codigo], ['conexion', 'tiempo-agotado', null]);
    assert.equal(motor.abiertos.length, 1);
    assert.ok(Date.now() - iniciado < TECHO_MS, 'the engine must return within its budget');
  });

  test('C4 a channel destroyed before connecting with ECONNREFUSED is host-inalcanzable', async () => {
    const { abrir, abiertos } = fabrica('rechazo');
    const probe = await probeConnection({
      ...SIN_DIAL, database: 'x', user: 'x', password: 'x', canal: abrir, timeoutMs: PRESUPUESTO_MS,
    });
    assert.deepEqual([probe.categoria, probe.codigo, abiertos.length], ['host-inalcanzable', 'ECONNREFUSED', 1]);
  });

  test('C5 closing a client whose channel is still connecting returns', async () => {
    const { abrir, abiertos } = fabrica('silencio');
    const { cliente, conectado, cancelarTemporizador } = iniciarConexion(
      { ...SIN_DIAL, database: 'x', user: 'x', password: 'x', canal: abrir },
      PRESUPUESTO_MS,
    );
    conectado.catch(() => undefined);
    cancelarTemporizador();
    await Promise.race([cerrarCliente(cliente, true), techo(TECHO_MS)]);
    assert.equal(abiertos.length, 1);
  });
});

const alcanzable = await new Promise<boolean>((resolve) => {
  const socket = net.connect({ host: objetivo.host, port: objetivo.port });
  const cerrar = (valor: boolean): void => {
    socket.destroy();
    resolve(valor);
  };
  socket.setTimeout(1000);
  socket.once('connect', () => cerrar(true));
  socket.once('timeout', () => cerrar(false));
  socket.once('error', () => cerrar(false));
});
const motivoSkip = alcanzable ? false : `no PostgreSQL server at ${objetivo.host}:${objetivo.port} — set TEST_DB_*`;

const SQL_LIMPIEZA = `
DROP SCHEMA IF EXISTS ${ESQUEMA} CASCADE;
DO $limpieza$
DECLARE rol text;
BEGIN
  FOREACH rol IN ARRAY ARRAY['ch19a_lector', 'ch19a_escritor'] LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = rol) THEN
      EXECUTE format('DROP OWNED BY %I', rol);
      EXECUTE format('DROP ROLE %I', rol);
    END IF;
  END LOOP;
END
$limpieza$;`;

const SQL_FIXTURE = `
CREATE SCHEMA ${ESQUEMA};
CREATE TABLE ${TABLA} (id integer PRIMARY KEY, nombre text NOT NULL);
INSERT INTO ${TABLA} VALUES (1, 'Café'), (2, 'Té'), (3, 'Mate');
CREATE ROLE ch19a_lector LOGIN PASSWORD '${CLAVES.lector}';
CREATE ROLE ch19a_escritor LOGIN PASSWORD '${CLAVES.escritor}';
GRANT USAGE ON SCHEMA ${ESQUEMA} TO ch19a_lector, ch19a_escritor;
GRANT SELECT ON ${TABLA} TO ch19a_lector, ch19a_escritor;
GRANT INSERT ON ${TABLA} TO ch19a_escritor;`;

describe('channel seam against a live PostgreSQL (CH-19a, C2, D1-D2, Q1-Q4)', { skip: motivoSkip }, () => {
  let admin!: pg.Client;

  before(async () => {
    admin = new pg.Client({ ...objetivo });
    await admin.connect();
    await admin.query(SQL_LIMPIEZA);
    await admin.query(SQL_FIXTURE);
  });

  after(async () => {
    await admin.query(SQL_LIMPIEZA);
    await admin.end();
  });

  /** One engine execution over a fresh relaying fake, as `usuario`. */
  async function ejecutar(
    usuario: keyof typeof CLAVES,
    sql: string,
    limite = 10,
    alAbrir?: (canal: CanalFalso) => void,
  ): Promise<{ resultado: ResultadoEjecucion; abiertos: CanalFalso[] }> {
    const { abrir, abiertos } = fabrica('relevo', alAbrir);
    const resultado = await ejecutarConsulta({
      ...SIN_DIAL, database: objetivo.database, user: `ch19a_${usuario}`, password: CLAVES[usuario],
      canal: abrir, sentencia: preparar(sql), limite, desplazamiento: 0,
    });
    return { resultado, abiertos };
  }

  test('C2 the channel supplies the stream, SSL stays off, and SELECT 1 succeeds', async () => {
    const { abrir, abiertos } = fabrica('relevo');
    const anterior = process.env.PGSSLMODE;
    process.env.PGSSLMODE = 'require';
    let conexion: ReturnType<typeof iniciarConexion>;
    try {
      conexion = iniciarConexion({ ...objetivo, ...SIN_DIAL, canal: abrir }, TECHO_MS);
    } finally {
      if (anterior === undefined) delete process.env.PGSSLMODE;
      else process.env.PGSSLMODE = anterior;
    }
    const { cliente, conectado, cancelarTemporizador } = conexion;
    try {
      await conectado;
      cancelarTemporizador();
      assert.equal(abiertos.length, 1);
      assert.equal(cliente.connection.stream, abiertos[0]);
      assert.equal(cliente.ssl, false);
      const { rows } = await cliente.query('SELECT 1 AS uno');
      assert.deepEqual(rows, [{ uno: 1 }]);
    } finally {
      cancelarTemporizador();
      await cerrarCliente(cliente, true);
    }
  });

  test('Q1 a read-only role gets the requested page of rows over the channel', async () => {
    const { resultado, abiertos } = await ejecutar('lector', `SELECT id, nombre FROM ${TABLA} ORDER BY id`, 2);
    assert.ok(resultado.resultado === 'ok', JSON.stringify(resultado));
    assert.equal(abiertos.length, 1);
    assert.deepEqual(resultado.filas, [[1, 'Café'], [2, 'Té']]);
    assert.equal(resultado.paginacion.hayMas, true);
  });

  test('D1 a channel dropped while idle leaves the process running and the next query rejects', async () => {
    const { abrir, abiertos } = fabrica('relevo');
    const { cliente, conectado, cancelarTemporizador } = iniciarConexion(
      { ...objetivo, ...SIN_DIAL, canal: abrir },
      TECHO_MS,
    );
    await conectado;
    cancelarTemporizador();
    // With no `'error'` listener (DEC-111) this destroy would end the runner's process.
    abiertos[0].destroy(Object.assign(new Error('canal cortado'), { code: 'ECONNRESET' }));
    await new Promise((resolve) => setTimeout(resolve, 100));
    await assert.rejects(() => cliente.query('SELECT 1'));
    await Promise.race([cerrarCliente(cliente, true), techo(TECHO_MS)]);
  });

  test('D2 a channel dropped during a statement fails in ejecucion without the credential', async () => {
    const { resultado, abiertos } = await ejecutar('lector', 'SELECT pg_sleep(2)', 10, (canal) => {
      canal.alEscribir = (trozo) => {
        if (trozo.includes('pg_sleep')) {
          canal.alEscribir = null;
          setTimeout(() => canal.destroy(new Error('canal cortado')), 300);
        }
      };
    });
    assert.ok(resultado.resultado === 'fallo', JSON.stringify(resultado));
    assert.deepEqual([resultado.fase, resultado.codigo, abiertos.length], ['ejecucion', null, 1]);
    assert.ok(!JSON.stringify(resultado).includes(CLAVES.lector), 'the credential must not ride out');
  });

  test('Q2 a role with table write privilege is still refused before its statement', async () => {
    const { resultado, abiertos } = await ejecutar('escritor', `SELECT id FROM ${TABLA}`);
    assert.ok(resultado.resultado === 'fallo', JSON.stringify(resultado));
    assert.deepEqual([resultado.fase, resultado.categoria, abiertos.length], ['permisos', 'rol-con-escritura-en-tabla', 1]);
  });

  test('Q3 a data-modifying CTE is still no-es-lectura and no row changes', async () => {
    const { resultado, abiertos } = await ejecutar('lector', `WITH x AS (DELETE FROM ${TABLA} RETURNING *) SELECT * FROM x`);
    assert.ok(resultado.resultado === 'fallo', JSON.stringify(resultado));
    assert.deepEqual([resultado.categoria, abiertos.length], ['no-es-lectura', 1]);
    const { rows } = await admin.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${TABLA}`);
    assert.equal(rows[0].n, 3);
  });

  test('Q4 multi-statement text is still error-sintaxis over the channel', async () => {
    const { resultado, abiertos } = await ejecutar('lector', 'SELECT 1; SELECT 2');
    assert.ok(resultado.resultado === 'fallo', JSON.stringify(resultado));
    assert.deepEqual([resultado.fase, resultado.categoria, abiertos.length], ['ejecucion', 'error-sintaxis', 1]);
  });
});
