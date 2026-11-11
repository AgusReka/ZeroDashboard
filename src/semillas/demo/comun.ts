import { filaDeAuditoria, veredictoDeSondeo } from '../../auditoria/auditoria.js';
import { sentenciaDeSondeo, type sondearEstructura } from '../../ejecucion/consulta-ejecucion.js';
import { CONTRATO_CANONICO } from '../../contrato/contrato.js';
import type { DestinoPostgres } from '../../ejecucion/db-probe.js';
import type { PrismaClient } from '../../generated/prisma/client.js';
import {
  diagnosticar,
  registrarVeredictos,
  type DiagnosticoValidacion,
  type VistaASentenciar,
} from '../../mapeo/validacion-mapeo.js';

/**
 * CH-49: the pieces every demo tenant shares. `sembrarDemo` (CH-31) used to hold them next to
 * Food Store's constants; a tenant is now a `TenantDemo` descriptor, so the second tenant runs
 * the same code path as the first.
 */

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

/** Everything that differs between one demo tenant and the next. */
export interface TenantDemo {
  ids: {
    tenant: string;
    conexion: string;
    /** By contract entity name, one id per canonical view. */
    vistas: Readonly<Record<string, string>>;
    usuario: string;
    automatizacion: string;
    /** Present only for the tenant that keeps the saved query. */
    consulta?: string;
  };
  nombre: string;
  /** Where the app reaches the replica inside the Compose network (DEC-170). */
  replica: {
    host: string;
    puerto: number;
    baseDatos: string;
    usuario: string;
    nombreConexion: string;
  };
  /** Already normalized; derived for the second tenant. */
  correoPanel: string;
  /** Prepended to this tenant's labels in `creadas`, so the two tenants never collide. */
  prefijoEtiqueta: string;
}

/** The operator the audit row is attributed to. */
export interface OperadorDemo {
  id: string;
  nombre: string;
}

/** The reason an entity is not valid, in machine tokens: no secret can be in it. */
export function motivoInvalida(diagnostico: DiagnosticoValidacion): string {
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
export async function crearSiFalta<T>(
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

/** The in-memory destination the seed dials: the plaintext from the environment is what was enciphered. */
export function destinoDeReplica(tenant: TenantDemo, claveReplica: string): DestinoPostgres & { id: string } {
  return {
    id: tenant.ids.conexion,
    host: tenant.replica.host,
    port: tenant.replica.puerto,
    database: tenant.replica.baseDatos,
    user: tenant.replica.usuario,
    password: claveReplica,
  };
}

/** The closed text for a probe that did not answer: `fase · categoria (codigo)`, never the driver's. */
export function mensajeSinRespuesta(fase: string, categoria: string, codigo: string | null): string {
  return `replica-demo did not answer: ${fase} · ${categoria} (${codigo ?? 'no code'})`;
}

/**
 * The route's validation, without the route: probe the views, judge each entity, persist
 * the verdicts and write the audit row (CH-20, DEC-159). Nothing is written until every
 * entity is `valida`. The audit row names the descriptor's tenant.
 */
export async function validarVistas(
  prisma: ClienteSemilla,
  contexto: { sondear: typeof sondearEstructura; claveReplica: string; operador: OperadorDemo },
  tenant: TenantDemo,
  vistas: readonly VistaASentenciar[],
): Promise<void> {
  const sondeo = await contexto.sondear(
    destinoDeReplica(tenant, contexto.claveReplica),
    vistas.map((v) => ({ entidad: v.entidad, sql: v.sql })),
  );
  if (sondeo.resultado === 'fallo') {
    throw new Error(mensajeSinRespuesta(sondeo.fase, sondeo.categoria, sondeo.codigo));
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
      conexionId: tenant.ids.conexion,
      sql: vistas.map((v) => sentenciaDeSondeo(v.sql)).join(';\n'),
      consulta: null,
      plantillaId: null,
      operador: contexto.operador,
    },
    veredictoDeSondeo(sondeo),
  );
  await prisma.registroEjecucion.create({
    data: { ...fila, tenantId: tenant.ids.tenant, tenantNombre: tenant.nombre },
  });
}
