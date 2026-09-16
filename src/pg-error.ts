/**
 * The two credential-safety sanitizers shared by every phase that classifies a
 * raw PostgreSQL driver error.
 *
 * They were CH-03's module-private helpers in `src/db-probe.ts` and were **moved**
 * here verbatim — not copied — when CH-04 added a second classifier
 * (`classifyExecutionError`). One definition means one place where the rule
 * "only `error.code`, and only when it has a known machine shape" can be read,
 * reviewed, or broken. `src/db-probe.test.ts` passes unchanged across the move
 * and is the regression guard for it.
 */

/** SQLSTATE shape, e.g. `28P01`. */
export const SQLSTATE_PATTERN = /^[0-9A-Z]{5}$/;
/** Node error-code shape, e.g. `ECONNREFUSED`. */
export const NODE_CODE_PATTERN = /^E[A-Z]{2,20}$/;

/**
 * Reads `error.code` only. `message`, `stack`, `connectionParameters` and the error
 * object itself are never read, spread, or serialized: node-postgres serializes the
 * plaintext password into those fields.
 */
export function leerCodigoCrudo(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }
  const codigo = (error as { code?: unknown }).code;
  return typeof codigo === 'string' ? codigo : null;
}

/**
 * Allowlist gate for the emitted `codigo`: a code is published only when it has a
 * known machine shape. Anything else (including free-text driver codes) becomes `null`.
 */
export function codigoPublicable(codigoCrudo: string | null): string | null {
  if (codigoCrudo === null) {
    return null;
  }
  if (SQLSTATE_PATTERN.test(codigoCrudo) || NODE_CODE_PATTERN.test(codigoCrudo)) {
    return codigoCrudo;
  }
  return null;
}
