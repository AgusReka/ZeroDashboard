import pg from 'pg';
import type { CategoriaEjecucion, SondeoEntidad } from './consulta-ejecucion.js';
import {
  AUTOMATIZACIONES,
  CONTRATO_CANONICO,
  type Automatizacion,
  type CampoCanonico,
  type EntidadCanonica,
  type Obligatoriedad,
  type TipoSemantico,
} from './contrato.js';

/**
 * CH-10: the pure half of mapping validation (M3, M4). It compares the columns a
 * zero-row probe reported against the typed canonical contract, and derives the
 * per-automation applicability report from the persisted results. No database, no
 * connection, no clock: `src/validacion-mapeo-rutas.ts` owns every side effect, and
 * this module is proven without either database in `validacion-mapeo.test.ts`.
 */

/** A persisted `VistaCanonica.estadoValidacion` (DEC-44). */
export type EstadoValidacion = 'no-validado' | 'valida' | 'invalida';

export const ESTADOS_VALIDACION: readonly EstadoValidacion[] = [
  'no-validado',
  'valida',
  'invalida',
];

export type VeredictoCampo =
  | 'ok'
  | 'ausente'
  | 'tipo-incorrecto'
  | 'alias-sin-comillas'
  | 'duplicada';

/**
 * The cast a view needs when its column's type has no entry in the table below
 * (DEC-45). Machine tokens, like every other verdict this API returns: the console
 * owns the human sentence.
 */
export interface PistaCast {
  accion: 'castear-en-la-vista';
  sugerencia: string;
}

export interface DiagnosticoCampo {
  campo: string;
  tipoEsperado: TipoSemantico;
  /** The probed column attributed to this field; `null` when none was. */
  columna: string | null;
  veredicto: VeredictoCampo;
  oid: number | null;
  /** The builtin type name (`int4`, `text`, …); `null` for enums and any non-builtin OID. */
  tipoPostgres: string | null;
  /** The category the column actually classified into; `null` when it has none. */
  tipoObservado: TipoSemantico | null;
  /** Only for a column whose OID the tolerant table does not classify (DEC-45). */
  pista: PistaCast | null;
}

/**
 * What is persisted in `VistaCanonica.diagnosticoValidacion`. `version` lets a later
 * change reshape it without misreading rows written by this one.
 */
export interface DiagnosticoValidacion {
  version: 1;
  sondeo:
    | { resultado: 'ok' }
    | { resultado: 'fallo'; categoria: CategoriaEjecucion; codigo: string | null };
  /** One verdict per contract field, in contract order. Empty when the probe failed. */
  campos: DiagnosticoCampo[];
  /** Columns the contract does not define for the entity (DEC-43). */
  columnasSobrantes: { columna: string; oid: number }[];
}

// ---- the tolerant OID → category table (DEC-39, DEC-45) --------------------------

const OID = pg.types.builtins;

/**
 * Every OID the validation classifies, with the category it *means* and the
 * categories it is *accepted* as. The two differ only for integers and text, which are
 * also valid identifiers: platforms key their rows by `int`, `uuid` or `text`.
 *
 * Nothing else is classified. Arrays, `money`, `json`, enums and any other OID fail as
 * a category mismatch with a cast hint (DEC-45). Domains need no entry: the server
 * reports a domain column as its base type.
 */
const TABLA_OID: ReadonlyMap<number, { observado: TipoSemantico; aceptado: readonly TipoSemantico[] }> =
  new Map([
    [OID.INT2, { observado: 'numero', aceptado: ['numero', 'identificador'] }],
    [OID.INT4, { observado: 'numero', aceptado: ['numero', 'identificador'] }],
    [OID.INT8, { observado: 'numero', aceptado: ['numero', 'identificador'] }],
    [OID.NUMERIC, { observado: 'numero', aceptado: ['numero'] }],
    [OID.FLOAT4, { observado: 'numero', aceptado: ['numero'] }],
    [OID.FLOAT8, { observado: 'numero', aceptado: ['numero'] }],
    [OID.UUID, { observado: 'identificador', aceptado: ['identificador'] }],
    [OID.TEXT, { observado: 'texto', aceptado: ['texto', 'identificador'] }],
    [OID.VARCHAR, { observado: 'texto', aceptado: ['texto', 'identificador'] }],
    [OID.BPCHAR, { observado: 'texto', aceptado: ['texto', 'identificador'] }],
    [OID.BOOL, { observado: 'booleano', aceptado: ['booleano'] }],
    [OID.DATE, { observado: 'fecha', aceptado: ['fecha'] }],
    [OID.TIMESTAMP, { observado: 'fecha', aceptado: ['fecha'] }],
    [OID.TIMESTAMPTZ, { observado: 'fecha', aceptado: ['fecha'] }],
  ]);

/** The builtin names, lowercased, for the diagnostic only: `pg` knows no other OID. */
const NOMBRE_POR_OID: ReadonlyMap<number, string> = new Map(
  Object.entries(OID).map(([nombre, oid]) => [oid, nombre.toLowerCase()]),
);

/** The cast that would bring an unclassified column into each expected category. */
const CAST_SUGERIDO: Record<TipoSemantico, string> = {
  identificador: '::text',
  texto: '::text',
  numero: '::numeric',
  booleano: '::boolean',
  fecha: '::timestamptz',
};

/** Whether a column of type `oid` satisfies a field declared as `tipo`. */
export function aceptaTipo(tipo: TipoSemantico, oid: number): boolean {
  return TABLA_OID.get(oid)?.aceptado.includes(tipo) ?? false;
}

/** The category a column of type `oid` means, or `null` when the table lacks it. */
export function tipoObservadoDe(oid: number): TipoSemantico | null {
  return TABLA_OID.get(oid)?.observado ?? null;
}

// ---- diagnosis of one entity ------------------------------------------------------

/** Whether a verdict fails the entity. Only an absent *optional* field is tolerated. */
function fallaCampo(veredicto: VeredictoCampo, obligatoriedad: Obligatoriedad): boolean {
  if (veredicto === 'ok') {
    return false;
  }
  return !(veredicto === 'ausente' && obligatoriedad === 'opcional');
}

function diagnosticoCampo(
  campo: CampoCanonico,
  columna: string | null,
  veredicto: VeredictoCampo,
  oid: number | null,
): DiagnosticoCampo {
  const tipoObservado = oid === null ? null : tipoObservadoDe(oid);
  const sinCategoria = oid !== null && tipoObservado === null;
  return {
    campo: campo.nombre,
    tipoEsperado: campo.tipo,
    columna,
    veredicto,
    oid,
    tipoPostgres: oid === null ? null : (NOMBRE_POR_OID.get(oid) ?? null),
    tipoObservado,
    pista:
      sinCategoria && veredicto === 'tipo-incorrecto'
        ? { accion: 'castear-en-la-vista', sugerencia: CAST_SUGERIDO[campo.tipo] }
        : null,
  };
}

/**
 * Compares one entity's probe against its contract fields.
 *
 * Per field, in contract order: an exact name match is checked for its type
 * (`ok` / `tipo-incorrecto`), or is `duplicada` when the view reports it more than
 * once. With no exact match, a column equal to the name folded to lower case is the
 * unquoted-alias mistake (`stockDisponible` → `stockdisponible`), attributed to the
 * field rather than listed as extra. Otherwise the field is `ausente`.
 *
 * The entity is `valida` only when the probe succeeded, no verdict fails, and every
 * probed column was attributed to a field (DEC-43).
 */
export function diagnosticar(
  entidad: EntidadCanonica,
  sondeo: SondeoEntidad,
): { estado: 'valida' | 'invalida'; diagnostico: DiagnosticoValidacion } {
  if (sondeo.resultado === 'fallo') {
    return {
      estado: 'invalida',
      diagnostico: {
        version: 1,
        sondeo: { resultado: 'fallo', categoria: sondeo.categoria, codigo: sondeo.codigo },
        campos: [],
        columnasSobrantes: [],
      },
    };
  }

  const atribuidas = new Set<number>();
  const campos = entidad.campos.map((campo): DiagnosticoCampo => {
    const exactas = indicesDe(sondeo.columnas, campo.nombre);
    if (exactas.length > 0) {
      exactas.forEach((i) => atribuidas.add(i));
      const primera = sondeo.columnas[exactas[0] as number] as { nombre: string; oid: number };
      if (exactas.length > 1) {
        return diagnosticoCampo(campo, primera.nombre, 'duplicada', primera.oid);
      }
      const veredicto = aceptaTipo(campo.tipo, primera.oid) ? 'ok' : 'tipo-incorrecto';
      return diagnosticoCampo(campo, primera.nombre, veredicto, primera.oid);
    }

    const plegado = campo.nombre.toLowerCase();
    const alias = plegado === campo.nombre ? [] : indicesDe(sondeo.columnas, plegado);
    if (alias.length > 0) {
      alias.forEach((i) => atribuidas.add(i));
      const primera = sondeo.columnas[alias[0] as number] as { nombre: string; oid: number };
      return diagnosticoCampo(campo, primera.nombre, 'alias-sin-comillas', primera.oid);
    }
    return diagnosticoCampo(campo, null, 'ausente', null);
  });

  const columnasSobrantes = sondeo.columnas
    .filter((_, i) => !atribuidas.has(i))
    .map((c) => ({ columna: c.nombre, oid: c.oid }));

  const falla = campos.some((c, i) =>
    fallaCampo(c.veredicto, (entidad.campos[i] as CampoCanonico).obligatoriedad),
  );
  return {
    estado: !falla && columnasSobrantes.length === 0 ? 'valida' : 'invalida',
    diagnostico: { version: 1, sondeo: { resultado: 'ok' }, campos, columnasSobrantes },
  };
}

function indicesDe(columnas: readonly { nombre: string }[], nombre: string): number[] {
  const indices: number[] = [];
  columnas.forEach((c, i) => {
    if (c.nombre === nombre) {
      indices.push(i);
    }
  });
  return indices;
}

// ---- the applicability report (M4, DEC-22, DEC-46) --------------------------------

/** The persisted columns the report reads, as the routes select them. */
export interface FilaValidacion {
  entidad: string;
  estadoValidacion: string;
  diagnosticoValidacion: unknown;
  validadaEn: Date | null;
}

export interface InformeEntidad {
  entidad: string;
  obligatoriedad: Obligatoriedad;
  /** `no-mapeada` is derived at read time: an unmapped entity has no row (DEC-44). */
  estado: EstadoValidacion | 'no-mapeada';
  validadaEn: Date | null;
  diagnostico: DiagnosticoValidacion | null;
}

export type EstadoAutomatizacion = 'aplicable' | 'inaplicable' | 'bloqueada' | 'pendiente';

export type MotivoAplicabilidad =
  | 'entidad-no-mapeada'
  | 'no-validada'
  | 'sondeo-fallido'
  | 'columnas-sobrantes'
  | 'diagnostico-ilegible'
  | Exclude<VeredictoCampo, 'ok'>;

export interface Motivo {
  entidad: string;
  campo: string | null;
  motivo: MotivoAplicabilidad;
}

export interface InformeAutomatizacion {
  automatizacion: Automatizacion;
  estado: EstadoAutomatizacion;
  motivos: Motivo[];
}

export interface InformeValidacion {
  entidades: InformeEntidad[];
  automatizaciones: InformeAutomatizacion[];
}

/**
 * A shape check of what was read back from JSONB. The rows are this module's own
 * output, so this only guards against a row written by a different `version`: an
 * unreadable diagnostic on an `invalida` row blocks, it never lets an automation pass.
 */
function esDiagnostico(valor: unknown): valor is DiagnosticoValidacion {
  if (typeof valor !== 'object' || valor === null) {
    return false;
  }
  const d = valor as Partial<DiagnosticoValidacion>;
  return (
    d.version === 1 &&
    typeof d.sondeo === 'object' &&
    d.sondeo !== null &&
    Array.isArray(d.campos) &&
    Array.isArray(d.columnasSobrantes)
  );
}

function estadoDe(valor: string): EstadoValidacion {
  // A value outside the closed set can only come from a hand-edited row; it is read as
  // "never validated", which keeps every dependent automation pending, never applicable.
  return (ESTADOS_VALIDACION as readonly string[]).includes(valor)
    ? (valor as EstadoValidacion)
    : 'no-validado';
}

/** Precedence when several conditions apply (DEC-46): the first listed wins. */
const PRECEDENCIA: readonly EstadoAutomatizacion[] = ['inaplicable', 'bloqueada', 'pendiente'];

/**
 * Builds the report from the persisted rows and the contract. Pure: the rows are the
 * whole input, so reading the report never needs the tenant's database (DEC-40).
 *
 * An automation depends on an entity when any of that entity's fields names it
 * (DEC-22). Per dependency, in contract order: an unmapped optional entity makes it
 * `inaplicable`; an unmapped required entity, a failed probe, extra columns, or a
 * failing field that names this automation make it `bloqueada`; a mapped entity never
 * validated makes it `pendiente`. Every reason is listed whatever the final status.
 */
export function informe(filas: readonly FilaValidacion[]): InformeValidacion {
  const porEntidad = new Map(filas.map((f) => [f.entidad, f]));

  const entidades = CONTRATO_CANONICO.map((e): InformeEntidad => {
    const fila = porEntidad.get(e.nombre);
    if (fila === undefined) {
      return {
        entidad: e.nombre,
        obligatoriedad: e.obligatoriedad,
        estado: 'no-mapeada',
        validadaEn: null,
        diagnostico: null,
      };
    }
    return {
      entidad: e.nombre,
      obligatoriedad: e.obligatoriedad,
      estado: estadoDe(fila.estadoValidacion),
      validadaEn: fila.validadaEn,
      diagnostico: esDiagnostico(fila.diagnosticoValidacion) ? fila.diagnosticoValidacion : null,
    };
  });

  const automatizaciones = Object.values(AUTOMATIZACIONES).map(
    (automatizacion): InformeAutomatizacion => {
      const motivos: Motivo[] = [];
      const condiciones = new Set<EstadoAutomatizacion>();

      CONTRATO_CANONICO.forEach((contrato, i) => {
        const depende = contrato.campos.some((c) => c.automatizaciones.includes(automatizacion));
        if (!depende) {
          return;
        }
        const e = entidades[i] as InformeEntidad;
        const agregar = (estado: EstadoAutomatizacion, campo: string | null, motivo: MotivoAplicabilidad) => {
          condiciones.add(estado);
          motivos.push({ entidad: e.entidad, campo, motivo });
        };

        if (e.estado === 'no-mapeada') {
          agregar(
            contrato.obligatoriedad === 'opcional' ? 'inaplicable' : 'bloqueada',
            null,
            'entidad-no-mapeada',
          );
        } else if (e.estado === 'no-validado') {
          agregar('pendiente', null, 'no-validada');
        } else if (e.estado === 'invalida') {
          if (e.diagnostico === null) {
            agregar('bloqueada', null, 'diagnostico-ilegible');
            return;
          }
          if (e.diagnostico.sondeo.resultado === 'fallo') {
            agregar('bloqueada', null, 'sondeo-fallido');
          }
          if (e.diagnostico.columnasSobrantes.length > 0) {
            agregar('bloqueada', null, 'columnas-sobrantes');
          }
          for (const diagnostico of e.diagnostico.campos) {
            const campo = contrato.campos.find((c) => c.nombre === diagnostico.campo);
            if (
              campo !== undefined &&
              campo.automatizaciones.includes(automatizacion) &&
              fallaCampo(diagnostico.veredicto, campo.obligatoriedad)
            ) {
              agregar(
                'bloqueada',
                campo.nombre,
                diagnostico.veredicto as Exclude<VeredictoCampo, 'ok'>,
              );
            }
          }
        }
      });

      const estado = PRECEDENCIA.find((p) => condiciones.has(p)) ?? 'aplicable';
      return { automatizacion, estado, motivos };
    },
  );

  return { entidades, automatizaciones };
}
