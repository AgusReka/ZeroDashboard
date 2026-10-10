import type { FastifyInstance } from 'fastify';
import { cronValido, proximaEjecucion } from './automatizaciones.js';
import type { PrismaAislado } from './aislamiento-prisma.js';
import { conTenantActivo } from './contexto-tenant.js';
import { LIMITE_LISTADO } from './listados.js';
import { levantarSesionPanel } from './panel-auth.js';

/**
 * CH-22b (DEC-137): the pure half of the panel's "mis automatizaciones" read. Business
 * copy, the readable frequency, the neutral run outcome and the allow-list projections
 * live here with no Prisma and no I/O, so every rule is unit-testable without a database.
 * The route registrar at the end of the file feeds these functions.
 */

/** What the client reads about one automation kind: a title and a one-line description. */
export interface CopyNegocio {
  titulo: string;
  descripcion: string;
}

/**
 * Business wording keyed by the template's `automatizacion` slug (DEC-128), the `TEMAS`
 * precedent of `src/correo.ts`. A `Map` lookup, so a slug such as `constructor` never
 * reaches `Object.prototype`. Insertion order is the order of `disponibles`.
 */
export const COPY_NEGOCIO: ReadonlyMap<string, CopyNegocio> = new Map([
  [
    'stock-fisico',
    {
      titulo: 'Aviso de stock bajo',
      descripcion: 'Te avisamos por correo cuando un producto se está quedando sin stock.',
    },
  ],
  [
    'stock-producible',
    {
      titulo: 'Aviso de productos que ya casi no podés armar',
      descripcion:
        'Te avisamos por correo cuando, con los insumos que tenés, ya casi no podés armar un producto.',
    },
  ],
]);

/** Any other slug on an existing automation: neutral text, never the template `nombre`. */
export const COPY_NEUTRO: CopyNegocio = {
  titulo: 'Automatización de tu negocio',
  descripcion: 'Una revisión automática que te mandamos por correo.',
};

/** The business copy of `slug`, or the neutral fallback. Never throws. */
export function copyDe(slug: string): CopyNegocio {
  return COPY_NEGOCIO.get(slug) ?? COPY_NEUTRO;
}

// ---- frequency (DEC-129) ------------------------------------------------------------

/** `M H * * D` with `D` one of the three day sets the console offers (DEC-129). */
const PATRON_FRECUENCIA = /^(\d{1,2}) (\d{1,2}) \* \* (\*|1-5|1-6)$/;

const DIAS_FRECUENCIA: ReadonlyMap<string, string> = new Map([
  ['*', 'Todos los días'],
  ['1-5', 'De lunes a viernes'],
  ['1-6', 'De lunes a sábado'],
]);

/**
 * Business text for the three DEC-129 patterns, such as `Todos los días a las 08:30`, in
 * the deployment zone. Any other expression gives `null` and the item omits the key, so
 * the stored expression never reaches the client.
 */
export function frecuenciaDeCron(cron: string): string | null {
  const partes = PATRON_FRECUENCIA.exec(cron.trim().split(/\s+/).join(' '));
  if (partes === null) {
    return null;
  }
  const minuto = Number(partes[1]);
  const hora = Number(partes[2]);
  const dias = DIAS_FRECUENCIA.get(partes[3] as string);
  if (minuto > 59 || hora > 23 || dias === undefined) {
    return null;
  }
  const hhmm = `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`;
  return `${dias} a las ${hhmm}`;
}

// ---- last run and active items ------------------------------------------------------

/** The only two outcomes the client reads about a finished run. */
export type ResultadoNegocio = 'completada' | 'no-realizada';

/**
 * `ok` is `completada`; `fallo`, `omitida` and any state this code does not know are
 * `no-realizada`. The reason of a failure never reaches the client (DEC-137, CH-22c).
 */
export function resultadoDe(estado: string): ResultadoNegocio {
  return estado === 'ok' ? 'completada' : 'no-realizada';
}

/** The columns of a stored automation this projection reads; nothing else is selected. */
export interface FilaAutomatizacion {
  activo: boolean;
  cron: string;
  plantilla: { automatizacion: string };
}

/** The latest finished run of one automation (never `en-curso`), as stored. */
export interface UltimaEjecucionFila {
  estado: string;
  iniciadaEn: Date;
  finalizadaEn: Date | null;
}

/** One entry of `activas`: the allow-list of DEC-137, with no identifier. */
export interface ItemActiva {
  titulo: string;
  descripcion: string;
  estado: 'activa' | 'pausada' | 'con_falla';
  frecuencia?: string;
  ultimaEjecucion: { fecha: string; resultado: ResultadoNegocio } | null;
  proximaEjecucion: string | null;
}

/**
 * Builds one `activas` item. The output object is written literally from named inputs,
 * never by spreading a stored row, so a column added later cannot leak. `estado` follows
 * `activo` alone: a failed last run does not change it. `ahora` is the request's single
 * clock read, shared by every item, and `zona` is the deployment zone (DEC-77).
 *
 * An invalid stored cron gives `proximaEjecucion: null` and no `frecuencia` instead of a
 * throw that would blank the whole screen.
 */
export function proyectarActiva(
  fila: FilaAutomatizacion,
  ultima: UltimaEjecucionFila | null,
  ahora: Date,
  zona: string,
): ItemActiva {
  const copy = copyDe(fila.plantilla.automatizacion);
  const ultimaEjecucion: ItemActiva['ultimaEjecucion'] =
    ultima === null
      ? null
      : {
          fecha: (ultima.finalizadaEn ?? ultima.iniciadaEn).toISOString(),
          resultado: resultadoDe(ultima.estado),
        };
  let estado: ItemActiva['estado'];
  if (!fila.activo) {
    estado = 'pausada';
  } else {
    const resultadoUltima = ultima === null ? null : resultadoDe(ultima.estado);
    if (ultima !== null && resultadoUltima === 'no-realizada') {
      estado = 'con_falla';
    } else {
      estado = 'activa';
    }
  }
  const item: ItemActiva = {
    titulo: copy.titulo,
    descripcion: copy.descripcion,
    estado,
    ultimaEjecucion,
    proximaEjecucion: fila.activo ? proximaIso(fila.cron, ahora, zona) : null,
  };
  const frecuencia = frecuenciaDeCron(fila.cron);
  if (frecuencia !== null) {
    item.frecuencia = frecuencia;
  }
  return item;
}

/** The next fire as ISO UTC, or `null` when the stored expression cannot be resolved. */
function proximaIso(cron: string, ahora: Date, zona: string): string | null {
  if (!cronValido(cron, zona)) {
    return null;
  }
  try {
    return proximaEjecucion(cron, ahora, zona).toISOString();
  } catch {
    return null;
  }
}

// ---- available automations ----------------------------------------------------------

/** The columns of a global template this rule reads; `nombre`, `sql` and the rest never. */
export interface PlantillaCatalogo {
  id: string;
  automatizacion: string;
}

/**
 * The templates the client could still turn on: those with business copy and without an
 * active automation of this tenant (a paused one does not hide it). Several templates
 * with the same slug are listed once, and none is listed if any of them is active. Order is the copy map's insertion order, then the
 * template `id`, so the same input always gives the same list. Output carries only
 * `titulo` and `descripcion`.
 *
 * `plantillaIdsActivas` must come from a tenant-scoped read: this function trusts it.
 */
export function proyectarDisponibles(
  plantillas: readonly PlantillaCatalogo[],
  plantillaIdsActivas: ReadonlySet<string>,
): CopyNegocio[] {
  const orden = [...COPY_NEGOCIO.keys()];
  const etiquetasActivas = new Set(
    plantillas.filter((p) => plantillaIdsActivas.has(p.id)).map((p) => p.automatizacion),
  );
  const candidatas = plantillas
    .filter((p) => COPY_NEGOCIO.has(p.automatizacion) && !etiquetasActivas.has(p.automatizacion))
    .sort(
      (a, b) =>
        orden.indexOf(a.automatizacion) - orden.indexOf(b.automatizacion) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
  const vistas = new Set<string>();
  const disponibles: CopyNegocio[] = [];
  for (const { automatizacion } of candidatas) {
    if (vistas.has(automatizacion)) {
      continue;
    }
    vistas.add(automatizacion);
    const copy = copyDe(automatizacion);
    disponibles.push({ titulo: copy.titulo, descripcion: copy.descripcion });
  }
  return disponibles;
}

// ---- route (DEC-137, DEC-135) -------------------------------------------------------

/** `ultimaEjecucion` is keyed by automation, so the second pass is a map lookup. */
interface EjecucionTerminada extends UltimaEjecucionFila {
  automatizacionId: string;
}

/**
 * `GET /api/panel/automatizaciones`: read-only, session-guarded, tenant only from the
 * session (DEC-135). No body, query or path parameter reaches a query. The clock is read
 * once per request and shared by every item; `server.ts` leaves `ahora` at its default.
 *
 * Fixed query count (design section 3): Q1 automations, Q2 latest finished start per
 * automation, Q3 those runs, Q4 the template catalog bounded by the copy map, Q5 the
 * templates this tenant has active. Q1, Q2, Q3 and Q5 are scoped by the isolation
 * extension (`findMany` and `groupBy` are in its filter set); `Plantilla` is global, so
 * the "active" set is always subtracted in code from the scoped Q5, never filtered
 * through a relation. No raw SQL, no nested `ejecuciones`, no `distinct`.
 */
export function registerPanelAutomatizacionesRoutes(
  app: FastifyInstance,
  prisma: PrismaAislado,
  zonaHoraria: string,
  ahora: () => Date = () => new Date(),
): void {
  app.get(
    '/api/panel/automatizaciones',
    { preHandler: [levantarSesionPanel(prisma)] },
    async (request, reply) => {
      const sesion = request.sesionPanel!;
      const referencia = ahora();
      const cuerpo = await conTenantActivo(
        { id: sesion.tenantId, nombre: sesion.tenantNombre },
        async () => {
          const [leidas, plantillas, activasGrupo] = await Promise.all([
            prisma.automatizacion.findMany({
              select: {
                id: true,
                activo: true,
                cron: true,
                plantilla: { select: { automatizacion: true } },
              },
              orderBy: [{ creadaEn: 'desc' }, { id: 'asc' }],
              take: LIMITE_LISTADO + 1,
            }),
            prisma.plantilla.findMany({
              where: { automatizacion: { in: [...COPY_NEGOCIO.keys()] } },
              select: { id: true, automatizacion: true },
            }),
            prisma.automatizacion.groupBy({ by: ['plantillaId'], where: { activo: true } }),
          ]);
          const truncado = leidas.length > LIMITE_LISTADO;
          const filas = leidas.slice(0, LIMITE_LISTADO);

          const ultimas = await ultimasTerminadas(
            prisma,
            filas.map((f) => f.id),
          );
          return {
            activas: filas.map((f) => proyectarActiva(f, ultimas.get(f.id) ?? null, referencia, zonaHoraria)),
            disponibles: proyectarDisponibles(
              plantillas,
              new Set(activasGrupo.map((g) => g.plantillaId)),
            ),
            zonaHoraria,
            truncado,
          };
        },
      );
      return reply.code(200).send(cuerpo);
    },
  );
}

/**
 * Q2 and Q3: the latest run that is not `en-curso` of each automation, by the
 * `(automatizacionId, iniciadaEn)` index. Skips Q3 when nothing has finished.
 */
async function ultimasTerminadas(
  prisma: PrismaAislado,
  ids: readonly string[],
): Promise<Map<string, EjecucionTerminada>> {
  const ultimas = new Map<string, EjecucionTerminada>();
  if (ids.length === 0) {
    return ultimas;
  }
  const grupos = await prisma.ejecucion.groupBy({
    by: ['automatizacionId'],
    where: { automatizacionId: { in: [...ids] }, estado: { not: 'en-curso' } },
    _max: { iniciadaEn: true },
  });
  const pares = grupos.flatMap((g) =>
    g._max.iniciadaEn === null
      ? []
      : [{ automatizacionId: g.automatizacionId, iniciadaEn: g._max.iniciadaEn }],
  );
  if (pares.length === 0) {
    return ultimas;
  }
  const filas = await prisma.ejecucion.findMany({
    where: { estado: { not: 'en-curso' }, OR: pares },
    select: { automatizacionId: true, estado: true, iniciadaEn: true, finalizadaEn: true },
  });
  for (const fila of filas) {
    // A tie on the same start keeps the first row: one run per automation at a time (DEC-96).
    if (!ultimas.has(fila.automatizacionId)) {
      ultimas.set(fila.automatizacionId, fila);
    }
  }
  return ultimas;
}
