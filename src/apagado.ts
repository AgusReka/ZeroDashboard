import type { FastifyBaseLogger } from 'fastify';

/**
 * CH-17a (DEC-100, DEC-102): SIGTERM and SIGINT close the application, which awaits the
 * scheduler's `detener()` through its `onClose` hook. It lives apart from `src/server.ts`
 * because that file listens on import, so a test could not load it.
 *
 * A listener on a signal removes Node's default exit, so the exit is explicit: 0 after the
 * close, 1 if the close rejects. The close runs once: a second signal is logged and
 * ignored, so a hung close needs `kill -9`, and the boot sweep (DEC-99) closes what it
 * leaves `en-curso`.
 */

const SENALES = ['SIGTERM', 'SIGINT'] as const;

export interface ProcesoConSenales {
  on(senal: (typeof SENALES)[number], fn: () => void): unknown;
}

export interface DependenciasApagado {
  /** `process` in `src/server.ts`; an `EventEmitter` in tests. */
  proceso: ProcesoConSenales;
  /** `() => app.close()` in `src/server.ts`. */
  cerrar: () => Promise<void>;
  log: FastifyBaseLogger;
  salir?: (codigo: number) => void;
}

export function registrarApagado({
  proceso,
  cerrar,
  log,
  salir = (codigo) => process.exit(codigo),
}: DependenciasApagado): void {
  let cierre: Promise<void> | null = null;
  for (const senal of SENALES) {
    proceso.on(senal, () => {
      if (cierre !== null) {
        log.warn({ senal }, 'shutdown already in progress');
        return;
      }
      log.info({ senal }, 'shutting down');
      // `then(cerrar)`, so even a synchronous throw from `cerrar` becomes a rejection.
      cierre = Promise.resolve()
        .then(cerrar)
        .then(
          () => salir(0),
          (error: unknown) => {
            // Only the class name: never the message or stack (rule 5).
            const nombreError = error instanceof Error ? error.name : typeof error;
            log.error({ error: 'error-interno', nombreError }, 'shutdown failed');
            salir(1);
          },
        );
    });
  }
}
