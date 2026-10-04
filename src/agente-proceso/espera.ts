import { LIMITES_AGENTE } from './limites.js';

/**
 * CH-19c2 (DEC-123): the delay before reconnect attempt `intento` (0-based). Exponential,
 * factor 2, with equal jitter: half of `tope` is fixed and the other half random, where
 * `tope = min(60 s, 1 s * 2^(intento + 1))`. So every delay lies in [tope/2, tope], never
 * below 1 s nor above 60 s, and a fleet of agents does not redial the engine in lockstep.
 */
export function esperaReconexion(intento: number, aleatorio: () => number): number {
  const tope = Math.min(LIMITES_AGENTE.esperaMaxMs, LIMITES_AGENTE.esperaMinMs * 2 ** (intento + 1));
  return Math.round(tope / 2 + aleatorio() * (tope / 2));
}
