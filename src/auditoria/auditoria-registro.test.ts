import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { extenderConAislamiento, type PrismaAislado } from '../aislamiento/aislamiento-prisma.js';
import { registrarContextoTenant } from '../aislamiento/contexto-tenant.js';
import { NOMBRE_COOKIE_CONSOLA, registrarGuardOperador } from '../consola/consola-auth.js';
import { registerConexionRoutes } from '../conexiones/conexiones.js';
import { registerConsultaRoutes } from '../consultas/consultas.js';
import { registerPlantillaPruebaRoute } from '../plantillas/plantilla-prueba.js';
import { registerValidacionMapeoRoutes } from '../mapeo/validacion-mapeo-rutas.js';
import {
  alcanzable,
  borrarOperadores,
  crearOperador,
  crearSesion,
  databaseUrl,
  motivoSkip,
  nombreUnico,
  objetivo,
} from '../consola/consola-auth-apoyo.js';

process.env.APP_PORT ??= '3000';
process.env.DATABASE_URL ??= databaseUrl;
process.env.CREDENTIAL_MASTER_KEY ??= 'emVyb2Rhc2hib2FyZC1jbGF2ZS1kZS1wcnVlYmFzISE=';

/**
 * CH-20 (DEC-159 to DEC-162): each audited console path writes one row per execution, with
 * the operator of the session. The target is the Compose database itself, reached through
 * a read-only role of this suite (`ch20_lector`), so a query can succeed. Audit rows cannot
 * be deleted (DEC-162): they stay, under tenants this suite creates and deletes.
 */
const ESQUEMA = 'ch20_auditoria';
const ROL = 'ch20_lector';
const CLAVE_ROL = 'ch20-clave-lector';

describe(
  'CH-20 recording in the four audited paths — live PostgreSQL target (DEC-159, DEC-160, DEC-162)',
  { skip: alcanzable ? false : motivoSkip },
  () => {
    let db!: PrismaClient;
    let prisma!: PrismaAislado;
    let app!: FastifyInstance;
    let log!: () => string;
    let tenantId = '';
    let tenantB = '';
    let conexionId = '';
    let plantillaId = '';
    let cookie = '';
    const operador = nombreUnico('op-auditoria');
    let operadorId = '';

    function construir(cliente: PrismaAislado): { app: FastifyInstance; log: () => string } {
      const partes: string[] = [];
      const stream = new Writable({
        write(trozo, _codificacion, listo) {
          partes.push(String(trozo));
          listo();
        },
      });
      const nueva = Fastify({ logger: { level: 'info', stream } });
      registrarGuardOperador(nueva, cliente);
      registrarContextoTenant(nueva, cliente);
      registerConexionRoutes(nueva, cliente);
      registerConsultaRoutes(nueva, cliente);
      registerPlantillaPruebaRoute(nueva, cliente);
      registerValidacionMapeoRoutes(nueva, cliente);
      return { app: nueva, log: () => partes.join('') };
    }

    function post(url: string, payload: object, destino = app) {
      return destino.inject({
        method: 'POST',
        url,
        payload,
        headers: { cookie, 'x-tenant-id': tenantId },
      });
    }

    function registros() {
      return db.registroEjecucion.findMany({ where: { tenantId }, orderBy: { creadoEn: 'asc' } });
    }

    before(async () => {
      db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
      prisma = extenderConAislamiento(db);
      await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS ${ESQUEMA} CASCADE`);
      await db.$executeRawUnsafe(`DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${ROL}') THEN
          EXECUTE 'DROP OWNED BY ${ROL}'; EXECUTE 'DROP ROLE ${ROL}';
        END IF; END $$`);
      await db.$executeRawUnsafe(`CREATE ROLE ${ROL} LOGIN PASSWORD '${CLAVE_ROL}'`);
      await db.$executeRawUnsafe(`CREATE SCHEMA ${ESQUEMA}`);
      await db.$executeRawUnsafe(`CREATE TABLE ${ESQUEMA}.producto (id int, nombre text)`);
      await db.$executeRawUnsafe(`INSERT INTO ${ESQUEMA}.producto VALUES (1, 'a'), (2, 'b')`);
      await db.$executeRawUnsafe(`GRANT USAGE ON SCHEMA ${ESQUEMA} TO ${ROL}`);
      await db.$executeRawUnsafe(`GRANT SELECT ON ${ESQUEMA}.producto TO ${ROL}`);

      ({ app, log } = construir(prisma));
      await app.ready();
      const tenant = await db.tenant.create({ data: { nombre: `CH-20 registro ${Date.now()}` } });
      tenantId = tenant.id;
      operadorId = (await crearOperador(prisma, operador, 'clave-de-operador-larga')).id;
      const { tokenPlano } = await crearSesion(prisma, operadorId, new Date(Date.now() + 3_600_000));
      cookie = `${NOMBRE_COOKIE_CONSOLA}=${tokenPlano}`;

      const alta = await post('/conexiones', {
        nombre: 'CH-20 lector',
        motor: 'postgres',
        host: objetivo.host,
        puerto: objetivo.port,
        baseDeDatos: objetivo.database,
        usuarioDb: ROL,
        credencial: CLAVE_ROL,
      });
      assert.equal(alta.statusCode, 201, alta.body);
      conexionId = alta.json().conexion?.id ?? alta.json().id;
      assert.ok(conexionId, alta.body);

      await db.vistaCanonica.create({
        data: {
          tenantId,
          conexionId,
          entidad: 'producto',
          sql: `SELECT id, nombre FROM ${ESQUEMA}.producto`,
          estadoValidacion: 'valida',
        },
      });
      plantillaId = (
        await db.plantilla.create({
          data: {
            nombre: 'CH-20 prueba',
            sql: 'SELECT count(*) AS n FROM v_producto',
            parametros: [],
            entidades: ['producto'],
            automatizacion: 'stock-fisico',
            formato: 'tabla',
            toleranciaFrescuraMinutos: 60,
          },
        })
      ).id;
    });

    after(async () => {
      const tenants = [tenantId, tenantB].filter((t) => t !== '');
      await db.consultaGuardadaVersion.deleteMany({ where: { tenantId: { in: tenants } } });
      await db.consultaGuardada.deleteMany({ where: { tenantId: { in: tenants } } });
      await db.tenant.deleteMany({ where: { id: tenantB } });
      await db.vistaCanonica.deleteMany({ where: { tenantId } });
      await db.conexion.deleteMany({ where: { tenantId } });
      await db.tenant.deleteMany({ where: { id: tenantId } });
      await db.plantilla.deleteMany({ where: { id: plantillaId } });
      await borrarOperadores(prisma, [operador]);
      await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS ${ESQUEMA} CASCADE`);
      await db.$executeRawUnsafe(`DROP OWNED BY ${ROL}`);
      await db.$executeRawUnsafe(`DROP ROLE IF EXISTS ${ROL}`);
      await db.$disconnect();
      await app.close();
    });

    test('an ad hoc query writes one row with the operator, the statement and the row count', async () => {
      const antes = (await registros()).length;
      const r = await post('/consultas/ejecutar', { conexionId, sql: `SELECT id FROM ${ESQUEMA}.producto` });
      assert.equal(r.statusCode, 200);
      assert.equal(r.json().resultado, 'ok', r.body);
      const filas = await registros();
      assert.equal(filas.length, antes + 1);
      const fila = filas[filas.length - 1];
      assert.equal(fila.origen, 'consulta');
      assert.equal(fila.operadorId, operadorId);
      assert.equal(fila.operadorNombre, operador);
      assert.equal(fila.conexionId, conexionId);
      assert.equal(fila.sql, `SELECT id FROM ${ESQUEMA}.producto`);
      assert.equal(fila.resultado, 'ok');
      assert.equal(fila.filas, 2);
      assert.equal(fila.consultaGuardadaId, null);
      assert.ok(fila.tenantNombre.startsWith('CH-20 registro'));
    });

    test('bound values never reach the row', async () => {
      const r = await post('/consultas/ejecutar', {
        conexionId,
        sql: `SELECT id FROM ${ESQUEMA}.producto WHERE nombre = :nombre`,
        parametros: [{ nombre: 'nombre', tipo: 'texto' }],
        valores: { nombre: 'valor-que-no-se-guarda' },
      });
      assert.equal(r.json().resultado, 'ok', r.body);
      const fila = (await registros()).at(-1)!;
      assert.equal(fila.sql, `SELECT id FROM ${ESQUEMA}.producto WHERE nombre = :nombre`);
      assert.ok(!JSON.stringify(fila).includes('valor-que-no-se-guarda'));
    });

    test('a read-only rejection is recorded as a failure with its phase and category', async () => {
      const r = await post('/consultas/ejecutar', { conexionId, sql: `UPDATE ${ESQUEMA}.producto SET nombre = 'x'` });
      assert.equal(r.json().resultado, 'fallo');
      const fila = (await registros()).at(-1)!;
      assert.equal(fila.resultado, 'fallo');
      assert.equal(fila.fase, r.json().fase);
      assert.equal(fila.categoria, r.json().categoria);
      assert.equal(fila.filas, null);
    });

    test('a request refused before the engine writes nothing', async () => {
      const antes = (await registros()).length;
      const desconocida = await post('/consultas/ejecutar', { conexionId: '00000000-0000-4000-8000-000000000000', sql: 'SELECT 1' });
      assert.equal(desconocida.statusCode, 404);
      const vacia = await post('/consultas/ejecutar', { conexionId, sql: '   ' });
      assert.equal(vacia.statusCode, 400);
      assert.equal((await registros()).length, antes);
    });

    test('the template test records the composed statement and the template id', async () => {
      const r = await post(`/plantillas/${plantillaId}/prueba`, { conexionId });
      assert.equal(r.statusCode, 200, r.body);
      const fila = (await registros()).at(-1)!;
      assert.equal(fila.origen, 'plantilla-prueba');
      assert.equal(fila.plantillaId, plantillaId);
      assert.match(fila.sql, /^WITH v_producto AS/);
      assert.match(fila.sql, /SELECT count\(\*\) AS n FROM v_producto/);
      assert.equal(fila.resultado, r.json().resultado);
    });

    test('the mapping validation records every probe statement', async () => {
      const r = await post(`/conexiones/${conexionId}/validacion-mapeo`, {});
      assert.equal(r.statusCode, 200, r.body);
      const fila = (await registros()).at(-1)!;
      assert.equal(fila.origen, 'validacion-mapeo');
      assert.equal(fila.sql, `SELECT * FROM (SELECT id, nombre FROM ${ESQUEMA}.producto) AS _validacion LIMIT 0`);
      assert.equal(fila.resultado, 'ok');
      assert.equal(fila.filas, null);
    });

    test('the connection probe records its fixed statement', async () => {
      const r = await post(`/conexiones/${conexionId}/prueba`, {});
      assert.equal(r.statusCode, 200, r.body);
      const fila = (await registros()).at(-1)!;
      assert.equal(fila.origen, 'conexion-prueba');
      assert.equal(fila.sql, 'SELECT 1');
      assert.equal(fila.resultado, r.json().resultado);
    });

    test('a failed audit write keeps the answer and logs an error without the statement', async () => {
      // Every delegate behaves as usual except the audit one, whose create always fails.
      const roto = new Proxy(prisma, {
        get(objetivoProxy, propiedad, receptor) {
          if (propiedad === 'registroEjecucion') {
            return { create: () => Promise.reject(new Error('escritura de auditoria rota')) };
          }
          return Reflect.get(objetivoProxy, propiedad, receptor);
        },
      });
      const otra = construir(roto);
      await otra.app.ready();
      try {
        const antes = (await registros()).length;
        const r = await post('/consultas/ejecutar', { conexionId, sql: `SELECT nombre FROM ${ESQUEMA}.producto` }, otra.app);
        assert.equal(r.statusCode, 200);
        assert.equal(r.json().resultado, 'ok');
        assert.equal((await registros()).length, antes);
        const lineas = otra.log().split('\n').filter((l) => l.includes('audit write failed'));
        assert.equal(lineas.length, 1);
        assert.equal(JSON.parse(lineas[0]).level, 50);
        assert.ok(!lineas[0].includes('SELECT nombre'));
      } finally {
        await otra.app.close();
      }
    });

    // ---- PR3 (DEC-161): the saved query reference, verified against the executed text ----

    const SQL_V1 = `SELECT id FROM ${ESQUEMA}.producto`;
    const SQL_V2 = `SELECT id, nombre FROM ${ESQUEMA}.producto`;

    /** A saved query at version 2 whose version 1 is in the history, in tenant `tenant`. */
    async function guardada(tenant: string, nombre: string) {
      const consulta = await db.consultaGuardada.create({
        data: { tenantId: tenant, nombre, sql: SQL_V2, version: 2 },
      });
      await db.consultaGuardadaVersion.create({
        data: { tenantId: tenant, consultaGuardadaId: consulta.id, version: 1, nombre, sql: SQL_V1, parametros: [], desde: new Date() },
      });
      return consulta.id;
    }

    test('the loaded query run unchanged is recorded with its id, version and name', async () => {
      const id = await guardada(tenantId, 'Stock bajo');
      const r = await post('/consultas/ejecutar', { conexionId, sql: SQL_V2, consultaGuardadaId: id, version: 2 });
      assert.equal(r.json().resultado, 'ok', r.body);
      const fila = (await registros()).at(-1)!;
      assert.deepEqual([fila.consultaGuardadaId, fila.consultaVersion, fila.consultaNombre], [id, 2, 'Stock bajo']);
    });

    test('a past version run with its own text is recorded with that version', async () => {
      const id = await guardada(tenantId, 'Historica');
      await post('/consultas/ejecutar', { conexionId, sql: SQL_V1, consultaGuardadaId: id, version: 1 });
      const fila = (await registros()).at(-1)!;
      assert.deepEqual([fila.consultaGuardadaId, fila.consultaVersion, fila.consultaNombre], [id, 1, 'Historica']);
    });

    test('an edited text, an unknown version or another tenant query is recorded as ad hoc, and answers as usual', async () => {
      const id = await guardada(tenantId, 'Editada');
      tenantB = (await db.tenant.create({ data: { nombre: `CH-20 registro B ${Date.now()}` } })).id;
      const deB = await guardada(tenantB, 'De otro tenant');
      for (const cuerpo of [
        { conexionId, sql: `${SQL_V2} WHERE id > 0`, consultaGuardadaId: id, version: 2 },
        { conexionId, sql: SQL_V2, consultaGuardadaId: id, version: 7 },
        { conexionId, sql: SQL_V2, consultaGuardadaId: deB, version: 2 },
        { conexionId, sql: `${SQL_V2};`, consultaGuardadaId: id, version: 2 },
      ]) {
        const r = await post('/consultas/ejecutar', cuerpo);
        assert.equal(r.statusCode, 200, r.body);
        assert.equal(r.json().resultado, 'ok', r.body);
        const fila = (await registros()).at(-1)!;
        assert.equal(fila.consultaGuardadaId, null, JSON.stringify(cuerpo));
        assert.equal(fila.consultaVersion, null);
      }
    });

    test('one reference field without the other is a 400 and records nothing', async () => {
      const antes = (await registros()).length;
      const soloId = await post('/consultas/ejecutar', { conexionId, sql: SQL_V2, consultaGuardadaId: 'x' });
      assert.deepEqual([soloId.statusCode, soloId.json()], [400, { error: 'solicitud-invalida', campos: ['/version'] }]);
      const soloVersion = await post('/consultas/ejecutar', { conexionId, sql: SQL_V2, version: 1 });
      assert.deepEqual([soloVersion.statusCode, soloVersion.json()], [400, { error: 'solicitud-invalida', campos: ['/consultaGuardadaId'] }]);
      const cero = await post('/consultas/ejecutar', { conexionId, sql: SQL_V2, consultaGuardadaId: 'x', version: 0 });
      assert.equal(cero.statusCode, 400);
      assert.equal((await registros()).length, antes);
    });

    test('a failing saved query lookup keeps the answer and records the run as ad hoc', async () => {
      const id = await guardada(tenantId, 'Lectura rota');
      // Every delegate behaves as usual except the saved query reads, which always fail.
      const roto = new Proxy(prisma, {
        get(objetivoProxy, propiedad, receptor) {
          if (propiedad === 'consultaGuardada' || propiedad === 'consultaGuardadaVersion') {
            return { findUnique: () => Promise.reject(new Error('lectura rota')) };
          }
          return Reflect.get(objetivoProxy, propiedad, receptor);
        },
      });
      const otra = construir(roto);
      await otra.app.ready();
      try {
        const antes = (await registros()).length;
        const r = await post('/consultas/ejecutar', { conexionId, sql: SQL_V2, consultaGuardadaId: id, version: 2 }, otra.app);
        assert.equal(r.statusCode, 200, r.body);
        assert.equal(r.json().resultado, 'ok');
        const filas = await registros();
        assert.equal(filas.length, antes + 1);
        assert.equal(filas.at(-1)!.consultaGuardadaId, null);
      } finally {
        await otra.app.close();
      }
    });

    test('a version beyond a 32-bit integer is a 400 and records nothing', async () => {
      const antes = (await registros()).length;
      const r = await post('/consultas/ejecutar', { conexionId, sql: SQL_V2, consultaGuardadaId: 'x', version: 3_000_000_000 });
      assert.equal(r.statusCode, 400);
      assert.equal((await registros()).length, antes);
    });

    test('a request without an operator records nothing and logs an error', async () => {
      const partes: string[] = [];
      const stream = new Writable({
        write(trozo, _codificacion, listo) {
          partes.push(String(trozo));
          listo();
        },
      });
      const sinGuard = Fastify({ logger: { level: 'info', stream } });
      registrarContextoTenant(sinGuard, prisma);
      registerConsultaRoutes(sinGuard, prisma);
      await sinGuard.ready();
      try {
        const antes = (await registros()).length;
        const r = await sinGuard.inject({
          method: 'POST',
          url: '/consultas/ejecutar',
          payload: { conexionId, sql: SQL_V1 },
          headers: { 'x-tenant-id': tenantId },
        });
        assert.equal(r.statusCode, 200);
        assert.equal((await registros()).length, antes);
        const lineas = partes.join('').split('\n').filter((l) => l.includes('audit skipped'));
        assert.equal(lineas.length, 1);
        assert.equal(JSON.parse(lineas[0]).level, 50);
      } finally {
        await sinGuard.close();
      }
    });

    test('the log of the normal app never carries a statement', () => {
      assert.ok(!log().includes(`${ESQUEMA}.producto`));
    });
  },
);
