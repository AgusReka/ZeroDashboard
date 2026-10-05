import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { PrismaClient } from './generated/prisma/client.js';
import type { PrismaAislado } from './aislamiento-prisma.js';
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
