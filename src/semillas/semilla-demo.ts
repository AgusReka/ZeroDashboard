import { sondearEstructura } from '../ejecucion/consulta-ejecucion.js';
import { LARGO_MINIMO_CLAVE, validarClave } from '../operador-alta.js';
import { correoValido, normalizarCorreo } from '../usuarios/usuarios-panel.js';
import { hashearClave } from '../compartido/crypto-auth.js';
import type { ClienteSemilla, TenantDemo } from './demo/comun.js';
import { sembrarTenant, verificarBaseDeReplica, type ContextoTenantDemo } from './demo/tenant.js';

export type { ClienteSemilla } from './demo/comun.js';

/**
 * CH-31 (DEC-171): the opt-in demo seed. With `SEED_DEMO=1` a fresh environment gets a
 * working tenant: the operator `demo`, "Food Store" with its connection to the
 * `replica-demo` service, the five canonical views validated by the same probe as
 * `POST /conexiones/:id/validacion-mapeo`, one saved query, a panel user and an active
 * automation. CH-49 adds a second tenant, "Café del Puerto", on its own replica database; both
 * run the same steps (`demo/tenant.ts`) from a descriptor. `prisma/seed.ts` calls it only when
 * the variable is exactly `1`.
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
  /** Café del Puerto (CH-49): same layout, `49d…` ids. */
  cafe: {
    tenant: '49d00000-0000-4000-8000-000000000001',
    conexion: '49d00000-0000-4000-8000-000000000002',
    vistas: {
      producto: '49d00000-0000-4000-8000-000000000011',
      insumo: '49d00000-0000-4000-8000-000000000012',
      receta_componente: '49d00000-0000-4000-8000-000000000013',
      pedido: '49d00000-0000-4000-8000-000000000014',
      item_pedido: '49d00000-0000-4000-8000-000000000015',
    },
    usuario: '49d00000-0000-4000-8000-000000000022',
    automatizacion: '49d00000-0000-4000-8000-000000000023',
  },
} as const;

const NOMBRE_OPERADOR = 'demo';
const NOMBRE_TENANT = 'Food Store';

/** Where the app reaches the replica inside the Compose network (DEC-170). */
const HOST_REPLICA = 'replica-demo';
const PUERTO_REPLICA = 5432;

/**
 * Café del Puerto's panel email: `DEMO_PANEL_CORREO` with `+cafe` inserted before the `@`.
 * Nothing is replaced: an address that already carries a `+tag` ends up with both
 * (`ana+x@host` becomes `ana+x+cafe@host`). It is a distinct `correo` (globally unique)
 * that reaches the same inbox, and it needs no extra variable. The input is already
 * normalized and has exactly one `@`.
 */
export function correoPanelCafe(correoPanel: string): string {
  const arroba = correoPanel.lastIndexOf('@');
  return `${correoPanel.slice(0, arroba)}+cafe${correoPanel.slice(arroba)}`;
}

function tenantFoodStore(entorno: EntornoDemo): TenantDemo {
  return {
    ids: {
      tenant: IDS_DEMO.tenant,
      conexion: IDS_DEMO.conexion,
      vistas: IDS_DEMO.vistas,
      usuario: IDS_DEMO.usuario,
      automatizacion: IDS_DEMO.automatizacion,
      consulta: IDS_DEMO.consulta,
    },
    nombre: NOMBRE_TENANT,
    replica: {
      host: HOST_REPLICA,
      puerto: PUERTO_REPLICA,
      baseDatos: 'food_store',
      usuario: 'lector_zerodashboard',
      nombreConexion: 'food-store-demo',
    },
    correoPanel: entorno.correoPanel,
    prefijoEtiqueta: '',
  };
}

function tenantCafe(entorno: EntornoDemo): TenantDemo {
  return {
    ids: IDS_DEMO.cafe,
    nombre: 'Café del Puerto',
    replica: {
      host: HOST_REPLICA,
      puerto: PUERTO_REPLICA,
      baseDatos: 'cafe_demo',
      usuario: 'lector_cafe_demo',
      nombreConexion: 'cafe-del-puerto-demo',
    },
    correoPanel: correoPanelCafe(entorno.correoPanel),
    prefijoEtiqueta: 'cafe:',
  };
}

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

export interface DependenciasDemo {
  /** The structure probe. Injected by tests; the real one dials the replica. */
  sondear?: typeof sondearEstructura;
}

export interface ResumenDemo {
  /** What this run created, by label; empty when everything was already there. */
  creadas: string[];
}

/**
 * Seeds whatever the demo is missing. Call `leerEntornoDemo` first. Throws, naming the
 * cause, when the replica does not answer or an entity is not valid after the probe; in
 * both cases the tenant's automation is not created and its views of this run are removed.
 * Café del Puerto is checked against an old replica volume before any of its rows exists.
 */
export async function sembrarDemo(
  prisma: ClienteSemilla,
  entorno: EntornoDemo,
  deps: DependenciasDemo = {},
): Promise<ResumenDemo> {
  const creadas: string[] = [];

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

  const contexto: ContextoTenantDemo = {
    sondear: deps.sondear ?? sondearEstructura,
    claveReplica: entorno.claveReplica,
    clavePanel: entorno.clavePanel,
    operador: { id: operadorExistente?.id ?? IDS_DEMO.operador, nombre: NOMBRE_OPERADOR },
    creadas,
  };

  await sembrarTenant(prisma, tenantFoodStore(entorno), contexto);

  const cafe = tenantCafe(entorno);
  const cafeExiste = await prisma.tenant.findUnique({ where: { id: cafe.ids.tenant }, select: { id: true } });
  if (cafeExiste === null) {
    await verificarBaseDeReplica(cafe, contexto);
  }
  await sembrarTenant(prisma, cafe, contexto);

  return { creadas };
}
