import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';
import { extenderConAislamiento, type PrismaAislado } from '../../aislamiento/aislamiento-prisma.js';
import { conTenantActivo } from '../../aislamiento/contexto-tenant.js';
import { SIN_AGENTES } from '../../agente/canal-agente.js';
import { alcanzable, databaseUrl, motivoSkip, objetivo } from '../../consola/consola-auth-apoyo.js';
import { cifrarCredencial } from '../../compartido/cripto-credencial.js';
import { ejecutarReporte } from '../../reportes/reporte-ejecucion.js';
import type { ClienteSemilla } from './comun.js';
import {
  IDS_REPORTES_DEMO,
  REPORTES_DEMO,
  rechazoDeEntradaReporte,
  sembrarReportes,
  type EntradaReporte,
} from './reportes.js';

process.env.APP_PORT ??= '3000';
process.env.DATABASE_URL ??= databaseUrl;
process.env.CREDENTIAL_MASTER_KEY ??= 'emVyb2Rhc2hib2FyZC1jbGF2ZS1kZS1wcnVlYmFzISE=';

/**
 * CH-49 (b2): the four seeded reports. They pass the same save-time checks as `POST /reportes`,
 * a corrupted copy of any of them does not, and each one's SQL, run through the report engine
 * over literal views, returns exactly the columns it assigns. The replica is never dialled.
 */

const [VENTAS, MAS_VENDIDO, POR_DIA, STOCK] = REPORTES_DEMO as readonly [
  EntradaReporte,
  EntradaReporte,
  EntradaReporte,
  EntradaReporte,
];

/** A copy of `entrada` with `cambios` over it: what a careless edit of the catalog would leave. */
function corrupta(entrada: EntradaReporte, cambios: Record<string, unknown>): EntradaReporte {
  return { ...entrada, ...cambios } as unknown as EntradaReporte;
}

function campos(entrada: EntradaReporte): unknown {
  return (rechazoDeEntradaReporte(entrada) as { campos?: string[] } | null)?.campos;
}

describe('CH-49 seeded reports — the save-time gate, no database', () => {
  test('there are four, with the design’s ids, visualizations and periods', () => {
    assert.deepEqual(
      REPORTES_DEMO.map((r) => [r.id, r.titulo, r.visualizacion, r.periodo?.dias ?? null]),
      [
        [IDS_REPORTES_DEMO.ventas, 'Ventas', 'numero', [7, 30, 90]],
        [IDS_REPORTES_DEMO.masVendido, 'Lo más vendido', 'barras', [7, 30, 90]],
        [IDS_REPORTES_DEMO.ventasPorDia, 'Ventas por día', 'linea', [30, 60]],
        [IDS_REPORTES_DEMO.stock, 'Stock de tus productos', 'tabla', null],
      ],
    );
    assert.equal(new Set(REPORTES_DEMO.map((r) => r.id)).size, 4);
  });

  test('every entry passes the gate', () => {
    for (const entrada of REPORTES_DEMO) {
      assert.equal(rechazoDeEntradaReporte(entrada), null, entrada.nombre);
    }
  });

  test('an extra key, a missing key and a wrong type are refused naming the field', () => {
    assert.deepEqual(campos(corrupta(VENTAS, { extra: 1 })), ['/extra']);
    assert.deepEqual(campos(corrupta(VENTAS, { columnasPrueba: ['ventas'] })), ['/columnasPrueba']);
    const { sql: _sql, ...sinSql } = VENTAS;
    assert.deepEqual(campos(sinSql as unknown as EntradaReporte), ['/sql']);
    assert.deepEqual(campos(corrupta(VENTAS, { entidades: ['pedidos'] })), ['/entidades/0']);
    assert.deepEqual(campos(corrupta(VENTAS, { visualizacion: 'torta' })), ['/visualizacion']);
    assert.deepEqual(campos(corrupta(POR_DIA, { periodo: { parametro: 'desde', dias: [30], extra: 1 } })), ['/periodo/extra']);
  });

  test('a wrong role is refused, as an unknown role and as a role the visualization does not take', () => {
    assert.deepEqual(
      campos(corrupta(MAS_VENDIDO, { columnas: [{ rol: 'dato', columna: 'producto', titulo: 'Producto' }, MAS_VENDIDO.columnas[1]] })),
      ['/columnas/0/rol'],
    );
    assert.deepEqual(
      campos(corrupta(MAS_VENDIDO, { columnas: [{ ...MAS_VENDIDO.columnas[0], rol: 'valor' }, MAS_VENDIDO.columnas[1]] })),
      ['/columnas'],
    );
  });

  test('an empty title is refused, for the report and for a column', () => {
    assert.deepEqual(campos(corrupta(VENTAS, { titulo: '   ' })), ['/titulo']);
    assert.deepEqual(
      campos(corrupta(VENTAS, { columnas: [{ rol: 'valor', columna: 'ventas', titulo: '' }] })),
      ['/columnas/0/titulo'],
    );
  });

  test('a panel glossary term is refused in the title, the description and a column title', () => {
    const terminos = (entrada: EntradaReporte) =>
      rechazoDeEntradaReporte(entrada) as { campos: string[]; terminos?: string[] };
    assert.deepEqual(terminos(corrupta(VENTAS, { titulo: 'Filas de la consulta' })), {
      error: 'solicitud-invalida',
      campos: ['/titulo'],
      terminos: ['consulta'],
    });
    assert.deepEqual(terminos(corrupta(VENTAS, { descripcion: 'Una réplica del tenant' })).campos, ['/descripcion']);
    assert.deepEqual(
      terminos(corrupta(VENTAS, { columnas: [{ rol: 'valor', columna: 'ventas', titulo: 'Parámetro' }] })).campos,
      ['/columnas/0/titulo'],
    );
  });

  test('the SQL checks of the route still apply: a period the statement never uses is refused', () => {
    assert.deepEqual(campos(corrupta(STOCK, { periodo: { parametro: 'desde', dias: [7] } })), ['/periodo/parametro']);
  });
});

describe('CH-49 sembrarReportes — create by fixed id, only if absent, nothing for a rejected entry', () => {
  /** A `reporte` delegate that remembers what it was asked to create. */
  function delegado(existentes: string[] = []) {
    const creados: { id: string; nombre: string }[] = [];
    const prisma = {
      reporte: {
        findUnique: async ({ where }: { where: { id: string } }) => (existentes.includes(where.id) ? { id: where.id } : null),
        create: async ({ data }: { data: { id: string; nombre: string } }) => {
          creados.push(data);
          return data;
        },
      },
    } as unknown as Pick<ClienteSemilla, 'reporte'>;
    return { prisma, creados };
  }

  test('writes the four reports with their fixed ids and the route’s own column mapping', async () => {
    const { prisma, creados } = delegado();
    const creadas: string[] = [];
    await sembrarReportes(prisma, creadas);
    assert.deepEqual(creados.map((c) => c.id), REPORTES_DEMO.map((r) => r.id));
    assert.equal(creadas.length, 4);
    assert.equal((creados[0] as { periodo?: unknown }).periodo !== undefined, true);
    assert.equal('columnasPrueba' in (creados[0] ?? {}), false);
  });

  test('an existing report is left alone and not counted', async () => {
    const { prisma, creados } = delegado([IDS_REPORTES_DEMO.masVendido]);
    const creadas: string[] = [];
    await sembrarReportes(prisma, creadas);
    assert.deepEqual(creados.map((c) => c.id), [IDS_REPORTES_DEMO.ventas, IDS_REPORTES_DEMO.ventasPorDia, IDS_REPORTES_DEMO.stock]);
    assert.equal(creadas.includes(`reporte:${MAS_VENDIDO.nombre}`), false);
  });

  test('a rejected entry throws naming the report and writes nothing, not even the valid ones', async () => {
    const { prisma, creados } = delegado();
    const creadas: string[] = [];
    await assert.rejects(
      sembrarReportes(prisma, creadas, [VENTAS, corrupta(POR_DIA, { titulo: '' })]),
      (error: Error) => error.message.startsWith(`demo report ${POR_DIA.nombre} rejected: `) && error.message.includes('/titulo'),
    );
    assert.deepEqual(creados, []);
    assert.deepEqual(creadas, []);
  });
});

// ---- live PostgreSQL -------------------------------------------------------------------

const ZONA = 'America/Argentina/Buenos_Aires';
/** 15:00 UTC on 2026-11-10: the 7-day period starts on 2026-11-03, the 30-day one on 2026-10-11. */
const RELOJ = new Date('2026-11-10T15:00:00.000Z');
const ROL = 'ch49_reportes';
const CLAVE_ROL = 'ch49-clave-reportes';

const SQL_LIMPIEZA = `
DO $limpieza$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${ROL}') THEN
    EXECUTE format('DROP OWNED BY %I', '${ROL}');
    EXECUTE format('DROP ROLE %I', '${ROL}');
  END IF;
END
$limpieza$;`;

/**
 * The three views the reports read, as literal rows (the technique of `reporte-prueba.test.ts`),
 * so the reader role needs no grant. Orders 1 and 2 are inside the 7 days, order 4 only inside
 * the 30 and order 5 only inside the 90; order 3 is cancelled and counts nowhere.
 */
const VISTAS: Record<string, string> = {
  producto: `SELECT id, nombre, "stockDisponible", sku, activo FROM (VALUES
  ('a', 'Brownie', 4, NULL::text, true),
  ('b', 'Café', 20, NULL::text, true),
  ('c', 'Descontinuado', 1, NULL::text, false)
) AS t(id, nombre, "stockDisponible", sku, activo)`,
  pedido: `SELECT id, "fechaCreacion", estado, total, numero, moneda FROM (VALUES
  ('1', TIMESTAMPTZ '2026-11-09 12:00:00+00', 'entregado', 100::numeric, 1, 'ARS'),
  ('2', TIMESTAMPTZ '2026-11-09 13:00:00+00', 'entregado', 50::numeric, 2, 'ARS'),
  ('3', TIMESTAMPTZ '2026-11-05 12:00:00+00', 'cancelado', 999::numeric, 3, 'ARS'),
  ('4', TIMESTAMPTZ '2026-10-20 12:00:00+00', 'entregado', 70::numeric, 4, 'ARS'),
  ('5', TIMESTAMPTZ '2026-09-01 12:00:00+00', 'entregado', 30::numeric, 5, 'ARS')
) AS t(id, "fechaCreacion", estado, total, numero, moneda)`,
  item_pedido: `SELECT id, "pedidoId", "productoId", cantidad, "precioUnitario" FROM (VALUES
  ('i1', '1', 'a', 2, 25::numeric),
  ('i2', '1', 'b', 1, 50::numeric),
  ('i3', '2', 'a', 3, 25::numeric),
  ('i4', '3', 'b', 50, 20::numeric),
  ('i5', '4', 'a', 5, 14::numeric)
) AS t(id, "pedidoId", "productoId", cantidad, "precioUnitario")`,
};

describe(
  'CH-49 seeded reports — each one’s columns over literal views on a live PostgreSQL',
  { skip: alcanzable ? false : motivoSkip },
  () => {
    let db!: PrismaClient;
    let aislado!: PrismaAislado;
    let admin!: pg.Client;
    let app!: FastifyInstance;
    let tenant = { id: '', nombre: '' };
    let conexionId = '';

    before(async () => {
      admin = new pg.Client({ ...objetivo });
      await admin.connect();
      await admin.query(SQL_LIMPIEZA);
      await admin.query(`CREATE ROLE ${ROL} LOGIN PASSWORD '${CLAVE_ROL}'`);
      db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
      aislado = extenderConAislamiento(db);
      const fila = await db.tenant.create({ data: { nombre: `CH-49 reportes ${Date.now()}` } });
      tenant = { id: fila.id, nombre: fila.nombre };
      conexionId = (
        await db.conexion.create({
          data: {
            tenantId: tenant.id,
            nombre: 'CH-49 reportes',
            motor: 'postgres',
            host: objetivo.host,
            puerto: objetivo.port,
            baseDeDatos: objetivo.database,
            usuarioDb: ROL,
            credencial: cifrarCredencial(CLAVE_ROL),
          },
        })
      ).id;
      for (const [entidad, sql] of Object.entries(VISTAS)) {
        await db.vistaCanonica.create({
          data: { tenantId: tenant.id, conexionId, entidad, sql, estadoValidacion: 'valida' },
        });
      }
      app = Fastify({ logger: false });
      await app.ready();
    });

    after(async () => {
      if (tenant.id !== '') {
        await db.vistaCanonica.deleteMany({ where: { tenantId: tenant.id } });
        await db.conexion.deleteMany({ where: { tenantId: tenant.id } });
        await db.tenant.deleteMany({ where: { id: tenant.id } });
      }
      await db.$disconnect();
      await app.close();
      await admin.query(SQL_LIMPIEZA);
      await admin.end();
    });

    /** The panel's own run (`auditoria: null`, so no audit row is written): the first declared period unless `dias`. */
    async function ejecutar(entrada: EntradaReporte, dias?: number) {
      const resultado = await conTenantActivo(tenant, () =>
        ejecutarReporte(
          app,
          aislado,
          {} as FastifyRequest,
          {
            id: entrada.id,
            sql: entrada.sql,
            entidades: entrada.entidades,
            visualizacion: entrada.visualizacion,
            periodo: entrada.periodo,
          },
          { conexionId, ...(dias === undefined ? {} : { dias }) },
          { zonaHoraria: ZONA, topeFilas: 200, canales: SIN_AGENTES, ahora: () => RELOJ },
          null,
          'demo report test failed',
        ),
      );
      assert.equal(resultado.tipo, 'respuesta');
      if (resultado.tipo !== 'respuesta') throw new Error('unreachable');
      const { respuesta } = resultado;
      assert.equal(respuesta.codigo, 200, JSON.stringify(respuesta.cuerpo));
      if (respuesta.codigo !== 200) throw new Error('unreachable');
      assert.equal(respuesta.cuerpo.resultado, 'ok', JSON.stringify(respuesta.cuerpo));
      if (respuesta.cuerpo.resultado !== 'ok') throw new Error('unreachable');
      return respuesta.cuerpo;
    }

    test('each report returns exactly the column names it assigns', async () => {
      for (const entrada of REPORTES_DEMO) {
        const cuerpo = await ejecutar(entrada);
        assert.deepEqual(
          cuerpo.columnas,
          entrada.columnas.map((c) => c.columna),
          entrada.nombre,
        );
        assert.ok(cuerpo.filas.length > 0, `${entrada.nombre} returned no rows`);
      }
    });

    test('sales add up the period without the cancelled order', async () => {
      assert.deepEqual((await ejecutar(VENTAS)).filas.map((f) => Number(f[0])), [150]);
      assert.deepEqual((await ejecutar(VENTAS, 30)).filas.map((f) => Number(f[0])), [220]);
      assert.deepEqual((await ejecutar(VENTAS, 90)).filas.map((f) => Number(f[0])), [250]);
    });

    test('the best sellers come most-sold first, each a label and a number', async () => {
      const cuerpo = await ejecutar(MAS_VENDIDO);
      assert.deepEqual(cuerpo.filas.map((f) => [f[0], Number(f[1])]), [['Brownie', 5], ['Café', 1]]);
      assert.deepEqual((await ejecutar(MAS_VENDIDO, 30)).filas.map((f) => [f[0], Number(f[1])]), [['Brownie', 10], ['Café', 1]]);
    });

    test('sales by day are labelled with a sortable date, oldest first', async () => {
      const cuerpo = await ejecutar(POR_DIA);
      assert.deepEqual(cuerpo.filas.map((f) => [f[0], Number(f[1])]), [['2026-10-20', 70], ['2026-11-09', 150]]);
    });

    test('the stock table lists the active products, lowest stock first', async () => {
      const cuerpo = await ejecutar(STOCK);
      assert.deepEqual(cuerpo.filas.map((f) => [f[0], Number(f[1])]), [['Brownie', 4], ['Café', 20]]);
    });
  },
);
