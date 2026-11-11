import { sondearEstructura } from '../ejecucion/consulta-ejecucion.js';
import { LARGO_MINIMO_CLAVE, validarClave } from '../operador-alta.js';
import { correoValido, normalizarCorreo } from '../usuarios/usuarios-panel.js';
import { hashearClave } from '../compartido/crypto-auth.js';
import type { ClienteSemilla, TenantDemo } from './demo/comun.js';
import { FORMATO_TOKEN_AGENTE, sembrarAgente } from './demo/agente.js';
import { sembrarCanales } from './demo/canales.js';
import { IDS_REPORTES_DEMO, sembrarReportes } from './demo/reportes.js';
import { sembrarTablero } from './demo/tableros.js';
import { sembrarTenant, verificarBaseDeReplica, type ContextoTenantDemo } from './demo/tenant.js';

export type { ClienteSemilla } from './demo/comun.js';

/**
 * CH-31 (DEC-171): the opt-in demo seed. With `SEED_DEMO=1` a fresh environment gets a
 * working tenant: the operator `demo`, "Food Store" with its connection to the
 * `replica-demo` service, the five canonical views validated by the same probe as
 * `POST /conexiones/:id/validacion-mapeo`, one saved query, a panel user and an active
 * automation. CH-49 adds a second tenant, "Café del Puerto", on its own replica database; both
 * run the same steps (`demo/tenant.ts`) from a descriptor. `prisma/seed.ts` calls it only when
 * the variable is exactly `1`. With `DEMO_AGENTE_TOKEN` Food Store also gets an agent and its
 * connection is created bound to it (`demo/agente.ts`, DEC-207).
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
  /** Food Store's dashboard (CH-49 b2). The four reports are global: see `IDS_REPORTES_DEMO`. */
  tablero: '49d00000-0000-4000-8000-000000000031',
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
    tablero: '49d00000-0000-4000-8000-000000000032',
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
    // Food Store shows all four reports, the stock table included.
    tablero: {
      id: IDS_DEMO.tablero,
      reportes: [
        IDS_REPORTES_DEMO.ventas,
        IDS_REPORTES_DEMO.masVendido,
        IDS_REPORTES_DEMO.ventasPorDia,
        IDS_REPORTES_DEMO.stock,
      ],
    },
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
    tablero: {
      id: IDS_DEMO.cafe.tablero,
      reportes: [IDS_REPORTES_DEMO.ventas, IDS_REPORTES_DEMO.masVendido, IDS_REPORTES_DEMO.ventasPorDia],
    },
  };
}

/** The variables the seed needs besides the ones the app already requires. */
export interface EntornoDemo {
  /** The read-only role's password: also what `REPLICA_DEMO_PASSWORD` gives the container. */
  claveReplica: string;
  claveOperador: string;
  /** Already normalized. */
  correoPanel: string;
  clavePanel: string;
  /** Optional (CH-49 c): the chat Food Store is linked to; `null` when unset or empty. */
  telegramChatId: bigint | null;
  /** Optional (CH-49 d): the token of Food Store's agent; `null` when unset or empty. Never logged. */
  agenteToken: string | null;
}

/** A signed 64-bit integer, the range of the `BigInt` column. */
const MINIMO_CHAT_ID = -(2n ** 63n);
const MAXIMO_CHAT_ID = 2n ** 63n - 1n;

/** The chat id as a `bigint`, or `null` when the variable is unset or empty. Never echoes the value. */
function chatIdDeTelegram(env: NodeJS.ProcessEnv): bigint | null {
  const valor = env.DEMO_TELEGRAM_CHAT_ID;
  if (valor === undefined || valor === '') {
    return null;
  }
  if (/^-?\d{1,19}$/.test(valor)) {
    const chatId = BigInt(valor);
    if (chatId >= MINIMO_CHAT_ID && chatId <= MAXIMO_CHAT_ID) {
      return chatId;
    }
  }
  throw new Error('Invalid environment variable: DEMO_TELEGRAM_CHAT_ID must be a Telegram chat id');
}

/** The agent token, or `null` when the variable is unset or empty. Never echoes the value. */
function tokenDeAgente(env: NodeJS.ProcessEnv): string | null {
  const valor = env.DEMO_AGENTE_TOKEN;
  if (valor === undefined || valor === '') {
    return null;
  }
  if (!FORMATO_TOKEN_AGENTE.test(valor)) {
    throw new Error(
      'Invalid environment variable: DEMO_AGENTE_TOKEN must be an agent token (zda_ followed by 43 characters)',
    );
  }
  return valor;
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
  return {
    claveReplica,
    claveOperador,
    correoPanel,
    clavePanel,
    telegramChatId: chatIdDeTelegram(env),
    agenteToken: tokenDeAgente(env),
  };
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
 * With an agent token, Food Store's agent comes before its tenant step (the connection is created
 * bound to it); the replica is still probed directly.
 * After both tenants come the four global reports and each tenant's dashboard (CH-49 b2), then
 * Food Store's Telegram link (when a chat id is set) and its every-minute automations (CH-49 c).
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

  const foodStore = tenantFoodStore(entorno);
  const agenteId =
    entorno.agenteToken === null ? null : await sembrarAgente(prisma, foodStore, entorno.agenteToken, creadas);
  await sembrarTenant(prisma, foodStore, contexto, agenteId);

  const cafe = tenantCafe(entorno);
  const cafeExiste = await prisma.tenant.findUnique({ where: { id: cafe.ids.tenant }, select: { id: true } });
  if (cafeExiste === null) {
    await verificarBaseDeReplica(cafe, contexto);
  }
  await sembrarTenant(prisma, cafe, contexto);

  // Reports are global and both dashboards draw on them; each tenant's views exist by now.
  await sembrarReportes(prisma, creadas);
  await sembrarTablero(prisma, tenantFoodStore(entorno), creadas);
  await sembrarTablero(prisma, cafe, creadas);

  await sembrarCanales(prisma, tenantFoodStore(entorno), entorno.telegramChatId, creadas);

  return { creadas };
}
