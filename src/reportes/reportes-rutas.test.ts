import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { extenderConAislamiento, type PrismaAislado } from '../aislamiento/aislamiento-prisma.js';
import { registrarContextoTenant } from '../aislamiento/contexto-tenant.js';
import { registrarGuardOperador } from '../consola/consola-auth.js';
import { alcanzable, databaseUrl, motivoSkip } from '../consola/consola-auth-apoyo.js';
import { LIMITE_LISTADO } from '../compartido/listados.js';
import { registerReporteRoutes } from './reportes-rutas.js';

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
 * Signature pin: the registrar takes the `reporte` delegate, never the client. Checked by
 * `tsc --noEmit`; never called.
 */
export function firmaSoloDelegado(app: FastifyInstance, cliente: PrismaAislado): void {
  // @ts-expect-error — the full client is not a `reporte` delegate.
  registerReporteRoutes(app, cliente);
  registerReporteRoutes(app, cliente.reporte);
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
    registerReporteRoutes(app, reportesQueNuncaDebenEscribirse);
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
    registerReporteRoutes(app, reportesQueNuncaDebenEscribirse);
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
    registerReporteRoutes(app, aislado.reporte);
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
    const { id, ...campos } = creado;
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
