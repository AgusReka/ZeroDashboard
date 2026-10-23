/**
 * Reads the offending field name out of an AJV error entry, or `null` when the entry
 * is about a value rather than a key. `propertyNames` reports the name both as a
 * top-level field on the inner error and in `params` on the wrapper error.
 */
function nombreDelCampo(params: unknown, propertyName: unknown): string | null {
  if (typeof propertyName === 'string' && propertyName !== '') {
    return propertyName;
  }
  if (typeof params !== 'object' || params === null) {
    return null;
  }
  const claves = params as {
    missingProperty?: unknown;
    additionalProperty?: unknown;
    propertyName?: unknown;
  };
  for (const valor of [claves.missingProperty, claves.additionalProperty, claves.propertyName]) {
    if (typeof valor === 'string' && valor !== '') {
      return valor;
    }
  }
  return null;
}

/**
 * Maps a validation failure to field paths only. The submitted values — the
 * credential among them — are never read back into the response. Fastify types
 * `validationError.validation` as `any`, so each entry is narrowed by hand.
 *
 * AJV reports *key*-level violations — `required`, `additionalProperties`,
 * `propertyNames` — with an **empty** `instancePath`, because the key it is
 * complaining about does not exist at a path yet. The offending name lives in
 * `params.missingProperty` / `params.additionalProperty` / `params.propertyName`
 * instead. Reading `instancePath` alone therefore collapsed every one of those to a
 * bare `/`, which told the caller that something was wrong but never which field.
 * Measured against Fastify 5 while implementing CH-05, whose spec requires the field
 * name to appear. The path is rebuilt as `<instancePath>/<nombre>` so a violation
 * nested inside an object still resolves to a full path, and value-level errors keep
 * using the `instancePath` AJV already provides.
 */
export function camposInvalidos(error: { validation?: unknown }): string[] {
  if (!Array.isArray(error.validation)) {
    return ['/'];
  }
  const campos = error.validation.map((detalle: unknown) => {
    if (typeof detalle !== 'object' || detalle === null) {
      return '/';
    }
    const { instancePath, params, propertyName } = detalle as {
      instancePath?: unknown;
      params?: unknown;
      propertyName?: unknown;
    };
    const base = typeof instancePath === 'string' ? instancePath : '';
    const nombre = nombreDelCampo(params, propertyName);
    if (nombre !== null) {
      return `${base}/${nombre}`;
    }
    return base !== '' ? base : '/';
  });
  // One rejected key can raise more than one entry (`propertyNames` raises two), and
  // the caller wants each offending field named once.
  return [...new Set(campos)];
}
