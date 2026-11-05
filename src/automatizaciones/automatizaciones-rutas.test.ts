import assert from 'node:assert/strict';
import net from 'node:net';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { extenderConAislamiento, type PrismaAislado } from '../aislamiento/aislamiento-prisma.js';
import { registrarContextoTenant } from '../aislamiento/contexto-tenant.js';
import {
  destinatariosDe,
  MAX_DESTINATARIOS,
  minimoFilasValido,
  registerAutomatizacionRoutes,
  resolverAjusteOperador,
} from './automatizaciones-rutas.js';
import { proximaEjecucion } from './automatizaciones.js';

/**
 * CH-13 units 3 and 5: create, list, get and deactivate an automation (tasks 3.1–3.5),
 * and list its runs (task 5.1). Every
 * check that answers before a database read runs against a client that throws on any
 * read; the rest run against a live PostgreSQL and skip when none is reachable.
 */

/** A client on which every model method throws, except the tenant lookup the hooks make. */
function clienteSoloTenant(tenant: { id: string; nombre: string; activo: boolean }): PrismaAislado {
  const modeloQueLanza = (modelo: string) =>
    new Proxy({}, {
      get: (_objetivo, metodo) => async () => {
        throw new Error(`la ruta leyó ${modelo}.${String(metodo)} antes de tiempo`);
      },
    });
  return new Proxy({}, {
    get: (_objetivo, modelo) =>
      modelo === 'tenant' ? { findUnique: async () => tenant } : modeloQueLanza(String(modelo)),
  }) as PrismaAislado;
}

test('CH-41 destinatariosDe trims spaces and tabs only and keeps the order given', () => {
  assert.deepEqual(destinatariosDe([' \t ops@example.com \t', 'b@example.com']), {
    ok: true,
    lista: ['ops@example.com', 'b@example.com'],
  });
  assert.deepEqual(destinatariosDe(['b@example.com', 'a@example.com']), { ok: true, lista: ['b@example.com', 'a@example.com'] });
});

test('CH-41 destinatariosDe keeps a CR or LF in, so the second element of this list is refused by position', () => {
  assert.deepEqual(destinatariosDe(['a@example.com', 'b@example.com\r\n']), { ok: false, indices: [1], excede: false });
  assert.deepEqual(destinatariosDe(['a@example.com\r\nBcc: b@example.com']), { ok: false, indices: [0], excede: false });
});

test('CH-41 destinatariosDe refuses a non-string element and an element holding several addresses, naming every position', () => {
  assert.deepEqual(destinatariosDe(['a@example.com', 3, null, '', '   ', 'a@b.com, c@d.com', 'a@b.com;c@d.com']), {
    ok: false,
    indices: [1, 2, 3, 4, 5, 6],
    excede: false,
  });
});

test('CH-41 destinatariosDe names positions as given, before removing duplicates', () => {
  assert.deepEqual(destinatariosDe(['a@example.com', 'A@example.com', 'no-es-un-correo']), {
    ok: false,
    indices: [2],
    excede: false,
  });
});

test('CH-41 destinatariosDe removes duplicates ignoring case and keeps the first spelling', () => {
  assert.deepEqual(destinatariosDe(['Ops@x.com', 'b@x.com', 'ops@x.com']), { ok: true, lista: ['Ops@x.com', 'b@x.com'] });
  assert.deepEqual(destinatariosDe([' a@x.com', 'a@x.com\t']), { ok: true, lista: ['a@x.com'] });
});

test('CH-41 destinatariosDe caps the list at 5 after removing duplicates', () => {
  assert.equal(MAX_DESTINATARIOS, 5);
  const cinco = ['a@x.com', 'b@x.com', 'c@x.com', 'd@x.com', 'e@x.com'];
  assert.deepEqual(destinatariosDe(cinco), { ok: true, lista: cinco });
  assert.deepEqual(destinatariosDe([...cinco, 'f@x.com']), { ok: false, indices: [], excede: true });
  assert.deepEqual(destinatariosDe([...cinco, 'E@x.com']), { ok: true, lista: cinco });
  // A refused element is named before the cap is looked at.
  assert.deepEqual(destinatariosDe([...cinco, 'f@x.com', 'no']), { ok: false, indices: [6], excede: false });
});

test('CH-41 destinatariosDe accepts the empty list', () => {
  assert.deepEqual(destinatariosDe([]), { ok: true, lista: [] });
});

// ---- CH-33 (DEC-174): the operator's adjust, pure half ---------------------------------

/** CH-40: the row cap the routes are registered with in this file (the default, DEC-19). */
const TOPE = 200;

const PLANTILLA_AJUSTE = {
  sql: 'SELECT * FROM v_producto WHERE stock < :umbral AND nombre = :nombre',
  parametros: [{ nombre: 'umbral', tipo: 'numero' }, { nombre: 'nombre', tipo: 'texto' }],
};

test('CH-33 resolverAjusteOperador returns only the columns the body sent', () => {
  assert.deepEqual(resolverAjusteOperador({ cron: '30 6 * * 1-5' }, PLANTILLA_AJUSTE, 'UTC', TOPE), {
    ok: true,
    datos: { cron: '30 6 * * 1-5' },
  });
  assert.deepEqual(
    resolverAjusteOperador({ destinatarios: [' \tops@example.com ', 'dos@example.com'] }, PLANTILLA_AJUSTE, 'UTC', TOPE),
    { ok: true, datos: { destinatarios: ['ops@example.com', 'dos@example.com'] } },
  );
  // CH-41: [] is a valid list and empties it.
  assert.deepEqual(resolverAjusteOperador({ destinatarios: [] }, PLANTILLA_AJUSTE, 'UTC', TOPE), {
    ok: true,
    datos: { destinatarios: [] },
  });
  // The map is replaced as a whole, never merged with what was stored.
  assert.deepEqual(resolverAjusteOperador({ valores: { umbral: 10, nombre: 'x' } }, PLANTILLA_AJUSTE, 'UTC', TOPE), {
    ok: true,
    datos: { valores: { umbral: 10, nombre: 'x' } },
  });
});

test('CH-33 resolverAjusteOperador names every offender together, as the alta does', () => {
  const resolucion = resolverAjusteOperador(
    { cron: '@daily', destinatarios: ['ops@example.com', 'ops@example.com\r\nBcc: otro@example.com'], valores: { umbral: 'diez', nombre: 'x' } },
    PLANTILLA_AJUSTE,
    'UTC',
    TOPE,
  );
  assert.equal(resolucion.ok, false);
  if (resolucion.ok) return;
  assert.ok(resolucion.campos.includes('/cron'), JSON.stringify(resolucion.campos));
  assert.ok(resolucion.campos.includes('/destinatarios/1'), JSON.stringify(resolucion.campos));
  assert.ok(resolucion.campos.some((campo) => campo.startsWith('/valores')), JSON.stringify(resolucion.campos));
  assert.ok((resolucion.problemas ?? []).some((problema) => problema.parametro === 'umbral'));
});

test('CH-33 resolverAjusteOperador refuses an undeclared or a missing value and a bad recipient', () => {
  for (const valores of [{ umbral: 1, nombre: 'x', otro: 1 }, { umbral: 1 }]) {
    const resolucion = resolverAjusteOperador({ valores }, PLANTILLA_AJUSTE, 'UTC', TOPE);
    assert.equal(resolucion.ok, false, JSON.stringify(valores));
  }
  for (const elemento of ['', '   ', 'a@b.com, c@d.com']) {
    const resolucion = resolverAjusteOperador({ destinatarios: [elemento] }, PLANTILLA_AJUSTE, 'UTC', TOPE);
    assert.deepEqual(resolucion, { ok: false, campos: ['/destinatarios/0'] }, JSON.stringify(elemento));
  }
  // CH-41: the second element is the one named, and a list over the cap names the list.
  assert.deepEqual(resolverAjusteOperador({ destinatarios: ['a@b.com', 'c@d.com, e@f.com'] }, PLANTILLA_AJUSTE, 'UTC', TOPE), {
    ok: false,
    campos: ['/destinatarios/1'],
  });
  const seis = ['a@x.com', 'b@x.com', 'c@x.com', 'd@x.com', 'e@x.com', 'f@x.com'];
  assert.deepEqual(resolverAjusteOperador({ destinatarios: seis }, PLANTILLA_AJUSTE, 'UTC', TOPE), {
    ok: false,
    campos: ['/destinatarios'],
  });
});

test('CH-40 minimoFilasValido accepts an integer from 1 to the cap', () => {
  for (const valor of [1, 5, TOPE]) assert.equal(minimoFilasValido(valor, TOPE), true, String(valor));
  for (const valor of [0, -1, TOPE + 1, 2.5, Number.NaN]) assert.equal(minimoFilasValido(valor, TOPE), false, String(valor));
  assert.equal(minimoFilasValido(51, 50), false, 'the cap is the one handed in');
});

test('CH-40 resolverAjusteOperador takes the minimum with the alta rule and names it with the others', () => {
  assert.deepEqual(resolverAjusteOperador({ minimoFilas: 10 }, PLANTILLA_AJUSTE, 'UTC', TOPE), {
    ok: true,
    datos: { minimoFilas: 10 },
  });
  assert.deepEqual(resolverAjusteOperador({ minimoFilas: 51 }, PLANTILLA_AJUSTE, 'UTC', 50), {
    ok: false,
    campos: ['/minimoFilas'],
  });
  const ambos = resolverAjusteOperador({ cron: '@daily', minimoFilas: 0 }, PLANTILLA_AJUSTE, 'UTC', TOPE);
  assert.deepEqual(ambos, { ok: false, campos: ['/cron', '/minimoFilas'] });
});

test('CH-40 the routes bound the minimum by the cap they were registered with, before any read', async () => {
  const app = Fastify({ logger: false });
  const cliente = clienteSoloTenant({ id: 't-activo', nombre: 'Activo', activo: true });
  registrarContextoTenant(app, cliente);
  registerAutomatizacionRoutes(app, cliente, 'UTC', 50);
  await app.ready();
  try {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/automatizaciones',
      headers: { 'x-tenant-id': 't-activo' },
      payload: { plantillaId: 'p', conexionId: 'c', cron: '0 8 * * *', minimoFilas: 51 },
    });
    assert.equal(respuesta.statusCode, 400, respuesta.body);
    assert.deepEqual(respuesta.json().campos, ['/minimoFilas']);
  } finally {
    await app.close();
  }
});

describe('automation routes — tenant header, body shape and cron (CH-13 3.1, 3.3)', () => {
  let sinLecturas!: FastifyInstance;

  before(async () => {
    sinLecturas = Fastify({ logger: false });
    const cliente = clienteSoloTenant({ id: 't-activo', nombre: 'Activo', activo: true });
    registrarContextoTenant(sinLecturas, cliente);
    registerAutomatizacionRoutes(sinLecturas, cliente, 'UTC', TOPE);
    await sinLecturas.ready();
  });

  after(async () => {
    await sinLecturas.close();
  });

  test('3.1 every automation route exists and, with no x-tenant-id, answers 400 tenant-no-indicado', async () => {
    const rutas: ['GET' | 'POST' | 'PUT', string, string][] = [
      ['POST', '/automatizaciones', '/automatizaciones'],
      ['GET', '/automatizaciones', '/automatizaciones'],
      ['GET', '/automatizaciones/:id', '/automatizaciones/cualquiera'],
      ['POST', '/automatizaciones/:id/desactivar', '/automatizaciones/cualquiera/desactivar'],
      ['GET', '/automatizaciones/:id/ejecuciones', '/automatizaciones/cualquiera/ejecuciones'],
      // CH-33 (DEC-174): the adjust is scoped like every other automation route.
      ['PUT', '/automatizaciones/:id/ajustes', '/automatizaciones/cualquiera/ajustes'],
    ];
    for (const [method, patron, url] of rutas) {
      assert.equal(sinLecturas.hasRoute({ method, url: patron }), true, `${method} ${patron}`);
      const respuesta = await sinLecturas.inject({ method, url, payload: method === 'GET' ? undefined : {} });
      assert.equal(respuesta.statusCode, 400, `${method} ${url}: ${respuesta.body}`);
      assert.deepEqual(respuesta.json(), { error: 'tenant-no-indicado' });
    }
  });

  test('3.1/3.3 a malformed body or an invalid cron is rejected naming the field, before any read', async () => {
    const valido = { plantillaId: 'p', conexionId: 'c', cron: '0 8 * * *' };
    const casos: [Record<string, unknown>, string[]][] = [
      [{ plantillaId: 'p', conexionId: 'c' }, ['/cron']],
      // The tenant comes from the header context, never from the body (rule 2).
      [{ ...valido, tenantId: 'otro' }, ['/tenantId']],
      [{ ...valido, activo: false }, ['/activo']],
      [{ ...valido, valores: [] }, ['/valores']],
      [{ ...valido, cron: '@daily' }, ['/cron']],
      [{ ...valido, cron: '0 0 8 * * *' }, ['/cron']],
      [{ ...valido, cron: '61 * * * *' }, ['/cron']],
      // CH-14 6.1, CH-41: every element checked by `direccionValida` before any read, and
      // named by its position. CR/LF and separators are refused anywhere, edges included
      // (Threat Matrix).
      [{ ...valido, destinatarios: ['no-es-una-direccion'] }, ['/destinatarios/0']],
      [{ ...valido, destinatarios: ['ops@x.com', 'not-an-email'] }, ['/destinatarios/1']],
      [{ ...valido, destinatarios: ['ops@example.com\r\nBcc: otro@example.com'] }, ['/destinatarios/0']],
      [{ ...valido, destinatarios: ['a@example.com', 'ops@example.com\r\n'] }, ['/destinatarios/1']],
      [{ ...valido, destinatarios: ['ops@example.com, otro@example.com'] }, ['/destinatarios/0']],
      [{ ...valido, destinatarios: ['ops@example.com;otro@example.com'] }, ['/destinatarios/0']],
      [{ ...valido, destinatarios: [''] }, ['/destinatarios/0']],
      [{ ...valido, destinatarios: ['   '] }, ['/destinatarios/0']],
      [{ ...valido, destinatarios: [3] }, ['/destinatarios/0']],
      [{ ...valido, destinatarios: ['a@example.com', null, 'x'] }, ['/destinatarios/1', '/destinatarios/2']],
      [{ ...valido, destinatarios: [`${'a'.repeat(250)}@example.com`] }, ['/destinatarios/0']],
      // CH-41: over the cap after removing duplicates; the old single key is no longer a key.
      [{ ...valido, destinatarios: ['a@x.com', 'b@x.com', 'c@x.com', 'd@x.com', 'e@x.com', 'f@x.com'] }, ['/destinatarios']],
      [{ ...valido, destinatario: 'ops@example.com' }, ['/destinatario']],
      [{ ...valido, destinatarios: { 0: 'a@x.com' } }, ['/destinatarios']],
      // CH-40: an integer from 1 to the row cap, refused before any read.
      [{ ...valido, minimoFilas: 0 }, ['/minimoFilas']],
      [{ ...valido, minimoFilas: -3 }, ['/minimoFilas']],
      [{ ...valido, minimoFilas: 2.5 }, ['/minimoFilas']],
      [{ ...valido, minimoFilas: 'cinco' }, ['/minimoFilas']],
      [{ ...valido, minimoFilas: null }, ['/minimoFilas']],
      [{ ...valido, minimoFilas: TOPE + 1 }, ['/minimoFilas']],
    ];
    for (const [payload, campos] of casos) {
      const respuesta = await sinLecturas.inject({
        method: 'POST',
        url: '/automatizaciones',
        headers: { 'x-tenant-id': 't-activo' },
        payload,
      });
      assert.equal(respuesta.statusCode, 400, `${JSON.stringify(payload)}: ${respuesta.body}`);
      assert.deepEqual(respuesta.json().campos.sort(), [...campos].sort());
    }
  });

  test('CH-33 an adjust body that is empty or names anything but valores, cron, destinatarios and minimoFilas is a 400 before any read', async () => {
    const casos: [Record<string, unknown>, string][] = [
      [{}, ''],
      [{ plantillaId: 'p' }, '/plantillaId'],
      [{ conexionId: 'c' }, '/conexionId'],
      [{ activo: true }, '/activo'],
      [{ tenantId: 'otro' }, '/tenantId'],
      [{ cron: '0 8 * * *', id: 'otra' }, '/id'],
      [{ valores: [] }, '/valores'],
      // CH-41: the former single key is refused, never silently dropped.
      [{ destinatario: 'a@example.com' }, '/destinatario'],
      [{ destinatario: null }, '/destinatario'],
      [{ cron: '0 8 * * *', destinatario: 'a@example.com' }, '/destinatario'],
      // CH-40: the schema refuses a non-integer or a minimum below 1 before the row is read.
      [{ minimoFilas: 0 }, '/minimoFilas'],
      [{ minimoFilas: 2.5 }, '/minimoFilas'],
    ];
    for (const [payload, campo] of casos) {
      const respuesta = await sinLecturas.inject({
        method: 'PUT',
        url: '/automatizaciones/cualquiera/ajustes',
        headers: { 'x-tenant-id': 't-activo' },
        payload,
      });
      assert.equal(respuesta.statusCode, 400, `${JSON.stringify(payload)}: ${respuesta.body}`);
      assert.equal(respuesta.json().error, 'solicitud-invalida');
      if (campo !== '') assert.ok(respuesta.json().campos.includes(campo), `${JSON.stringify(payload)}: ${respuesta.body}`);
    }
  });
});

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

const motivoSkip: string | false = (await esAlcanzable(objetivo.host, objetivo.port, 1000))
  ? false
  : `no PostgreSQL server at ${objetivo.host}:${objetivo.port} — set TEST_DB_*`;

describe('automation routes — create, list, get, deactivate, runs (CH-13 3.2, 3.4, 3.5, 5.1)', { skip: motivoSkip }, () => {
  let app!: FastifyInstance;
  /** The raw client: fixtures and cleanup only. The app gets the extended one. */
  let prisma!: PrismaClient;
  const marca = `CH-13 u3 ${Date.now()}`;
  let tenantA!: string;
  let tenantB!: string;
  let plantillaId!: string;
  let conexionA!: string;
  let conexionB!: string;

  async function conexion(tenantId: string): Promise<string> {
    const fila = await prisma.conexion.create({
      data: {
        tenantId,
        nombre: `${marca} conexion`,
        motor: 'postgres',
        host: '127.0.0.1',
        puerto: 1,
        baseDeDatos: 'nunca-se-disca',
        usuarioDb: 'nadie',
        credencial: 'nunca-se-descifra',
      },
    });
    return fila.id;
  }

  before(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    tenantA = (await prisma.tenant.create({ data: { nombre: `${marca} A` } })).id;
    tenantB = (await prisma.tenant.create({ data: { nombre: `${marca} B` } })).id;
    conexionA = await conexion(tenantA);
    conexionB = await conexion(tenantB);
    plantillaId = (
      await prisma.plantilla.create({
        data: {
          nombre: `${marca} plantilla`,
          sql: 'SELECT * FROM v_producto WHERE nombre = :nombre',
          parametros: [{ nombre: 'nombre', tipo: 'texto' }],
          entidades: ['producto'],
          automatizacion: 'stock-fisico',
          formato: 'correo-html',
          toleranciaFrescuraMinutos: 30,
        },
      })
    ).id;
    app = Fastify({ logger: false });
    const aislado = extenderConAislamiento(prisma);
    registrarContextoTenant(app, aislado);
    registerAutomatizacionRoutes(app, aislado, 'UTC', TOPE);
    await app.ready();
  });

  after(async () => {
    for (const tenantId of [tenantA, tenantB]) {
      if (tenantId === undefined) continue;
      await prisma.ejecucion.deleteMany({ where: { tenantId } });
      await prisma.automatizacion.deleteMany({ where: { tenantId } });
      await prisma.conexion.deleteMany({ where: { tenantId } });
      await prisma.tenant.delete({ where: { id: tenantId } });
    }
    await prisma.plantilla.deleteMany({ where: { nombre: { startsWith: marca } } });
    await prisma.$disconnect();
    await app.close();
  });

  function crear(payload: Record<string, unknown>, tenantId = tenantA) {
    return app.inject({ method: 'POST', url: '/automatizaciones', headers: { 'x-tenant-id': tenantId }, payload });
  }

  function pedir(method: 'GET' | 'POST', url: string, tenantId = tenantA) {
    return app.inject({ method, url, headers: { 'x-tenant-id': tenantId } });
  }

  const cuerpo = () => ({ plantillaId, conexionId: conexionA, valores: { nombre: 'x' }, cron: '0 8 * * 1-5' });

  test('3.2 a valid create persists activo: true, scoped to the header tenant', async () => {
    const respuesta = await crear(cuerpo());
    assert.equal(respuesta.statusCode, 201, respuesta.body);
    const { automatizacion } = respuesta.json();
    assert.equal(automatizacion.activo, true);
    assert.deepEqual(automatizacion.valores, { nombre: 'x' });
    const fila = await prisma.automatizacion.findUniqueOrThrow({ where: { id: automatizacion.id } });
    assert.equal(fila.tenantId, tenantA);
    assert.equal(fila.cron, '0 8 * * 1-5');
  });

  test('CH-21c R1 the 201 adds the first run and the zone; the automation itself is unchanged', async () => {
    const respuesta = await crear(cuerpo());
    assert.equal(respuesta.statusCode, 201, respuesta.body);
    const cuerpo201 = respuesta.json();
    assert.deepEqual(Object.keys(cuerpo201).sort(), ['automatizacion', 'proximaEjecucion', 'zonaHoraria']);
    assert.deepEqual(
      Object.keys(cuerpo201.automatizacion).sort(),
      ['activo', 'canal', 'conexionId', 'creadaEn', 'cron', 'destinatarios', 'id', 'minimoFilas', 'plantillaId', 'valores'],
    );
    const { creadaEn, cron } = cuerpo201.automatizacion;
    assert.equal(cuerpo201.proximaEjecucion, proximaEjecucion(cron, new Date(creadaEn), 'UTC').toISOString());
    assert.ok(new Date(cuerpo201.proximaEjecucion).getTime() > new Date(creadaEn).getTime());
    assert.equal(cuerpo201.zonaHoraria, 'UTC');
  });

  test('CH-41 a valid list persists trimmed, in order, and is returned by create and get', async () => {
    const respuesta = await crear({ ...cuerpo(), destinatarios: ['  ops@example.com ', 'duena@example.com\t'] });
    assert.equal(respuesta.statusCode, 201, respuesta.body);
    const { automatizacion } = respuesta.json();
    assert.deepEqual(automatizacion.destinatarios, ['ops@example.com', 'duena@example.com']);
    const fila = await prisma.automatizacion.findUniqueOrThrow({ where: { id: automatizacion.id } });
    assert.deepEqual(fila.destinatarios, ['ops@example.com', 'duena@example.com']);
    const obtenida = await pedir('GET', `/automatizaciones/${automatizacion.id}`);
    assert.deepEqual(obtenida.json().automatizacion.destinatarios, ['ops@example.com', 'duena@example.com']);
  });

  test('CH-41 without recipients the row persists an empty list', async () => {
    const respuesta = await crear(cuerpo());
    assert.equal(respuesta.statusCode, 201, respuesta.body);
    const { automatizacion } = respuesta.json();
    assert.deepEqual(automatizacion.destinatarios, []);
    const fila = await prisma.automatizacion.findUniqueOrThrow({ where: { id: automatizacion.id } });
    assert.deepEqual(fila.destinatarios, []);
  });

  test('CH-41 duplicates are kept once ignoring case, and five after removing a duplicate are accepted', async () => {
    const dup = await crear({ ...cuerpo(), destinatarios: ['Ops@x.com', 'b@x.com', 'ops@x.com'] });
    assert.equal(dup.statusCode, 201, dup.body);
    assert.deepEqual(dup.json().automatizacion.destinatarios, ['Ops@x.com', 'b@x.com']);

    const cinco = await crear({ ...cuerpo(), destinatarios: ['a@x.com', 'b@x.com', 'c@x.com', 'd@x.com', 'e@x.com', 'A@x.com'] });
    assert.equal(cinco.statusCode, 201, cinco.body);
    assert.equal(cinco.json().automatizacion.destinatarios.length, 5);
  });

  test('CH-41 an invalid second recipient or a sixth one is a 400 naming it; nothing persists', async () => {
    const antes = await prisma.automatizacion.count({ where: { tenantId: tenantA } });
    const invalida = await crear({ ...cuerpo(), destinatarios: ['ops@x.com', 'not-an-email'] });
    assert.equal(invalida.statusCode, 400, invalida.body);
    assert.deepEqual(invalida.json().campos, ['/destinatarios/1']);
    const seis = await crear({ ...cuerpo(), destinatarios: ['a@x.com', 'b@x.com', 'c@x.com', 'd@x.com', 'e@x.com', 'f@x.com'] });
    assert.equal(seis.statusCode, 400, seis.body);
    assert.deepEqual(seis.json().campos, ['/destinatarios']);
    assert.equal(await prisma.automatizacion.count({ where: { tenantId: tenantA } }), antes);
  });

  test('CH-41 the former destinatario key is refused on create, never silently dropped', async () => {
    const antes = await prisma.automatizacion.count({ where: { tenantId: tenantA } });
    const respuesta = await crear({ ...cuerpo(), destinatario: 'ops@example.com' });
    assert.equal(respuesta.statusCode, 400, respuesta.body);
    assert.ok(respuesta.json().campos.includes('/destinatario'), respuesta.body);
    assert.equal(await prisma.automatizacion.count({ where: { tenantId: tenantA } }), antes);
  });

  test('3.2 a missing or ill-typed parameter value is 400 naming it; nothing persists', async () => {
    const antes = await prisma.automatizacion.count({ where: { tenantId: tenantA } });
    for (const valores of [{}, { nombre: 3 }]) {
      const respuesta = await crear({ ...cuerpo(), valores });
      assert.equal(respuesta.statusCode, 400, respuesta.body);
      assert.deepEqual(respuesta.json().campos, ['/valores/nombre']);
    }
    assert.equal(await prisma.automatizacion.count({ where: { tenantId: tenantA } }), antes);
  });

  test("3.2 another tenant's connection, or an unknown template, is 404; nothing persists", async () => {
    // A foreign connection would be written under A, the header tenant; count A's rows only,
    // since other suites may write automations in parallel.
    const antes = await prisma.automatizacion.count({ where: { tenantId: tenantA } });
    const deB = await crear({ ...cuerpo(), conexionId: conexionB });
    assert.equal(deB.statusCode, 404, deB.body);
    assert.deepEqual(deB.json(), { error: 'conexion-no-encontrada' });
    const sinPlantilla = await crear({ ...cuerpo(), plantillaId: 'no-existe' });
    assert.equal(sinPlantilla.statusCode, 404, sinPlantilla.body);
    assert.deepEqual(sinPlantilla.json(), { error: 'plantilla-no-encontrada' });
    assert.equal(await prisma.automatizacion.count({ where: { tenantId: tenantA } }), antes);
  });

  test('3.4/3.5 list, get, deactivate once, and the deactivated row stays listed', async () => {
    const id = (await crear(cuerpo())).json().automatizacion.id as string;

    const obtenida = await pedir('GET', `/automatizaciones/${id}`);
    assert.equal(obtenida.statusCode, 200, obtenida.body);
    assert.equal(obtenida.json().automatizacion.plantillaId, plantillaId);
    assert.equal(obtenida.json().automatizacion.conexionId, conexionA);
    assert.deepEqual(obtenida.json().automatizacion.valores, { nombre: 'x' });

    const baja = await pedir('POST', `/automatizaciones/${id}/desactivar`);
    assert.equal(baja.statusCode, 200, baja.body);
    assert.equal(baja.json().automatizacion.activo, false);
    const repetida = await pedir('POST', `/automatizaciones/${id}/desactivar`);
    assert.equal(repetida.statusCode, 409, repetida.body);
    assert.deepEqual(repetida.json(), { error: 'automatizacion-desactivada' });

    const listado = await pedir('GET', '/automatizaciones');
    assert.equal(listado.statusCode, 200, listado.body);
    const fila = listado.json().automatizaciones.find((a: { id: string }) => a.id === id);
    assert.equal(fila?.activo, false);
    assert.equal('valores' in fila, false);
    // CH-14 6.2: the list stays minimal; the recipients are on the get only.
    assert.equal('destinatarios' in fila, false);
    assert.equal(listado.json().truncado, false);
    assert.deepEqual((await pedir('GET', '/automatizaciones', tenantB)).json().automatizaciones, []);
  });

  test('3.4/3.5 an unknown or foreign id is 404; no route edits, deletes or reactivates', async () => {
    const deA = (await crear(cuerpo())).json().automatizacion.id as string;
    for (const [method, url] of [
      ['GET', `/automatizaciones/${deA}`],
      ['POST', `/automatizaciones/${deA}/desactivar`],
      ['GET', '/automatizaciones/no-existe'],
      ['POST', '/automatizaciones/no-existe/desactivar'],
    ] as const) {
      const respuesta = await pedir(method, url, tenantB);
      assert.equal(respuesta.statusCode, 404, `${method} ${url}: ${respuesta.body}`);
      assert.deepEqual(respuesta.json(), { error: 'automatizacion-no-encontrada' });
    }
    assert.equal((await prisma.automatizacion.findUniqueOrThrow({ where: { id: deA } })).activo, true);
    for (const method of ['PUT', 'PATCH', 'DELETE'] as const) {
      assert.equal(app.hasRoute({ method, url: '/automatizaciones/:id' }), false);
    }
    assert.equal(app.hasRoute({ method: 'POST', url: '/automatizaciones/:id/activar' }), false);
  });

  test("5.1 an automation's runs are listed newest first, even deactivated; a foreign id is 404", async () => {
    const id = (await crear(cuerpo())).json().automatizacion.id as string;
    // Run rows are the scheduler's to write; here they are written directly, oldest first.
    const iniciadas = ['2021-03-01T10:00:00Z', '2021-03-02T10:00:00Z', '2021-03-03T10:00:00Z'];
    for (const [i, iniciada] of iniciadas.entries()) {
      await prisma.ejecucion.create({
        data: {
          tenantId: tenantA,
          automatizacionId: id,
          estado: i === 1 ? 'fallo' : 'ok',
          iniciadaEn: new Date(iniciada),
          finalizadaEn: new Date(new Date(iniciada).getTime() + 250),
          duracionMs: 250,
          filas: i === 1 ? null : 3,
          fase: i === 1 ? 'conexion' : 'ejecucion',
          error: i === 1 ? 'conexion' : null,
          // CH-14: the oldest run reads as a pre-CH-14 row (null outcome).
          notificacion: ['enviada', null, 'omitida-sin-filas'][i],
          // CH-17b: the middle run reads as a pre-migration row (null attempts, DEC-103).
          intentos: [1, null, 2][i],
          // CH-39: the oldest run fell back to the table; the middle one is a pre-CH-39 row (null);
          // the newest holds a value that is not an array of strings, which must read as null.
          ...(i === 0 ? { mensajeRespaldo: ['stock'] } : i === 2 ? { mensajeRespaldo: ['stock', 1] } : {}),
        },
      });
    }
    assert.equal((await pedir('POST', `/automatizaciones/${id}/desactivar`)).statusCode, 200);

    const propia = await pedir('GET', `/automatizaciones/${id}/ejecuciones`);
    assert.equal(propia.statusCode, 200, propia.body);
    const { ejecuciones, truncado } = propia.json();
    assert.equal(truncado, false);
    assert.deepEqual(
      ejecuciones.map((e: { iniciadaEn: string }) => e.iniciadaEn),
      iniciadas.map((i) => new Date(i).toISOString()).reverse(),
    );
    assert.deepEqual(
      { ...ejecuciones[1], id: undefined },
      {
        id: undefined,
        estado: 'fallo',
        iniciadaEn: '2021-03-02T10:00:00.000Z',
        finalizadaEn: '2021-03-02T10:00:00.250Z',
        duracionMs: 250,
        filas: null,
        corte: null,
        fase: 'conexion',
        error: 'conexion',
        codigoError: null,
        notificacion: null,
        canal: null,
        intentos: null,
        mensajeRespaldo: null,
      },
    );
    // CH-14 6.2: each run carries its notification outcome.
    assert.deepEqual(
      ejecuciones.map((e: { notificacion: string | null }) => e.notificacion),
      ['omitida-sin-filas', null, 'enviada'],
    );
    // CH-17b 3.1: each run carries its connection attempts; null stays null, never 1.
    assert.deepEqual(
      ejecuciones.map((e: { intentos: number | null }) => e.intentos),
      [2, null, 1],
    );
    // CH-39: each run carries the names its message lacked; null for none, and for a stored
    // value that is not an array of strings.
    assert.deepEqual(
      ejecuciones.map((e: { mensajeRespaldo: string[] | null }) => e.mensajeRespaldo),
      [null, null, ['stock']],
    );

    for (const url of [`/automatizaciones/${id}/ejecuciones`, '/automatizaciones/no-existe/ejecuciones']) {
      const ajena = await pedir('GET', url, tenantB);
      assert.equal(ajena.statusCode, 404, `${url}: ${ajena.body}`);
      assert.deepEqual(ajena.json(), { error: 'automatizacion-no-encontrada' });
    }
  });

  // ---- CH-33 (DEC-174): adjusting in place ------------------------------------------

  function ajustar(id: string, payload: Record<string, unknown>, tenantId = tenantA) {
    return app.inject({ method: 'PUT', url: `/automatizaciones/${id}/ajustes`, headers: { 'x-tenant-id': tenantId }, payload });
  }

  async function nueva(): Promise<string> {
    const respuesta = await crear({ ...cuerpo(), destinatarios: ['a@example.com'] });
    assert.equal(respuesta.statusCode, 201, respuesta.body);
    return respuesta.json().automatizacion.id as string;
  }

  test('CH-44 the channel defaults to correo, Telegram needs no link, and a stray value is refused', async () => {
    const porDefecto = await crear(cuerpo());
    assert.equal(porDefecto.statusCode, 201, porDefecto.body);
    assert.equal(porDefecto.json().automatizacion.canal, 'correo');

    const telegram = await crear({ ...cuerpo(), canal: 'telegram' });
    assert.equal(telegram.statusCode, 201, telegram.body);
    assert.equal(telegram.json().automatizacion.canal, 'telegram');

    const raro = await crear({ ...cuerpo(), canal: 'sms' });
    assert.equal(raro.statusCode, 400);
    assert.deepEqual(raro.json().campos, ['/canal']);
  });

  test('CH-44 an adjust switches the channel and keeps the recipients, and a stray value stores nothing', async () => {
    const id = await nueva();
    const aTelegram = await ajustar(id, { canal: 'telegram' });
    assert.equal(aTelegram.statusCode, 200, aTelegram.body);
    assert.equal(aTelegram.json().automatizacion.canal, 'telegram');
    assert.deepEqual(aTelegram.json().automatizacion.destinatarios, ['a@example.com']);

    const raro = await ajustar(id, { canal: 'sms' });
    assert.equal(raro.statusCode, 400);
    assert.deepEqual(raro.json().campos, ['/canal']);

    const aCorreo = await ajustar(id, { canal: 'correo' });
    assert.equal(aCorreo.json().automatizacion.canal, 'correo');
    assert.deepEqual(aCorreo.json().automatizacion.destinatarios, ['a@example.com']);
  });

  test('CH-44 the runs listing carries each run\'s channel, and changing the channel leaves it alone', async () => {
    const id = await nueva();
    const inicio = new Date();
    await prisma.ejecucion.createMany({
      data: [
        { tenantId: tenantA, automatizacionId: id, estado: 'ok', iniciadaEn: inicio, canal: 'correo' },
        { tenantId: tenantA, automatizacionId: id, estado: 'ok', iniciadaEn: new Date(inicio.getTime() + 1000), canal: null },
      ],
    });
    await ajustar(id, { canal: 'telegram' });
    const respuesta = await pedir('GET', `/automatizaciones/${id}/ejecuciones`);
    assert.equal(respuesta.statusCode, 200, respuesta.body);
    assert.deepEqual(new Set(respuesta.json().ejecuciones.map((e: { canal: string | null }) => e.canal)), new Set(['correo', null]));
  });

  test('CH-33 an adjust changes only the sent columns, keeps the id and the runs, and reports the next run', async () => {
    const id = await nueva();
    await prisma.ejecucion.create({
      data: {
        tenantId: tenantA,
        automatizacionId: id,
        estado: 'ok',
        iniciadaEn: new Date(),
        finalizadaEn: new Date(),
        duracionMs: 1,
        filas: 0,
        fase: 'ejecucion',
      },
    });

    const respuesta = await ajustar(id, { cron: '30 6 * * 1-5', destinatarios: ['b@example.com', 'c@example.com'] });

    assert.equal(respuesta.statusCode, 200, respuesta.body);
    const cuerpo200 = respuesta.json();
    assert.deepEqual(Object.keys(cuerpo200).sort(), ['automatizacion', 'proximaEjecucion', 'zonaHoraria']);
    assert.equal(cuerpo200.automatizacion.id, id);
    assert.equal(cuerpo200.automatizacion.cron, '30 6 * * 1-5');
    assert.deepEqual(cuerpo200.automatizacion.destinatarios, ['b@example.com', 'c@example.com']);
    assert.deepEqual(cuerpo200.automatizacion.valores, { nombre: 'x' }, 'valores were not sent and did not change');
    assert.equal(cuerpo200.zonaHoraria, 'UTC');
    const proxima = new Date(cuerpo200.proximaEjecucion);
    assert.equal(proxima.getUTCHours(), 6);
    assert.equal(proxima.getUTCMinutes(), 30);
    const fila = await prisma.automatizacion.findUniqueOrThrow({ where: { id } });
    assert.equal(fila.plantillaId, plantillaId);
    assert.equal(fila.conexionId, conexionA);
    assert.equal(fila.activo, true);
    const ejecuciones = await pedir('GET', `/automatizaciones/${id}/ejecuciones`);
    assert.equal(ejecuciones.json().ejecuciones.length, 1, 'the run history stays under the same id');
  });

  test('CH-33 valores are checked against the stored template and replace the map; an empty list clears the recipients', async () => {
    const id = await nueva();

    const mal = await ajustar(id, { valores: { otro: 'y' } });
    assert.equal(mal.statusCode, 400, mal.body);
    assert.ok(mal.json().campos.some((campo: string) => campo.startsWith('/valores')), mal.body);
    assert.deepEqual((await prisma.automatizacion.findUniqueOrThrow({ where: { id } })).valores, { nombre: 'x' });

    const bien = await ajustar(id, { valores: { nombre: 'nuevo' }, destinatarios: [] });
    assert.equal(bien.statusCode, 200, bien.body);
    assert.deepEqual(bien.json().automatizacion.destinatarios, []);
    const fila = await prisma.automatizacion.findUniqueOrThrow({ where: { id } });
    assert.deepEqual(fila.valores, { nombre: 'nuevo' });
    assert.deepEqual(fila.destinatarios, []);
  });

  test('CH-41 an adjust replaces the list as a whole and removes duplicates ignoring case', async () => {
    const id = await nueva();
    const respuesta = await ajustar(id, { destinatarios: ['B@example.com', 'a@example.com', 'b@example.com'] });
    assert.equal(respuesta.statusCode, 200, respuesta.body);
    assert.deepEqual(respuesta.json().automatizacion.destinatarios, ['B@example.com', 'a@example.com']);
    assert.deepEqual((await prisma.automatizacion.findUniqueOrThrow({ where: { id } })).destinatarios, ['B@example.com', 'a@example.com']);
  });

  test('CH-41 the former destinatario key is refused on adjust and the row is unchanged', async () => {
    const id = await nueva();
    for (const payload of [{ destinatario: 'b@example.com' }, { destinatario: null }, { cron: '0 9 * * *', destinatario: 'b@example.com' }]) {
      const respuesta = await ajustar(id, payload);
      assert.equal(respuesta.statusCode, 400, `${JSON.stringify(payload)}: ${respuesta.body}`);
      assert.equal(respuesta.json().error, 'solicitud-invalida');
      assert.ok(respuesta.json().campos.includes('/destinatario'), respuesta.body);
    }
    const fila = await prisma.automatizacion.findUniqueOrThrow({ where: { id } });
    assert.equal(fila.cron, '0 8 * * 1-5');
    assert.deepEqual(fila.destinatarios, ['a@example.com']);
  });

  test("CH-41 another tenant's automation is 404 for a list adjust, and its row is unchanged", async () => {
    const id = await nueva();
    const respuesta = await ajustar(id, { destinatarios: ['intruso@example.com', 'otro@example.com'] }, tenantB);
    assert.equal(respuesta.statusCode, 404, respuesta.body);
    assert.deepEqual(respuesta.json(), { error: 'automatizacion-no-encontrada' });
    assert.deepEqual((await prisma.automatizacion.findUniqueOrThrow({ where: { id } })).destinatarios, ['a@example.com']);
  });

  test('CH-33 an invalid cron or recipients is a 400 naming it, and nothing is written', async () => {
    const id = await nueva();
    const casos: [Record<string, unknown>, string][] = [
      [{ cron: 'cada día' }, '/cron'],
      [{ destinatarios: ['a@b.com', 'c@d.com, e@f.com'] }, '/destinatarios/1'],
      [{ destinatarios: ['a@b.com', 3] }, '/destinatarios/1'],
      [{ destinatarios: ['a@x.com', 'b@x.com', 'c@x.com', 'd@x.com', 'e@x.com', 'f@x.com'] }, '/destinatarios'],
    ];
    for (const [payload, campo] of casos) {
      const respuesta = await ajustar(id, payload);
      assert.equal(respuesta.statusCode, 400, respuesta.body);
      assert.deepEqual(respuesta.json().campos, [campo]);
    }
    const fila = await prisma.automatizacion.findUniqueOrThrow({ where: { id } });
    assert.equal(fila.cron, '0 8 * * 1-5');
    assert.deepEqual(fila.destinatarios, ['a@example.com']);
  });

  // ---- CH-40 (DEC-186, DEC-193): the minimum rows ------------------------------------

  test('CH-40 a minimum persists and is returned by create and get; without one it is 1', async () => {
    const con = await crear({ ...cuerpo(), minimoFilas: 5 });
    assert.equal(con.statusCode, 201, con.body);
    const id = con.json().automatizacion.id as string;
    assert.equal(con.json().automatizacion.minimoFilas, 5);
    assert.equal((await prisma.automatizacion.findUniqueOrThrow({ where: { id } })).minimoFilas, 5);
    assert.equal((await pedir('GET', `/automatizaciones/${id}`)).json().automatizacion.minimoFilas, 5);

    const sin = await crear(cuerpo());
    assert.equal(sin.statusCode, 201, sin.body);
    assert.equal(sin.json().automatizacion.minimoFilas, 1);

    // A numeric string is its integer, as in every other integer body field.
    const texto = await crear({ ...cuerpo(), minimoFilas: '7' });
    assert.equal(texto.statusCode, 201, texto.body);
    assert.equal(texto.json().automatizacion.minimoFilas, 7);
  });

  test('CH-40 the cap itself is accepted; one above it is a 400 and nothing persists', async () => {
    assert.equal((await crear({ ...cuerpo(), minimoFilas: TOPE })).statusCode, 201);
    const antes = await prisma.automatizacion.count({ where: { tenantId: tenantA } });
    const respuesta = await crear({ ...cuerpo(), minimoFilas: TOPE + 1 });
    assert.equal(respuesta.statusCode, 400, respuesta.body);
    assert.deepEqual(respuesta.json().campos, ['/minimoFilas']);
    assert.equal(await prisma.automatizacion.count({ where: { tenantId: tenantA } }), antes);
  });

  test('CH-40 an adjust changes the minimum on the same row and keeps its runs', async () => {
    const id = await nueva();
    await prisma.ejecucion.create({
      data: {
        tenantId: tenantA,
        automatizacionId: id,
        estado: 'ok',
        iniciadaEn: new Date(),
        finalizadaEn: new Date(),
        duracionMs: 1,
        filas: 3,
        fase: 'ejecucion',
        notificacion: 'omitida-bajo-minimo',
      },
    });

    const respuesta = await ajustar(id, { minimoFilas: 10 });

    assert.equal(respuesta.statusCode, 200, respuesta.body);
    assert.equal(respuesta.json().automatizacion.minimoFilas, 10);
    const fila = await prisma.automatizacion.findUniqueOrThrow({ where: { id } });
    assert.equal(fila.minimoFilas, 10);
    assert.equal(fila.cron, '0 8 * * 1-5');
    assert.deepEqual(fila.destinatarios, ['a@example.com']);
    const { ejecuciones } = (await pedir('GET', `/automatizaciones/${id}/ejecuciones`)).json();
    assert.deepEqual(
      ejecuciones.map((e: { notificacion: string | null }) => e.notificacion),
      ['omitida-bajo-minimo'],
      'the run keeps its id and the listing carries the new outcome',
    );
  });

  test('CH-40 an adjust minimum out of range is a 400 naming it, and nothing is written', async () => {
    const id = await nueva();
    for (const minimoFilas of [0, TOPE + 1, 2.5]) {
      const respuesta = await ajustar(id, { minimoFilas });
      assert.equal(respuesta.statusCode, 400, `${minimoFilas}: ${respuesta.body}`);
      assert.deepEqual(respuesta.json().campos, ['/minimoFilas']);
    }
    assert.equal((await prisma.automatizacion.findUniqueOrThrow({ where: { id } })).minimoFilas, 1);
  });

  test("CH-40 another tenant's automation is 404 for a minimum adjust, and its row is unchanged", async () => {
    const id = await nueva();
    const respuesta = await ajustar(id, { minimoFilas: 10 }, tenantB);
    assert.equal(respuesta.statusCode, 404, respuesta.body);
    assert.deepEqual(respuesta.json(), { error: 'automatizacion-no-encontrada' });
    assert.equal((await prisma.automatizacion.findUniqueOrThrow({ where: { id } })).minimoFilas, 1);
  });

  test('CH-33 a deactivated automation answers 409, an unknown or foreign one 404, and neither is written', async () => {
    const id = await nueva();
    assert.equal((await pedir('POST', `/automatizaciones/${id}/desactivar`)).statusCode, 200);
    const desactivada = await ajustar(id, { cron: '0 9 * * *' });
    assert.equal(desactivada.statusCode, 409, desactivada.body);
    assert.deepEqual(desactivada.json(), { error: 'automatizacion-desactivada' });

    const activa = await nueva();
    const casos: [string, string][] = [[activa, tenantB], ['no-existe', tenantA]];
    for (const [objetivoId, tenantId] of casos) {
      const respuesta = await ajustar(objetivoId, { cron: '0 9 * * *' }, tenantId);
      assert.equal(respuesta.statusCode, 404, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'automatizacion-no-encontrada' });
    }
    assert.equal((await prisma.automatizacion.findUniqueOrThrow({ where: { id: activa } })).cron, '0 8 * * 1-5');
    assert.equal((await prisma.automatizacion.findUniqueOrThrow({ where: { id } })).cron, '0 8 * * 1-5');
  });
});
