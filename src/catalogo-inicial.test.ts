import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import net from 'node:net';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { extenderConAislamiento, type PrismaAislado } from './aislamiento-prisma.js';
import { registrarContextoTenant } from './contexto-tenant.js';
import { sentenciaPaginada } from './consulta-ejecucion.js';
import { prepararSentencia } from './parametros.js';
import { componerSentencia, evaluarVistas } from './plantillas.js';
import { datosDePlantilla, PlantillaCompleta, registerPlantillaRoutes } from './plantillas-rutas.js';
import {
  CATALOGO_INICIAL,
  ID_STOCK_FISICO,
  ID_STOCK_PRODUCIBLE,
  rechazoDeEntrada,
  sembrarCatalogoInicial,
  type DelegadoSiembra,
  type EntradaCatalogo,
} from './catalogo-inicial.js';

/**
 * CH-21b: the initial template catalog. U1-U5 need no database. L1-L3 seed per-run copies
 * of the real entries under random ids and delete only those ids: the real fixed ids are
 * never written here. C1, C2 and L4 run inside `BEGIN READ ONLY` over `VALUES` views.
 */

const [FISICO, PRODUCIBLE] = CATALOGO_INICIAL;
const cuerpo = ({ id: _id, ...resto }: EntradaCatalogo) => resto;
const con = (e: EntradaCatalogo, cambios: Record<string, unknown>) => ({ ...e, ...cambios }) as EntradaCatalogo;
const fila = (e: EntradaCatalogo) => ({ id: e.id, ...datosDePlantilla(e) });

/** U5 signature pin: the real delegate satisfies `DelegadoSiembra`. Checked by tsc; never called. */
export function firmaAceptaDelegado(p: PrismaClient): void {
  void sembrarCatalogoInicial(p.plantilla);
}

describe('initial catalog — content and save-time checks (CH-21b, no database)', () => {
  test('U1 a closed list of two entries, contract-only read SQL, strict key set', () => {
    assert.ok(Object.isFrozen(CATALOGO_INICIAL) && CATALOGO_INICIAL.every(Object.isFrozen));
    assert.deepEqual(
      CATALOGO_INICIAL.map((e) => [e.id, e.nombre, e.automatizacion, e.entidades, e.toleranciaFrescuraMinutos]),
      [
        ['21b00000-0000-4000-8000-000000000001', 'Alerta de stock físico', 'stock-fisico', ['producto', 'receta_componente'], 60],
        ['21b00000-0000-4000-8000-000000000002', 'Alerta de stock producible', 'stock-producible', ['producto', 'insumo', 'receta_componente'], 120],
      ],
    );
    assert.deepEqual([ID_STOCK_FISICO, ID_STOCK_PRODUCIBLE], CATALOGO_INICIAL.map((e) => e.id));
    for (const e of CATALOGO_INICIAL) {
      assert.deepEqual(Object.keys(e).sort(), Object.keys(PlantillaCompleta).sort());
      assert.equal(e.formato, 'correo-html');
      assert.deepEqual(e.parametros, [{ nombre: 'umbral', tipo: 'numero' }]);
      const alias = [...e.sql.matchAll(/\bv_(\w+)/g)].map((m) => m[1]);
      assert.ok(alias.length > 0 && alias.every((a) => e.entidades.includes(a)), e.id);
      // Every FROM/JOIN names a v_<entidad> alias: no physical table, no schema-qualified name.
      assert.ok([...e.sql.matchAll(/\b(?:FROM|JOIN)\s+(\S+)/gi)].every((m) => /^v_\w+$/.test(m[1])), e.id);
      assert.doesNotMatch(e.sql, /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE)\b/i);
      assert.doesNotMatch(e.sql, /;|\$\d|<=\s*\d|--|\/\*/);
      assert.match(e.sql, /<= :umbral/);
      // Rule 5 and rule 7: no personal-data column, no credential or connection string.
      assert.doesNotMatch(e.sql, /domicilio|telefono|correo|email/i);
      assert.doesNotMatch(JSON.stringify(e), /password|clave|tenant|:\/\//i);
    }
    assert.ok(!CATALOGO_INICIAL.some((e) => e.automatizacion === 'reporte-diario'));
    assert.deepEqual(rechazoDeEntrada(con(FISICO, { tenantId: 'otro' }))?.campos, ['/tenantId']);
    const { nombre: _nombre, ...sinNombre } = FISICO;
    assert.deepEqual(rechazoDeEntrada(sinNombre as EntradaCatalogo)?.campos, ['/nombre']);
  });

  test('U2 parity with POST /plantillas: entries are 201, broken copies rejected alike and never written', async () => {
    const creados: unknown[] = [];
    const plantillas = { create: async ({ data }: { data: unknown }) => (creados.push(data), {}) };
    const app = Fastify({ logger: false });
    registerPlantillaRoutes(app, plantillas as unknown as PrismaAislado['plantilla']);
    const post = (e: EntradaCatalogo) => app.inject({ method: 'POST', url: '/plantillas', payload: cuerpo(e) });
    for (const e of CATALOGO_INICIAL) {
      assert.equal((await post(e)).statusCode, 201);
      assert.equal(rechazoDeEntrada(e), null);
    }
    assert.deepEqual(creados, CATALOGO_INICIAL.map((e) => datosDePlantilla(e)));
    const nuncaEscribe: DelegadoSiembra = { createMany: async () => assert.fail('a rejected entry reached createMany') };
    const rotas: [EntradaCatalogo, string][] = [
      [con(FISICO, { sql: FISICO.sql.split(':umbral').join('$1') }), 'posicional-a-mano'],
      [con(PRODUCIBLE, { entidades: ['producto', 'cliente'] }), '"rechazados":["cliente"]'],
    ];
    for (const [rota, motivo] of rotas) {
      const respuesta = await post(rota);
      assert.equal(respuesta.statusCode, 400, respuesta.body);
      // The whole envelope, campos and rechazados included, is the route's own.
      assert.deepEqual(JSON.parse(JSON.stringify(rechazoDeEntrada(rota))), respuesta.json());
      const catalogo = CATALOGO_INICIAL.map((e) => (e.id === rota.id ? rota : e));
      await assert.rejects(sembrarCatalogoInicial(nuncaEscribe, catalogo), (error: Error) =>
        error.message.startsWith(`catálogo inicial: ${rota.id} rechazada: `) && error.message.includes(motivo));
    }
    assert.equal(creados.length, 2);
    await app.close();
  });

  test('U3 one createMany with the fixed ids in list order and skipDuplicates; duplicate ids throw first', async () => {
    const llamadas: Parameters<DelegadoSiembra['createMany']>[0][] = [];
    const falso: DelegadoSiembra = { createMany: async (args) => (llamadas.push(args), { count: 7 }) };
    assert.equal(await sembrarCatalogoInicial(falso), 7);
    // Deep equality also proves the rows carry no tenantId and no key beyond the model's.
    assert.deepEqual(llamadas, [{ data: CATALOGO_INICIAL.map(fila), skipDuplicates: true }]);
    await assert.rejects(sembrarCatalogoInicial(falso, [FISICO, con(PRODUCIBLE, { id: FISICO.id })]), /duplicado/);
    assert.equal(llamadas.length, 1);
  });

  test('U4 umbral travels only as $1; the DEC-71 gate guards receta_componente for stock-fisico', () => {
    for (const e of CATALOGO_INICIAL) {
      const compuesta = componerSentencia(e.sql, e.entidades.map((entidad) => ({ entidad, sql: `SELECT * FROM f_${entidad}` })));
      const preparada = prepararSentencia(compuesta, e.parametros, { umbral: 5 });
      assert.ok(preparada.ok, JSON.stringify(preparada));
      assert.equal(preparada.valor.texto, compuesta.split(':umbral').join('$1'));
      assert.doesNotMatch(preparada.valor.texto, /:umbral|\b5\b/);
      assert.deepEqual(preparada.valor.valores, [5]);
    }
    const vista = (entidad: string, estadoValidacion: string, sql = `SELECT * FROM f_${entidad}`) => ({ entidad, sql, estadoValidacion });
    const producto = vista('producto', 'valida');
    assert.deepEqual(evaluarVistas(FISICO.entidades, [producto]), {
      ok: false,
      entidades: [{ entidad: 'receta_componente', estado: 'no-mapeada' }],
    });
    assert.deepEqual(evaluarVistas(FISICO.entidades, [producto, vista('receta_componente', 'no-validado')]), {
      ok: false,
      entidades: [{ entidad: 'receta_componente', estado: 'no-validado' }],
    });
    const vacia = 'SELECT NULL::text AS "productoId" WHERE false';
    assert.deepEqual(evaluarVistas(FISICO.entidades, [vista('receta_componente', 'valida', vacia), producto]), {
      ok: true,
      vistas: [{ entidad: 'producto', sql: producto.sql }, { entidad: 'receta_componente', sql: vacia }],
    });
  });
});

// ---- live PostgreSQL: the same TEST_DB_* gate as plantillas-rutas.test.ts ------------

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

/** One TCP handshake, no driver: decides whether this suite has a server to talk to. */
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

describe('initial catalog — create-if-absent seeding (CH-21b L1-L3)', { skip: motivoSkip }, () => {
  let app!: FastifyInstance;
  let prisma!: PrismaClient;
  const marca = `CH-21b test ${Date.now()}`;
  const prueba = CATALOGO_INICIAL.map((e) => ({ ...e, id: randomUUID(), nombre: `${marca} ${e.nombre}` }));
  const ids = prueba.map((e) => e.id);
  const limpiar: string[] = [...ids];
  const sembrar = () => sembrarCatalogoInicial(prisma.plantilla, prueba);
  const leer = () => Promise.all(ids.map((id) => prisma.plantilla.findUnique({ where: { id } })));

  before(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    const aislado = extenderConAislamiento(prisma);
    app = Fastify({ logger: false });
    registrarContextoTenant(app, aislado);
    registerPlantillaRoutes(app, aislado.plantilla);
    await app.ready();
  });

  after(async () => {
    await prisma.plantilla.deleteMany({ where: { id: { in: limpiar } } });
    await prisma.$disconnect();
    await app.close();
  });

  test('L1 the first seed creates both rows, the second creates none and modifies none', async () => {
    assert.equal(await sembrar(), 2);
    assert.deepEqual(await leer(), prueba.map(fila));
    assert.equal(await sembrar(), 0);
    assert.deepEqual(await leer(), prueba.map(fila));
  });

  test('L2 an operator edit and an unrelated stock-fisico template survive a seed', async () => {
    const editada = { ...cuerpo(prueba[0]), nombre: `${marca} editada`, sql: 'SELECT pr.nombre FROM v_producto pr WHERE pr."stockDisponible" <= :umbral' };
    const put = await app.inject({ method: 'PUT', url: `/plantillas/${ids[0]}`, payload: editada });
    assert.equal(put.statusCode, 200, put.body);
    const post = await app.inject({ method: 'POST', url: '/plantillas', payload: { ...cuerpo(prueba[0]), nombre: `${marca} ajena` } });
    assert.equal(post.statusCode, 201, post.body);
    const ajena = (post.json() as { plantilla: { id: string } }).plantilla;
    limpiar.push(ajena.id);
    assert.equal(await sembrar(), 0);
    assert.deepEqual(await prisma.plantilla.findUnique({ where: { id: ids[0] } }), put.json().plantilla);
    assert.deepEqual(await prisma.plantilla.findUnique({ where: { id: ajena.id } }), ajena);
    assert.equal(await prisma.plantilla.count({ where: { nombre: { startsWith: marca } } }), 3);
  });

  test('L3 an absent row is recreated by id only, the other is untouched, both answer get-by-id', async () => {
    const [editada] = await leer();
    await prisma.plantilla.delete({ where: { id: ids[1] } });
    assert.equal(await sembrar(), 1);
    const filas = await leer();
    assert.deepEqual(filas, [editada, fila(prueba[1])]);
    const respuestas = await Promise.all(ids.map((id) => app.inject({ method: 'GET', url: `/plantillas/${id}` })));
    assert.deepEqual(respuestas.map((r) => [r.statusCode, r.json()]), filas.map((plantilla) => [200, { plantilla }]));
  });
});

/** Miniature views. The rows are deliberately out of order, so a kept order is the template's. */
const VISTAS: Record<string, string> = {
  producto: `SELECT * FROM (VALUES ('d','Donas',6,true),('b','Budin',4,true),('g','Galleta',0,false),
    ('c','Chipa',2,true),('e','Empanada',1,true),('f','Fugazza',9,true),('a','Alfajor',2,true))
    AS t(id, nombre, "stockDisponible", activo)`,
  insumo: `SELECT * FROM (VALUES ('h','Harina',10),('u','Huevo',3)) AS t(id, nombre, "stockDisponible")`,
  receta_componente: `SELECT * FROM (VALUES ('e','h',2),('e','u',1),('f','h',1)) AS t("productoId", "insumoId", "cantidadPorUnidad")`,
};
const SIN_RECETAS = 'SELECT NULL::text AS "productoId", NULL::text AS "insumoId", 1 AS "cantidadPorUnidad" WHERE false';

describe('initial catalog — read-only execution on a VALUES fixture (CH-21b C1, C2, L4)', { skip: motivoSkip }, () => {
  let cliente!: pg.Client;
  before(async () => {
    cliente = new pg.Client(objetivo);
    await cliente.connect();
  });
  after(async () => {
    await cliente.end();
  });

  async function ejecutar(e: EntradaCatalogo, umbral: number, vistas = VISTAS, limite = 50) {
    const compuesta = componerSentencia(e.sql, e.entidades.map((entidad) => ({ entidad, sql: vistas[entidad] })));
    const preparada = prepararSentencia(compuesta, e.parametros, { umbral });
    assert.ok(preparada.ok, JSON.stringify(preparada));
    await cliente.query('BEGIN READ ONLY');
    try {
      const r = await cliente.query({ ...sentenciaPaginada(preparada.valor, limite, 0), rowMode: 'array' });
      return { columnas: r.fields.map((f) => f.name), filas: r.rows };
    } finally {
      await cliente.query('ROLLBACK');
    }
  }

  test('C1 stock-fisico: at or below umbral, active, without a recipe; a decimal umbral binds', async () => {
    const cinco = await ejecutar(FISICO, 5);
    assert.deepEqual(cinco, { columnas: ['Producto', 'Stock disponible'], filas: [['Alfajor', 2], ['Chipa', 2], ['Budin', 4]] });
    assert.deepEqual((await ejecutar(FISICO, 2.5)).filas, [['Alfajor', 2], ['Chipa', 2]]);
    assert.deepEqual((await ejecutar(FISICO, 5, { ...VISTAS, receta_componente: SIN_RECETAS })).filas[0], ['Empanada', 1]);
    // The stored tolerance reaches no execution path (DEC-66, DEC-128).
    assert.deepEqual(await ejecutar(con(FISICO, { toleranciaFrescuraMinutos: 0 }), 5), cinco);
  });

  test('C2 stock-producible: umbral filters producible units; the limiting ingredient comes with its stock', async () => {
    const r = await ejecutar(PRODUCIBLE, 5);
    assert.deepEqual(r.columnas, ['Producto', 'Stock producible', 'Insumo limitante', 'Stock del insumo limitante']);
    assert.deepEqual(r.filas, [['Empanada', '3', 'Huevo', 3]]);
    assert.deepEqual((await ejecutar(PRODUCIBLE, 10)).filas, [['Empanada', '3', 'Huevo', 3], ['Fugazza', '10', 'Harina', 10]]);
  });

  test('L4 the template ORDER BY survives the engine nesting, so LIMIT keeps the lowest rows', async () => {
    // Limit 2 fetches 3 rows (the probe row); Donas (6) is the row the LIMIT must cut.
    assert.deepEqual((await ejecutar(FISICO, 100, VISTAS, 2)).filas, [['Alfajor', 2], ['Chipa', 2], ['Budin', 4]]);
  });
});
