import type { FastifyInstance, FastifyRequest } from 'fastify';
import { registrarEjecucion, veredictoDeEjecucion, type OrigenEjecucion } from '../auditoria/auditoria.js';
import type { PrismaAislado } from '../aislamiento/aislamiento-prisma.js';
import type { AbridorDeCanales } from '../agente/canal-agente.js';
import { camposDeDestino, destinoDeConexion } from '../conexiones/conexion-destino.js';
import { ErrorCredencialIlegible } from '../compartido/cripto-credencial.js';
import { componerSentencia, evaluarVistas } from '../plantillas/plantillas.js';
import { ejecutarConsulta, type ResultadoEjecucion } from './consulta-ejecucion.js';
import { prepararSentencia } from './parametros.js';

/**
 * CH-45 (DEC-198): the run step over the canonical views that the template tests (CH-12,
 * CH-38) and the report tests share, moved out of `src/plantillas/plantilla-prueba.ts` with
 * the same order and bodies. It returns the answer instead of sending it, so a caller can add
 * fields to a `200` (the report tests add `periodo` and `faltantes`). With one copy, the
 * DEC-71 gate lives in one place.
 *
 * Every refusal answers before anything is dialed: ownership (`404`), the DEC-71 gate
 * (`409`), the values against the declaration (`400`), the credential (`409` or `404`). Then
 * it executes, logs a sanitized `warn` on failure, writes one audit row (none for a panel run,
 * CH-48) and answers `200`.
 */

export interface PedidoSobreVistas {
  /** Owned by the active tenant, or the answer is `404 conexion-no-encontrada`. */
  conexionId: string;
  /** Stored or already-validated operator SQL, composed over the approved views (DEC-70). */
  sql: string;
  /** The declaration, re-checked here and never trusted (DEC-73). */
  parametros: unknown;
  /** The entities the DEC-71 gate checks; a stored value outside the contract throws. */
  entidades: unknown;
  valores: Record<string, unknown>;
  limite: number;
  desplazamiento: number;
  /** Row ceiling (DEC-19). Absent means `loadConfig().maxFilasPorConsulta`, read at execution. */
  topeFilas?: number;
  /**
   * The audit row's fields. `null` only for a client panel run (CH-48, DEC-202): no row is
   * written and no "audit skipped" line is logged. Every console path passes an object.
   */
  auditoria: { origen: OrigenEjecucion; plantillaId: string | null; reporteId: string | null } | null;
  /** The `warn` line's message, kept per caller so existing logs do not change. */
  mensajeFallo: string;
}

export type RespuestaSobreVistas =
  | { codigo: 200; cuerpo: ResultadoEjecucion }
  | { codigo: 400 | 404 | 409; cuerpo: Record<string, unknown> };

export async function ejecutarSobreVistas(
  app: FastifyInstance,
  prisma: PrismaAislado,
  request: FastifyRequest,
  pedido: PedidoSobreVistas,
  canales: AbridorDeCanales,
): Promise<RespuestaSobreVistas> {
  const { conexionId } = pedido;
  // An ownership check only, as on `GET /conexiones/:id/validacion-mapeo`: the
  // extension adds `tenantId` to this selector (DEC-13), so another tenant's connection
  // is `null` here. No credential is deciphered and no mapping row is read before it.
  const conexion = await prisma.conexion.findUnique({
    where: { id: conexionId },
    select: { id: true },
  });
  if (conexion === null) {
    return { codigo: 404, cuerpo: { error: 'conexion-no-encontrada' } };
  }

  // DEC-71: `sql` and its verdict come from one scoped read, so the SQL the gate
  // approves is exactly the SQL the verdict covers. Only this connection's rows count.
  const filas = await prisma.vistaCanonica.findMany({
    where: { conexionId },
    select: { entidad: true, sql: true, estadoValidacion: true },
  });
  const compuerta = evaluarVistas(pedido.entidades, filas);
  if (!compuerta.ok) {
    return { codigo: 409, cuerpo: { error: 'vista-canonica-no-aprobada', entidades: compuerta.entidades } };
  }

  // Execution, once every gate has passed: `componerSentencia` → `prepararSentencia` →
  // `destinoDeConexion` → `ejecutarConsulta`. The composed text is built from operator SQL
  // only (DEC-70) and the whole of it goes through the scanner a saved query goes through,
  // so a value reaches the driver as a bind and never as text (rule 4).
  // The declaration is re-checked here, not trusted (DEC-73), and the values are checked
  // against it: the same `400 {campos, problemas}` as `/consultas/ejecutar`.
  const sql = componerSentencia(pedido.sql, compuerta.vistas);
  const preparada = prepararSentencia(sql, pedido.parametros, pedido.valores);
  if (!preparada.ok) {
    return {
      codigo: 400,
      cuerpo: {
        error: 'solicitud-invalida',
        campos: [...new Set(preparada.problemas.map((problema) => problema.campo))],
        problemas: preparada.problemas,
      },
    };
  }

  // The one read that names `credencial` (CH-07), made only now that nothing is left to
  // reject. It is tenant-scoped like the ownership check above (DEC-13).
  let destino;
  try {
    destino = await destinoDeConexion(prisma, conexionId, canales);
  } catch (error) {
    if (error instanceof ErrorCredencialIlegible) {
      // As on `/consultas/ejecutar`: the row exists but cannot be read under the current
      // key (DEC-20), and nothing about the envelope or the key reaches the body.
      return { codigo: 409, cuerpo: { error: 'credencial-ilegible' } };
    }
    throw error;
  }
  if (destino === null) {
    // Only reachable if the row was deleted after the ownership check.
    return { codigo: 404, cuerpo: { error: 'conexion-no-encontrada' } };
  }

  const ejecucion = await ejecutarConsulta({
    ...camposDeDestino(destino),
    sentencia: preparada.valor,
    limite: pedido.limite,
    desplazamiento: pedido.desplazamiento,
    topeFilas: pedido.topeFilas,
  });
  if (ejecucion.resultado === 'fallo') {
    // Sanitized summary only, for the reason `/consultas/ejecutar` gives: the driver error
    // carries the plaintext password. Values are never logged either (rule 5).
    app.log.warn(
      {
        conexionId: destino.id,
        fase: ejecucion.fase,
        categoria: ejecucion.categoria,
        codigo: ejecucion.codigo,
        durationMs: ejecucion.duracionMs,
      },
      pedido.mensajeFallo,
    );
  }
  // CH-20 (DEC-159, DEC-160): the composed statement as executed, never the values.
  // CH-48 (DEC-202): a panel run passes `null` and leaves no row.
  if (pedido.auditoria !== null) {
    await registrarEjecucion(prisma, app.log, request, {
      origen: pedido.auditoria.origen,
      conexionId: destino.id,
      sql,
      consulta: null,
      plantillaId: pedido.auditoria.plantillaId,
      reporteId: pedido.auditoria.reporteId,
    }, veredictoDeEjecucion(ejecucion));
  }
  // A completed attempt is `200` whatever its verdict (the CH-04 contract).
  return { codigo: 200, cuerpo: ejecucion };
}
