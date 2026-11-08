import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '../generated/prisma/client.js';
import { extenderConAislamiento, type PrismaAislado } from '../aislamiento/aislamiento-prisma.js';
import { registrarContextoTenant } from '../aislamiento/contexto-tenant.js';
import { registrarGuardOperador } from '../consola/consola-auth.js';
import { alcanzable, databaseUrl, motivoSkip } from '../consola/consola-auth-apoyo.js';
import { LIMITE_LISTADO } from '../compartido/listados.js';
import { registerTableroRoutes } from '../tablero/tablero-rutas.js';
import { registerReporteRoutes, type UsoDeReportes } from './reportes-rutas.js';

/**
 * CH-45 (DEC-183, DEC-198) task 5.4: the report catalog's create, list, get and in-place
 * replace, and every refusal of the seven-step check order. No request here carries
 * `x-tenant-id`: the catalog is global and exempt by exact row, so every case below is also a
 * proof of that exemption.
 */

/** A body that passes every save-time check; each case overrides one field. */
const VALIDO = {
  nombre: 'CH-45 ventas por producto',
  titulo: 'Lo más vendido',
  sql: 'SELECT nombre AS producto, sum(total) AS total FROM v_producto GROUP BY 1',
  entidades: ['producto', 'pedido'],
  visualizacion: 'barras',
  columnas: [
    { rol: 'etiqueta', columna: 'producto', titulo: 'Producto' },
    { rol: 'valor', columna: 'total', titulo: 'Total vendido' },
  ],
  periodo: null,
  columnasPrueba: ['producto', 'total'],
};

/** The same report with a period on `:desde`. */
const CON_PERIODO = {
  ...VALIDO,
  sql: 'SELECT nombre AS producto, sum(total) AS total FROM v_producto WHERE fecha >= :desde GROUP BY 1',
  periodo: { parametro: 'desde', dias: [30, 7, 90] },
};

interface CuerpoRechazo {
  error: string;
  campos: string[];
  terminos?: string[];
  faltantes?: string[];
  problemas?: { parametro: string | null; motivo: string; campo: string }[];
}

/**
 * Signature pin: the registrar takes the `reporte` delegate and the use port (CH-46, DEC-199),
 * never the client. Checked by `tsc --noEmit`; never called.
 */
export function firmaSoloDelegado(app: FastifyInstance, cliente: PrismaAislado, uso: UsoDeReportes): void {
  // @ts-expect-error — the full client is not a `reporte` delegate.
  registerReporteRoutes(app, cliente, uso);
  registerReporteRoutes(app, cliente.reporte, uso);
}

/** Port stand-in for suites where no request may reach the use rule. */
const usoQueNuncaDebeConsultarse: UsoDeReportes = {
  enUso: async () => {
    throw new Error('un cuerpo rechazado consultó el uso');
  },
  reemplazarSiLibre: async () => {
    throw new Error('un cuerpo rechazado llegó a reemplazarSiLibre');
  },
};

/** The port as `src/app/rutas.ts` builds it, over the extended client. */
function usoDeReportes(aislado: PrismaAislado): UsoDeReportes {
  return {
    enUso: (id) => aislado.tablero.reporteEnUso(id),
    reemplazarSiLibre: (id, datos) => aislado.tablero.reemplazarReporteLibre(id, datos),
  };
}

/** Every method throws: a rejected body that reached the table fails the case loudly. */
const reportesQueNuncaDebenEscribirse = new Proxy({}, {
  get: (_objetivo, metodo) => async () => {
    throw new Error(`un cuerpo rechazado llegó a reporte.${String(metodo)}`);
  },
}) as PrismaAislado['reporte'];

describe('CH-45 report catalog — save-time refusals, in check order (DEC-198)', () => {
  let app!: FastifyInstance;

  before(async () => {
    app = Fastify({ logger: false });
    // The hooks get a client that throws too: an exempt route must not resolve a tenant.
    registrarContextoTenant(app, reportesQueNuncaDebenEscribirse as unknown as PrismaAislado);
    registerReporteRoutes(app, reportesQueNuncaDebenEscribirse, usoQueNuncaDebeConsultarse);
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  async function rechazar(cambios: Record<string, unknown>, quitar?: string, metodo: 'POST' | 'PUT' = 'POST') {
    const payload: Record<string, unknown> = { ...VALIDO, ...cambios };
    if (quitar !== undefined) delete payload[quitar];
    const respuesta = await app.inject({
      method: metodo,
      url: metodo === 'POST' ? '/reportes' : '/reportes/r-1',
      payload,
    });
    assert.equal(respuesta.statusCode, 400, respuesta.body);
    const cuerpo = respuesta.json() as CuerpoRechazo;
    assert.equal(cuerpo.error, 'solicitud-invalida');
    return cuerpo;
  }

  test('1. AJV: unknown keys, missing fields and values outside the lists name the field', async () => {
    assert.deepEqual((await rechazar({ visualizacion: 'torta' })).campos, ['/visualizacion']);
    assert.deepEqual((await rechazar({ tenantId: 'otro' })).campos, ['/tenantId']);
    assert.deepEqual((await rechazar({ parametros: [] })).campos, ['/parametros']);
    assert.deepEqual((await rechazar({}, 'titulo')).campos, ['/titulo']);
    assert.deepEqual((await rechazar({}, 'columnas')).campos, ['/columnas']);
    assert.deepEqual((await rechazar({ entidades: [] })).campos, ['/entidades']);
    assert.deepEqual((await rechazar({ entidades: ['producto', 'cliente'] })).campos, ['/entidades/1']);
    // Nested objects are strict too: an unknown key is refused, never stripped.
    assert.deepEqual((await rechazar({ periodo: { parametro: 'desde', dias: [7], hasta: 'x' } })).campos, ['/periodo/hasta']);
    assert.deepEqual(
      (await rechazar({ columnas: [{ rol: 'valor', columna: 'total', titulo: 'T', formato: 'x' }] })).campos,
      ['/columnas/0/formato'],
    );
    assert.deepEqual((await rechazar({ columnas: [{ rol: 'eje', columna: 'total', titulo: 'T' }] })).campos, ['/columnas/0/rol']);
    assert.deepEqual(
      (await rechazar({ columnas: [{ rol: 'valor', columna: 'c'.repeat(64), titulo: 'T' }] })).campos,
      ['/columnas/0/columna'],
    );
    assert.deepEqual(
      (await rechazar({ columnasPrueba: Array.from({ length: 201 }, (_, i) => `c${i}`) })).campos,
      ['/columnasPrueba'],
    );
  });

  test('2. the texts: caps after trimming and the glossary, with terminos', async () => {
    assert.deepEqual((await rechazar({ nombre: '   ' })).campos, ['/nombre']);
    assert.deepEqual((await rechazar({ nombre: 'n'.repeat(81) })).campos, ['/nombre']);
    assert.deepEqual((await rechazar({ titulo: '  ' })).campos, ['/titulo']);
    assert.deepEqual((await rechazar({ titulo: 't'.repeat(81) })).campos, ['/titulo']);
    assert.deepEqual((await rechazar({ descripcion: 'd'.repeat(201) })).campos, ['/descripcion']);
    const glosario = await rechazar({ titulo: 'Resultado de la consulta', descripcion: 'Por tenant' });
    assert.deepEqual(glosario.campos, ['/titulo', '/descripcion']);
    assert.deepEqual(glosario.terminos, ['consulta', 'tenant']);
  });

  test('3. the period: parametro by the DEC-49 rule, and dias', async () => {
    assert.deepEqual((await rechazar({ ...CON_PERIODO, periodo: { parametro: '1desde', dias: [7] } })).campos, [
      '/periodo/parametro',
    ]);
    for (const dias of [[7, 7], [0], [400], []]) {
      const cuerpo = await rechazar({ ...CON_PERIODO, periodo: { parametro: 'desde', dias } });
      assert.deepEqual(cuerpo.campos, ['/periodo/dias'], JSON.stringify(dias));
    }
  });

  test('4. the columns by role, then their titles', async () => {
    assert.deepEqual((await rechazar({ columnas: [{ rol: 'valor', columna: 'total', titulo: 'Total' }] })).campos, [
      '/columnas',
    ]);
    assert.deepEqual(
      (
        await rechazar({
          columnas: [
            { rol: 'etiqueta', columna: 'total', titulo: 'A' },
            { rol: 'valor', columna: 'total', titulo: 'B' },
          ],
        })
      ).campos,
      ['/columnas'],
    );
    assert.deepEqual((await rechazar({ visualizacion: 'tabla', columnas: [] })).campos, ['/columnas']);
    const titulo = await rechazar({
      columnas: [
        { rol: 'etiqueta', columna: 'producto', titulo: 'Producto' },
        { rol: 'valor', columna: 'total', titulo: 'Total de la query' },
      ],
    });
    assert.deepEqual(titulo.campos, ['/columnas/1/titulo']);
    assert.deepEqual(titulo.terminos, ['query']);
  });

  test('5. columnasPrueba: required, and every assigned column in it, with faltantes', async () => {
    assert.deepEqual((await rechazar({}, 'columnasPrueba')).campos, ['/columnasPrueba']);
    const faltan = await rechazar({ columnasPrueba: ['producto', 'unidades'] });
    assert.deepEqual(faltan.campos, ['/columnas']);
    assert.deepEqual(faltan.faltantes, ['total']);
  });

  test('6. a statement blank once sanitized', async () => {
    assert.deepEqual((await rechazar({ sql: '  ;  ' })).campos, ['/sql']);
  });

  test('7. the statement against the derived declaration: sin-declarar, sin-usar, $n', async () => {
    const sinDeclarar = await rechazar({ ...CON_PERIODO, sql: `${CON_PERIODO.sql} HAVING max(fecha) < :hasta` });
    assert.deepEqual(sinDeclarar.campos, ['/sql']);
    assert.deepEqual(sinDeclarar.problemas, [{ parametro: 'hasta', motivo: 'sin-declarar', campo: '/sql' }]);
    // A report with no period declares nothing, so any marker is undeclared.
    const sinPeriodo = await rechazar({ sql: 'SELECT 1 AS total, :desde AS producto' });
    assert.deepEqual(sinPeriodo.problemas, [{ parametro: 'desde', motivo: 'sin-declarar', campo: '/sql' }]);
    const sinUsar = await rechazar({ ...CON_PERIODO, sql: VALIDO.sql });
    assert.deepEqual(sinUsar.campos, ['/periodo/parametro']);
    assert.deepEqual(sinUsar.problemas, [{ parametro: 'desde', motivo: 'sin-usar', campo: '/periodo/parametro' }]);
    const posicional = await rechazar({ sql: 'SELECT $1 AS producto, 2 AS total' });
    assert.deepEqual(posicional.problemas, [{ parametro: '$1', motivo: 'posicional-a-mano', campo: '/sql' }]);
  });

  test('the first refusal wins: an AJV error hides a text error', async () => {
    assert.deepEqual((await rechazar({ visualizacion: 'torta', titulo: 'SQL' })).campos, ['/visualizacion']);
  });

  test('PUT runs the same checks before any read', async () => {
    assert.deepEqual((await rechazar({ visualizacion: 'torta' }, undefined, 'PUT')).campos, ['/visualizacion']);
    assert.deepEqual((await rechazar({}, 'columnasPrueba', 'PUT')).campos, ['/columnasPrueba']);
  });
});

describe('CH-45 report catalog — operator guard (DEC-152)', () => {
  let app!: FastifyInstance;

  before(async () => {
    app = Fastify({ logger: false });
    const cliente = reportesQueNuncaDebenEscribirse as unknown as PrismaAislado;
    registrarGuardOperador(app, cliente);
    registrarContextoTenant(app, cliente);
    registerReporteRoutes(app, reportesQueNuncaDebenEscribirse, usoQueNuncaDebeConsultarse);
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test('every catalog route without an operator session answers 401', async () => {
    for (const [method, url] of [
      ['GET', '/reportes'],
      ['GET', '/reportes/r-1'],
      ['POST', '/reportes'],
      ['PUT', '/reportes/r-1'],
    ] as const) {
      const respuesta = await app.inject({ method, url, payload: method === 'GET' ? undefined : VALIDO });
      assert.equal(respuesta.statusCode, 401, `${method} ${url}: ${respuesta.body}`);
    }
  });
});

describe('CH-45 report catalog — create, list, get, replace (DEC-68, DEC-198)', { skip: alcanzable ? false : motivoSkip }, () => {
  let app!: FastifyInstance;
  /** The raw client: fixtures and cleanup only. The app gets the extended one. */
  let prisma!: PrismaClient;
  const marca = `CH-45 rutas ${Date.now()}-${randomBytes(3).toString('hex')}`;
  let tenantId = '';

  before(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    const aislado = extenderConAislamiento(prisma);
    app = Fastify({ logger: false });
    registrarContextoTenant(app, aislado);
    registerReporteRoutes(app, aislado.reporte, usoDeReportes(aislado));
    await app.ready();
    tenantId = (await prisma.tenant.create({ data: { nombre: `${marca} tenant` } })).id;
  });

  after(async () => {
    await prisma.reporte.deleteMany({ where: { nombre: { startsWith: marca } } });
    if (tenantId !== '') await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
    await app.close();
  });

  async function crear(cambios: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
    const payload = { ...VALIDO, nombre: marca, ...cambios };
    const respuesta = await app.inject({ method: 'POST', url: '/reportes', payload });
    assert.equal(respuesta.statusCode, 201, respuesta.body);
    return (respuesta.json() as { reporte: Record<string, unknown> }).reporte;
  }

  test('a headerless create persists every field it echoes back, and not columnasPrueba', async () => {
    const creado = await crear({ nombre: `  ${marca} alta  `, titulo: ' Lo más vendido ', descripcion: '   ' });
    // CH-46 (DEC-199): `enUso` is computed, never stored; a new report is on no dashboard.
    const { id, enUso, ...campos } = creado;
    assert.equal(enUso, false);
    assert.ok(typeof id === 'string' && id.length > 0);
    const { columnasPrueba: _ignorado, ...sinPrueba } = VALIDO;
    assert.deepEqual(campos, { ...sinPrueba, nombre: `${marca} alta`, titulo: 'Lo más vendido', descripcion: null });
    assert.deepEqual(await prisma.reporte.findUnique({ where: { id } }), { id, ...campos });
  });

  test('a period is stored as declared, and a null period reads back null', async () => {
    const conPeriodo = await crear({ ...CON_PERIODO, nombre: `${marca} periodo` });
    assert.deepEqual(conPeriodo.periodo, { parametro: 'desde', dias: [30, 7, 90] });
    const sinPeriodo = await crear({ nombre: `${marca} sin periodo` });
    assert.equal(sinPeriodo.periodo, null);
  });

  test('a table keeps the declared column order, with its titles', async () => {
    const columnas = [
      { rol: 'columna', columna: 'producto', titulo: 'Producto' },
      { rol: 'columna', columna: 'unidades', titulo: 'Unidades' },
      { rol: 'columna', columna: 'total', titulo: 'Total' },
    ];
    const creado = await crear({
      nombre: `${marca} tabla`,
      visualizacion: 'tabla',
      columnas,
      columnasPrueba: ['total', 'unidades', 'producto'],
    });
    const respuesta = await app.inject({ method: 'GET', url: `/reportes/${String(creado.id)}` });
    assert.equal(respuesta.statusCode, 200, respuesta.body);
    assert.deepEqual((respuesta.json() as { reporte: { columnas: unknown } }).reporte.columnas, columnas);
  });

  test('a headerless get-by-id returns exactly what create echoed; an unknown id is 404', async () => {
    const creado = await crear({ nombre: `${marca} consulta` });
    const respuesta = await app.inject({ method: 'GET', url: `/reportes/${String(creado.id)}` });
    assert.deepEqual(respuesta.json(), { reporte: creado });
    for (const id of ['11111111-2222-3333-4444-555555555555', 'no-es-un-uuid']) {
      const ninguno = await app.inject({ method: 'GET', url: `/reportes/${id}` });
      assert.equal(ninguno.statusCode, 404);
      assert.deepEqual(ninguno.json(), { error: 'reporte-no-encontrado' });
    }
  });

  test('the headerless list is a summary ordered by nombre, then id, with no SQL', async () => {
    const b = await crear({ nombre: `${marca} orden b`, sql: 'SELECT 1 AS producto, 2 AS total, 3 AS marca_ch45_b' });
    const a = await crear({ nombre: `${marca} orden a` });
    const respuesta = await app.inject({ method: 'GET', url: '/reportes' });
    assert.equal(respuesta.statusCode, 200, respuesta.body);
    const { reportes, truncado } = respuesta.json() as { reportes: { id: string }[]; truncado: boolean };
    assert.equal(typeof truncado, 'boolean');
    const ids = reportes.map((r) => r.id);
    assert.ok(ids.indexOf(String(a.id)) >= 0 && ids.indexOf(String(a.id)) < ids.indexOf(String(b.id)));
    assert.deepEqual(Object.keys(reportes[ids.indexOf(String(a.id))]).sort(), ['id', 'nombre', 'titulo', 'visualizacion']);
    assert.ok(!respuesta.body.includes('marca_ch45_b'), 'no stored sql may reach the list payload');
  });

  test(`the list is capped at ${LIMITE_LISTADO} rows and says so with truncado`, async () => {
    const prefijo = `${marca} tope `;
    const { columnasPrueba: _ignorado, ...fila } = VALIDO;
    try {
      await prisma.reporte.createMany({
        data: Array.from({ length: LIMITE_LISTADO + 1 }, (_, i) => ({
          ...fila,
          nombre: `${prefijo}${String(i).padStart(4, '0')}`,
          periodo: undefined,
        })),
      });
      const respuesta = await app.inject({ method: 'GET', url: '/reportes' });
      const cuerpo = respuesta.json() as { reportes: unknown[]; truncado: boolean };
      assert.equal(cuerpo.reportes.length, LIMITE_LISTADO);
      assert.equal(cuerpo.truncado, true);
    } finally {
      await prisma.reporte.deleteMany({ where: { nombre: { startsWith: prefijo } } });
    }
  });

  test('PUT replaces the whole report in place, under the same id', async () => {
    const creado = await crear({ nombre: `${marca} reemplazo` });
    const nuevo = { ...CON_PERIODO, nombre: `${marca} reemplazo 2`, visualizacion: 'linea' };
    const respuesta = await app.inject({ method: 'PUT', url: `/reportes/${String(creado.id)}`, payload: nuevo });
    assert.equal(respuesta.statusCode, 200, respuesta.body);
    const { reporte } = respuesta.json() as { reporte: Record<string, unknown> };
    assert.equal(reporte.id, creado.id);
    assert.equal(reporte.sql, CON_PERIODO.sql);
    assert.equal(reporte.visualizacion, 'linea');
    const leido = await app.inject({ method: 'GET', url: `/reportes/${String(creado.id)}` });
    assert.deepEqual(leido.json(), { reporte });
    // Back to no period: the stored value is SQL NULL again.
    const sinPeriodo = await app.inject({
      method: 'PUT',
      url: `/reportes/${String(creado.id)}`,
      payload: { ...VALIDO, nombre: `${marca} reemplazo 3` },
    });
    assert.equal((sinPeriodo.json() as { reporte: { periodo: unknown } }).reporte.periodo, null);
  });

  test('PUT on an unknown id is 404 and writes nothing', async () => {
    const nombre = `${marca} fantasma`;
    const respuesta = await app.inject({
      method: 'PUT',
      url: '/reportes/11111111-2222-3333-4444-555555555555',
      payload: { ...VALIDO, nombre },
    });
    assert.equal(respuesta.statusCode, 404, respuesta.body);
    assert.deepEqual(respuesta.json(), { error: 'reporte-no-encontrado' });
    assert.equal(await prisma.reporte.count({ where: { nombre } }), 0);
  });

  test('a rejected body writes no row', async () => {
    const nombre = `${marca} rechazado`;
    const respuesta = await app.inject({
      method: 'POST',
      url: '/reportes',
      payload: { ...VALIDO, nombre, titulo: 'Corre la consulta' },
    });
    assert.equal(respuesta.statusCode, 400, respuesta.body);
    assert.equal(await prisma.reporte.count({ where: { nombre } }), 0);
  });

  test('DELETE answers 404 with a selected tenant, and the report remains', async () => {
    const creado = await crear({ nombre: `${marca} no se borra` });
    const respuesta = await app.inject({
      method: 'DELETE',
      url: `/reportes/${String(creado.id)}`,
      headers: { 'x-tenant-id': tenantId },
    });
    assert.equal(respuesta.statusCode, 404, respuesta.body);
    assert.ok(await prisma.reporte.findUnique({ where: { id: String(creado.id) } }));
  });
});

// ---- CH-46 (DEC-199) task 4.3: a report on a dashboard is in use and is not replaced ----

describe('CH-46 report catalog — the use port (DEC-199)', () => {
  const FILA = {
    id: 'r-1',
    nombre: 'CH-46 puerto',
    titulo: 'Lo más vendido',
    descripcion: null,
    sql: VALIDO.sql,
    entidades: VALIDO.entidades,
    visualizacion: 'barras',
    columnas: VALIDO.columnas,
    periodo: null,
  };
  let app!: FastifyInstance;
  let enUso = false;
  let resultadoReemplazo: 'no-encontrado' | 'en-uso' | typeof FILA = FILA;
  const llamadas: string[] = [];

  before(async () => {
    const reportes = {
      findUnique: async () => FILA,
      create: async () => FILA,
    } as unknown as PrismaAislado['reporte'];
    app = Fastify({ logger: false });
    registerReporteRoutes(app, reportes, {
      enUso: async (id) => (llamadas.push(`enUso:${id}`), enUso),
      reemplazarSiLibre: async (id) => (llamadas.push(`reemplazar:${id}`), resultadoReemplazo as never),
    });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test('GET /:id carries enUso from the port, and nothing else about use', async () => {
    for (const valor of [true, false]) {
      enUso = valor;
      const respuesta = await app.inject({ method: 'GET', url: '/reportes/r-1' });
      assert.equal(respuesta.statusCode, 200, respuesta.body);
      assert.deepEqual(respuesta.json(), { reporte: { ...FILA, enUso: valor } });
    }
  });

  test('POST answers 201 with enUso false and never asks the port', async () => {
    llamadas.length = 0;
    const respuesta = await app.inject({ method: 'POST', url: '/reportes', payload: VALIDO });
    assert.equal(respuesta.statusCode, 201, respuesta.body);
    assert.deepEqual(respuesta.json(), { reporte: { ...FILA, enUso: false } });
    assert.deepEqual(llamadas, []);
  });

  test('PUT maps the three outcomes of the port to 404, 409 and 200', async () => {
    resultadoReemplazo = 'no-encontrado';
    const noEncontrado = await app.inject({ method: 'PUT', url: '/reportes/r-1', payload: VALIDO });
    assert.equal(noEncontrado.statusCode, 404, noEncontrado.body);
    assert.deepEqual(noEncontrado.json(), { error: 'reporte-no-encontrado' });

    resultadoReemplazo = 'en-uso';
    const ocupado = await app.inject({ method: 'PUT', url: '/reportes/r-1', payload: VALIDO });
    assert.equal(ocupado.statusCode, 409, ocupado.body);
    assert.deepEqual(ocupado.json(), { error: 'reporte-en-uso' });

    resultadoReemplazo = FILA;
    const libre = await app.inject({ method: 'PUT', url: '/reportes/r-1', payload: VALIDO });
    assert.equal(libre.statusCode, 200, libre.body);
    assert.deepEqual(libre.json(), { reporte: { ...FILA, enUso: false } });
  });

  test('a 400 body never reaches the port, even for a report in use', async () => {
    llamadas.length = 0;
    resultadoReemplazo = 'en-uso';
    const respuesta = await app.inject({
      method: 'PUT',
      url: '/reportes/r-1',
      payload: { ...VALIDO, visualizacion: 'torta' },
    });
    assert.equal(respuesta.statusCode, 400, respuesta.body);
    assert.deepEqual(llamadas, []);
  });
});

describe('CH-46 report catalog — in use on a live PostgreSQL target (DEC-199)', { skip: alcanzable ? false : motivoSkip }, () => {
  let app!: FastifyInstance;
  /** The raw client: fixtures and cleanup only. The app gets the extended one. */
  let prisma!: PrismaClient;
  const marca = `CH-46 uso ${Date.now()}-${randomBytes(3).toString('hex')}`;
  const tenantIds: string[] = [];
  const conexionIds: string[] = [];

  before(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    const aislado = extenderConAislamiento(prisma);
    app = Fastify({ logger: false });
    registrarContextoTenant(app, aislado);
    registerReporteRoutes(app, aislado.reporte, usoDeReportes(aislado));
    registerTableroRoutes(app, aislado);
    await app.ready();
    for (const clave of ['A', 'B']) {
      const tenant = await prisma.tenant.create({ data: { nombre: `${marca} ${clave}` } });
      tenantIds.push(tenant.id);
      const conexion = await prisma.conexion.create({
        data: {
          tenantId: tenant.id,
          nombre: `CH-46 ${clave}`,
          motor: 'postgres',
          host: 'localhost',
          puerto: 5432,
          baseDeDatos: 'ninguna',
          usuarioDb: 'nadie',
          credencial: 'no-es-un-sobre',
        },
      });
      conexionIds.push(conexion.id);
    }
  });

  after(async () => {
    // RESTRICT everywhere: dashboards, then connections, tenants and reports.
    await prisma.tablero.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.conexion.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await prisma.reporte.deleteMany({ where: { nombre: { startsWith: marca } } });
    await prisma.$disconnect();
    await app.close();
  });

  async function crear(etiqueta: string): Promise<Record<string, unknown>> {
    const respuesta = await app.inject({ method: 'POST', url: '/reportes', payload: { ...VALIDO, nombre: `${marca} ${etiqueta}` } });
    assert.equal(respuesta.statusCode, 201, respuesta.body);
    return (respuesta.json() as { reporte: Record<string, unknown> }).reporte;
  }

  /** Saves tenant B's dashboard through the route, as the console does. */
  async function guardarEnB(reportes: string[]) {
    const respuesta = await app.inject({
      method: 'PUT',
      url: '/tablero',
      headers: { 'x-tenant-id': tenantIds[1] },
      payload: { conexionId: conexionIds[1], reportes },
    });
    assert.equal(respuesta.statusCode, 200, respuesta.body);
  }

  async function leerEnUso(id: string, headers: Record<string, string> = {}): Promise<unknown> {
    const respuesta = await app.inject({ method: 'GET', url: `/reportes/${id}`, headers });
    assert.equal(respuesta.statusCode, 200, respuesta.body);
    return (respuesta.json() as { reporte: { enUso: unknown } }).reporte.enUso;
  }

  test('enUso is false on no dashboard, then true once one holds it, with nothing else about use', async () => {
    const creado = await crear('lectura');
    const id = String(creado.id);
    assert.equal(await leerEnUso(id), false);
    await guardarEnB([id]);
    const respuesta = await app.inject({ method: 'GET', url: `/reportes/${id}` });
    const { reporte } = respuesta.json() as { reporte: Record<string, unknown> };
    assert.equal(reporte.enUso, true);
    assert.deepEqual(Object.keys(reporte).sort(), Object.keys(creado).sort());
    assert.ok(!respuesta.body.includes(tenantIds[1]), 'no tenant id may reach the body');
    assert.ok(!respuesta.body.includes(conexionIds[1]), 'no connection id may reach the body');
  });

  test("a report on another tenant's dashboard is 409 with tenant A or none, and stays unchanged", async () => {
    const creado = await crear('ocupado');
    const id = String(creado.id);
    await guardarEnB([id]);
    for (const headers of [{}, { 'x-tenant-id': tenantIds[0] }]) {
      const respuesta = await app.inject({
        method: 'PUT',
        url: `/reportes/${id}`,
        headers,
        payload: { ...CON_PERIODO, nombre: `${marca} ocupado cambiado` },
      });
      assert.equal(respuesta.statusCode, 409, respuesta.body);
      assert.deepEqual(respuesta.json(), { error: 'reporte-en-uso' });
    }
    const { enUso: _enUso, ...columnas } = creado;
    assert.deepEqual(await prisma.reporte.findUnique({ where: { id } }), columnas);
  });

  test('a report that left every dashboard is replaced again, 200', async () => {
    const creado = await crear('liberado');
    const id = String(creado.id);
    await guardarEnB([id]);
    await guardarEnB([]);
    assert.equal(await leerEnUso(id), false);
    const respuesta = await app.inject({
      method: 'PUT',
      url: `/reportes/${id}`,
      payload: { ...CON_PERIODO, nombre: `${marca} liberado 2` },
    });
    assert.equal(respuesta.statusCode, 200, respuesta.body);
    const { reporte } = respuesta.json() as { reporte: Record<string, unknown> };
    assert.equal(reporte.sql, CON_PERIODO.sql);
    assert.equal(reporte.enUso, false);
  });

  test('an invalid body on a report in use is 400, not 409', async () => {
    const creado = await crear('invalido');
    await guardarEnB([String(creado.id)]);
    const respuesta = await app.inject({
      method: 'PUT',
      url: `/reportes/${String(creado.id)}`,
      payload: { ...VALIDO, visualizacion: 'torta' },
    });
    assert.equal(respuesta.statusCode, 400, respuesta.body);
    assert.deepEqual((respuesta.json() as CuerpoRechazo).campos, ['/visualizacion']);
  });

  /** A promise that rejects after `ms`, so a lock that never frees fails the case instead of hanging. */
  const limite = (ms: number, mensaje: string) =>
    new Promise<never>((_resolver, rechazar) => setTimeout(() => rechazar(new Error(mensaje)), ms).unref());

  /** Whether `promesa` is still pending after 750 ms. */
  async function sigueEsperando(promesa: Promise<unknown>): Promise<boolean> {
    const primero = await Promise.race([
      promesa.then(() => 'resuelto'),
      new Promise<string>((resolver) => setTimeout(() => resolver('espera'), 750)),
    ]);
    return primero === 'espera';
  }

  /**
   * Opens a transaction on the raw client that runs `bloquear`, then holds it until `liberar`.
   * `tomado` resolves once the lock is held.
   */
  function sostener(bloquear: (tx: Prisma.TransactionClient) => Promise<unknown>) {
    let liberar!: () => void;
    const compuerta = new Promise<void>((resolver) => {
      liberar = resolver;
    });
    let marcarTomado!: () => void;
    const tomado = new Promise<void>((resolver) => {
      marcarTomado = resolver;
    });
    const transaccion = prisma.$transaction(
      async (tx) => {
        await bloquear(tx);
        marcarTomado();
        await compuerta;
      },
      { timeout: 30_000 },
    );
    return { liberar, tomado, transaccion };
  }

  test('a dashboard save in flight makes a replace wait, then answer 409 with the report unchanged', async () => {
    const creado = await crear('carrera guardado');
    const id = String(creado.id);
    // What `PUT /tablero` does inside its transaction: FOR KEY SHARE on the report, then the write.
    const sostenido = sostener(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Reporte" WHERE "id" = ANY(${[id]}) FOR KEY SHARE`;
      await tx.tablero.create({ data: { tenantId: tenantIds[0], conexionId: conexionIds[0], reportes: [id] } });
    });
    try {
      await Promise.race([sostenido.tomado, sostenido.transaccion, limite(10_000, 'the save never ran')]);
      const reemplazo = app.inject({
        method: 'PUT',
        url: `/reportes/${id}`,
        payload: { ...CON_PERIODO, nombre: `${marca} carrera guardado 2` },
      });
      assert.equal(await sigueEsperando(reemplazo), true, 'the replace must wait on the row lock');
      sostenido.liberar();
      await sostenido.transaccion;
      const respuesta = await Promise.race([reemplazo, limite(10_000, 'the replace hung')]);
      assert.equal(respuesta.statusCode, 409, respuesta.body);
      assert.equal((await prisma.reporte.findUnique({ where: { id } }))?.sql, VALIDO.sql);
    } finally {
      sostenido.liberar();
      await sostenido.transaccion.catch(() => undefined);
      await prisma.tablero.deleteMany({ where: { tenantId: tenantIds[0] } });
    }
  });

  test('a replace in flight makes a dashboard save wait; the save then holds the replaced report', async () => {
    const creado = await crear('carrera reemplazo');
    const id = String(creado.id);
    // What `reemplazarReporteLibre` does: FOR UPDATE on the report, then the write.
    const sostenido = sostener(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Reporte" WHERE "id" = ${id} FOR UPDATE`;
      await tx.reporte.update({ where: { id }, data: { sql: CON_PERIODO.sql } });
    });
    try {
      await Promise.race([sostenido.tomado, sostenido.transaccion, limite(10_000, 'the replace never ran')]);
      const guardado = app.inject({
        method: 'PUT',
        url: '/tablero',
        headers: { 'x-tenant-id': tenantIds[0] },
        payload: { conexionId: conexionIds[0], reportes: [id] },
      });
      assert.equal(await sigueEsperando(guardado), true, 'the save must wait on the row lock');
      sostenido.liberar();
      await sostenido.transaccion;
      const respuesta = await Promise.race([guardado, limite(10_000, 'the save hung')]);
      assert.equal(respuesta.statusCode, 200, respuesta.body);
      // Replaced before being added: the dashboard holds the new statement, and now blocks edits.
      assert.equal((await prisma.reporte.findUnique({ where: { id } }))?.sql, CON_PERIODO.sql);
      assert.equal(await leerEnUso(id), true);
    } finally {
      sostenido.liberar();
      await sostenido.transaccion.catch(() => undefined);
      await prisma.tablero.deleteMany({ where: { tenantId: tenantIds[0] } });
    }
  });

  test('a save and a replace started together end consistent', async () => {
    for (let vuelta = 0; vuelta < 5; vuelta += 1) {
      const creado = await crear(`juntos ${vuelta}`);
      const id = String(creado.id);
      const [guardado, reemplazo] = await Promise.all([
        app.inject({
          method: 'PUT',
          url: '/tablero',
          headers: { 'x-tenant-id': tenantIds[0] },
          payload: { conexionId: conexionIds[0], reportes: [id] },
        }),
        app.inject({
          method: 'PUT',
          url: `/reportes/${id}`,
          payload: { ...CON_PERIODO, nombre: `${marca} juntos ${vuelta} b` },
        }),
      ]);
      assert.equal(guardado.statusCode, 200, guardado.body);
      const sql = (await prisma.reporte.findUnique({ where: { id } }))?.sql;
      // Either the replace lost and the report is unchanged, or it ran before the report was added.
      if (reemplazo.statusCode === 409) {
        assert.equal(sql, VALIDO.sql);
      } else {
        assert.equal(reemplazo.statusCode, 200, reemplazo.body);
        assert.equal(sql, CON_PERIODO.sql);
      }
      assert.equal(await leerEnUso(id), true);
      await prisma.tablero.deleteMany({ where: { tenantId: tenantIds[0] } });
    }
  });
});
