import { cronValido, esCanal } from '../../automatizaciones/automatizaciones.js';
import { destinatariosDe, minimoFilasValido } from '../../automatizaciones/automatizaciones-rutas.js';
import { DEFAULT_MAX_FILAS_CONSULTA, DEFAULT_ZONA_HORARIA } from '../../compartido/config.js';
import { ID_STOCK_FISICO, ID_STOCK_PRODUCIBLE } from '../../plantillas/catalogo-inicial.js';
import { crearSiFalta, type ClienteSemilla, type TenantDemo } from './comun.js';

/**
 * CH-49 (c): Food Store's two "every minute" automations, one per catalog template and each on
 * its own channel, and its Telegram link, so a fresh demo shows a notification within two minutes
 * of starting. They are Food Store's only automations.
 *
 * The email one reads `stock-fisico`, which the replica's stock (18, 9 and 4 units) leaves with
 * two rows under a threshold of 10, so the minimum of two rows is met and the email goes out on
 * every tick. The Telegram one reads `stock-producible`, whose replica data (Hamburguesa Picante
 * 15, Hamburguesa BBQ Bacon 20) leaves two rows under a threshold of 20, with a minimum of one.
 * Raising a threshold in the panel adds a row; lowering it under the minimum makes the run
 * `omitida-bajo-minimo`. They are created on every seeded start, with no opt-in variable, and
 * stopped from the console («Desactivar»).
 *
 * The Telegram link needs a chat id from the environment; the seed never reads the bot token
 * and never logs the chat id. An existing link, even to another chat, is not touched, and
 * Café del Puerto is never linked.
 *
 * Ids (design.md "Ids"): 51 the email automation, 52 the Telegram one, 61 the link.
 */
export const IDS_CANALES_DEMO = {
  automatizacionCorreo: '49d00000-0000-4000-8000-000000000051',
  automatizacionTelegram: '49d00000-0000-4000-8000-000000000052',
  vinculo: '49d00000-0000-4000-8000-000000000061',
} as const;

const CRON_CADA_MINUTO = '* * * * *';
/** `.example` never delivers, so these two are only there to show a list of three. */
const DESTINATARIOS_FIJOS = ['encargado@food-store.example', 'compras@food-store.example'];

type ClienteCanales = Pick<ClienteSemilla, 'automatizacion' | 'vinculoTelegram'>;

interface AutomatizacionDemo {
  id: string;
  etiqueta: string;
  plantillaId: string;
  umbral: number;
  minimoFilas: number;
  canal: 'correo' | 'telegram';
  destinatarios: string[];
}

function automatizacionesDeLaDemo(tenant: TenantDemo): AutomatizacionDemo[] {
  return [
    {
      id: IDS_CANALES_DEMO.automatizacionCorreo,
      etiqueta: 'automatizacion:correo-cada-minuto',
      plantillaId: ID_STOCK_FISICO,
      umbral: 10,
      minimoFilas: 2,
      canal: 'correo',
      destinatarios: [tenant.correoPanel, ...DESTINATARIOS_FIJOS],
    },
    {
      id: IDS_CANALES_DEMO.automatizacionTelegram,
      etiqueta: 'automatizacion:telegram-cada-minuto',
      plantillaId: ID_STOCK_PRODUCIBLE,
      umbral: 20,
      minimoFilas: 1,
      canal: 'telegram',
      destinatarios: [],
    },
  ];
}

/**
 * The product's own checks on an automation, before anything is written: the schedule, the
 * channel, the minimum of rows and, for email, the list rule of `destinatariosDe` (the cap of
 * five included). The list is stored as that rule returns it. A rejected one stops the seed
 * naming the automation, never a value.
 */
function validada(automatizacion: AutomatizacionDemo): string[] {
  const rechazo = (motivo: string): Error =>
    new Error(`demo automation ${automatizacion.etiqueta} rejected: ${motivo}`);
  if (!cronValido(CRON_CADA_MINUTO, DEFAULT_ZONA_HORARIA)) {
    throw rechazo('invalid schedule');
  }
  if (!esCanal(automatizacion.canal)) {
    throw rechazo('invalid channel');
  }
  if (!minimoFilasValido(automatizacion.minimoFilas, DEFAULT_MAX_FILAS_CONSULTA)) {
    throw rechazo('invalid minimum of rows');
  }
  const lista = destinatariosDe(automatizacion.destinatarios);
  if (!lista.ok) {
    throw rechazo('invalid recipients');
  }
  if (automatizacion.canal === 'correo' ? lista.lista.length < 2 : lista.lista.length > 0) {
    throw rechazo('recipients do not fit the channel');
  }
  return lista.lista;
}

/**
 * Creates, only when missing: the link (when `chatId` is set and the tenant has none), the email
 * automation, and the Telegram automation only when the tenant is linked after the link step.
 * Both automations are checked before any row is written. `tenant` is Food Store.
 */
export async function sembrarCanales(
  prisma: ClienteCanales,
  tenant: TenantDemo,
  chatId: bigint | null,
  creadas: string[],
): Promise<void> {
  const [correo, telegram] = automatizacionesDeLaDemo(tenant) as [AutomatizacionDemo, AutomatizacionDemo];
  const listas = new Map([correo, telegram].map((a) => [a.id, validada(a)]));
  const tenantId = tenant.ids.tenant;

  const buscarVinculo = () => prisma.vinculoTelegram.findUnique({ where: { tenantId }, select: { id: true } });
  if (chatId !== null) {
    await crearSiFalta(creadas, 'vinculo-telegram', buscarVinculo, () =>
      // Not `crearVincular`: it consumes a one-time code and runs inside a tenant context.
      prisma.vinculoTelegram.create({ data: { id: IDS_CANALES_DEMO.vinculo, tenantId, chatId } }),
    );
  }

  const vinculado = (await buscarVinculo()) !== null;
  for (const automatizacion of [correo, telegram]) {
    if (automatizacion.canal === 'telegram' && !vinculado) {
      continue;
    }
    await crearSiFalta(
      creadas,
      automatizacion.etiqueta,
      () => prisma.automatizacion.findUnique({ where: { id: automatizacion.id }, select: { id: true } }),
      () =>
        prisma.automatizacion.create({
          data: {
            id: automatizacion.id,
            tenantId,
            plantillaId: automatizacion.plantillaId,
            conexionId: tenant.ids.conexion,
            valores: { umbral: automatizacion.umbral },
            cron: CRON_CADA_MINUTO,
            destinatarios: listas.get(automatizacion.id) ?? [],
            minimoFilas: automatizacion.minimoFilas,
            canal: automatizacion.canal,
            activo: true,
          },
        }),
    );
  }
}
