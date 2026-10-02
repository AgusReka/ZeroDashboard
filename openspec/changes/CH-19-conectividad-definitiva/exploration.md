# Exploration: CH-19 Conectividad definitiva (C1, C2, C3)

Date: 2026-10-02. Decisions registered: DEC-112 to DEC-120 in `docs/01-decisiones.md`.

## Current state

- Every tenant-database connection goes through `iniciarConexion` (`src/db-probe.ts:101`), the only `new pg.Client`. Users: `probeConnection` and `enSesionSoloLectura` (`src/consulta-ejecucion.ts:391`).
- `destinoDeConexion` (`src/conexion-destino.ts:25`) reads and decrypts the credential. Five callers copy fields by hand: `conexiones.ts`, `consultas.ts`, `plantilla-prueba.ts`, `validacion-mapeo-rutas.ts`, `planificador.ts`.
- Read-only layer 1: `correrTransaccion` (`consulta-ejecucion.ts:334`) with `BEGIN TRANSACTION READ ONLY`, DEC-08 privilege check, DEC-09 single statement. Layer 2: client-provisioned role without write permissions.
- `conectarConReintentos` (`planificador.ts:278`) retries only the dial (DEC-97). Scheduler is serial (DEC-110) and single instance (DEC-75).
- Isolation: `MODELOS_AISLADOS` (`src/aislamiento-prisma.ts:29-35`); a model not listed passes unfiltered. `X-Tenant-Id` exemptions are a closed list (`src/contexto-tenant.ts:116-145`).
- No persisted reachability state today. G1 connection mark is `Conexion.creadaEn` (DEC-88).
- `pg` 8.23 accepts `config.stream` as a factory (`node_modules/pg/lib/connection.js:19-21`), so a tunneled duplex can be injected at `iniciarConexion`. Needs a spike.
- Tests dial a live PostgreSQL directly; direct mode must keep working.

## Decisions taken

| DEC | Decision |
|---|---|
| 112 | Byte relay; engine keeps `pg.Client` |
| 113 | WebSocket over TLS, TLS at reverse proxy |
| 114 | Per-agent hashed bearer token |
| 115 | One agent per tenant; allowlist only on agent; direct mode coexists (production switch-off pending) |
| 116 | `/agente/*` closed exemption; tenant from token |
| 117 | Offline agent: attempt and fail with `agente-desconectado` |
| 118 | Heartbeat plus TCP probe; no alert email |
| 119 | C3 by script plus template; amends DEC-88 |
| 120 | Docker image |

## Split (each PR <= 400 lines; size:exception where needed)

| Change | Content | Est. lines |
|---|---|---|
| CH-19a | Protocol types, `canal` seam in `iniciarConexion` threaded through the five callers, spike with an in-memory fake stream | 280-380 |
| CH-19b | Migration `Agente` + `Conexion.agenteId`, token create/list/revoke, isolation, two-tenant test | 320-400 |
| CH-19c1 | Engine side: WebSocket control/data routes, session registry, `destinoDeConexion` returns a channel | 350-420 |
| CH-19c2 | Agent process: reconnect with backoff, allowlist, bridge, Dockerfile target, compose snippet, end-to-end test | 300-400 |
| CH-19d | C2: heartbeat and probe, state columns, new categories, DEC-97 amendment, state endpoint, console indicator, at-risk view | 350-430 |
| CH-19e | C3: `scripts/conectividad-alta.sql`, bitacora template, DEC-88 mark, onboarding runbook | 200-300 |

## Anti-scope risks

- Rule 1: no route may take SQL from the client side.
- Rule 2: tenant only from token; unlisted model fails open; session ids must be unguessable.
- Rule 4: agent probe is TCP only, no SQL.
- Rule 5: channel logs carry closed fields only; never tokens or frame contents; relay must not buffer rows (DEC-93).
- Rule 6: no heartbeat job in the scheduler, no operator alert emails, no store-and-forward (DEC-95), no skipping runs (DEC-110).
- Rule 7: agent token is a secret; shown once, stored hashed.
- Public WebSocket endpoint needs auth before upgrade, size limits and idle timeouts.
- Relay latency must fit the existing connect budget (`PRESUPUESTO_AGOTADO` stays authoritative).

## Comparables (search summaries only; run sdd-research to make citable)

- Grafana Private Data Source Connect: outbound SSH reverse tunnel from an agent in the customer network.
- Fivetran Proxy Agent: outbound mTLS relay.
