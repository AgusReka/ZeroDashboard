import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Writable } from 'node:stream';
import { after, before, describe, test } from 'node:test';
import Fastify, { type FastifyInstance } from 'fastify';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { extenderConAislamiento, type PrismaAislado } from '../aislamiento/aislamiento-prisma.js';
import { registrarContextoTenant } from '../aislamiento/contexto-tenant.js';
import { NOMBRE_COOKIE_CONSOLA, registrarGuardOperador } from '../consola/consola-auth.js';
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
import { registerConexionRoutes } from '../conexiones/conexiones.js';
import { registerAutomatizacionRoutes } from './automatizaciones-rutas.js';
import { entradaDeCorreo, peticionDeCorrida, type PlantillaDeCorrida } from './corrida.js';
import { componerCorreo } from './correo.js';
import { respuestaDeVistaPrevia } from './vista-previa.js';
import { prepararSentencia } from '../ejecucion/parametros.js';
import type { EjecucionExitosa, EjecucionFallida } from '../ejecucion/consulta-ejecucion.js';

process.env.APP_PORT ??= '3000';
process.env.DATABASE_URL ??= databaseUrl;
process.env.CREDENTIAL_MASTER_KEY ??= 'emVyb2Rhc2hib2FyZC1jbGF2ZS1kZS1wcnVlYmFzISE=';

/**
 * CH-42 (X10, DEC-189, DEC-195): the message preview. The pure part runs without a database:
 * the steps shared with the run, the decision and the message; the live part builds the route
 * on a read-only role and proves it neither sends nor records a run.
 */

const ZONA = 'America/Argentina/Buenos_Aires';
const FECHA = new Date('2026-11-03T12:00:00Z');

function plantillaCon(encabezado: string | null, linea: string | null): PlantillaDeCorrida {
  return {
    sql: 'SELECT producto, cantidad FROM v_producto',
    parametros: [],
    entidades: ['producto'],
    nombre: 'Stock bajo',
    automatizacion: 'stock-fisico',
    encabezadoMensaje: encabezado,
    lineaMensaje: linea,
  };
}

function exitosa(filas: unknown[][], hayMas = false, columnas = ['producto', 'cantidad']): EjecucionExitosa {
  return {
    resultado: 'ok',
    fase: 'ejecucion',
    columnas,
    filas,
    corte: hayMas ? 'tope-de-filas' : null,
    paginacion: {
      limite: 200,
      desplazamiento: 0,
      hayMas,
      siguienteDesplazamiento: hayMas ? filas.length : null,
      topeFilas: 200,
    },
    duracionMs: 4,
  };
}

describe('CH-42 shared steps — one input and one page for the run and the preview', () => {
  test('1.4 with one text null the input carries mensaje null, and the table is rendered', () => {
    const resultado = exitosa([['Harina', 3]]);
    assert.equal(entradaDeCorreo(plantillaCon('Encabezado', null), resultado, FECHA, ZONA).mensaje, null);
    assert.equal(entradaDeCorreo(plantillaCon(null, '{producto}'), resultado, FECHA, ZONA).mensaje, null);
  });

  test('1.4 with both texts the input is what a run builds', () => {
    const resultado = exitosa([['Harina', 3], ['Azúcar', 0]], true);
    assert.deepEqual(entradaDeCorreo(plantillaCon('Poco stock', '{producto}: {cantidad}'), resultado, FECHA, ZONA), {
      nombre: 'Stock bajo',
      automatizacion: 'stock-fisico',
      columnas: ['producto', 'cantidad'],
      filas: [['Harina', 3], ['Azúcar', 0]],
      hayMas: true,
      fecha: FECHA,
      zona: ZONA,
      mensaje: { encabezado: 'Poco stock', linea: '{producto}: {cantidad}' },
    });
  });

  test('1.4 the run page is one page of the row cap from row 0', () => {
    const sentencia = prepararSentencia('SELECT 1', [], {});
    assert.ok(sentencia.ok);
    const destino = { id: 'c-1', host: 'h', port: 5432, database: 'd', user: 'u', password: 'p' };
    const peticion = peticionDeCorrida({ ok: true, sql: 'SELECT 1', destino, sentencia: sentencia.valor }, 20);
    assert.equal(peticion.limite, 20);
    assert.equal(peticion.desplazamiento, 0);
    assert.equal(peticion.topeFilas, 20);
    assert.equal(peticion.sentencia, sentencia.valor);
    assert.equal(peticion.host, 'h');
    assert.ok(!('id' in peticion), 'the engine never reads the connection id');
  });
});

describe('CH-42 respuestaDeVistaPrevia — the decision, «Para» and the message (email-notification delta)', () => {
  const PARA = ['ops@empresa.com', 'ventas@empresa.com'];
  const plantilla = plantillaCon('Poco stock', '{producto}: quedan {cantidad}');
  const tres = exitosa([['Harina', 3], ['Azúcar', 0], ['Sal', 1]]);

  function respuesta(
    ejecucion: EjecucionExitosa | EjecucionFallida,
    destinatarios: readonly string[],
    minimoFilas: number,
    configurado: boolean,
  ) {
    return respuestaDeVistaPrevia(ejecucion, { destinatarios, minimoFilas }, plantilla, configurado, FECHA, ZONA);
  }

  test('3.4 a run would send: enviar, both addresses in order, and the message', () => {
    const r = respuesta(tres, PARA, 1, true);
    assert.equal(r.decision, 'enviar');
    assert.deepEqual(r.para, PARA);
    assert.ok(r.correo !== null);
    assert.match(r.correo.texto, /Harina: quedan 3/);
    // The engine verdict is spread unchanged, so the console renders it like a template test.
    assert.equal(r.resultado, 'ok');
    assert.deepEqual(r.resultado === 'ok' ? r.filas : null, tres.filas);
  });

  test('3.4 para is a copy of the stored list, not the same array', () => {
    const lista = ['ops@empresa.com'];
    const r = respuesta(tres, lista, 1, true);
    assert.deepEqual(r.para, lista);
    assert.notEqual(r.para, lista);
  });

  test('3.4 without recipients the message is still built', () => {
    const r = respuesta(tres, [], 1, true);
    assert.equal(r.decision, 'sin-destinatario');
    assert.deepEqual(r.para, []);
    assert.ok(r.correo !== null);
  });

  test('3.4 without SMTP the message is still built', () => {
    const r = respuesta(tres, PARA, 1, false);
    assert.equal(r.decision, 'no-configurada');
    assert.ok(r.correo !== null);
  });

  test('3.4 below the minimum, and with zero rows, there is no message', () => {
    const bajo = respuesta(tres, PARA, 5, true);
    assert.deepEqual([bajo.decision, bajo.correo], ['omitida-bajo-minimo', null]);
    const vacio = respuesta(exitosa([]), PARA, 1, true);
    assert.deepEqual([vacio.decision, vacio.correo], ['omitida-sin-filas', null]);
  });

  test('3.4 a failed query has no decision and no message, and keeps the engine failure', () => {
    const fallo: EjecucionFallida = {
      resultado: 'fallo',
      fase: 'ejecucion',
      categoria: 'error-sintaxis',
      codigo: '42601',
      duracionMs: 2,
    };
    const r = respuesta(fallo, PARA, 1, true);
    assert.deepEqual(r, { ...fallo, decision: null, para: PARA, correo: null });
  });

  test('3.4 a result cut by the row cap under the minimum still sends, as a run decides', () => {
    const r = respuesta(exitosa([['Harina', 3], ['Sal', 1]], true), PARA, 50, true);
    assert.equal(r.decision, 'enviar');
    assert.ok(r.correo !== null);
  });

  test('3.4 the preview message equals the message a run composes for the same four inputs', () => {
    const r = respuesta(tres, PARA, 1, true);
    assert.deepEqual(r.correo, componerCorreo(entradaDeCorreo(plantilla, tres, FECHA, ZONA)));
  });

  test('3.4 a line naming a missing column gives the table, as the run sends it', () => {
    const conStock = plantillaCon('Poco stock', '{producto}: {stock}');
    const r = respuestaDeVistaPrevia(tres, { destinatarios: PARA, minimoFilas: 1 }, conStock, true, FECHA, ZONA);
    assert.ok(r.correo !== null);
    assert.match(r.correo.html, /<table/);
    assert.ok(!r.correo.texto.includes('Poco stock'));
    assert.deepEqual(r.correo, componerCorreo(entradaDeCorreo(conStock, tres, FECHA, ZONA)));
  });
});

describe('CH-42 the preview can neither send nor record a run — structural', () => {
  const fuentes = ['vista-previa.ts', 'corrida.ts'].map((nombre) => ({
    nombre,
    texto: readFileSync(new URL(`./${nombre}`, import.meta.url), 'utf8'),
  }));

  test('3.5 neither module imports the notifier or the scheduler, nor names the Ejecucion delegate', () => {
    for (const { nombre, texto } of fuentes) {
      assert.ok(!texto.includes('./notificador.js'), `${nombre} imports the notifier`);
      assert.ok(!texto.includes('./planificador.js'), `${nombre} imports the scheduler`);
      // `ejecucion.` as an identifier, not inside a module path such as `consulta-ejecucion.js`.
      assert.ok(!/(?<![\w/-])ejecucion\s*\./.test(texto), `${nombre} names the Ejecucion delegate`);
    }
  });
});

/**
 * The live part. The target is the test database itself, reached through a read-only role of
 * this suite (`ch42_lector`), so the query succeeds. Audit rows cannot be deleted (DEC-162):
 * they stay, under tenants this suite creates and deletes.
 */
const ESQUEMA = 'ch42_vista_previa';
const ROL = 'ch42_lector';
const CLAVE_ROL = 'ch42-clave-lector';
const TOPE = 200;

describe(
  'CH-42 POST /automatizaciones/:id/vista-previa — live PostgreSQL target (X10, DEC-189, DEC-195)',
  { skip: alcanzable ? false : motivoSkip },
  () => {
    let db!: PrismaClient;
    let prisma!: PrismaAislado;
    let app!: FastifyInstance;
    let cookie = '';
    let tenantA = '';
    let tenantB = '';
    let conexionA = '';
    let conexionB = '';
    const plantillas: string[] = [];
    let plantillaId = '';
    const operador = nombreUnico('op-vista-previa');

    function construir(
      cliente: PrismaAislado,
      { tope = TOPE, correoConfigurado = true } = {},
    ): { app: FastifyInstance; log: () => string } {
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
      registerAutomatizacionRoutes(nueva, cliente, 'UTC', tope, { correoConfigurado });
      return { app: nueva, log: () => partes.join('') };
    }

    function vistaPrevia(id: string, destino = app, tenant = tenantA) {
      return destino.inject({
        method: 'POST',
        url: `/automatizaciones/${id}/vista-previa`,
        headers: { cookie, 'x-tenant-id': tenant },
      });
    }

    function registros(tenant = tenantA) {
      return db.registroEjecucion.findMany({ where: { tenantId: tenant }, orderBy: { creadoEn: 'asc' } });
    }

    async function plantilla(datos: { sql: string; entidades?: string[]; parametros?: object[] }) {
      const fila = await db.plantilla.create({
        data: {
          nombre: 'CH-42 vista previa',
          sql: datos.sql,
          parametros: datos.parametros ?? [],
          entidades: datos.entidades ?? ['producto'],
          automatizacion: 'stock-fisico',
          formato: 'correo-html',
          toleranciaFrescuraMinutos: 60,
          encabezadoMensaje: 'Poco stock',
          lineaMensaje: '{producto}: quedan {cantidad}',
        },
      });
      plantillas.push(fila.id);
      return fila.id;
    }

    async function automatizacion(
      datos: {
        plantilla?: string;
        destinatarios?: string[];
        minimoFilas?: number;
        activo?: boolean;
        valores?: object;
        tenant?: string;
        conexion?: string;
      } = {},
    ) {
      const fila = await db.automatizacion.create({
        data: {
          tenantId: datos.tenant ?? tenantA,
          plantillaId: datos.plantilla ?? plantillaId,
          conexionId: datos.conexion ?? conexionA,
          valores: datos.valores ?? {},
          cron: '0 8 * * *',
          destinatarios: datos.destinatarios ?? ['ops@empresa.com'],
          minimoFilas: datos.minimoFilas ?? 1,
          activo: datos.activo ?? true,
        },
      });
      return fila.id;
    }

    /** A connection of `tenant` to this suite's role, with an approved `producto` view. */
    async function alta(tenant: string): Promise<string> {
      const r = await app.inject({
        method: 'POST',
        url: '/conexiones',
        headers: { cookie, 'x-tenant-id': tenant },
        payload: {
          nombre: 'CH-42 lector',
          motor: 'postgres',
          host: objetivo.host,
          puerto: objetivo.port,
          baseDeDatos: objetivo.database,
          usuarioDb: ROL,
          credencial: CLAVE_ROL,
        },
      });
      assert.equal(r.statusCode, 201, r.body);
      const id: string = r.json().conexion?.id ?? r.json().id;
      await db.vistaCanonica.create({
        data: {
          tenantId: tenant,
          conexionId: id,
          entidad: 'producto',
          sql: `SELECT id, nombre, cantidad FROM ${ESQUEMA}.producto`,
          estadoValidacion: 'valida',
        },
      });
      return id;
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
      await db.$executeRawUnsafe(`CREATE TABLE ${ESQUEMA}.producto (id int, nombre text, cantidad int)`);
      await db.$executeRawUnsafe(
        `INSERT INTO ${ESQUEMA}.producto VALUES (1, 'Harina', 3), (2, 'Azúcar', 0), (3, 'Sal', 1)`,
      );
      await db.$executeRawUnsafe(`GRANT USAGE ON SCHEMA ${ESQUEMA} TO ${ROL}`);
      await db.$executeRawUnsafe(`GRANT SELECT ON ${ESQUEMA}.producto TO ${ROL}`);

      ({ app } = construir(prisma));
      await app.ready();
      tenantA = (await db.tenant.create({ data: { nombre: `CH-42 A ${Date.now()}` } })).id;
      tenantB = (await db.tenant.create({ data: { nombre: `CH-42 B ${Date.now()}` } })).id;
      const operadorId = (await crearOperador(prisma, operador, 'clave-de-operador-larga')).id;
      const { tokenPlano } = await crearSesion(prisma, operadorId, new Date(Date.now() + 3_600_000));
      cookie = `${NOMBRE_COOKIE_CONSOLA}=${tokenPlano}`;
      conexionA = await alta(tenantA);
      conexionB = await alta(tenantB);
      plantillaId = await plantilla({ sql: 'SELECT nombre AS producto, cantidad FROM v_producto ORDER BY id' });
    });

    after(async () => {
      const tenants = [tenantA, tenantB].filter((t) => t !== '');
      await db.ejecucion.deleteMany({ where: { tenantId: { in: tenants } } });
      await db.automatizacion.deleteMany({ where: { tenantId: { in: tenants } } });
      await db.vistaCanonica.deleteMany({ where: { tenantId: { in: tenants } } });
      await db.conexion.deleteMany({ where: { tenantId: { in: tenants } } });
      await db.tenant.deleteMany({ where: { id: { in: tenants } } });
      await db.plantilla.deleteMany({ where: { id: { in: plantillas } } });
      await borrarOperadores(prisma, [operador]);
      await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS ${ESQUEMA} CASCADE`);
      await db.$executeRawUnsafe(`DROP OWNED BY ${ROL}`);
      await db.$executeRawUnsafe(`DROP ROLE IF EXISTS ${ROL}`);
      await db.$disconnect();
      await app.close();
    });

    test('3.6 reaching the minimum: rows, enviar, para and the message; twice, with no run and no change', async () => {
      const id = await automatizacion({ destinatarios: ['ops@empresa.com', 'ventas@empresa.com'] });
      // A prior run, which the preview must leave exactly as it is.
      await db.ejecucion.create({
        data: { tenantId: tenantA, automatizacionId: id, estado: 'ok', iniciadaEn: new Date('2026-01-01T08:00:00Z') },
      });
      const antes = await db.automatizacion.findUnique({ where: { id } });
      const corridasAntes = await db.ejecucion.findMany({ where: { automatizacionId: id } });
      for (let vez = 0; vez < 2; vez += 1) {
        const r = await vistaPrevia(id);
        assert.equal(r.statusCode, 200, r.body);
        const cuerpo = r.json();
        assert.equal(cuerpo.resultado, 'ok');
        assert.deepEqual(cuerpo.filas, [['Harina', 3], ['Azúcar', 0], ['Sal', 1]]);
        assert.equal(cuerpo.decision, 'enviar');
        assert.deepEqual(cuerpo.para, ['ops@empresa.com', 'ventas@empresa.com']);
        assert.match(cuerpo.correo.texto, /Harina: quedan 3/);
        assert.equal(typeof cuerpo.correo.asunto, 'string');
        assert.equal(typeof cuerpo.correo.html, 'string');
      }
      assert.deepEqual(await db.automatizacion.findUnique({ where: { id } }), antes);
      assert.deepEqual(await db.ejecucion.findMany({ where: { automatizacionId: id } }), corridasAntes);
    });

    test('3.6 no run, with SMTP configured and a decision to send', async () => {
      // The route never receives a notifier, so "never sends" rests on its signature and on the
      // structural import test (3.5); this case proves that a sendable result still writes no run.
      const id = await automatizacion();
      const r = await vistaPrevia(id);
      assert.equal(r.statusCode, 200, r.body);
      assert.equal(r.json().decision, 'enviar');
      assert.equal(await db.ejecucion.count({ where: { automatizacionId: id } }), 0);
    });

    test('3.6 one audit row under its own origin, with the statement and the template, and nothing else', async () => {
      const id = await automatizacion({ destinatarios: ['auditada@empresa.com'] });
      const antes = (await registros()).length;
      const r = await vistaPrevia(id);
      assert.equal(r.statusCode, 200, r.body);
      const filas = await registros();
      assert.equal(filas.length, antes + 1);
      const fila = filas.at(-1)!;
      assert.equal(fila.origen, 'automatizacion-vista-previa');
      assert.equal(fila.conexionId, conexionA);
      assert.equal(fila.plantillaId, plantillaId);
      assert.match(fila.sql, /^WITH v_producto AS/);
      assert.match(fila.sql, /SELECT nombre AS producto, cantidad FROM v_producto ORDER BY id/);
      assert.equal(fila.resultado, 'ok');
      assert.equal(fila.filas, 3);
      assert.equal(fila.operadorNombre, operador);
      const texto = JSON.stringify(fila);
      for (const prohibido of ['auditada@empresa.com', r.json().correo.asunto, 'Harina', id]) {
        assert.ok(!texto.includes(prohibido), `the audit row holds ${prohibido}`);
      }
    });

    test('3.6 SMTP configured or not: enviar or no-configurada, both with the message', async () => {
      const sinCorreo = construir(prisma, { correoConfigurado: false });
      await sinCorreo.app.ready();
      try {
        const id = await automatizacion();
        const con = (await vistaPrevia(id)).json();
        const sin = (await vistaPrevia(id, sinCorreo.app)).json();
        assert.deepEqual([con.decision, sin.decision], ['enviar', 'no-configurada']);
        assert.ok(con.correo !== null && sin.correo !== null);
      } finally {
        await sinCorreo.app.close();
      }
    });

    test('3.6 the run page: a row cap of 2 on three rows with minimum 5 reads two rows, hayMas and enviar', async () => {
      const corto = construir(prisma, { tope: 2 });
      await corto.app.ready();
      try {
        const id = await automatizacion({ minimoFilas: 5 });
        const r = await vistaPrevia(id, corto.app);
        assert.equal(r.statusCode, 200, r.body);
        const cuerpo = r.json();
        assert.equal(cuerpo.filas.length, 2);
        assert.equal(cuerpo.paginacion.hayMas, true);
        assert.equal(cuerpo.decision, 'enviar');
      } finally {
        await corto.app.close();
      }
    });

    test('3.6 refusals answer before anything is dialled and write no audit row', async () => {
      const antes = (await registros()).length;
      const desconocida = await vistaPrevia('00000000-0000-4000-8000-000000000000');
      assert.deepEqual([desconocida.statusCode, desconocida.json()], [404, { error: 'automatizacion-no-encontrada' }]);

      const desactivada = await vistaPrevia(await automatizacion({ activo: false }));
      assert.deepEqual([desactivada.statusCode, desactivada.json()], [409, { error: 'automatizacion-desactivada' }]);

      const sinVista = await vistaPrevia(
        await automatizacion({ plantilla: await plantilla({ sql: 'SELECT 1 FROM v_pedido', entidades: ['pedido'] }) }),
      );
      assert.equal(sinVista.statusCode, 409, sinVista.body);
      assert.equal(sinVista.json().error, 'vista-canonica-no-aprobada');
      assert.deepEqual(
        sinVista.json().entidades.map((e: { entidad: string }) => e.entidad),
        ['pedido'],
      );

      const conParametro = await plantilla({
        sql: 'SELECT nombre AS producto, cantidad FROM v_producto WHERE cantidad >= :minimo',
        parametros: [{ nombre: 'minimo', tipo: 'numero' }],
      });
      const vencidos = await vistaPrevia(await automatizacion({ plantilla: conParametro, valores: {} }));
      assert.equal(vencidos.statusCode, 400, vencidos.body);
      assert.equal(vencidos.json().error, 'solicitud-invalida');
      assert.ok(vencidos.json().campos.length > 0);
      assert.ok(vencidos.json().problemas.length > 0);

      assert.equal((await registros()).length, antes);
    });

    test('3.6 a query failing at execution is a 200 with the failure, no decision, no message, one fallo row', async () => {
      const rota = await plantilla({ sql: 'SELECT no_existe AS producto FROM v_producto' });
      const id = await automatizacion({ plantilla: rota });
      const antes = (await registros()).length;
      const r = await vistaPrevia(id);
      assert.equal(r.statusCode, 200, r.body);
      const cuerpo = r.json();
      assert.equal(cuerpo.resultado, 'fallo');
      assert.equal(cuerpo.fase, 'ejecucion');
      assert.equal(typeof cuerpo.categoria, 'string');
      assert.deepEqual([cuerpo.decision, cuerpo.correo], [null, null]);
      const filas = await registros();
      assert.equal(filas.length, antes + 1);
      assert.equal(filas.at(-1)!.resultado, 'fallo');
    });

    test('3.6 a failed audit write keeps the normal answer and logs one error line', async () => {
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
        const id = await automatizacion();
        const antes = (await registros()).length;
        const r = await vistaPrevia(id, otra.app);
        assert.equal(r.statusCode, 200, r.body);
        assert.equal(r.json().decision, 'enviar');
        assert.ok(r.json().correo !== null);
        assert.equal((await registros()).length, antes);
        const lineas = otra.log().split('\n').filter((l) => l.includes('audit write failed'));
        assert.equal(lineas.length, 1);
        assert.equal(JSON.parse(lineas[0]).level, 50);
      } finally {
        await otra.app.close();
      }
    });

    test('4.2 two tenants on the same template each read only their own recipients as para', async () => {
      const deA = await automatizacion({ destinatarios: ['a1@empresa.com', 'a2@empresa.com'] });
      const deB = await automatizacion({ tenant: tenantB, conexion: conexionB, destinatarios: ['b1@otra.com'] });
      const a = (await vistaPrevia(deA, app, tenantA)).json();
      const b = (await vistaPrevia(deB, app, tenantB)).json();
      assert.deepEqual(a.para, ['a1@empresa.com', 'a2@empresa.com']);
      assert.deepEqual(b.para, ['b1@otra.com']);
      assert.ok(!JSON.stringify(a).includes('b1@otra.com'));
      assert.ok(!JSON.stringify(b).includes('a1@empresa.com') && !JSON.stringify(b).includes('a2@empresa.com'));
    });
  },
);
