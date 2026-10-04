# Exploration: CH-19c2 agent process (fifth slice of CH-19)

Date: 2026-10-03. Status: decisions A1-A7 pending the user's choice (candidate DEC-123).

## Current state

- `src/agente-protocolo.ts`: types only, zero imports (`AperturaSesion`, `Latido`, `SesionFallida`, `MensajeControl`, `CodigoErrorAgente` with 7 codes, `CodigoCierre` 4001/4002). No runtime values allowed.
- `src/agente-servidor.ts`: control `/agente/control`, data `/agente/datos/<22 chars>`; header `^Bearer (zda_[A-Za-z0-9_-]{43})$`; refusals 401/403/404/500 before the 101; control `maxPayload` 4096, data 1 MiB; engine pings every 20 s and terminates sockets that miss a pong.
- `src/registro-agentes.ts`: 8 sessions per agent, pending TTL 30 s, a new control socket closes the old one with 4001, revoke or baja close with 4002.
- `src/canal-agente.ts`: `LIMITE_TRAMA_DATOS = 1 << 20` is a runtime constant in an engine module (the agent cannot import it); writes above 1 MiB are split.
- `src/agente-e2e.test.ts` (115-138): the fake agent is the reference (replica first, then data dial-back); no backpressure, allowlist, timeouts or reconnect.
- `src/agente-token.ts` is a runtime module the agent must not import.
- `src/config.ts` echoes some values in errors (counter-example, do not copy). `src/apagado.ts` types its logger as `FastifyBaseLogger` (not reusable).
- Build: `tsconfig.json` has `rootDir: src`; one `Dockerfile` runtime stage (the last stage is the default target); `docker-compose.yml` publishes `${APP_PORT}:${APP_PORT}` on all interfaces; `.env.example` is engine-only.
- `ws` 8.22.0 and `@types/ws` 8.18.2 are installed; 19c2 adds no npm dependency. `ws` client defaults: `maxPayload` 100 MiB and `perMessageDeflate` true (both must be set), `followRedirects` false, HTTP status only via `'unexpected-response'`, bad URL error echoes the URL.
- `package.json` test script `tsx --test src/**/*.test.ts` is unquoted: a test file in a `src/<subdir>/` makes POSIX `sh` expand it to `src/*/*.test.ts` and silently drop every flat test. It must be quoted if a subdirectory is used.

## Decisions pending (candidate DEC-123)

- A1 code location and build, A2 protocol-type imports, A3 terminal versus retry, A4 allowlist format and matching, A5 allowlist-refusal code, A6 TLS rule, A7 Compose and env example placement. Options and recommendations were presented to the user; the registered result is in DEC-123.

## Design-level (no DEC)

- Env vars: `AGENT_SERVER_URL` (origin only), `AGENT_TOKEN`, `AGENT_ALLOWED_TARGETS`; limits are constants. Config errors name the variable and never print a value. Not `loadConfig`.
- Backoff: exponential, 1 s min, factor 2, 60 s max, equal jitter, injectable random and timer; the counter resets after the control socket stays open at least 30 s.
- Ping watchdog: terminate a socket with no engine ping for 50 s; no `latido` sent in 19c2.
- Replica connect timeout 10 s (`ETIMEDOUT`); `sesionId` validated against `^[A-Za-z0-9_-]{22}$` before it enters a URL; replica first, then dial data with a 10 s handshake timeout; a data-dial failure destroys the replica socket.
- Agent-side session cap 16; sessions survive a control drop; `sesion-fallida` is best effort, no queue.
- Hand-written bridge (binary only, text frame closes the data socket with 1003, backpressure both ways, no `createWebSocketStream`), data `maxPayload` exactly 1 MiB.
- Own signal handler (SIGTERM/SIGINT: stop reconnecting, close control 1001, close data, destroy replicas, wait at most 5 s, exit 0). Exit codes: 0 clean, 1 config, 2 credentials, 3 replaced.
- Own JSON-lines logger with a closed event union; never token, URL, host, port, `sesionId`, frame bytes or any `error.message`.
- Docker: stage order `build`, `agente`, engine last; `agente` stage on `node:22-alpine`, `USER node`, only `dist-agente` plus `node_modules/ws`; no HEALTHCHECK (agent-side state belongs to 19d1); `build:agente` script.
- `iniciarAgente({ config, log, programar, aleatorio })` returns `{ terminado, detener() }`; `main.ts` maps the reason to an exit code.

## e2e strategy

In-process agent as the main matrix against a real Fastify, registry, upgrade listener and live PostgreSQL; a few spawned-process checks (bad config exits 1 with no secret on stderr, one happy path). Graceful shutdown is tested in-process with an injected signal emitter (on Windows `child.kill()` is a hard kill). A small TCP forwarder between agent and engine can sever links. Real TLS is not tested end to end (rule 7): pure URL-policy tests plus an options-spy test, gap noted for the 19e runbook. Cases A1-A9: probe through the agent, target not in the allowlist (zero accepts on a throwaway replica), reconnect after a cut, 401 terminal, 4002 terminal, 4001 terminal, replica refused with no data upgrade, a 1 MB result across frames, stdout without secrets. Do not modify the 19c1 `agente-e2e.test.ts`.

## Scope

In 19c2: agent process, config, TLS rule, allowlist, reconnect, ping watchdog, bridge, session cap, shutdown, logger, Docker target, Compose file, env example, e2e. Out: heartbeat semantics and reachability state, including how the probe reaches the agent (19d1; keep the control dispatcher a closed switch on `tipo`), the `agente-desconectado` category (19d2), runbook, `conectividad-alta.sql`, image distribution, direct-mode re-evaluation and proxy/TLS docs (19e).

## Size and split

About 1.6k estimated (likely 1.9-2.1k measured), five chained PRs: 1) config, TLS policy, allowlist, limits, parity test (~320); 2) logger and bridge (~340); 3) backoff, control loop, classification, watchdog (~355); 4) main, shutdown, exit codes, boundary test, tsconfig, Dockerfile stage, compose, env example (~300); 5) e2e matrix (~300). PRs 1-3 may pass 400; fallbacks: PR 2 extras to PR 3 or a sixth PR; PR 5 may move A8 and A9. Nothing is wired into the engine in any PR.

## Anti-scope risks

Rule 1: the bridge never inspects bytes (no Postgres protocol sniffing); a boundary test forbids `pg` and Prisma imports. Rules 2 and 5: the agent sees only a token; no tenant variable; logs never carry token, URL, host, port, `sesionId` or frame bytes. Rule 3: no DB credentials on the agent. Rule 4: `sesionId` is regex-validated before entering the URL. Rule 6: no queue, no session retry, no health port, no reload, no CIDR or wildcards, no probing, no new control messages. Rule 7: empty values in the env example, `${AGENT_TOKEN:?}` in Compose, no token in the image or build args, generated tokens in tests. Other: real TLS verification (including `NODE_TLS_REJECT_UNAUTHORIZED=0`) has no e2e coverage and must be verified at apply; duplicated token regex and limits need parity tests; `docker build --target agente` needs a manual check; the existing Compose publishes the engine port on all interfaces (19e item).
