import { ID_STOCK_FISICO } from '../../plantillas/catalogo-inicial.js';
import type { sondearEstructura } from '../../ejecucion/consulta-ejecucion.js';
import { CONTRATO_CANONICO } from '../../contrato/contrato.js';
import { cifrarCredencial } from '../../compartido/cripto-credencial.js';
import { hashearClave } from '../../compartido/crypto-auth.js';
import type { VistaASentenciar } from '../../mapeo/validacion-mapeo.js';
import {
  crearSiFalta,
  destinoDeReplica,
  mensajeSinRespuesta,
  validarVistas,
  type ClienteSemilla,
  type OperadorDemo,
  type TenantDemo,
} from './comun.js';

/**
 * The saved query reads the real table, not a canonical view: saved queries run raw
 * against the replica (no view composition). `:umbral` is the CH-11 marker syntax of
 * `src/ejecucion/parametros.ts`; the `::numeric` cast lets a decimal threshold bind against the
 * integer column, as the catalog's `stock-fisico` does. Only Food Store's replica has `product`.
 */
const SQL_CONSULTA = `SELECT
  name AS "Producto",
  stock_quantity AS "Stock"
FROM product
WHERE deleted_at IS NULL
  AND stock_quantity::numeric <= :umbral
ORDER BY stock_quantity ASC, name ASC, id ASC`;

const CRON_DEMO = '0 9 * * *';
const UMBRAL_DEMO = 5;

export interface ContextoTenantDemo {
  sondear: typeof sondearEstructura;
  claveReplica: string;
  clavePanel: string;
  operador: OperadorDemo;
  creadas: string[];
}

/**
 * Closes the old-volume case before any row exists: a `replica-demo-data` volume created
 * before CH-49 has no `cafe_demo`, and the views' probe would fail only after the tenant, the
 * connection and the user were written. The empty probe only dials, so the answer is the
 * connection's. Only `base-inexistente` gets the recreate-the-volume text; any other failure
 * keeps the probe's closed message.
 */
export async function verificarBaseDeReplica(
  tenant: TenantDemo,
  contexto: Pick<ContextoTenantDemo, 'sondear' | 'claveReplica'>,
): Promise<void> {
  const sondeo = await contexto.sondear(destinoDeReplica(tenant, contexto.claveReplica), []);
  if (sondeo.resultado !== 'fallo') {
    return;
  }
  if (sondeo.categoria === 'base-inexistente') {
    throw new Error(
      `replica-demo has no database ${tenant.replica.baseDatos}: recreate the volume with docker compose down -v`,
    );
  }
  throw new Error(mensajeSinRespuesta(sondeo.fase, sondeo.categoria, sondeo.codigo));
}

/**
 * Seeds one tenant from its descriptor: the tenant, its connection, the optional saved query,
 * its panel user, the five views with the probe and the daily automation. `agenteId` binds the
 * connection to an agent when the row is created; it stays `null` until the agent unit.
 * Throws, naming the cause, when the replica does not answer or an entity is not valid after
 * the probe; the views of this run are then removed and the automation is not created.
 */
export async function sembrarTenant(
  prisma: ClienteSemilla,
  tenant: TenantDemo,
  contexto: ContextoTenantDemo,
  agenteId: string | null = null,
): Promise<void> {
  const { creadas } = contexto;
  const etiqueta = (nombre: string): string => `${tenant.prefijoEtiqueta}${nombre}`;
  const { tenant: tenantId, conexion: conexionId } = tenant.ids;

  await crearSiFalta(
    creadas,
    etiqueta('tenant'),
    () => prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } }),
    () => prisma.tenant.create({ data: { id: tenantId, nombre: tenant.nombre } }),
  );

  await crearSiFalta(
    creadas,
    etiqueta('conexion'),
    () => prisma.conexion.findUnique({ where: { id: conexionId }, select: { id: true } }),
    () =>
      prisma.conexion.create({
        data: {
          id: conexionId,
          tenantId,
          nombre: tenant.replica.nombreConexion,
          motor: 'postgres',
          host: tenant.replica.host,
          puerto: tenant.replica.puerto,
          baseDeDatos: tenant.replica.baseDatos,
          usuarioDb: tenant.replica.usuario,
          // Enciphered like any registered connection (CH-07); no agent unless the caller
          // binds one: the replica is reachable directly inside the Compose network.
          credencial: cifrarCredencial(contexto.claveReplica),
          soloLectura: true,
          agenteId,
        },
      }),
  );

  if (tenant.ids.consulta !== undefined) {
    const consultaId = tenant.ids.consulta;
    await crearSiFalta(
      creadas,
      etiqueta('consulta'),
      () => prisma.consultaGuardada.findUnique({ where: { id: consultaId }, select: { id: true } }),
      () =>
        prisma.consultaGuardada.create({
          data: {
            id: consultaId,
            tenantId,
            nombre: 'Productos con poco stock',
            sql: SQL_CONSULTA,
            parametros: [{ nombre: 'umbral', tipo: 'numero' }],
          },
        }),
    );
  }

  // `correo` is unique across tenants: an existing user with this email, whatever its id,
  // is left as it is.
  await crearSiFalta(
    creadas,
    etiqueta('usuario'),
    () =>
      prisma.usuario.findFirst({
        where: { OR: [{ id: tenant.ids.usuario }, { correo: tenant.correoPanel }] },
        select: { id: true },
      }),
    async () =>
      prisma.usuario.create({
        data: {
          id: tenant.ids.usuario,
          tenantId,
          correo: tenant.correoPanel,
          claveHash: await hashearClave(contexto.clavePanel),
          nombre: 'Usuario demo',
        },
      }),
  );

  // The five views, one per contract entity, in contract order.
  const nuevas: VistaASentenciar[] = [];
  for (const entidad of CONTRATO_CANONICO) {
    const id = tenant.ids.vistas[entidad.nombre] as string;
    const fila = await crearSiFalta(
      creadas,
      etiqueta(`vista:${entidad.nombre}`),
      () =>
        prisma.vistaCanonica.findFirst({
          where: { OR: [{ id }, { conexionId, entidad: entidad.nombre }] },
          select: { id: true },
        }),
      () =>
        prisma.vistaCanonica.create({
          data: { id, tenantId, conexionId, entidad: entidad.nombre, sql: `SELECT * FROM v_${entidad.nombre}` },
          select: { id: true, entidad: true, sql: true, actualizadaEn: true },
        }),
    );
    if (fila !== null) {
      nuevas.push(fila);
    }
  }

  // The probe runs only for views this run created: a restart finds them already
  // validated (or edited by the owner) and does not touch them.
  if (nuevas.length > 0) {
    try {
      await validarVistas(prisma, contexto, tenant, nuevas);
    } catch (error) {
      // Leaving the rows would make the next start skip the probe and go on to create an
      // automation over views nobody validated.
      await prisma.vistaCanonica.deleteMany({ where: { id: { in: nuevas.map((v) => v.id) } } });
      throw error;
    }
  }

  await crearSiFalta(
    creadas,
    etiqueta('automatizacion'),
    () => prisma.automatizacion.findUnique({ where: { id: tenant.ids.automatizacion }, select: { id: true } }),
    () =>
      prisma.automatizacion.create({
        data: {
          id: tenant.ids.automatizacion,
          tenantId,
          plantillaId: ID_STOCK_FISICO,
          conexionId,
          valores: { umbral: UMBRAL_DEMO },
          cron: CRON_DEMO,
          destinatarios: [tenant.correoPanel],
          activo: true,
        },
      }),
  );
}
