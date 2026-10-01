# Exploration: CH-17 — Engine: overlaps, retries, interrupted runs (X4, X5, X7)

Status: explore done. Decisions Q1–Q9 resolved as DEC-95 to DEC-101; CH-17 split into CH-17a (X7, X4) and CH-17b (X5) by DEC-101.

## Current state

- Scheduler (`src/planificador.ts`): serial, self-rescheduling `setTimeout` tick at `hh:mm:01`, in-process (DEC-75). Ticks never overlap; no catch-up; tenants and automations run one at a time.
- `correr()`: `ejecucion.create({estado:'en-curso'})` → pipeline → `notificar()` → one `ejecucion.update` that closes the row. Nothing else finalises a row.
- `Ejecucion.estado/fase/error` are free TEXT (closed sets live in TS types and specs). `estado`: `en-curso`, `ok`, `fallo`.
- Closed failure categories already exist per phase (connection, query, permissions, preparation, send): groundwork for a transient classifier.
- Isolation extension: scheduler queries against scoped models must go through it (tenant-isolation spec); `updateMany` is whitelisted.
- No SIGTERM/SIGINT handler in `src/`: every redeploy during a run leaves an orphan `en-curso` row.
- Tests run against live PostgreSQL with a fake `Reloj`; the closed-port fixture classifies as `host-inalcanzable` (a retry candidate).

## Stories

| Story | Criterion | Release |
|---|---|---|
| X4 | "Si la ejecución anterior sigue corriendo, la nueva no arranca y queda registrado" | R2 |
| X5 | "Política de reintentos con tope; agotado el tope, se marca como fallida" | R2 |
| X7 | "Al reiniciar el servicio, las ejecuciones colgadas se marcan como fallidas, no quedan 'en curso' para siempre" | R2 |

Boundaries: X6 and X8 belong to CH-18; agent connectivity to CH-19 (DEC-94).

## Key findings

1. X4 is nearly vacuous in the serial single-process design; it bites against zombie rows, future parallelism and multi-instance. Coalesced fires leave no record.
2. Catch-up / coalesced-fire accounting is referenced by code comments as CH-17's but not by X4/X5/X7 (rule 6 pressure).
3. Retry collides with the CH-14 "exactly one send attempt, no retry" requirement; the notification phase must stay excluded (and duplicates are X6).
4. A live process can leave a stuck row if the final `ejecucion.update` throws; X7 "al reiniciar" does not cover it.
5. The sweep cannot use raw SQL; it must iterate tenant contexts (tenant-isolation spec, DEC-13). Deactivated tenants (DEC-14) need a scope ruling.
6. Retry policy must be injected with a no-retry default or existing scheduler tests change silently.

## Approaches (summary)

- X4: (A) in-memory set; (B) DB lookup of `en-curso` row before create, skip recorded; (C) partial unique index. Recommended B with a recorded skip.
- X7: (1) boot sweep, (2) staleness reaper per tick, (3) both. Recommended 1. Interrupted runs are not re-executed.
- X5: (P-A) in-run loop on the connection phase with fixed pause, one row per run plus nullable `intentos`; (P-B) re-attempt on later ticks; (P-C) no engine retry. Recommended P-A, transient connection categories only, global env config, small cap.
- Order: X7, then X4, then X5.

## Open decisions (Q1–Q9)

See the grouped prompt delivered to the user; answers are registered as DEC-95 onward in `docs/01-decisiones.md`.

## Size

Code plus tests ~650–850 lines (~900–1250 with artifacts). 400-line budget risk: High. Decision needed before apply: Yes. Preflight chose single-pr, which conflicts with the forecast (Q9).

## Risks

Rule 6 (retry/catch-up), spec drift from new closed values (`omitida`, `interrumpida`, `solapamiento`), retry blocking the serial tick, sweep scope vs DEC-14, single-instance assumption, unverified Prisma drift for a partial unique index, test fragility, unchanged notification crash window.

Ready for proposal: No.
