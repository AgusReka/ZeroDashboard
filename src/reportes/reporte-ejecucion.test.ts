import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { extenderConAislamiento, type PrismaAislado } from '../aislamiento/aislamiento-prisma.js';
import { conTenantActivo } from '../aislamiento/contexto-tenant.js';
import { SIN_AGENTES } from '../agente/canal-agente.js';
import { alcanzable, databaseUrl, motivoSkip, objetivo } from '../consola/consola-auth-apoyo.js';
import { cifrarCredencial } from '../compartido/cripto-credencial.js';
import { diasDelPedido, ejecutarReporte, type ReporteAEjecutar } from './reporte-ejecucion.js';
import { fechaDelPeriodo } from './reportes.js';

process.env.APP_PORT ??= '3000';
process.env.DATABASE_URL ??= databaseUrl;
process.env.CREDENTIAL_MASTER_KEY ??= 'emVyb2Rhc2hib2FyZC1jbGF2ZS1kZS1wcnVlYmFzISE=';

/**
 * CH-48 task 1.4: the report run shared by the console test and the client panel. The days
 * are chosen as CH-45 chose them, and under one clock both callers bind the same date and ask
 * for the same ceiling plus one.
 */

describe('CH-48 diasDelPedido — moved from the console test unchanged (DEC-198)', () => {
  const periodo = { parametro: 'desde', dias: [30, 7, 90] };

  test('no period and no request is null; a request on a report with no period is a refusal', () => {
    assert.equal(diasDelPedido(null, undefined), null);
    assert.equal(diasDelPedido(null, 7), 'rechazo');
  });

  test('no request is the first declared value; a declared request is itself', () => {
    assert.equal(diasDelPedido(periodo, undefined), 30);
    assert.equal(diasDelPedido(periodo, 7), 7);
    assert.equal(diasDelPedido(periodo, 90), 90);
  });

  test('an undeclared request is a refusal', () => {
    for (const dias of [15, 0, -7, 7.5, 366]) {
      assert.equal(diasDelPedido(periodo, dias), 'rechazo', String(dias));
    }
  });
});

const ZONA = 'America/Argentina/Buenos_Aires';
/** 02:30 UTC is still the previous day in the deployment zone: the zone decides "today". */
const RELOJ = new Date('2026-11-10T02:30:00.000Z');
const ROL = 'ch48_ejecucion';
const CLAVE_ROL = 'ch48-clave-ejecucion';

const SQL_LIMPIEZA = `
DO $limpieza$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${ROL}') THEN
    EXECUTE format('DROP OWNED BY %I', '${ROL}');
    EXECUTE format('DROP ROLE %I', '${ROL}');
  END IF;
END
$limpieza$;`;

describe('CH-48 ejecutarReporte — both callers on a live PostgreSQL (DEC-198, DEC-202)', { skip: alcanzable ? false : motivoSkip }, () => {
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
    const fila = await db.tenant.create({ data: { nombre: `CH-48 ejecucion ${Date.now()}` } });
    tenant = { id: fila.id, nombre: fila.nombre };
    conexionId = (
      await db.conexion.create({
        data: {
          tenantId: tenant.id,
          nombre: 'CH-48 ejecucion',
          motor: 'postgres',
          host: objetivo.host,
          puerto: objetivo.port,
          baseDeDatos: objetivo.database,
          usuarioDb: ROL,
          credencial: cifrarCredencial(CLAVE_ROL),
        },
      })
    ).id;
    // Literal rows, so the role needs no grant.
    await db.vistaCanonica.create({
      data: {
        tenantId: tenant.id,
        conexionId,
        entidad: 'producto',
        sql: 'SELECT g AS id FROM generate_series(1, 30) AS g',
        estadoValidacion: 'valida',
      },
    });
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

  const REPORTE: ReporteAEjecutar = {
    id: null,
    sql: 'SELECT :desde::text AS desde, id AS total FROM v_producto ORDER BY id',
    entidades: ['producto'],
    visualizacion: 'barras',
    periodo: { parametro: 'desde', dias: [30, 7] },
  };

  async function ejecutar(auditoria: Parameters<typeof ejecutarReporte>[6], dias?: number) {
    return conTenantActivo(tenant, () =>
      ejecutarReporte(
        app,
        aislado,
        {} as FastifyRequest,
        REPORTE,
        { conexionId, ...(dias === undefined ? {} : { dias }) },
        { zonaHoraria: ZONA, topeFilas: 200, canales: SIN_AGENTES, ahora: () => RELOJ },
        auditoria,
        'test run failed',
      ),
    );
  }

  test('the console audit and the panel null audit bind the same date and the same ceiling', async () => {
    const consola = await ejecutar({ origen: 'reporte-prueba', plantillaId: null, reporteId: null }, 7);
    const panel = await ejecutar(null, 7);
    const esperada = fechaDelPeriodo(RELOJ, ZONA, 7);
    assert.equal(esperada, '2026-11-02');
    for (const resultado of [consola, panel]) {
      assert.equal(resultado.tipo, 'respuesta');
      if (resultado.tipo !== 'respuesta') return;
      assert.deepEqual(resultado.periodo, { dias: 7, desde: esperada });
      assert.equal(resultado.respuesta.codigo, 200);
      const cuerpo = resultado.respuesta.cuerpo;
      assert.equal(cuerpo.resultado, 'ok', JSON.stringify(cuerpo));
      if (cuerpo.resultado !== 'ok') return;
      assert.equal(cuerpo.filas.length, 20);
      assert.equal(cuerpo.filas[0][0], esperada, 'the date is bound, as computed by the server');
      assert.equal(cuerpo.corte, 'tope-de-filas', 'the ceiling plus one was asked for');
      assert.equal(cuerpo.paginacion.topeFilas, 20);
    }
  });

  test('no requested days is the first declared value; an undeclared one is a refusal that dials nothing', async () => {
    const predeterminado = await ejecutar(null);
    assert.equal(predeterminado.tipo, 'respuesta');
    if (predeterminado.tipo === 'respuesta') {
      assert.deepEqual(predeterminado.periodo, { dias: 30, desde: fechaDelPeriodo(RELOJ, ZONA, 30) });
    }
    assert.deepEqual(await ejecutar(null, 15), { tipo: 'dias-rechazados' });
  });
});
