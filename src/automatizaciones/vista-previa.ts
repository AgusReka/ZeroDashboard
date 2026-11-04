import type { FastifyInstance } from 'fastify';
import { registrarEjecucion, veredictoDeEjecucion } from '../auditoria/auditoria.js';
import type { PrismaAislado } from '../aislamiento/aislamiento-prisma.js';
import { SIN_AGENTES, type AbridorDeCanales } from '../agente/canal-agente.js';
import { decidirNotificacion, type OmisionNotificacion } from './automatizaciones.js';
import { componerCorreo } from './correo.js';
import { entradaDeCorreo, peticionDeCorrida, prepararCorrida, type PlantillaDeCorrida } from './corrida.js';
import { ejecutarConsulta, type ResultadoEjecucion } from '../ejecucion/consulta-ejecucion.js';

/**
 * CH-42 (X10, DEC-189, DEC-195): `POST /automatizaciones/:id/vista-previa`, the message
 * preview. It runs the automation's query once, through the run's own steps (`./corrida.ts`)
 * and with the run's page, and answers with the rows, whether a run would notify and to whom,
 * and the message a run would compose. It holds no notifier and never writes a run row: every
 * send is still scheduled (DEC-189 (b) rejected). It dials once, with no retry, like every
 * console path, and is audited like the template test, under its own origin. It lives in its
 * own file so the dial and the audit write are visible to grep, as `plantilla-prueba.ts` is.
 */

interface VistaPreviaParams {
  id: string;
}

/** `enviar`, the omission a run would record, or null when the query failed (precedence row 1). */
export type DecisionVistaPrevia = 'enviar' | OmisionNotificacion | null;

export interface CorreoVistaPrevia {
  asunto: string;
  texto: string;
  html: string;
}

/** The template test's 200 body, plus the three preview fields. */
export type RespuestaVistaPrevia = ResultadoEjecucion & {
  decision: DecisionVistaPrevia;
  para: string[];
  correo: CorreoVistaPrevia | null;
};

/** The decisions a run reaches the delivery rows with, so a message would be composed. */
const DECISIONES_CON_MENSAJE: readonly DecisionVistaPrevia[] = ['enviar', 'sin-destinatario', 'no-configurada'];

/**
 * Pure: the decision a run would take with this result (DEC-83, DEC-186), the stored
 * recipients as `para`, and the message when a run would compose one. `fecha` stands for the
 * run's start and `zona` is the deployment zone, the two the scheduler passes.
 */
export function respuestaDeVistaPrevia(
  resultado: ResultadoEjecucion,
  automatizacion: { destinatarios: readonly string[]; minimoFilas: number },
  plantilla: PlantillaDeCorrida,
  correoConfigurado: boolean,
  fecha: Date,
  zona: string,
): RespuestaVistaPrevia {
  const decidida = decidirNotificacion(
    resultado,
    automatizacion.destinatarios,
    correoConfigurado,
    automatizacion.minimoFilas,
  );
  const decision: DecisionVistaPrevia = decidida.enviar ? 'enviar' : decidida.notificacion;
  const correo =
    resultado.resultado === 'ok' && DECISIONES_CON_MENSAJE.includes(decision)
      ? componerCorreo(entradaDeCorreo(plantilla, resultado, fecha, zona))
      : null;
  return { ...resultado, decision, para: [...automatizacion.destinatarios], correo };
}

export interface OpcionesVistaPrevia {
  /** CH-19c1: the agent session registry. Absent means `SIN_AGENTES`, which fails closed. */
  canales?: AbridorDeCanales;
  /** Whether the boot notifier exists (`SMTP_HOST` set). Absent means false. */
  correoConfigurado?: boolean;
}

/**
 * `zonaHoraria` and `topeFilas` come from the entry point's one `loadConfig()`, the values the
 * scheduler reads with, so the preview reads the same page and dates the subject the same way.
 */
export function registerVistaPreviaRoute(
  app: FastifyInstance,
  prisma: PrismaAislado,
  zonaHoraria: string,
  topeFilas: number,
  { canales = SIN_AGENTES, correoConfigurado = false }: OpcionesVistaPrevia,
): void {
  // No body schema, like `/desactivar`: nothing is read from the body.
  app.post<{ Params: VistaPreviaParams }>('/automatizaciones/:id/vista-previa', async (request, reply) => {
    // Scoped by the extension: another tenant's id is `null`, the same `404` as an unknown one.
    const automatizacion = await prisma.automatizacion.findUnique({
      where: { id: request.params.id },
      select: {
        activo: true,
        plantillaId: true,
        conexionId: true,
        valores: true,
        destinatarios: true,
        minimoFilas: true,
      },
    });
    if (automatizacion === null) {
      return reply.code(404).send({ error: 'automatizacion-no-encontrada' });
    }
    // The console offers the preview on active rows only; a deactivated one answers as the adjust does.
    if (!automatizacion.activo) {
      return reply.code(409).send({ error: 'automatizacion-desactivada' });
    }
    // `Plantilla` is global (DEC-61); its id comes from a row the extension already scoped.
    const plantilla = await prisma.plantilla.findUnique({
      where: { id: automatizacion.plantillaId },
      select: {
        sql: true,
        parametros: true,
        entidades: true,
        nombre: true,
        automatizacion: true,
        encabezadoMensaje: true,
        lineaMensaje: true,
      },
    });
    if (plantilla === null) {
      return reply.code(404).send({ error: 'plantilla-no-encontrada' });
    }

    // The run's own checks, in its order; each refusal answers with the template test's body,
    // and nothing is dialled before all of them passed.
    const preparada = await prepararCorrida(prisma, automatizacion, plantilla, canales);
    if (!preparada.ok) {
      const { rechazo } = preparada;
      switch (rechazo.categoria) {
        case 'vista-canonica-no-aprobada':
          return reply.code(409).send({ error: 'vista-canonica-no-aprobada', entidades: rechazo.entidades });
        case 'valores-invalidos':
          return reply.code(400).send({
            error: 'solicitud-invalida',
            campos: [...new Set(preparada.problemas.map((problema) => problema.campo))],
            problemas: preparada.problemas,
          });
        case 'credencial-ilegible':
          return reply.code(409).send({ error: 'credencial-ilegible' });
        case 'conexion-no-encontrada':
          return reply.code(404).send({ error: 'conexion-no-encontrada' });
      }
    }

    // One dial, read-only, with the run's page; no retry (only scheduled runs retry, DEC-98).
    const resultado = await ejecutarConsulta(peticionDeCorrida(preparada, topeFilas));
    if (resultado.resultado === 'fallo') {
      // Sanitized summary only, as the template test: the driver error carries the password.
      app.log.warn(
        {
          conexionId: preparada.destino.id,
          fase: resultado.fase,
          categoria: resultado.categoria,
          codigo: resultado.codigo,
          durationMs: resultado.duracionMs,
        },
        'automation preview execution failed',
      );
    }
    // DEC-195: the composed statement and the template, never the automation, a recipient or
    // the message. A failed write is logged and swallowed (DEC-162).
    await registrarEjecucion(prisma, app.log, request, {
      origen: 'automatizacion-vista-previa',
      conexionId: preparada.destino.id,
      sql: preparada.sql,
      consulta: null,
      plantillaId: automatizacion.plantillaId,
    }, veredictoDeEjecucion(resultado));
    return reply
      .code(200)
      .send(respuestaDeVistaPrevia(resultado, automatizacion, plantilla, correoConfigurado, new Date(), zonaHoraria));
  });
}
