import assert from 'node:assert/strict';
import net from 'node:net';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { extenderConAislamiento } from './aislamiento-prisma.js';
import { registrarContextoTenant } from './contexto-tenant.js';
import { generarTokenSesion } from './crypto-auth.js';
import { LIMITE_LISTADO } from './listados.js';
import {
  COPY_NEGOCIO,
  COPY_NEUTRO,
  copyDe,
  frecuenciaDeCron,
  proyectarActiva,
  proyectarDisponibles,
  registerPanelAutomatizacionesRoutes,
  resultadoDe,
  type FilaAutomatizacion,
} from './panel-automatizaciones.js';

/**
 * Unit cases for CH-22b (DEC-137): the pure half of the panel's automations read. No
 * database, no network, no clock: only the copy map, the frequency text and the rules that
 * build the allow-listed items.
 */

// ---- 1.1 copy map and fallback ------------------------------------------------------

describe('copyDe — business copy with a neutral fallback', () => {
  test('1.1 a mapped slug returns its map entry', () => {
    assert.deepEqual(copyDe('stock-fisico'), {
      titulo: 'Aviso de stock bajo',
      descripcion: 'Te avisamos por correo cuando un producto se está quedando sin stock.',
    });
    assert.equal(copyDe('stock-producible'), COPY_NEGOCIO.get('stock-producible'));
  });

  test('1.1 the map keeps the catalog order used by disponibles', () => {
    assert.deepEqual([...COPY_NEGOCIO.keys()], ['stock-fisico', 'stock-producible']);
  });

  test('1.1 an unmapped slug returns the fallback and never throws', () => {
    for (const slug of ['reporte-semanal', '', 'constructor', '__proto__']) {
      assert.equal(copyDe(slug), COPY_NEUTRO, slug);
    }
  });

  test('1.1 the fallback carries only a title and a description, no template name', () => {
    assert.deepEqual(Object.keys(COPY_NEUTRO).sort(), ['descripcion', 'titulo']);
    assert.equal(COPY_NEUTRO.titulo, 'Automatización de tu negocio');
    assert.equal(COPY_NEUTRO.descripcion, 'Una revisión automática que te mandamos por correo.');
  });
});

// ---- 1.2 frequency mapping (DEC-129) ------------------------------------------------

describe('frecuenciaDeCron — text only for the three DEC-129 patterns', () => {
  test('1.2 the three patterns', () => {
    assert.equal(frecuenciaDeCron('30 8 * * *'), 'Todos los días a las 08:30');
    assert.equal(frecuenciaDeCron('0 9 * * 1-5'), 'De lunes a viernes a las 09:00');
    assert.equal(frecuenciaDeCron('0 18 * * 1-6'), 'De lunes a sábado a las 18:00');
  });

  test('1.2 hour and minute are zero-padded', () => {
    assert.equal(frecuenciaDeCron('5 7 * * *'), 'Todos los días a las 07:05');
  });

  test('1.2 extra whitespace is normalized', () => {
    assert.equal(frecuenciaDeCron('  30   8 *  * *  '), 'Todos los días a las 08:30');
  });

  test('1.2 any other expression gives null', () => {
    for (const cron of [
      '*/15 * * * *',
      '0 8 1 * *',
      '0 8 * * 0-6',
      '0 8 * * 1',
      '61 8 * * *',
      '0 24 * * *',
      'no es un cron',
      '',
    ]) {
      assert.equal(frecuenciaDeCron(cron), null, cron);
    }
  });

  test('1.2 the result never contains the cron string', () => {
    for (const cron of ['30 8 * * *', '0 9 * * 1-5', '0 18 * * 1-6']) {
      assert.ok(!(frecuenciaDeCron(cron) ?? '').includes(cron), cron);
    }
  });
});

// ---- 1.3 result mapping ------------------------------------------------------------

describe('resultadoDe — a neutral outcome, never the failure reason', () => {
  test('1.3 ok is completada', () => {
    assert.equal(resultadoDe('ok'), 'completada');
  });

  test('1.3 fallo, omitida and unknown states are no-realizada', () => {
    for (const estado of ['fallo', 'omitida', 'en-curso', 'algo-nuevo', '']) {
      assert.equal(resultadoDe(estado), 'no-realizada', estado);
    }
  });
});

// ---- 1.4 to 1.6 active-item projection ----------------------------------------------

const AHORA = new Date('2026-10-07T10:00:00Z');
const ZONA_BA = 'America/Argentina/Buenos_Aires';
const PROHIBIDAS = ['tenantId', 'conexionId', 'valores', 'codigoError', 'error', 'sql'];

/** A stored row as the database would hand it, carrying every forbidden field. */
const FILA_CRUDA = {
  id: 'aut-1',
  tenantId: 'ten-1',
  plantillaId: 'pla-1',
  conexionId: 'con-1',
  valores: { umbral: 5 },
  destinatario: 'ana@empresa.com',
  activo: true,
  cron: '0 8 * * *',
  plantilla: { automatizacion: 'stock-fisico', nombre: 'Console name', sql: 'SELECT 1' },
};
const EJECUCION_CRUDA = {
  id: 'eje-1',
  tenantId: 'ten-1',
  estado: 'fallo',
  iniciadaEn: new Date('2026-10-07T08:00:00Z'),
  finalizadaEn: new Date('2026-10-07T08:00:05Z'),
  error: 'sql-rechazado',
  codigoError: '42P01',
};

function fila(parche: Partial<FilaAutomatizacion> = {}): FilaAutomatizacion {
  return { id: 'aut-1', activo: true, cron: '0 8 * * *', plantilla: { automatizacion: 'stock-fisico' }, ...parche };
}

/** Every key at any depth of a parsed JSON value. */
function clavesProfundas(valor: unknown): string[] {
  if (Array.isArray(valor)) {
    return valor.flatMap(clavesProfundas);
  }
  if (valor !== null && typeof valor === 'object') {
    return Object.entries(valor).flatMap(([k, v]) => [k, ...clavesProfundas(v)]);
  }
  return [];
}

describe('proyectarActiva — allow-list without technical fields', () => {
  test('1.4 no forbidden key and no stored value reaches the item', () => {
    const item = proyectarActiva(FILA_CRUDA, EJECUCION_CRUDA, AHORA, 'UTC');
    const claves = clavesProfundas(item);
    for (const prohibida of PROHIBIDAS) {
      assert.ok(!claves.includes(prohibida), prohibida);
    }
    const texto = JSON.stringify(item);
    for (const valor of ['SELECT 1', 'Console name', '42P01', 'sql-rechazado', 'ten-1', 'con-1']) {
      assert.ok(!texto.includes(valor), valor);
    }
  });

  test('1.4 the item has exactly the allow-listed keys: the opaque id (DEC-139) and nothing technical', () => {
    const item = proyectarActiva(FILA_CRUDA, EJECUCION_CRUDA, AHORA, 'UTC');
    assert.equal(item.id, 'aut-1');
    assert.deepEqual(Object.keys(item).sort(), [
      'descripcion',
      'estado',
      'frecuencia',
      'id',
      'proximaEjecucion',
      'titulo',
      'ultimaEjecucion',
    ]);
    assert.deepEqual(Object.keys(item.ultimaEjecucion ?? {}).sort(), ['fecha', 'resultado']);
  });

  test('1.4 the copy comes from the slug map, and the fallback for an unmapped slug', () => {
    const mapeada = proyectarActiva(fila(), null, AHORA, 'UTC');
    assert.equal(mapeada.titulo, 'Aviso de stock bajo');
    const otra = proyectarActiva(
      fila({ plantilla: { automatizacion: 'reporte-semanal' } }),
      null,
      AHORA,
      'UTC',
    );
    assert.equal(otra.titulo, 'Automatización de tu negocio');
  });

  test('1.4 estado is activa/pausada/con_falla; con_falla when active and last finished run failed', () => {
    assert.equal(proyectarActiva(fila(), null, AHORA, 'UTC').estado, 'activa');
    assert.equal(proyectarActiva(fila({ activo: false }), null, AHORA, 'UTC').estado, 'pausada');
    const conFallo = proyectarActiva(fila(), EJECUCION_CRUDA, AHORA, 'UTC');
    assert.equal(conFallo.estado, 'con_falla');
    assert.equal(conFallo.ultimaEjecucion?.resultado, 'no-realizada');
    const omitida = proyectarActiva(fila(), { estado: 'omitida', iniciadaEn: new Date('2026-10-07T08:00:00Z'), finalizadaEn: new Date('2026-10-07T08:00:05Z') }, AHORA, 'UTC');
    assert.equal(omitida.estado, 'con_falla');
    assert.equal(omitida.ultimaEjecucion?.resultado, 'no-realizada');
    const okRun = proyectarActiva(fila(), { estado: 'ok', iniciadaEn: new Date('2026-10-07T08:00:00Z'), finalizadaEn: new Date('2026-10-07T08:00:05Z') }, AHORA, 'UTC');
    assert.equal(okRun.estado, 'activa');
    const soloEnCurso = proyectarActiva(fila(), null, AHORA, 'UTC');
    assert.equal(soloEnCurso.estado, 'activa');
    const pausadaConFallo = proyectarActiva(fila({ activo: false }), EJECUCION_CRUDA, AHORA, 'UTC');
    assert.equal(pausadaConFallo.estado, 'pausada');
  });

  test('1.4 frecuencia is a missing key, not null, outside the three patterns', () => {
    const item = proyectarActiva(fila({ cron: '*/15 * * * *' }), null, AHORA, 'UTC');
    assert.equal('frecuencia' in item, false);
    assert.equal(proyectarActiva(fila(), null, AHORA, 'UTC').frecuencia, 'Todos los días a las 08:00');
  });

  test('1.4 fecha is finalizadaEn, or iniciadaEn when the run has no end', () => {
    const fin = proyectarActiva(fila(), { ...EJECUCION_CRUDA }, AHORA, 'UTC');
    assert.equal(fin.ultimaEjecucion?.fecha, '2026-10-07T08:00:05.000Z');
    const sinFin = proyectarActiva(
      fila(),
      { estado: 'ok', iniciadaEn: new Date('2026-10-07T07:00:00Z'), finalizadaEn: null },
      AHORA,
      'UTC',
    );
    assert.deepEqual(sinFin.ultimaEjecucion, {
      fecha: '2026-10-07T07:00:00.000Z',
      resultado: 'completada',
    });
  });

  test('1.5 next run from a fixed clock, per zone', () => {
    assert.equal(proyectarActiva(fila(), null, AHORA, 'UTC').proximaEjecucion, '2026-10-08T08:00:00.000Z');
    assert.equal(proyectarActiva(fila(), null, AHORA, ZONA_BA).proximaEjecucion, '2026-10-07T11:00:00.000Z');
  });

  test('1.5 a paused automation has no next run', () => {
    assert.equal(proyectarActiva(fila({ activo: false }), null, AHORA, 'UTC').proximaEjecucion, null);
  });

  test('1.6 an invalid stored cron gives a null next run, no frecuencia and no throw', () => {
    for (const cron of ['no es un cron', '61 8 * * *']) {
      const item = proyectarActiva(fila({ cron }), null, AHORA, 'UTC');
      assert.equal(item.proximaEjecucion, null, cron);
      assert.equal('frecuencia' in item, false, cron);
    }
  });
});

// ---- 1.7 and 1.8 available automations --------------------------------------------

describe('proyectarDisponibles — what the client can still turn on', () => {
  const FISICO = { id: 'p-1', automatizacion: 'stock-fisico' };
  const PRODUCIBLE = { id: 'p-2', automatizacion: 'stock-producible' };

  test('1.7 a template with an active automation is not available', () => {
    const lista = proyectarDisponibles([FISICO, PRODUCIBLE], new Set(['p-1']));
    assert.deepEqual(lista, [copyDe('stock-producible')]);
  });

  test('1.7 a template with only a paused automation is available (its id is not active)', () => {
    assert.equal(proyectarDisponibles([FISICO], new Set()).length, 1);
    assert.equal(proyectarDisponibles([FISICO], new Set(['p-9'])).length, 1);
  });

  test('1.7 a tenant without automations sees every mapped template', () => {
    assert.equal(proyectarDisponibles([FISICO, PRODUCIBLE], new Set()).length, 2);
  });

  test('1.7 a template without business copy is hidden', () => {
    const lista = proyectarDisponibles(
      [{ id: 'p-3', automatizacion: 'reporte-semanal' }, FISICO],
      new Set(),
    );
    assert.deepEqual(lista, [copyDe('stock-fisico')]);
  });

  test('1.7 order is the copy map order, whatever the input order', () => {
    const lista = proyectarDisponibles([PRODUCIBLE, FISICO], new Set());
    assert.deepEqual(
      lista.map((i) => i.titulo),
      ['Aviso de stock bajo', 'Aviso de productos que ya casi no podés armar'],
    );
  });

  test('1.7 items carry only titulo and descripcion', () => {
    for (const item of proyectarDisponibles([FISICO, PRODUCIBLE], new Set())) {
      assert.deepEqual(Object.keys(item).sort(), ['descripcion', 'titulo']);
    }
  });

  test('1.8 two templates with the same slug yield a single entry', () => {
    const lista = proyectarDisponibles(
      [
        { id: 'p-8', automatizacion: 'stock-fisico' },
        { id: 'p-7', automatizacion: 'stock-fisico' },
      ],
      new Set(),
    );
    assert.deepEqual(lista, [copyDe('stock-fisico')]);
  });

  test('1.8 a slug with an active template is hidden even if a twin template is not active', () => {
    const lista = proyectarDisponibles(
      [
        { id: 'p-7', automatizacion: 'stock-fisico' },
        { id: 'p-8', automatizacion: 'stock-fisico' },
        PRODUCIBLE,
      ],
      new Set(['p-7']),
    );
    assert.deepEqual(lista, [copyDe('stock-producible')]);
  });
});

// ---- 1.9 glossary scan --------------------------------------------------------------

describe('glosario — no technical term reaches the client copy', () => {
  const PROHIBIDOS = [
    'tenant',
    'cron',
    'sql',
    'consulta',
    'query',
    'ejecución',
    'réplica',
    'parámetro',
    'timeout',
    'plantilla',
  ];

  test('1.9 the copy map, the fallback and every frequency text are clean', () => {
    const textos: string[] = [];
    for (const { titulo, descripcion } of [...COPY_NEGOCIO.values(), COPY_NEUTRO]) {
      textos.push(titulo, descripcion);
    }
    for (const cron of ['30 8 * * *', '0 9 * * 1-5', '0 18 * * 1-6']) {
      textos.push(frecuenciaDeCron(cron) as string);
    }
    assert.equal(textos.length, 9);
    for (const texto of textos) {
      for (const termino of PROHIBIDOS) {
        assert.ok(!texto.toLowerCase().includes(termino), `"${termino}" en "${texto}"`);
      }
    }
  });
});

// ---- 2.x route against a live PostgreSQL target (CH-22b PR2) -------------------------

/** Same target and variables as `src/panel-auth.test.ts` (see `src/aislamiento.test.ts`). */
const objetivo = {
  host: process.env.TEST_DB_HOST ?? 'localhost',
  port: Number(process.env.TEST_DB_PORT ?? '5432'),
  user: process.env.TEST_DB_USER ?? 'zerodashboard',
  password: process.env.TEST_DB_PASSWORD ?? 'change-me',
  database: process.env.TEST_DB_NAME ?? 'zerodashboard',
};
const databaseUrl =
  `postgresql://${encodeURIComponent(objetivo.user)}:${encodeURIComponent(objetivo.password)}` +
  `@${objetivo.host}:${objetivo.port}/${objetivo.database}`;

function esAlcanzable(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const cerrar = (alcanzable: boolean): void => {
      socket.destroy();
      resolve(alcanzable);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => cerrar(true));
    socket.once('timeout', () => cerrar(false));
    socket.once('error', () => cerrar(false));
  });
}

const alcanzable = await esAlcanzable(objetivo.host, objetivo.port, 1000);
const motivoSkip =
  `no PostgreSQL server at ${objetivo.host}:${objetivo.port} — ` +
  'bring up the Compose db service and set TEST_DB_* (see src/aislamiento.test.ts)';

interface CuerpoAutomatizaciones {
  activas: Array<Record<string, unknown> & { titulo: string; estado: string }>;
  disponibles: Array<{ titulo: string; descripcion: string }>;
  zonaHoraria: string;
  truncado: boolean;
}

/** Every object key of a parsed body, at any depth. */
function clavesDe(valor: unknown, acumuladas = new Set<string>()): Set<string> {
  if (Array.isArray(valor)) {
    valor.forEach((v) => clavesDe(v, acumuladas));
  } else if (typeof valor === 'object' && valor !== null) {
    for (const [clave, interior] of Object.entries(valor)) {
      acumuladas.add(clave);
      clavesDe(interior, acumuladas);
    }
  }
  return acumuladas;
}

describe(
  'GET /api/panel/automatizaciones — live PostgreSQL target (CH-22b PR2)',
  { skip: alcanzable ? false : motivoSkip },
  () => {
    const marca = `CH-22b ${Date.now()}`;
    const SQL_SECRETO = `SELECT secreto_${Date.now()} FROM v_producto`;
    const NOMBRE_PLANTILLA = `${marca} plantilla interna`;
    const RELOJ = new Date('2026-10-07T10:00:00Z');
    let db!: PrismaClient;
    let app!: FastifyInstance;
    let fisico!: string;
    let producible!: string;
    let noMapeada!: string;
    const tenantIds: string[] = [];
    const plantillaIds: string[] = [];
    const apps: FastifyInstance[] = [];

    async function montarApp(zona: string, reloj?: () => Date): Promise<FastifyInstance> {
      const instancia = Fastify({ logger: false });
      const aislado = extenderConAislamiento(db);
      registrarContextoTenant(instancia, aislado);
      registerPanelAutomatizacionesRoutes(instancia, aislado, zona, reloj);
      apps.push(instancia);
      await instancia.ready();
      return instancia;
    }

    before(async () => {
      db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
      app = await montarApp('UTC');
      const plantilla = async (automatizacion: string): Promise<string> => {
        const fila = await db.plantilla.create({
          data: {
            nombre: NOMBRE_PLANTILLA,
            sql: SQL_SECRETO,
            entidades: ['producto'],
            automatizacion,
            formato: 'correo-html',
            toleranciaFrescuraMinutos: 30,
          },
        });
        plantillaIds.push(fila.id);
        return fila.id;
      };
      fisico = await plantilla('stock-fisico');
      producible = await plantilla('stock-producible');
      noMapeada = await plantilla(`ch22b-sin-copy-${Date.now()}`);
    });

    after(async () => {
      if (tenantIds.length > 0) {
        const donde = { tenantId: { in: tenantIds } };
        await db.ejecucion.deleteMany({ where: donde });
        await db.automatizacion.deleteMany({ where: donde });
        await db.conexion.deleteMany({ where: donde });
        await db.usuario.deleteMany({ where: donde });
        await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
      }
      await db.plantilla.deleteMany({ where: { id: { in: plantillaIds } } });
      await db.$disconnect();
      await Promise.all(apps.map((a) => a.close()));
    });

    interface Negocio {
      tenantId: string;
      conexionId: string;
      cookie: { cookie: string };
    }

    /** One tenant, one user, one connection and one live session cookie. */
    async function negocio(etiqueta: string, tenantActivo = true): Promise<Negocio> {
      const tenant = await db.tenant.create({
        data: { nombre: `${marca} ${etiqueta}`, activo: tenantActivo },
      });
      tenantIds.push(tenant.id);
      const usuario = await db.usuario.create({
        data: { tenantId: tenant.id, correo: `${tenant.id}@prueba.test`, claveHash: 'x', activo: true },
      });
      const conexion = await db.conexion.create({
        data: {
          tenantId: tenant.id,
          nombre: 'Replica',
          motor: 'postgres',
          host: 'localhost',
          puerto: 5432,
          baseDeDatos: 'x',
          usuarioDb: 'x',
          credencial: 'x',
        },
      });
      const { tokenPlano, tokenHash } = generarTokenSesion();
      await db.sesionPanel.create({
        data: {
          tokenHash,
          usuarioId: usuario.id,
          tenantId: tenant.id,
          expiraEn: new Date(Date.now() + 3_600_000),
        },
      });
      return {
        tenantId: tenant.id,
        conexionId: conexion.id,
        cookie: { cookie: `zd_panel_session=${tokenPlano}` },
      };
    }

    async function automatizacion(
      n: Negocio,
      plantillaId: string,
      extra: { cron?: string; activo?: boolean; creadaEn?: string; valores?: object } = {},
    ): Promise<string> {
      const fila = await db.automatizacion.create({
        data: {
          tenantId: n.tenantId,
          plantillaId,
          conexionId: n.conexionId,
          cron: extra.cron ?? '0 8 * * *',
          activo: extra.activo ?? true,
          ...(extra.creadaEn === undefined ? {} : { creadaEn: new Date(extra.creadaEn) }),
          ...(extra.valores === undefined ? {} : { valores: extra.valores }),
        },
      });
      return fila.id;
    }

    async function ejecucion(
      n: Negocio,
      automatizacionId: string,
      estado: string,
      iniciadaEn: string,
      extra: { error?: string; codigoError?: string } = {},
    ): Promise<void> {
      await db.ejecucion.create({
        data: {
          tenantId: n.tenantId,
          automatizacionId,
          estado,
          iniciadaEn: new Date(iniciadaEn),
          finalizadaEn: estado === 'en-curso' ? null : new Date(iniciadaEn),
          ...extra,
        },
      });
    }

    async function leer(n: Negocio, instancia: FastifyInstance = app) {
      const respuesta = await instancia.inject({
        method: 'GET',
        url: '/api/panel/automatizaciones',
        headers: n.cookie,
      });
      return { respuesta, cuerpo: respuesta.json() as CuerpoAutomatizaciones };
    }

    test('2.1 a tenant without automations answers 200, the exact keys and every mapped template', async () => {
      const { respuesta, cuerpo } = await leer(await negocio('vacio'));
      assert.equal(respuesta.statusCode, 200, respuesta.body);
      assert.deepEqual(Object.keys(cuerpo).sort(), ['activas', 'disponibles', 'truncado', 'zonaHoraria']);
      assert.deepEqual(cuerpo.activas, []);
      assert.equal(cuerpo.truncado, false);
      assert.equal(cuerpo.zonaHoraria, 'UTC');
      assert.deepEqual(cuerpo.disponibles, [...COPY_NEGOCIO.values()]);
    });

    test('2.2 the session guard answers 401 without a cookie or with an unknown token', async () => {
      const sin = await app.inject({ method: 'GET', url: '/api/panel/automatizaciones' });
      assert.equal(sin.statusCode, 401, sin.body);
      assert.deepEqual(sin.json(), { error: 'sesion-invalida' });
      const falso = await app.inject({
        method: 'GET',
        url: '/api/panel/automatizaciones',
        headers: { cookie: 'zd_panel_session=no-existe' },
      });
      assert.equal(falso.statusCode, 401, falso.body);
      assert.deepEqual(falso.json(), { error: 'sesion-invalida' });
    });

    test('2.2 an expired session answers 401 sesion-expirada and no data', async () => {
      const n = await negocio('expirado');
      await db.sesionPanel.updateMany({
        where: { tenantId: n.tenantId },
        data: { expiraEn: new Date(Date.now() - 60_000) },
      });
      const { respuesta } = await leer(n);
      assert.equal(respuesta.statusCode, 401, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'sesion-expirada' });
    });

    test('2.2 a deactivated tenant answers 409 tenant-desactivado and no automation data', async () => {
      const n = await negocio('muerto', false);
      await automatizacion(n, fisico);
      const { respuesta } = await leer(n);
      assert.equal(respuesta.statusCode, 409, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'tenant-desactivado' });
    });

    test('2.3 a valid cookie with no X-Tenant-Id answers 200, not 400', async () => {
      const n = await negocio('sin-cabecera');
      const respuesta = await app.inject({
        method: 'GET',
        url: '/api/panel/automatizaciones',
        headers: n.cookie,
      });
      assert.equal(respuesta.statusCode, 200, respuesta.body);
    });

    test('2.6 ultimaEjecucion: none and only en-curso are null; the latest finished one wins', async () => {
      const n = await negocio('ultima');
      await automatizacion(n, fisico, { creadaEn: '2026-01-03T00:00:00Z' });
      const soloCurso = await automatizacion(n, producible, { creadaEn: '2026-01-02T00:00:00Z' });
      const mixta = await automatizacion(n, noMapeada, { creadaEn: '2026-01-01T00:00:00Z' });
      await ejecucion(n, soloCurso, 'en-curso', '2026-10-07T09:00:00Z');
      await ejecucion(n, mixta, 'ok', '2026-10-07T08:00:00Z');
      await ejecucion(n, mixta, 'en-curso', '2026-10-07T09:00:00Z');
      const { cuerpo } = await leer(n);
      assert.deepEqual(
        cuerpo.activas.map((a) => a.ultimaEjecucion),
        [null, null, { fecha: '2026-10-07T08:00:00.000Z', resultado: 'completada' }],
      );
    });

    test('2.6 each automation reports its own latest; a failure is no-realizada with no error text', async () => {
      const n = await negocio('propias');
      const uno = await automatizacion(n, fisico, { creadaEn: '2026-01-02T00:00:00Z' });
      const dos = await automatizacion(n, producible, { creadaEn: '2026-01-01T00:00:00Z' });
      await ejecucion(n, uno, 'ok', '2026-10-06T08:00:00Z');
      await ejecucion(n, uno, 'fallo', '2026-10-07T08:00:00Z', { error: 'replica-caida', codigoError: '08006' });
      await ejecucion(n, dos, 'ok', '2026-10-05T08:00:00Z');
      const { respuesta, cuerpo } = await leer(n);
      assert.deepEqual(
        cuerpo.activas.map((a) => [a.estado, a.ultimaEjecucion]),
        [
          ['con_falla', { fecha: '2026-10-07T08:00:00.000Z', resultado: 'no-realizada' }],
          ['activa', { fecha: '2026-10-05T08:00:00.000Z', resultado: 'completada' }],
        ],
      );
      assert.ok(!respuesta.body.includes('replica-caida') && !respuesta.body.includes('08006'));
    });

    test('2.6 a paused automation is listed as pausada with proximaEjecucion null', async () => {
      const n = await negocio('pausada');
      await automatizacion(n, fisico, { activo: false });
      const { cuerpo } = await leer(n);
      assert.equal(cuerpo.activas.length, 1);
      assert.equal(cuerpo.activas[0]?.estado, 'pausada');
      assert.equal(cuerpo.activas[0]?.proximaEjecucion, null);
    });

    test('2.6a active automation with omitida becomes con_falla and paused stays pausada', async () => {
      const n = await negocio('falla-omitida');
      const activa = await automatizacion(n, fisico, { creadaEn: '2026-01-02T00:00:00Z' });
      const pausada = await automatizacion(n, producible, { activo: false, creadaEn: '2026-01-01T00:00:00Z' });
      await ejecucion(n, activa, 'omitida', '2026-10-07T08:00:00Z');
      await ejecucion(n, pausada, 'fallo', '2026-10-07T08:00:00Z');
      const { cuerpo } = await leer(n);
      assert.deepEqual(
        cuerpo.activas.map((a) => [a.estado, (a as any).ultimaEjecucion?.resultado]),
        [
          ['con_falla', 'no-realizada'],
          ['pausada', 'no-realizada'],
        ],
      );
    });

    test('2.7 an active automation hides its template; a paused-only one does not', async () => {
      const activa = await negocio('oculta');
      await automatizacion(activa, fisico);
      assert.deepEqual((await leer(activa)).cuerpo.disponibles, [COPY_NEGOCIO.get('stock-producible')]);

      const pausada = await negocio('solo-pausada');
      await automatizacion(pausada, fisico, { activo: false });
      assert.deepEqual((await leer(pausada)).cuerpo.disponibles, [...COPY_NEGOCIO.values()]);
    });

    test('2.7 an unmapped slug is never offered, and an existing automation of it uses the fallback', async () => {
      const n = await negocio('sin-copy');
      await automatizacion(n, noMapeada);
      const { respuesta, cuerpo } = await leer(n);
      assert.equal(cuerpo.activas[0]?.titulo, COPY_NEUTRO.titulo);
      assert.equal(cuerpo.activas[0]?.descripcion, COPY_NEUTRO.descripcion);
      assert.ok(!respuesta.body.includes(NOMBRE_PLANTILLA));
      assert.equal(cuerpo.disponibles.length, COPY_NEGOCIO.size);
    });

    test('2.8 the injected clock and zone fix proximaEjecucion', async () => {
      const n = await negocio('reloj');
      await automatizacion(n, fisico, { cron: '0 8 * * *' });
      const utc = await montarApp('UTC', () => RELOJ);
      const buenosAires = await montarApp('America/Argentina/Buenos_Aires', () => RELOJ);
      assert.equal((await leer(n, utc)).cuerpo.activas[0]?.proximaEjecucion, '2026-10-08T08:00:00.000Z');
      const ba = await leer(n, buenosAires);
      assert.equal(ba.cuerpo.activas[0]?.proximaEjecucion, '2026-10-07T11:00:00.000Z');
      assert.equal(ba.cuerpo.zonaHoraria, 'America/Argentina/Buenos_Aires');
    });

    test('2.9 a stored invalid cron still answers 200 with proximaEjecucion null and no frecuencia', async () => {
      const n = await negocio('cron-roto');
      await automatizacion(n, fisico, { cron: 'esto no es un cron', creadaEn: '2026-01-02T00:00:00Z' });
      await automatizacion(n, producible, { cron: '30 9 * * 1-5', creadaEn: '2026-01-01T00:00:00Z' });
      const { respuesta, cuerpo } = await leer(n);
      assert.equal(respuesta.statusCode, 200, respuesta.body);
      assert.equal(cuerpo.activas[0]?.proximaEjecucion, null);
      assert.ok(!('frecuencia' in (cuerpo.activas[0] ?? {})));
      assert.equal(cuerpo.activas[1]?.frecuencia, 'De lunes a viernes a las 09:30');
      assert.equal(typeof cuerpo.activas[1]?.proximaEjecucion, 'string');
    });

    test('2.10 the body carries only allow-listed keys and none of the stored internals', async () => {
      const n = await negocio('prohibidas');
      const id = await automatizacion(n, fisico, { valores: { umbral: 7 }, cron: '*/15 * * * *' });
      await ejecucion(n, id, 'fallo', '2026-10-07T08:00:00Z', { error: 'replica-caida', codigoError: '42P01' });
      const { respuesta, cuerpo } = await leer(n);
      const claves = clavesDe(cuerpo);
      for (const prohibida of ['tenantId', 'conexionId', 'valores', 'codigoError', 'error', 'sql', 'cron']) {
        assert.ok(!claves.has(prohibida), prohibida);
      }
      for (const texto of [SQL_SECRETO, '42P01', 'replica-caida', NOMBRE_PLANTILLA, n.tenantId, n.conexionId, '*/15']) {
        assert.ok(!respuesta.body.includes(texto), texto);
      }
      assert.deepEqual(
        Object.keys(cuerpo.activas[0] ?? {}).sort(),
        ['descripcion', 'estado', 'id', 'proximaEjecucion', 'titulo', 'ultimaEjecucion'],
      );
      assert.equal(cuerpo.activas[0]?.id, id);
      assert.deepEqual(Object.keys(cuerpo.disponibles[0] ?? {}).sort(), ['descripcion', 'titulo']);
    });

    test('2.11 at the limit is not truncated; one over is cut to the limit and disponibles is unaffected', async () => {
      const n = await negocio('limite');
      await db.automatizacion.createMany({
        data: Array.from({ length: LIMITE_LISTADO }, (_, i) => ({
          tenantId: n.tenantId,
          plantillaId: noMapeada,
          conexionId: n.conexionId,
          cron: '0 8 * * *',
          creadaEn: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
        })),
      });
      const justo = await leer(n);
      assert.equal(justo.cuerpo.activas.length, LIMITE_LISTADO);
      assert.equal(justo.cuerpo.truncado, false);

      await automatizacion(n, fisico, { creadaEn: '2025-01-01T00:00:00Z' });
      const exceso = await leer(n);
      assert.equal(exceso.cuerpo.activas.length, LIMITE_LISTADO);
      assert.equal(exceso.cuerpo.truncado, true);
      assert.deepEqual(
        exceso.cuerpo.disponibles,
        [COPY_NEGOCIO.get('stock-producible')],
        'the oldest (cut) automation still hides its template',
      );
    });
  },
);
