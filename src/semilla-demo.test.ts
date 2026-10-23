import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { ID_STOCK_FISICO, sembrarCatalogoInicial } from './catalogo-inicial.js';
import { alcanzable, databaseUrl, motivoSkip } from './consola-auth-apoyo.js';
import type { ResultadoSondeo, SondeoEntidad } from './ejecucion/consulta-ejecucion.js';
import { CONTRATO_CANONICO, type TipoSemantico } from './contrato/contrato.js';
import { descifrarCredencial } from './compartido/cripto-credencial.js';
import { verificarClave } from './compartido/crypto-auth.js';
import { IDS_DEMO, leerEntornoDemo, sembrarDemo, type EntornoDemo } from './semilla-demo.js';

process.env.CREDENTIAL_MASTER_KEY ??= 'emVyb2Rhc2hib2FyZC1jbGF2ZS1kZS1wcnVlYmFzISE=';

/**
 * CH-31 (DEC-171): the demo seed. Its rows are written with fixed ids, so the suite removes
 * them before each case and after the last; the audit table is the one thing it cannot clean,
 * because the database refuses to delete from it (DEC-162), so the audit assertions count the
 * rows a run added rather than the rows that exist.
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

  test('a complete environment is read, with the email normalized', () => {
    const entorno = leerEntornoDemo(ENV_COMPLETO);
    assert.equal(entorno.correoPanel, 'demo-ch31@prueba.test');
    assert.equal(entorno.claveReplica, 'ch31-clave-replica');
  });
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
      const tenantId = IDS_DEMO.tenant;
      await db.ejecucion.deleteMany({ where: { tenantId } });
      await db.automatizacion.deleteMany({ where: { tenantId } });
      await db.vistaCanonica.deleteMany({ where: { tenantId } });
      await db.consultaGuardadaVersion.deleteMany({ where: { tenantId } });
      await db.consultaGuardada.deleteMany({ where: { tenantId } });
      await db.conexion.deleteMany({ where: { tenantId } });
      await db.sesionPanel.deleteMany({ where: { tenantId } });
      await db.usuario.deleteMany({ where: { tenantId } });
      await db.tenant.deleteMany({ where: { id: tenantId } });
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

    function cuentas() {
      const where = { tenantId: IDS_DEMO.tenant };
      return Promise.all([
        db.vistaCanonica.count({ where }),
        db.automatizacion.count({ where }),
        db.consultaGuardada.count({ where }),
        db.usuario.count({ where }),
        db.conexion.count({ where }),
      ]);
    }

    test('the first run creates every row with its fixed id, validates the five views and audits once', async () => {
      const antes = (
        await db.registroEjecucion.findMany({ where: { tenantId: IDS_DEMO.tenant }, select: { id: true } })
      ).map((f) => f.id);

      const { creadas } = await sembrarDemo(db, entorno, { sondear: SONDEAR_OK });
      assert.equal(creadas.length, 11, creadas.join(', '));

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

      const automatizacion = await db.automatizacion.findUniqueOrThrow({ where: { id: IDS_DEMO.automatizacion } });
      assert.equal(automatizacion.plantillaId, ID_STOCK_FISICO);
      assert.equal(automatizacion.conexionId, IDS_DEMO.conexion);
      assert.deepEqual(automatizacion.valores, { umbral: 5 });
      assert.equal(automatizacion.cron, '0 9 * * *');
      assert.equal(automatizacion.destinatario, 'demo-ch31@prueba.test');
      assert.equal(automatizacion.activo, true);

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

    test('a second run creates nothing, never probes, and keeps the owner’s edit', async () => {
      await sembrarDemo(db, entorno, { sondear: SONDEAR_OK });
      const editada = 'SELECT 1 AS editada';
      await db.consultaGuardada.update({
        where: { id: IDS_DEMO.consulta },
        data: { sql: editada, parametros: [], nombre: 'Editada por el dueño' },
      });
      await db.automatizacion.update({ where: { id: IDS_DEMO.automatizacion }, data: { activo: false } });
      const antes = await db.registroEjecucion.count({ where: { tenantId: IDS_DEMO.tenant } });

      const { creadas } = await sembrarDemo(db, entorno, { sondear: SONDEAR_NUNCA });

      assert.deepEqual(creadas, []);
      assert.deepEqual(await cuentas(), [5, 1, 1, 1, 1]);
      const consulta = await db.consultaGuardada.findUniqueOrThrow({ where: { id: IDS_DEMO.consulta } });
      assert.equal(consulta.sql, editada);
      assert.equal(consulta.nombre, 'Editada por el dueño');
      assert.equal(
        (await db.automatizacion.findUniqueOrThrow({ where: { id: IDS_DEMO.automatizacion } })).activo,
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

      const { creadas } = await sembrarDemo(db, entorno, { sondear: SONDEAR_OK });
      assert.ok(creadas.includes('automatizacion'));
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
  },
);
