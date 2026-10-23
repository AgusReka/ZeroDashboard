import { filaDeAuditoria, veredictoDeSondeo } from '../auditoria/auditoria.js';
import { ID_STOCK_FISICO } from '../plantillas/catalogo-inicial.js';
import { sentenciaDeSondeo, sondearEstructura } from '../ejecucion/consulta-ejecucion.js';
import { CONTRATO_CANONICO } from '../contrato/contrato.js';
import { cifrarCredencial } from '../compartido/cripto-credencial.js';
import { hashearClave } from '../compartido/crypto-auth.js';
import type { DestinoPostgres } from '../ejecucion/db-probe.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { LARGO_MINIMO_CLAVE, validarClave } from '../operador-alta.js';
import { correoValido, normalizarCorreo } from '../usuarios/usuarios-panel.js';
import {
  diagnosticar,
  registrarVeredictos,
  type DiagnosticoValidacion,
  type VistaASentenciar,
} from '../mapeo/validacion-mapeo.js';

/**
 * CH-31 (DEC-171): the opt-in demo seed. With `SEED_DEMO=1` a fresh environment gets a
 * working tenant: the operator `demo`, "Food Store" with its connection to the
 * `replica-demo` service, the five canonical views validated by the same probe as
 * `POST /conexiones/:id/validacion-mapeo`, one saved query, a panel user and an active
 * automation. `prisma/seed.ts` calls it only when the variable is exactly `1`.
 *
 * Every row has a fixed id and is created only if absent (DEC-125's rule): an existing row
 * is never updated or deleted, so a restart leaves the owner's edits alone. The one
 * exception to "never deleted" is a view this very run created, removed again when its
 * validation fails, so the next start probes it instead of finding an unvalidated row and
 * skipping the probe.
 *
 * It runs outside any request, with the plain client: there is no tenant context to inject
 * `tenantId` from, so every write names it. Errors name a variable, an entity or the
 * replica's `fase · categoria (codigo)`, never a secret and never the driver's error.
 */

/** Fixed ids, so restarts are idempotent and nothing depends on a name. */
export const IDS_DEMO = {
  operador: '31d00000-0000-4000-8000-000000000001',
  tenant: '31d00000-0000-4000-8000-000000000002',
  conexion: '31d00000-0000-4000-8000-000000000003',
  vistas: {
    producto: '31d00000-0000-4000-8000-000000000011',
    insumo: '31d00000-0000-4000-8000-000000000012',
    receta_componente: '31d00000-0000-4000-8000-000000000013',
    pedido: '31d00000-0000-4000-8000-000000000014',
    item_pedido: '31d00000-0000-4000-8000-000000000015',
  },
  consulta: '31d00000-0000-4000-8000-000000000021',
  usuario: '31d00000-0000-4000-8000-000000000022',
  automatizacion: '31d00000-0000-4000-8000-000000000023',
} as const;

const NOMBRE_OPERADOR = 'demo';
const NOMBRE_TENANT = 'Food Store';

/** Where the app reaches the replica inside the Compose network (DEC-170). */
const REPLICA = {
  nombre: 'food-store-demo',
  motor: 'postgres',
  host: 'replica-demo',
  puerto: 5432,
  baseDeDatos: 'food_store',
  usuarioDb: 'lector_zerodashboard',
} as const;

/**
 * The saved query reads the real table, not a canonical view: saved queries run raw
 * against the replica (no view composition). `:umbral` is the CH-11 marker syntax of
 * `src/ejecucion/parametros.ts`; the `::numeric` cast lets a decimal threshold bind against the
 * integer column, as the catalog's `stock-fisico` does.
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

/** The four variables the seed needs besides the ones the app already requires. */
export interface EntornoDemo {
  /** The read-only role's password: also what `REPLICA_DEMO_PASSWORD` gives the container. */
  claveReplica: string;
  claveOperador: string;
  /** Already normalized. */
  correoPanel: string;
  clavePanel: string;
}

function variable(env: NodeJS.ProcessEnv, nombre: string): string {
  const valor = env[nombre];
  if (valor === undefined || valor === '') {
    throw new Error(`Missing required environment variable: ${nombre}`);
  }
  return valor;
}

/**
 * Reads and checks the demo variables. A missing or invalid one throws naming the
 * variable and, for an invalid one, the rule, never the value.
 */
export function leerEntornoDemo(env: NodeJS.ProcessEnv = process.env): EntornoDemo {
  const claveReplica = variable(env, 'REPLICA_DEMO_PASSWORD');

  const claveOperador = variable(env, 'DEMO_OPERADOR_CLAVE');
  if (!validarClave(claveOperador)) {
    throw new Error(
      `Invalid environment variable: DEMO_OPERADOR_CLAVE must have at least ${LARGO_MINIMO_CLAVE} characters`,
    );
  }

  const correoPanel = normalizarCorreo(variable(env, 'DEMO_PANEL_CORREO'));
  if (!correoValido(correoPanel)) {
    throw new Error('Invalid environment variable: DEMO_PANEL_CORREO is not a valid email address');
  }

  const clavePanel = variable(env, 'DEMO_PANEL_CLAVE');
  return { claveReplica, claveOperador, correoPanel, clavePanel };
}

/** Only the delegates the seed touches, so the test client and the seed's both fit. */
export type ClienteSemilla = Pick<
  PrismaClient,
  | 'operador'
  | 'tenant'
  | 'conexion'
  | 'vistaCanonica'
  | 'consultaGuardada'
  | 'usuario'
  | 'automatizacion'
  | 'registroEjecucion'
>;

export interface DependenciasDemo {
  /** The structure probe. Injected by tests; the real one dials the replica. */
  sondear?: typeof sondearEstructura;
}

export interface ResumenDemo {
  /** What this run created, by label; empty when everything was already there. */
  creadas: string[];
}

/** The reason an entity is not valid, in machine tokens: no secret can be in it. */
function motivoInvalida(diagnostico: DiagnosticoValidacion): string {
  if (diagnostico.sondeo.resultado === 'fallo') {
    return `${diagnostico.sondeo.categoria} (${diagnostico.sondeo.codigo ?? 'no code'})`;
  }
  const campos = diagnostico.campos
    .filter((c) => c.veredicto !== 'ok')
    .map((c) => `${c.campo}: ${c.veredicto}`);
  const sobrantes = diagnostico.columnasSobrantes.map((c) => `extra column ${c.columna}`);
  return [...campos, ...sobrantes].join(', ');
}

/** Creates the row when `buscar` finds none; returns what `crear` returned, or `null`. */
async function crearSiFalta<T>(
  creadas: string[],
  etiqueta: string,
  buscar: () => Promise<unknown>,
  crear: () => Promise<T>,
): Promise<T | null> {
  if ((await buscar()) !== null) {
    return null;
  }
  const fila = await crear();
  creadas.push(etiqueta);
  return fila;
}

/**
 * Seeds whatever the demo is missing. Call `leerEntornoDemo` first. Throws, naming the
 * cause, when the replica does not answer or an entity is not valid after the probe; in
 * both cases the automation is not created and the views of this run are removed.
 */
export async function sembrarDemo(
  prisma: ClienteSemilla,
  entorno: EntornoDemo,
  deps: DependenciasDemo = {},
): Promise<ResumenDemo> {
  const sondear = deps.sondear ?? sondearEstructura;
  const creadas: string[] = [];
  const { tenant: tenantId, conexion: conexionId } = IDS_DEMO;

  // The operator is the one row with a second unique key (`nombre`): a `demo` created by
  // `npm run operador:alta` has another id, and creating over it would fail. It is used
  // as it is, for the audit row's attribution only.
  const operadorExistente = await prisma.operador.findFirst({
    where: { OR: [{ id: IDS_DEMO.operador }, { nombre: NOMBRE_OPERADOR }] },
    select: { id: true },
  });
  if (operadorExistente === null) {
    await prisma.operador.create({
      data: {
        id: IDS_DEMO.operador,
        nombre: NOMBRE_OPERADOR,
        claveHash: await hashearClave(entorno.claveOperador),
      },
    });
    creadas.push('operador');
  }
  const operadorId = operadorExistente?.id ?? IDS_DEMO.operador;

  await crearSiFalta(
    creadas,
    'tenant',
    () => prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } }),
    () => prisma.tenant.create({ data: { id: tenantId, nombre: NOMBRE_TENANT } }),
  );

  await crearSiFalta(
    creadas,
    'conexion',
    () => prisma.conexion.findUnique({ where: { id: conexionId }, select: { id: true } }),
    () =>
      prisma.conexion.create({
        data: {
          id: conexionId,
          tenantId,
          ...REPLICA,
          // Enciphered like any registered connection (CH-07); no agent: the replica is
          // reachable directly inside the Compose network.
          credencial: cifrarCredencial(entorno.claveReplica),
          soloLectura: true,
        },
      }),
  );

  await crearSiFalta(
    creadas,
    'consulta',
    () => prisma.consultaGuardada.findUnique({ where: { id: IDS_DEMO.consulta }, select: { id: true } }),
    () =>
      prisma.consultaGuardada.create({
        data: {
          id: IDS_DEMO.consulta,
          tenantId,
          nombre: 'Productos con poco stock',
          sql: SQL_CONSULTA,
          parametros: [{ nombre: 'umbral', tipo: 'numero' }],
        },
      }),
  );

  // `correo` is unique across tenants: an existing user with this email, whatever its id,
  // is left as it is.
  await crearSiFalta(
    creadas,
    'usuario',
    () =>
      prisma.usuario.findFirst({
        where: { OR: [{ id: IDS_DEMO.usuario }, { correo: entorno.correoPanel }] },
        select: { id: true },
      }),
    async () =>
      prisma.usuario.create({
        data: {
          id: IDS_DEMO.usuario,
          tenantId,
          correo: entorno.correoPanel,
          claveHash: await hashearClave(entorno.clavePanel),
          nombre: 'Usuario demo',
        },
      }),
  );

  // The five views, one per contract entity, in contract order.
  const nuevas: VistaASentenciar[] = [];
  for (const entidad of CONTRATO_CANONICO) {
    const id = IDS_DEMO.vistas[entidad.nombre as keyof typeof IDS_DEMO.vistas];
    const fila = await crearSiFalta(
      creadas,
      `vista:${entidad.nombre}`,
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
      await validarVistas(prisma, sondear, entorno, nuevas, operadorId);
    } catch (error) {
      // Leaving the rows would make the next start skip the probe and go on to create an
      // automation over views nobody validated.
      await prisma.vistaCanonica.deleteMany({ where: { id: { in: nuevas.map((v) => v.id) } } });
      throw error;
    }
  }

  await crearSiFalta(
    creadas,
    'automatizacion',
    () => prisma.automatizacion.findUnique({ where: { id: IDS_DEMO.automatizacion }, select: { id: true } }),
    () =>
      prisma.automatizacion.create({
        data: {
          id: IDS_DEMO.automatizacion,
          tenantId,
          plantillaId: ID_STOCK_FISICO,
          conexionId,
          valores: { umbral: UMBRAL_DEMO },
          cron: CRON_DEMO,
          destinatario: entorno.correoPanel,
          activo: true,
        },
      }),
  );

  return { creadas };
}

/**
 * The route's validation, without the route: probe the views, judge each entity, persist
 * the verdicts and write the audit row (CH-20, DEC-159). Nothing is written until every
 * entity is `valida`.
 */
async function validarVistas(
  prisma: ClienteSemilla,
  sondear: typeof sondearEstructura,
  entorno: EntornoDemo,
  vistas: readonly VistaASentenciar[],
  operadorId: string,
): Promise<void> {
  const destino: DestinoPostgres & { id: string } = {
    id: IDS_DEMO.conexion,
    host: REPLICA.host,
    port: REPLICA.puerto,
    database: REPLICA.baseDeDatos,
    user: REPLICA.usuarioDb,
    // The plaintext from the environment: it is what was just enciphered into the row.
    password: entorno.claveReplica,
  };

  const sondeo = await sondear(
    destino,
    vistas.map((v) => ({ entidad: v.entidad, sql: v.sql })),
  );
  if (sondeo.resultado === 'fallo') {
    throw new Error(
      `replica-demo did not answer: ${sondeo.fase} · ${sondeo.categoria} (${sondeo.codigo ?? 'no code'})`,
    );
  }

  const invalidas: string[] = [];
  vistas.forEach((vista, i) => {
    const contrato = CONTRATO_CANONICO.find((e) => e.nombre === vista.entidad);
    const resultado = sondeo.entidades[i];
    if (contrato === undefined || resultado === undefined) {
      invalidas.push(`${vista.entidad} (no probe result)`);
      return;
    }
    const { estado, diagnostico } = diagnosticar(contrato, resultado);
    if (estado !== 'valida') {
      invalidas.push(`${vista.entidad} (${motivoInvalida(diagnostico)})`);
    }
  });
  if (invalidas.length > 0) {
    throw new Error(`demo mapping is not valid after the probe: ${invalidas.join('; ')}`);
  }

  await registrarVeredictos(prisma.vistaCanonica, vistas, sondeo.entidades, new Date());

  // The same row `POST /conexiones/:id/validacion-mapeo` would record: the probe statements
  // in contract order and the verdict. The plain client injects nothing, so the tenant is named.
  const fila = filaDeAuditoria(
    {
      origen: 'validacion-mapeo',
      conexionId: IDS_DEMO.conexion,
      sql: vistas.map((v) => sentenciaDeSondeo(v.sql)).join(';\n'),
      consulta: null,
      plantillaId: null,
      operador: { id: operadorId, nombre: NOMBRE_OPERADOR },
    },
    veredictoDeSondeo(sondeo),
  );
  await prisma.registroEjecucion.create({
    data: { ...fila, tenantId: IDS_DEMO.tenant, tenantNombre: NOMBRE_TENANT },
  });
}
