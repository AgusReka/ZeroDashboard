import type { FastifyInstance } from 'fastify';
import type { Prisma } from './generated/prisma/client.js';
import type { PrismaAislado } from './aislamiento-prisma.js';
import { camposInvalidos } from './conexiones.js';
import { destinoDeConexion } from './conexion-destino.js';
import { sondearEstructura } from './consulta-ejecucion.js';
import { CONTRATO_CANONICO } from './contrato.js';
import { ErrorCredencialIlegible } from './cripto-credencial.js';
import { diagnosticar, informe, type FilaValidacion } from './validacion-mapeo.js';

/**
 * CH-10: explicit, persisted validation of a connection's canonical-view mapping (M3)
 * and the per-automation applicability report (M4). Per connection, not per entity:
 * one dial and one DEC-08 check cover every mapped entity, and applicability needs all
 * five entities anyway (CH-10 design, "Granularity, route").
 *
 *  - `POST /conexiones/:id/validacion-mapeo` is the **only** path in the application
 *    that executes registered canonical-view SQL, and only as a zero-row probe inside
 *    `READ ONLY` (DEC-42). It persists the verdict on each `VistaCanonica` row (DEC-44).
 *  - `GET` on the same path builds the report from the persisted rows and the contract.
 *    It never opens a connection to the tenant's database (DEC-40).
 */

interface ConexionParams {
  id: string;
}

/**
 * The validate action takes no input, and says so with a schema rather than by
 * ignoring whatever arrives, following `registroVistaCanonicaSchema`. `propertyNames:
 * false` rejects every key, `tenantId` included, and names it in `campos`. The `null`
 * type is what lets a request with no body at all through: Fastify validates a missing
 * body as `null`, and there is nothing to require.
 */
const validacionBodySchema = {
  type: ['object', 'null'],
  additionalProperties: false,
  propertyNames: false,
} as const;

/** The columns the report reads; the SQL itself never leaves this module. */
const SELECCION_INFORME = {
  entidad: true,
  estadoValidacion: true,
  diagnosticoValidacion: true,
  validadaEn: true,
} as const;

/** Contract order, so the probes run and the diagnostics are written in a stable order. */
function ordenDelContrato(entidad: string): number {
  return CONTRATO_CANONICO.findIndex((e) => e.nombre === entidad);
}

export function registerValidacionMapeoRoutes(app: FastifyInstance, prisma: PrismaAislado): void {
  /** Every mapping row of the connection, in the shape `informe()` reads. */
  function filasDelInforme(conexionId: string): Promise<FilaValidacion[]> {
    return prisma.vistaCanonica.findMany({ where: { conexionId }, select: SELECCION_INFORME });
  }

  app.post<{ Params: ConexionParams }>(
    '/conexiones/:id/validacion-mapeo',
    { schema: { body: validacionBodySchema }, attachValidation: true },
    async (request, reply) => {
      if (request.validationError) {
        return reply.code(400).send({
          error: 'solicitud-invalida',
          campos: camposInvalidos(request.validationError),
        });
      }

      const conexionId = request.params.id;
      // Ownership and coordinates in one scoped read (DEC-13): another tenant's
      // connection resolves to `null` and takes the `404` before any row of its mapping
      // is read and before any socket is opened.
      let destino;
      try {
        destino = await destinoDeConexion(prisma, conexionId);
      } catch (error) {
        if (error instanceof ErrorCredencialIlegible) {
          return reply.code(409).send({ error: 'credencial-ilegible' });
        }
        throw error;
      }
      if (destino === null) {
        return reply.code(404).send({ error: 'conexion-no-encontrada' });
      }

      const vistas = (
        await prisma.vistaCanonica.findMany({
          where: { conexionId },
          select: { id: true, entidad: true, sql: true, actualizadaEn: true },
        })
      ).sort((a, b) => ordenDelContrato(a.entidad) - ordenDelContrato(b.entidad));

      // Nothing mapped, nothing to probe: the report is answered without dialling.
      if (vistas.length === 0) {
        return reply.code(200).send({ resultado: 'ok', validacionMapeo: informe([]) });
      }

      const sondeo = await sondearEstructura(
        destino,
        vistas.map((v) => ({ entidad: v.entidad, sql: v.sql })),
      );

      if (sondeo.resultado === 'fallo') {
        // A failed *session* (no connection, a blocked role, the backstop) is a fact
        // about the connection, not about any mapping, so nothing is written and every
        // prior verdict stands (CH-10 design, "Session failure"). Sanitized summary only,
        // as in `consultas.ts`: the driver error carries the plaintext password.
        app.log.warn(
          {
            conexionId: destino.id,
            fase: sondeo.fase,
            categoria: sondeo.categoria,
            codigo: sondeo.codigo,
            durationMs: sondeo.duracionMs,
          },
          'mapping validation failed',
        );
        return reply.code(200).send(sondeo);
      }

      const validadaEn = new Date();
      for (const [i, vista] of vistas.entries()) {
        const contrato = CONTRATO_CANONICO[ordenDelContrato(vista.entidad)];
        const resultado = sondeo.entidades[i];
        if (contrato === undefined || resultado === undefined) {
          continue;
        }
        const { estado, diagnostico } = diagnosticar(contrato, resultado);
        // The stale-write guard: the verdict is written only if the row still holds the
        // SQL that was probed. A `PUT` that replaced it mid-probe has already reset the
        // row to "not validated" (DEC-41), and this write then matches nothing, so the
        // old statement's verdict can never land on the new one. `actualizadaEn` is set
        // to the value read: validating a mapping does not change it.
        await prisma.vistaCanonica.updateMany({
          where: { id: vista.id, sql: vista.sql },
          data: {
            estadoValidacion: estado,
            diagnosticoValidacion: diagnostico as unknown as Prisma.InputJsonValue,
            validadaEn,
            actualizadaEn: vista.actualizadaEn,
          },
        });
      }

      // Read back rather than assembled from what was just written, so a row the guard
      // skipped reports the state it actually holds.
      return reply
        .code(200)
        .send({ resultado: 'ok', validacionMapeo: informe(await filasDelInforme(conexionId)) });
    },
  );

  app.get<{ Params: ConexionParams }>(
    '/conexiones/:id/validacion-mapeo',
    async (request, reply) => {
      const conexionId = request.params.id;
      // An ownership check, never a way to the connection's coordinates: `destinoDeConexion`
      // is not called on this path, so no credential is deciphered and nothing is dialled.
      const conexion = await prisma.conexion.findUnique({
        where: { id: conexionId },
        select: { id: true },
      });
      if (conexion === null) {
        return reply.code(404).send({ error: 'conexion-no-encontrada' });
      }

      return reply
        .code(200)
        .send({ validacionMapeo: informe(await filasDelInforme(conexionId)) });
    },
  );
}
