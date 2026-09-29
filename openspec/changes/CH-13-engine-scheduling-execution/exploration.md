# Exploration: CH-13 — Engine: Scheduling and Execution (X1, X2)

**Status:** done — OQ-A..OQ-D resolved by the user on 2026-09-28 (all recommended options) and registered as DEC-74 (OQ-A), DEC-75 (OQ-B), DEC-76 (OQ-C), DEC-77 (OQ-D).

## Scope

- X1: scheduler runs automation templates by schedule.
- X2: execution log with start, end, duration, rows, status.
- Out of scope: condition + email notification (CH-14: X3, N1, N2); overlaps, retries, interrupted runs, duplicate notifications, cross-tenant failure isolation (CH-17/CH-18, R2).

## Current State

- CH-12's execution pipeline is reusable as-is: `componerSentencia` and `evaluarVistas` (`src/plantillas.ts`), `ejecutarConsulta` (`src/consulta-ejecucion.ts`, whose `ResultadoEjecucion` shape feeds the log), and `src/plantilla-prueba.ts` as the structural template for a run.
- `conTenantActivo` (`src/contexto-tenant.ts`) is documented as a test/seed-only helper; a background run would make it a production entry point for tenant-scoped work.
- `src/aislamiento-prisma.ts` `MODELOS_AISLADOS` must include any new tenant-scoped model.
- `openspec/specs/domain-data-model/spec.md` (inherited from CH-12) currently forbids `Ejecucion` / `Automatizacion` tables; that requirement must be explicitly superseded, not silently contradicted.
- The app runs as a single process (`src/server.ts`) in one Compose service.

## Existing decisions that apply

- DEC-61 (Plantilla stays tenant-agnostic): rules out storing schedule/connection/values on `Plantilla`.
- DEC-19 (global env-var configuration precedent): relevant to timezone.
- DEC-02 (no external orchestrator such as n8n) and DEC-09 (avoid dependencies for this class of concern).
- D-1 current leaning (store metadata, not results): supports logging only a row count for X2.

## Sequencing gap

`docs/mapa-historias.md` assigns template instantiation for a tenant (D2) to CH-21/R2, but X1/X2 need a per-tenant schedule + connection + parameter-value binding now.

## Open Questions (require user decision before sdd-propose)

**OQ-A — Where does the schedule/connection/parameter-value binding live?**
- (a) CH-13 introduces a minimal tenant-scoped automation instance entity (e.g. `Automatizacion`) with only what X1/X2 need, no CH-21 UX. **Recommended.**
- (b) Attach it to `Plantilla` — breaks DEC-61.
- (c) Reorder the map to pull D2 into CH-13, or postpone CH-13 until CH-21.

**OQ-B — In-process timer vs separate worker process?**
- (a) In-process inside the existing `src/server.ts` process/Compose service. **Recommended.**
- (b) Separate worker process / Compose service.

**OQ-C — Schedule expression format?**
- (a) Full cron via a small next-fire-time-only parsing library (new dependency). **Recommended.**
- (b) Restricted hand-rolled subset (daily HH:mm / every N minutes), no dependency.

**OQ-D — Timezone interpretation?**
- (a) UTC only.
- (b) Single global timezone via env var (DEC-19 precedent). **Recommended.**
- (c) Per-tenant timezone (new `Tenant` column).

## Risks

1. Superseding the domain-data-model prohibition on `Ejecucion` / `Automatizacion`.
2. `conTenantActivo` becomes a production path; needs design attention.
3. If OQ-A pulls part of D2 forward, the maps need a note.
4. AGENTS.md lists D-4/D-5 as open, but they are closed (DEC-25/DEC-26). This is a documentation issue, not a blocker.
5. A cron dependency adds new third-party surface.
