import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { ID_STOCK_FISICO, ID_STOCK_PRODUCIBLE, sembrarCatalogoInicial } from '../plantillas/catalogo-inicial.js';
import { alcanzable, databaseUrl, motivoSkip } from '../consola/consola-auth-apoyo.js';
import type { ResultadoSondeo, SondeoEntidad } from '../ejecucion/consulta-ejecucion.js';
import { CONTRATO_CANONICO, type TipoSemantico } from '../contrato/contrato.js';
import { descifrarCredencial } from '../compartido/cripto-credencial.js';
import { verificarClave } from '../compartido/crypto-auth.js';
import { hashTokenAgente } from '../agente/agente-token.js';
import { ID_AGENTE_DEMO } from './demo/agente.js';
import { IDS_CANALES_DEMO } from './demo/canales.js';
import { IDS_REPORTES_DEMO, REPORTES_DEMO } from './demo/reportes.js';
import { IDS_DEMO, correoPanelCafe, leerEntornoDemo, sembrarDemo, type EntornoDemo } from './semilla-demo.js';

process.env.CREDENTIAL_MASTER_KEY ??= 'emVyb2Rhc2hib2FyZC1jbGF2ZS1kZS1wcnVlYmFzISE=';

/**
 * CH-31 (DEC-171): the demo seed. Its rows are written with fixed ids, so the suite removes
 * them before each case and after the last; the audit table is the one thing it cannot clean,
 * because the database refuses to delete from it (DEC-162), so the audit assertions count the
 * rows a run added rather than the rows that exist.
 *
 * CH-49 (b2): the four global reports and each tenant's dashboard come after both tenants. The
 * reports are global, so the suite deletes only the seeded ids, never by name or count.
 *
 * CH-49 (b1): the seed runs two tenants, Food Store and Café del Puerto, from one descriptor
 * each. Cases that read "the tenant" without a name mean Food Store, as before.
 *
 * The replica is not dialled: `sembrarDemo` takes the probe as a dependency and the cases
 * hand it a fake answer. The real probe is exercised by `validacion-mapeo-rutas.test.ts`.
 */

const ENV_COMPLETO: NodeJS.ProcessEnv = {
  REPLICA_DEMO_PASSWORD: 'ch31-clave-replica',
  DEMO_OPERADOR_CLAVE: 'ch31-clave-operador-larga',
  DEMO_PANEL_CORREO: ' Demo-CH31@Prueba.test ',
  DEMO_PANEL_CLAVE: 'ch31-clave-panel',
};

/** Valid by format only: the seed never contacts an agent. */
const TOKEN = `zda_${'A'.repeat(43)}`;
const OTRO_TOKEN = `zda_${'B'.repeat(43)}`;

const OID = pg.types.builtins;
/** A column type each semantic category accepts (see `aceptaTipo`). */
const OID_POR_TIPO: Record<TipoSemantico, number> = {
  identificador: OID.TEXT,
  texto: OID.TEXT,
  numero: OID.NUMERIC,
  booleano: OID.BOOL,
  fecha: OID.TIMESTAMPTZ,
};

/** A probe answer where every entity reports exactly its contract fields. */
function sondeoValido(
  entidades: readonly { entidad: string }[],
  sinCampo?: { entidad: string; campo: string },
): ResultadoSondeo {
  const respuestas = entidades.map((e): SondeoEntidad => {
    const contrato = CONTRATO_CANONICO.find((c) => c.nombre === e.entidad);
    return {
      entidad: e.entidad,
      resultado: 'ok',
      columnas: (contrato?.campos ?? [])
        .filter((c) => !(sinCampo?.entidad === e.entidad && sinCampo.campo === c.nombre))
        .map((c) => ({ nombre: c.nombre, oid: OID_POR_TIPO[c.tipo] })),
    };
  });
  return { resultado: 'ok', fase: 'ejecucion', entidades: respuestas, duracionMs: 3 };
}

const SONDEAR_OK = async (_destino: unknown, entidades: readonly { entidad: string }[]) => sondeoValido(entidades);

const SONDEAR_FALLO = async (): Promise<ResultadoSondeo> => ({
  resultado: 'fallo',
  fase: 'conexion',
  categoria: 'tiempo-agotado',
  codigo: null,
  duracionMs: 5,
});

/** A probe that answers per replica database: the one named `base` gets `respuesta`, the rest are valid. */
function sondearPorBase(base: string, respuesta: () => Promise<ResultadoSondeo>) {
  return async (destino: { database: string }, entidades: readonly { entidad: string }[]) =>
    destino.database === base ? respuesta() : sondeoValido(entidades);
}

const SONDEAR_NUNCA = async (): Promise<ResultadoSondeo> => {
  throw new Error('the probe must not run');
};

// ---- no server needed ------------------------------------------------------------------

describe('semilla demo — environment', () => {
  for (const nombre of ['REPLICA_DEMO_PASSWORD', 'DEMO_OPERADOR_CLAVE', 'DEMO_PANEL_CORREO', 'DEMO_PANEL_CLAVE']) {
    test(`a missing ${nombre} throws naming it`, () => {
      assert.throws(() => leerEntornoDemo({ ...ENV_COMPLETO, [nombre]: undefined }), new RegExp(nombre));
      assert.throws(() => leerEntornoDemo({ ...ENV_COMPLETO, [nombre]: '' }), new RegExp(nombre));
    });
  }

  test('an operator password under 12 characters is refused without echoing it', () => {
    const corta = 'corta-123';
    assert.throws(
      () => leerEntornoDemo({ ...ENV_COMPLETO, DEMO_OPERADOR_CLAVE: corta }),
      (error: Error) => /DEMO_OPERADOR_CLAVE/.test(error.message) && !error.message.includes(corta),
    );
  });

  test('an invalid panel email is refused without echoing it', () => {
    const invalido = 'sin-arroba';
    assert.throws(
      () => leerEntornoDemo({ ...ENV_COMPLETO, DEMO_PANEL_CORREO: invalido }),
      (error: Error) => /DEMO_PANEL_CORREO/.test(error.message) && !error.message.includes(invalido),
    );
  });

  test('Café del Puerto’s email is the panel email with +cafe before the @', () => {
    assert.equal(correoPanelCafe('demo-ch31@prueba.test'), 'demo-ch31+cafe@prueba.test');
    // Nothing is replaced: an existing tag stays and the new one is added after it.
    assert.equal(correoPanelCafe('ana+x@prueba.test'), 'ana+x+cafe@prueba.test');
  });

  test('a complete environment is read, with the email normalized', () => {
    const entorno = leerEntornoDemo(ENV_COMPLETO);
    assert.equal(entorno.correoPanel, 'demo-ch31@prueba.test');
    assert.equal(entorno.claveReplica, 'ch31-clave-replica');
  });

  test('the Telegram chat id is optional: unset and empty both read as no chat', () => {
    assert.equal(leerEntornoDemo(ENV_COMPLETO).telegramChatId, null);
    assert.equal(leerEntornoDemo({ ...ENV_COMPLETO, DEMO_TELEGRAM_CHAT_ID: '' }).telegramChatId, null);
  });

  test('a Telegram chat id is read as a bigint, negative group ids and the 64-bit limits included', () => {
    const chat = (valor: string) => leerEntornoDemo({ ...ENV_COMPLETO, DEMO_TELEGRAM_CHAT_ID: valor }).telegramChatId;
    assert.equal(chat('123456789'), 123456789n);
    assert.equal(chat('-1001234567890'), -1001234567890n);
    assert.equal(chat('9223372036854775807'), 9223372036854775807n);
    assert.equal(chat('-9223372036854775808'), -9223372036854775808n);
  });

  test('the agent token is optional: unset and empty both read as no token', () => {
    assert.equal(leerEntornoDemo(ENV_COMPLETO).agenteToken, null);
    assert.equal(leerEntornoDemo({ ...ENV_COMPLETO, DEMO_AGENTE_TOKEN: '' }).agenteToken, null);
  });

  test('a well-formed agent token is read as it is', () => {
    assert.equal(leerEntornoDemo({ ...ENV_COMPLETO, DEMO_AGENTE_TOKEN: TOKEN }).agenteToken, TOKEN);
  });

  for (const invalido of [
    'abc',
    `zda_${'A'.repeat(42)}`,
    `zda_${'A'.repeat(44)}`,
    `zdb_${'A'.repeat(43)}`,
    `zda_${'A'.repeat(42)}!`,
    ` zda_${'A'.repeat(43)}`,
    `zda_${'A'.repeat(43)}\n`,
  ]) {
    test(`the agent token of ${invalido.length} characters starting "${invalido.trim().slice(0, 4)}" is refused naming the variable, without echoing it`, () => {
      assert.throws(
        () => leerEntornoDemo({ ...ENV_COMPLETO, DEMO_AGENTE_TOKEN: invalido }),
        (error: Error) =>
          error.message ===
            'Invalid environment variable: DEMO_AGENTE_TOKEN must be an agent token (zda_ followed by 43 characters)' &&
          !error.message.includes(invalido.trim()),
      );
    });
  }

  for (const invalido of ['abc', '1.5', ' 12', '12 ', '+12', '--1', '9223372036854775808', '-9223372036854775809', '12345678901234567890']) {
    test(`the Telegram chat id "${invalido}" is refused naming the variable, without echoing it`, () => {
      assert.throws(
        () => leerEntornoDemo({ ...ENV_COMPLETO, DEMO_TELEGRAM_CHAT_ID: invalido }),
        (error: Error) =>
          error.message === 'Invalid environment variable: DEMO_TELEGRAM_CHAT_ID must be a Telegram chat id' &&
          !error.message.includes(invalido.trim()),
      );
    });
  }
});

// ---- live PostgreSQL -------------------------------------------------------------------

describe(
  'semilla demo — integration against the application database',
  { skip: alcanzable ? false : motivoSkip },
  () => {
    let db!: PrismaClient;
    let entorno!: EntornoDemo;

    /** Everything the seed writes, children first; the audit rows stay (DEC-162). */
    async function limpiar(): Promise<void> {
      for (const tenantId of [IDS_DEMO.tenant, IDS_DEMO.cafe.tenant]) {
        await db.tablero.deleteMany({ where: { tenantId } });
        await db.vinculoTelegram.deleteMany({ where: { tenantId } });
        await db.ejecucion.deleteMany({ where: { tenantId } });
        await db.automatizacion.deleteMany({ where: { tenantId } });
        await db.vistaCanonica.deleteMany({ where: { tenantId } });
        await db.consultaGuardadaVersion.deleteMany({ where: { tenantId } });
        await db.consultaGuardada.deleteMany({ where: { tenantId } });
        await db.conexion.deleteMany({ where: { tenantId } });
        // The agent goes after its connections (RESTRICT) and before the tenant.
        await db.agente.deleteMany({ where: { tenantId } });
        await db.sesionPanel.deleteMany({ where: { tenantId } });
        await db.usuario.deleteMany({ where: { tenantId } });
        await db.tenant.deleteMany({ where: { id: tenantId } });
      }
      // Reports are global: only the seeded ids go.
      await db.reporte.deleteMany({ where: { id: { in: REPORTES_DEMO.map((r) => r.id) } } });
      // The operator's sessions cascade with it.
      await db.operador.deleteMany({ where: { id: IDS_DEMO.operador } });
    }

    before(async () => {
      db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
      entorno = leerEntornoDemo(ENV_COMPLETO);
      // The automation points at a catalog template, as in the seed's own order.
      await sembrarCatalogoInicial(db.plantilla);
    });

    beforeEach(limpiar);

    after(async () => {
      await limpiar();
      await db.$disconnect();
    });

    function cuentas(tenantId: string = IDS_DEMO.tenant) {
      const where = { tenantId };
      return Promise.all([
        db.vistaCanonica.count({ where }),
        db.automatizacion.count({ where }),
        db.consultaGuardada.count({ where }),
        db.usuario.count({ where }),
        db.conexion.count({ where }),
      ]);
    }

    function reportesSembrados() {
      return db.reporte.count({ where: { id: { in: REPORTES_DEMO.map((r) => r.id) } } });
    }

    function tablerosDeLaDemo() {
      return db.tablero.count({ where: { tenantId: { in: [IDS_DEMO.tenant, IDS_DEMO.cafe.tenant] } } });
    }

    test('the first run creates every row with its fixed id, validates the five views and audits once', async () => {
      const antes = (
        await db.registroEjecucion.findMany({ where: { tenantId: IDS_DEMO.tenant }, select: { id: true } })
      ).map((f) => f.id);

      const { creadas } = await sembrarDemo(db, entorno, { sondear: SONDEAR_OK });
      assert.equal(creadas.length, 26, creadas.join(', '));

      const operador = await db.operador.findUniqueOrThrow({ where: { id: IDS_DEMO.operador } });
      assert.equal(operador.nombre, 'demo');
      assert.ok(await verificarClave(ENV_COMPLETO.DEMO_OPERADOR_CLAVE as string, operador.claveHash));

      const tenant = await db.tenant.findUniqueOrThrow({ where: { id: IDS_DEMO.tenant } });
      assert.equal(tenant.nombre, 'Food Store');

      const conexion = await db.conexion.findUniqueOrThrow({ where: { id: IDS_DEMO.conexion } });
      assert.deepEqual(
        [conexion.host, conexion.puerto, conexion.baseDeDatos, conexion.usuarioDb, conexion.motor, conexion.soloLectura, conexion.agenteId],
        ['replica-demo', 5432, 'food_store', 'lector_zerodashboard', 'postgres', true, null],
      );
      assert.notEqual(conexion.credencial, entorno.claveReplica);
      assert.equal(descifrarCredencial(conexion.credencial), entorno.claveReplica);

      const vistas = await db.vistaCanonica.findMany({ where: { tenantId: IDS_DEMO.tenant } });
      assert.deepEqual(vistas.map((v) => v.entidad).sort(), CONTRATO_CANONICO.map((e) => e.nombre).sort());
      for (const vista of vistas) {
        assert.equal(vista.id, IDS_DEMO.vistas[vista.entidad as keyof typeof IDS_DEMO.vistas]);
        assert.equal(vista.sql, `SELECT * FROM v_${vista.entidad}`);
        assert.equal(vista.estadoValidacion, 'valida', vista.entidad);
        assert.notEqual(vista.validadaEn, null);
      }

      const consulta = await db.consultaGuardada.findUniqueOrThrow({ where: { id: IDS_DEMO.consulta } });
      assert.equal(consulta.nombre, 'Productos con poco stock');
      assert.deepEqual(consulta.parametros, [{ nombre: 'umbral', tipo: 'numero' }]);
      assert.match(consulta.sql, /:umbral/);

      const usuario = await db.usuario.findUniqueOrThrow({ where: { id: IDS_DEMO.usuario } });
      assert.equal(usuario.correo, 'demo-ch31@prueba.test');
      assert.equal(usuario.nombre, 'Usuario demo');
      assert.ok(await verificarClave(ENV_COMPLETO.DEMO_PANEL_CLAVE as string, usuario.claveHash));

      // Food Store has no daily automation: its two every-minute ones are checked with the channels.
      assert.equal(await db.automatizacion.count({ where: { tenantId: IDS_DEMO.tenant, cron: '0 9 * * *' } }), 0);

      const filas = await db.registroEjecucion.findMany({
        where: { tenantId: IDS_DEMO.tenant, id: { notIn: antes } },
      });
      assert.equal(filas.length, 1);
      const [fila] = filas;
      assert.equal(fila?.origen, 'validacion-mapeo');
      assert.equal(fila?.operadorId, IDS_DEMO.operador);
      assert.equal(fila?.operadorNombre, 'demo');
      assert.equal(fila?.tenantNombre, 'Food Store');
      assert.equal(fila?.conexionId, IDS_DEMO.conexion);
      assert.equal(fila?.resultado, 'ok');
      assert.equal(fila?.consultaGuardadaId, null);
      assert.equal(fila?.plantillaId, null);
      const sentencias = (fila?.sql ?? '').split(';\n');
      assert.equal(sentencias.length, 5);
      CONTRATO_CANONICO.forEach((entidad, i) => {
        assert.match(sentencias[i] ?? '', new RegExp(`FROM v_${entidad.nombre}\\) AS _validacion LIMIT 0$`));
      });
    });

    test('the first run also seeds Café del Puerto with its own ids, database, user and audit row', async () => {
      const antes = (
        await db.registroEjecucion.findMany({ where: { tenantId: IDS_DEMO.cafe.tenant }, select: { id: true } })
      ).map((f) => f.id);

      const { creadas } = await sembrarDemo(db, entorno, { sondear: SONDEAR_OK });
      assert.deepEqual(
        creadas.filter((c) => c.startsWith('cafe:')),
        [
          'cafe:tenant',
          'cafe:conexion',
          'cafe:usuario',
          ...CONTRATO_CANONICO.map((e) => `cafe:vista:${e.nombre}`),
          'cafe:automatizacion',
          'cafe:tablero',
        ],
      );

      const tenant = await db.tenant.findUniqueOrThrow({ where: { id: IDS_DEMO.cafe.tenant } });
      assert.equal(tenant.nombre, 'Café del Puerto');

      const conexion = await db.conexion.findUniqueOrThrow({ where: { id: IDS_DEMO.cafe.conexion } });
      assert.deepEqual(
        [conexion.tenantId, conexion.nombre, conexion.host, conexion.puerto, conexion.baseDeDatos, conexion.usuarioDb, conexion.soloLectura, conexion.agenteId],
        [IDS_DEMO.cafe.tenant, 'cafe-del-puerto-demo', 'replica-demo', 5432, 'cafe_demo', 'lector_cafe_demo', true, null],
      );
      assert.equal(descifrarCredencial(conexion.credencial), entorno.claveReplica);

      const vistas = await db.vistaCanonica.findMany({ where: { tenantId: IDS_DEMO.cafe.tenant } });
      assert.deepEqual(vistas.map((v) => v.entidad).sort(), CONTRATO_CANONICO.map((e) => e.nombre).sort());
      for (const vista of vistas) {
        assert.equal(vista.id, IDS_DEMO.cafe.vistas[vista.entidad as keyof typeof IDS_DEMO.cafe.vistas]);
        assert.equal(vista.conexionId, IDS_DEMO.cafe.conexion);
        assert.equal(vista.estadoValidacion, 'valida', vista.entidad);
      }

      // No saved query: only Food Store keeps it.
      assert.equal(await db.consultaGuardada.count({ where: { tenantId: IDS_DEMO.cafe.tenant } }), 0);

      const usuario = await db.usuario.findUniqueOrThrow({ where: { id: IDS_DEMO.cafe.usuario } });
      assert.equal(usuario.tenantId, IDS_DEMO.cafe.tenant);
      assert.equal(usuario.correo, 'demo-ch31+cafe@prueba.test');
      assert.ok(await verificarClave(ENV_COMPLETO.DEMO_PANEL_CLAVE as string, usuario.claveHash));

      const automatizacion = await db.automatizacion.findUniqueOrThrow({ where: { id: IDS_DEMO.cafe.automatizacion } });
      assert.equal(automatizacion.plantillaId, ID_STOCK_FISICO);
      assert.equal(automatizacion.conexionId, IDS_DEMO.cafe.conexion);
      assert.deepEqual(automatizacion.valores, { umbral: 5 });
      assert.equal(automatizacion.cron, '0 9 * * *');
      assert.deepEqual(automatizacion.destinatarios, ['demo-ch31+cafe@prueba.test']);
      assert.equal(automatizacion.activo, true);

      const filas = await db.registroEjecucion.findMany({
        where: { tenantId: IDS_DEMO.cafe.tenant, id: { notIn: antes } },
      });
      assert.equal(filas.length, 1);
      assert.equal(filas[0]?.tenantNombre, 'Café del Puerto');
      assert.equal(filas[0]?.conexionId, IDS_DEMO.cafe.conexion);
      assert.equal(filas[0]?.resultado, 'ok');
      assert.equal(filas[0]?.operadorId, IDS_DEMO.operador);

      // Each tenant keeps its own rows.
      assert.deepEqual(await cuentas(IDS_DEMO.cafe.tenant), [5, 1, 0, 1, 1]);
      assert.deepEqual(await cuentas(), [5, 1, 1, 1, 1]);
    });

    test('the four reports and both dashboards are seeded after the tenants, by fixed id', async () => {
      const { creadas } = await sembrarDemo(db, entorno, { sondear: SONDEAR_OK });
      assert.deepEqual(
        creadas.filter((c) => c.startsWith('reporte:') || c.endsWith('tablero')),
        [...REPORTES_DEMO.map((r) => `reporte:${r.nombre}`), 'tablero', 'cafe:tablero'],
      );

      for (const entrada of REPORTES_DEMO) {
        const fila = await db.reporte.findUniqueOrThrow({ where: { id: entrada.id } });
        assert.deepEqual(
          [fila.nombre, fila.titulo, fila.descripcion, fila.sql, fila.entidades, fila.visualizacion, fila.columnas, fila.periodo],
          [entrada.nombre, entrada.titulo, entrada.descripcion, entrada.sql, entrada.entidades, entrada.visualizacion, entrada.columnas, entrada.periodo],
          entrada.nombre,
        );
      }

      const foodStore = await db.tablero.findUniqueOrThrow({ where: { tenantId: IDS_DEMO.tenant } });
      assert.deepEqual(
        [foodStore.id, foodStore.conexionId, foodStore.reportes],
        [
          IDS_DEMO.tablero,
          IDS_DEMO.conexion,
          [IDS_REPORTES_DEMO.ventas, IDS_REPORTES_DEMO.masVendido, IDS_REPORTES_DEMO.ventasPorDia, IDS_REPORTES_DEMO.stock],
        ],
      );
      const cafe = await db.tablero.findUniqueOrThrow({ where: { tenantId: IDS_DEMO.cafe.tenant } });
      assert.deepEqual(
        [cafe.id, cafe.conexionId, cafe.reportes],
        [
          IDS_DEMO.cafe.tablero,
          IDS_DEMO.cafe.conexion,
          [IDS_REPORTES_DEMO.ventas, IDS_REPORTES_DEMO.masVendido, IDS_REPORTES_DEMO.ventasPorDia],
        ],
      );
    });

    test('a dashboard the tenant already has is untouched and no second one is created', async () => {
      await sembrarDemo(db, entorno, { sondear: SONDEAR_OK });
      // The owner replaced Food Store's dashboard with one of their own (another id, one report);
      // Café del Puerto's was edited in place.
      await db.tablero.delete({ where: { tenantId: IDS_DEMO.tenant } });
      const propio = await db.tablero.create({
        data: { tenantId: IDS_DEMO.tenant, conexionId: IDS_DEMO.conexion, reportes: [IDS_REPORTES_DEMO.stock] },
      });
      await db.tablero.update({ where: { tenantId: IDS_DEMO.cafe.tenant }, data: { reportes: [IDS_REPORTES_DEMO.ventas] } });

      const { creadas } = await sembrarDemo(db, entorno, { sondear: SONDEAR_NUNCA });

      assert.deepEqual(creadas, []);
      assert.equal(await db.tablero.count({ where: { tenantId: IDS_DEMO.tenant } }), 1);
      const foodStore = await db.tablero.findUniqueOrThrow({ where: { tenantId: IDS_DEMO.tenant } });
      assert.deepEqual([foodStore.id, foodStore.reportes], [propio.id, [IDS_REPORTES_DEMO.stock]]);
      assert.notEqual(foodStore.id, IDS_DEMO.tablero);
      const cafe = await db.tablero.findUniqueOrThrow({ where: { tenantId: IDS_DEMO.cafe.tenant } });
      assert.deepEqual(cafe.reportes, [IDS_REPORTES_DEMO.ventas]);
    });

    test('a report that already exists is left as it is, and the missing ones are still created', async () => {
      await db.reporte.create({
        data: {
          id: IDS_REPORTES_DEMO.ventas,
          nombre: 'Editado por el dueño',
          titulo: 'Mis ventas',
          sql: 'SELECT 1 AS ventas',
          entidades: ['pedido'],
          visualizacion: 'numero',
          columnas: [{ rol: 'valor', columna: 'ventas', titulo: 'Ventas' }],
        },
      });

      const { creadas } = await sembrarDemo(db, entorno, { sondear: SONDEAR_OK });

      assert.equal(creadas.filter((c) => c.startsWith('reporte:')).length, 3);
      assert.equal(await reportesSembrados(), 4);
      const editado = await db.reporte.findUniqueOrThrow({ where: { id: IDS_REPORTES_DEMO.ventas } });
      assert.deepEqual([editado.nombre, editado.sql], ['Editado por el dueño', 'SELECT 1 AS ventas']);
    });

    test('a second run creates nothing, never probes, and keeps the owner’s edit', async () => {
      await sembrarDemo(db, entorno, { sondear: SONDEAR_OK });
      const editada = 'SELECT 1 AS editada';
      await db.consultaGuardada.update({
        where: { id: IDS_DEMO.consulta },
        data: { sql: editada, parametros: [], nombre: 'Editada por el dueño' },
      });
      await db.automatizacion.update({ where: { id: IDS_CANALES_DEMO.automatizacionCorreo }, data: { activo: false } });
      const antes = await db.registroEjecucion.count({ where: { tenantId: IDS_DEMO.tenant } });

      const { creadas } = await sembrarDemo(db, entorno, { sondear: SONDEAR_NUNCA });

      assert.deepEqual(creadas, []);
      assert.deepEqual(await cuentas(), [5, 1, 1, 1, 1]);
      assert.deepEqual(await cuentas(IDS_DEMO.cafe.tenant), [5, 1, 0, 1, 1]);
      assert.equal(await reportesSembrados(), 4);
      assert.equal(await tablerosDeLaDemo(), 2);
      const consulta = await db.consultaGuardada.findUniqueOrThrow({ where: { id: IDS_DEMO.consulta } });
      assert.equal(consulta.sql, editada);
      assert.equal(consulta.nombre, 'Editada por el dueño');
      assert.equal(
        (await db.automatizacion.findUniqueOrThrow({ where: { id: IDS_CANALES_DEMO.automatizacionCorreo } })).activo,
        false,
      );
      assert.equal(await db.registroEjecucion.count({ where: { tenantId: IDS_DEMO.tenant } }), antes);
    });

    test('a probe that does not answer throws naming the cause, creates no automation and can be retried', async () => {
      await assert.rejects(
        sembrarDemo(db, entorno, { sondear: SONDEAR_FALLO }),
        (error: Error) =>
          error.message === 'replica-demo did not answer: conexion · tiempo-agotado (no code)' &&
          !error.message.includes(entorno.claveReplica),
      );
      // Views of the failed run are gone, so the next start probes again.
      assert.deepEqual(await cuentas(), [0, 0, 1, 1, 1]);
      // Nothing that depends on the views exists: no dashboard, and the reports come after the tenants.
      assert.equal(await tablerosDeLaDemo(), 0);
      assert.equal(await reportesSembrados(), 0);

      const { creadas } = await sembrarDemo(db, entorno, { sondear: SONDEAR_OK });
      assert.ok(creadas.includes('automatizacion:correo-cada-minuto'));
      assert.deepEqual(await cuentas(), [5, 1, 1, 1, 1]);
    });

    test('an entity that is not valid after the probe throws naming it, and nothing depends on it', async () => {
      const sondear = async (_destino: unknown, entidades: readonly { entidad: string }[]) =>
        sondeoValido(entidades, { entidad: 'producto', campo: 'stockDisponible' });
      const antes = await db.registroEjecucion.count({ where: { tenantId: IDS_DEMO.tenant } });

      await assert.rejects(
        sembrarDemo(db, entorno, { sondear }),
        (error: Error) => /producto \(stockDisponible: ausente\)/.test(error.message) && !/pedido/.test(error.message),
      );

      assert.deepEqual(await cuentas(), [0, 0, 1, 1, 1]);
      assert.equal(await db.registroEjecucion.count({ where: { tenantId: IDS_DEMO.tenant } }), antes);
    });

    test('an old replica volume without cafe_demo fails with the recreate message and leaves no Café rows', async () => {
      const auditoriaAntes = await db.registroEjecucion.count({ where: { tenantId: IDS_DEMO.cafe.tenant } });
      const sondear = sondearPorBase('cafe_demo', async () => ({
        resultado: 'fallo',
        fase: 'conexion',
        categoria: 'base-inexistente',
        codigo: '3D000',
        duracionMs: 4,
      }));

      await assert.rejects(
        sembrarDemo(db, entorno, { sondear }),
        (error: Error) =>
          error.message === 'replica-demo has no database cafe_demo: recreate the volume with docker compose down -v' &&
          !error.message.includes(entorno.claveReplica),
      );

      // Food Store, seeded before the check, stays (its every-minute automations come last, so none yet); nothing of the second tenant exists.
      assert.deepEqual(await cuentas(), [5, 0, 1, 1, 1]);
      assert.equal(await db.tenant.count({ where: { id: IDS_DEMO.cafe.tenant } }), 0);
      assert.deepEqual(await cuentas(IDS_DEMO.cafe.tenant), [0, 0, 0, 0, 0]);
      assert.equal(await db.registroEjecucion.count({ where: { tenantId: IDS_DEMO.cafe.tenant } }), auditoriaAntes);
      // The reports and dashboards come after both tenants, so neither exists yet.
      assert.equal(await reportesSembrados(), 0);
      assert.equal(await tablerosDeLaDemo(), 0);
    });

    test('any other failure of cafe_demo keeps the probe’s closed message and leaves no Café rows', async () => {
      const sondear = sondearPorBase('cafe_demo', SONDEAR_FALLO);

      await assert.rejects(
        sembrarDemo(db, entorno, { sondear }),
        (error: Error) => error.message === 'replica-demo did not answer: conexion · tiempo-agotado (no code)',
      );

      assert.equal(await db.tenant.count({ where: { id: IDS_DEMO.cafe.tenant } }), 0);
      assert.deepEqual(await cuentas(IDS_DEMO.cafe.tenant), [0, 0, 0, 0, 0]);
    });

    test('the old-volume check is skipped once Café del Puerto exists', async () => {
      await sembrarDemo(db, entorno, { sondear: SONDEAR_OK });

      const { creadas } = await sembrarDemo(db, entorno, { sondear: SONDEAR_NUNCA });

      assert.deepEqual(creadas, []);
    });

    // ---- CH-49 (c): the every-minute automations and the Telegram link -----------------------

    const CHAT = 5550001234n;
    const entornoConChat = (): EntornoDemo => ({ ...entorno, telegramChatId: CHAT });

    test('without a chat id the email automation is created and no link or Telegram automation is', async () => {
      const { creadas } = await sembrarDemo(db, entorno, { sondear: SONDEAR_OK });

      assert.ok(creadas.includes('automatizacion:correo-cada-minuto'));
      assert.equal(creadas.includes('vinculo-telegram'), false);
      assert.equal(creadas.includes('automatizacion:telegram-cada-minuto'), false);
      assert.equal(await db.vinculoTelegram.count({ where: { tenantId: IDS_DEMO.tenant } }), 0);
      assert.equal(await db.automatizacion.count({ where: { id: IDS_CANALES_DEMO.automatizacionTelegram } }), 0);

      const correo = await db.automatizacion.findUniqueOrThrow({ where: { id: IDS_CANALES_DEMO.automatizacionCorreo } });
      assert.deepEqual(
        [correo.tenantId, correo.plantillaId, correo.conexionId, correo.valores, correo.cron, correo.minimoFilas, correo.canal, correo.activo],
        [IDS_DEMO.tenant, ID_STOCK_FISICO, IDS_DEMO.conexion, { umbral: 10 }, '* * * * *', 2, 'correo', true],
      );
      assert.deepEqual(correo.destinatarios, [
        'demo-ch31@prueba.test',
        'encargado@food-store.example',
        'compras@food-store.example',
      ]);
      // Food Store has no daily automation any more: this one is its only automation without a chat id.
      assert.equal(await db.automatizacion.count({ where: { tenantId: IDS_DEMO.tenant } }), 1);
      // Café del Puerto gets no every-minute one.
      assert.equal(await db.automatizacion.count({ where: { tenantId: IDS_DEMO.cafe.tenant, cron: '* * * * *' } }), 0);
    });

    test('with a chat id Food Store is linked, the Telegram automation exists and the id is not logged', async () => {
      const registro: string[] = [];
      const espiar = (...args: unknown[]) => void registro.push(args.map(String).join(' '));
      const originales = { log: console.log, info: console.info, warn: console.warn, error: console.error };
      Object.assign(console, { log: espiar, info: espiar, warn: espiar, error: espiar });
      let creadas: string[];
      try {
        ({ creadas } = await sembrarDemo(db, entornoConChat(), { sondear: SONDEAR_OK }));
      } finally {
        Object.assign(console, originales);
      }

      assert.deepEqual(
        creadas.filter((c) => c === 'vinculo-telegram' || c.endsWith('cada-minuto')),
        ['vinculo-telegram', 'automatizacion:correo-cada-minuto', 'automatizacion:telegram-cada-minuto'],
      );
      assert.equal(creadas.some((c) => c.includes(String(CHAT))), false);
      assert.equal(registro.some((linea) => linea.includes(String(CHAT))), false);

      const vinculo = await db.vinculoTelegram.findUniqueOrThrow({ where: { tenantId: IDS_DEMO.tenant } });
      assert.deepEqual([vinculo.id, vinculo.chatId], [IDS_CANALES_DEMO.vinculo, CHAT]);
      assert.equal(await db.vinculoTelegram.count({ where: { tenantId: IDS_DEMO.cafe.tenant } }), 0);

      const telegram = await db.automatizacion.findUniqueOrThrow({ where: { id: IDS_CANALES_DEMO.automatizacionTelegram } });
      assert.deepEqual(
        [telegram.tenantId, telegram.plantillaId, telegram.conexionId, telegram.valores, telegram.cron, telegram.minimoFilas, telegram.canal, telegram.destinatarios, telegram.activo],
        [IDS_DEMO.tenant, ID_STOCK_PRODUCIBLE, IDS_DEMO.conexion, { umbral: 20 }, '* * * * *', 1, 'telegram', [], true],
      );
    });

    test('a link the tenant already has, even to another chat, is untouched; the Telegram automation still follows it', async () => {
      await sembrarDemo(db, entorno, { sondear: SONDEAR_OK });
      const otro = await db.vinculoTelegram.create({ data: { tenantId: IDS_DEMO.tenant, chatId: 777n } });

      const { creadas } = await sembrarDemo(db, entornoConChat(), { sondear: SONDEAR_NUNCA });

      assert.deepEqual(creadas, ['automatizacion:telegram-cada-minuto']);
      const vinculo = await db.vinculoTelegram.findUniqueOrThrow({ where: { tenantId: IDS_DEMO.tenant } });
      assert.deepEqual([vinculo.id, vinculo.chatId], [otro.id, 777n]);
      assert.equal(await db.vinculoTelegram.count({ where: { tenantId: IDS_DEMO.tenant } }), 1);
    });

    test('a second run with the chat id creates nothing and keeps the owner’s edit of the every-minute automation', async () => {
      await sembrarDemo(db, entornoConChat(), { sondear: SONDEAR_OK });
      await db.automatizacion.update({
        where: { id: IDS_CANALES_DEMO.automatizacionCorreo },
        data: { activo: false, valores: { umbral: 20 } },
      });

      const { creadas } = await sembrarDemo(db, entornoConChat(), { sondear: SONDEAR_NUNCA });

      assert.deepEqual(creadas, []);
      assert.deepEqual(await cuentas(), [5, 2, 1, 1, 1]);
      assert.equal(await db.vinculoTelegram.count({ where: { tenantId: IDS_DEMO.tenant } }), 1);
      const correo = await db.automatizacion.findUniqueOrThrow({ where: { id: IDS_CANALES_DEMO.automatizacionCorreo } });
      assert.deepEqual([correo.activo, correo.valores], [false, { umbral: 20 }]);
    });

    // ---- CH-49 (d): the seeded agent ---------------------------------------------------------

    const entornoConAgente = (token: string = TOKEN): EntornoDemo => ({ ...entorno, agenteToken: token });
    const agenteIdDeLaConexion = async () =>
      (await db.conexion.findUniqueOrThrow({ where: { id: IDS_DEMO.conexion } })).agenteId;

    test('with a token Food Store gets an agent that holds only the hash, and its connection is bound to it', async () => {
      const { creadas } = await sembrarDemo(db, entornoConAgente(), { sondear: SONDEAR_OK });

      assert.deepEqual(
        creadas.filter((c) => c === 'tenant' || c === 'agente' || c === 'conexion'),
        ['tenant', 'agente', 'conexion'],
      );
      assert.equal(creadas.some((c) => c.includes(TOKEN)), false);

      const agente = await db.agente.findUniqueOrThrow({ where: { tenantId: IDS_DEMO.tenant } });
      assert.deepEqual([agente.id, agente.tokenHash, agente.revocadoEn], [ID_AGENTE_DEMO, hashTokenAgente(TOKEN), null]);
      // No column of the agent's row, nor of the connection's, carries the token.
      assert.equal(JSON.stringify(agente).includes(TOKEN), false);

      const conexion = await db.conexion.findUniqueOrThrow({ where: { id: IDS_DEMO.conexion } });
      assert.equal(conexion.agenteId, ID_AGENTE_DEMO);
      // Host and port stay as the agent sees them; the credential is still the replica's.
      assert.deepEqual([conexion.host, conexion.puerto], ['replica-demo', 5432]);
      assert.equal(JSON.stringify(conexion).includes(TOKEN), false);
      assert.equal(descifrarCredencial(conexion.credencial), entorno.claveReplica);

      // Café del Puerto stays direct, and Food Store's views are validated all the same.
      assert.equal((await db.conexion.findUniqueOrThrow({ where: { id: IDS_DEMO.cafe.conexion } })).agenteId, null);
      assert.equal(await db.agente.count({ where: { tenantId: IDS_DEMO.cafe.tenant } }), 0);
      assert.deepEqual(await cuentas(), [5, 1, 1, 1, 1]);
    });

    test('the token never reaches the log', async () => {
      const registro: string[] = [];
      const espiar = (...args: unknown[]) => void registro.push(args.map(String).join(' '));
      const originales = { log: console.log, info: console.info, warn: console.warn, error: console.error };
      Object.assign(console, { log: espiar, info: espiar, warn: espiar, error: espiar });
      try {
        await sembrarDemo(db, entornoConAgente(), { sondear: SONDEAR_OK });
      } finally {
        Object.assign(console, originales);
      }
      assert.equal(registro.some((linea) => linea.includes(TOKEN)), false);
    });

    test('without a token there is no agent and the connection is direct', async () => {
      const { creadas } = await sembrarDemo(db, entorno, { sondear: SONDEAR_OK });

      assert.equal(creadas.includes('agente'), false);
      assert.equal(await db.agente.count({ where: { tenantId: IDS_DEMO.tenant } }), 0);
      assert.equal(await agenteIdDeLaConexion(), null);
    });

    test('an agent the tenant already has is untouched, whatever its token, and the new connection binds to it', async () => {
      await db.tenant.create({ data: { id: IDS_DEMO.tenant, nombre: 'Food Store' } });
      const propio = await db.agente.create({
        data: {
          id: '00000000-0000-4000-8000-0000000000a1',
          tenantId: IDS_DEMO.tenant,
          tokenHash: hashTokenAgente(OTRO_TOKEN),
        },
      });

      const { creadas } = await sembrarDemo(db, entornoConAgente(), { sondear: SONDEAR_OK });

      assert.equal(creadas.includes('agente'), false);
      assert.equal(await db.agente.count({ where: { tenantId: IDS_DEMO.tenant } }), 1);
      const agente = await db.agente.findUniqueOrThrow({ where: { tenantId: IDS_DEMO.tenant } });
      assert.deepEqual(
        [agente.id, agente.tokenHash, agente.tokenEmitidoEn.getTime()],
        [propio.id, hashTokenAgente(OTRO_TOKEN), propio.tokenEmitidoEn.getTime()],
      );
      assert.equal(await agenteIdDeLaConexion(), propio.id);
    });

    test('a direct connection that already exists stays direct when a token is added later', async () => {
      await sembrarDemo(db, entorno, { sondear: SONDEAR_OK });

      const { creadas } = await sembrarDemo(db, entornoConAgente(), { sondear: SONDEAR_NUNCA });

      assert.deepEqual(creadas, ['agente']);
      assert.equal(await db.agente.count({ where: { tenantId: IDS_DEMO.tenant } }), 1);
      assert.equal(await agenteIdDeLaConexion(), null);
    });

    test('a second run with the token creates nothing and keeps the binding', async () => {
      await sembrarDemo(db, entornoConAgente(), { sondear: SONDEAR_OK });

      const { creadas } = await sembrarDemo(db, entornoConAgente(), { sondear: SONDEAR_NUNCA });

      assert.deepEqual(creadas, []);
      assert.equal(await db.agente.count({ where: { tenantId: IDS_DEMO.tenant } }), 1);
      assert.equal(await agenteIdDeLaConexion(), ID_AGENTE_DEMO);
    });

    test('a probe that fails after the agent was created leaves it, and the retry finishes the demo bound', async () => {
      await assert.rejects(sembrarDemo(db, entornoConAgente(), { sondear: SONDEAR_FALLO }));
      assert.equal(await db.agente.count({ where: { tenantId: IDS_DEMO.tenant } }), 1);

      await sembrarDemo(db, entornoConAgente(), { sondear: SONDEAR_OK });
      assert.equal(await agenteIdDeLaConexion(), ID_AGENTE_DEMO);
      assert.deepEqual(await cuentas(), [5, 1, 1, 1, 1]);
    });
  },
);
