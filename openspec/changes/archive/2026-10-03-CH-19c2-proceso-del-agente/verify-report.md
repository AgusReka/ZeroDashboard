```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:ca29ab2d112c48a4468ca992e39fbbece47cdb97921d3aa998946812dd35ee6f
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 13/13
scenarios: 37/37
test_command: "TEST_DB_PORT=5434 npm test"
test_exit_code: 0
test_output_hash: sha256:208ff48728c8e3e028e44200b9f576af09a32cf6f2e035d5b21b478a763161df
build_command: "npx tsc --noEmit && npx tsc -p tsconfig.agente.json --noEmit && npx tsc -p tsconfig.json --noEmit"
build_exit_code: 0
build_output_hash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

# Verification Report: CH-19c2-proceso-del-agente

Mode: openspec, standard (no Strict TDD runner mandated). Branch `ch19c2/e2e-con-agente-real`, HEAD `2b1aec0`.

## Evidence

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit 0, no output |
| `npx tsc -p tsconfig.agente.json --noEmit`, `npx tsc -p tsconfig.json --noEmit` | exit 0, no output |
| `TEST_DB_PORT=5434 npm test` | exit 0. tests 829, pass 829, fail 0, cancelled 0, skipped 0 (baseline 767, expected 829; no live suite self-skipped) |
| `docker compose -f docker-compose.agente.yml config` with the three variables unset | refuses, one error per variable naming it ("AGENT_TOKEN is required"), no value |
| `docker build --target agente .` | not re-run (no rebuild); apply run 4.9 recorded exit 0, `User=node`, `Healthcheck=null`, no pg/Prisma/Fastify/engine sources; default `docker build .` identical to the previous image (4.10) |

## Completeness

All tasks 1.1-5.9 are checked except: 1.8 (unit 1 line-count checkpoint, measured 429 > 400; resolved by the PR split #70-#78, but the box was never ticked), 6.1 and 6.2 (archive-time, orchestrator-owned by design).

## Spec compliance matrix (13 requirements, 37 scenarios)

| Requirement | Scenarios | Covering passing tests | Status |
|---|---|---|---|
| Configuration | 3 | config.test C1, C2, valid-config, C5 ; arranque M1 ; proceso-e2e S1 (spawned, sentinel) | COMPLIANT |
| TLS and URL Policy | 3 | config C3, C4, C6 ; agente K10 (URL checked before any socket) ; tls X1 (real `tls.connect` with env=0) | COMPLIANT |
| Literal Allowlist | 3 | destinos L1-L5 ; config C1 ; sesiones T2 ; e2e A2 | COMPLIANT |
| Session Handling | 4 | puente B7, B8, B5 ; sesiones T1-T3 ; agente K9 ; e2e A7 | COMPLIANT |
| Error Reporting | 2 | sesiones T2 ; puente B6 ; e2e A2 | COMPLIANT |
| Byte Bridge | 4 | puente B1-B4 ; e2e A8 (1.5 MiB intact); agente K10 (maxPayload 4096 / 1 MiB, perMessageDeflate off) | COMPLIANT |
| Reconnect Backoff | 2 | espera tests ; agente K5, K6 | COMPLIANT with WARNING W1 |
| Terminal Conditions | 3 | agente K1-K3 ; e2e A4-A6, S3 | COMPLIANT |
| Ping Watchdog | 2 | agente K7 ; puente B9 | COMPLIANT |
| Graceful Shutdown | 2 | arranque M2, M3 ; e2e A1, A8 | COMPLIANT |
| Logging | 2 | log G1-G3 ; e2e A9 (full run, closed keys, no secret) | COMPLIANT |
| Engine-Code Boundary | 3 | frontera F1, F2 ; paridad P1 (forbidden-import proof recorded in apply 4.3) | COMPLIANT |
| Packaging | 4 | Quoted glob: 829 count (816 -> 816 recorded at 4.6) ; Compose refusal: verified by me with `compose config` ; Engine unaffected and Agent image: apply-recorded docker runs, not re-run here | COMPLIANT (3 of 4 rely partly on recorded manual evidence, see W3) |

## Correctness checks requested

| Item | Observed |
|---|---|
| Agent imports (grep over non-test `src/agente-proceso`) | Only `node:*`, `ws`, `./x.js`, and `import type` from `../agente-protocolo.js` (agente, log, puente, sesiones). No non-type protocol import. |
| Log content | Closed union, per-event field list, line built from the list not the object. Call sites carry only constants, status or close codes, attempt/delay numbers, `codigo`, `variable`, signal, motive. `nombreError` regex-sanitized. No `console.*`; the only `.message` mentions are comments. Errors on sockets are dropped via no-op listeners. e2e A9 confirms at runtime. |
| No queue, no direct fallback, no SQL parsing or byte inspection | `informar` drops when control is not OPEN; the bridge forwards `Buffer` slices without reading them; no SQL strings in the agent. |
| Allowlist | Exact `Map` lookup on normalized `host port`; entry host dialed; refuses `*`, CIDR, ranges, `127.1`, octal/hex, port 0/65536; string port never matches. |
| TLS policy | `wss:` always, `ws:` only `localhost`/`127.x`/`[::1]`; rejects any `@ # ?`, non-`/` path, other schemes; explicit `rejectUnauthorized: true`, `followRedirects: false`; no env var read. |
| Exit codes | `CODIGO_SALIDA`: detenido 0, credenciales-rechazadas 2, agente-revocado 2, reemplazado 3; config error 1; crash 1 (known). |
| Engine code unchanged | `git diff master --stat` shows NO file under `src/` outside `src/agente-proceso/`. Other changed files: `Dockerfile`, `package.json`, `.dockerignore`, `.gitignore` (expected), `docker-compose.agente.yml`, `.env.agente.example`, `tsconfig.agente.json` (new, in scope), `docs/01-decisiones.md` and `docs/02-mapa-de-changes.md` (DEC-123 registration and map), OpenSpec docs. `src/agente-channel`, `src/agente-protocolo.ts`, `tsconfig.json`, `docker-compose.yml` have no diff. |
| Dockerfile | New stages `build-agente` and `agente` (`node:22-alpine`, `USER node`, only `ws` and `dist-agente`, no HEALTHCHECK) sit before the engine stage, which is still the LAST `FROM`. |
| Secrets | `.env.agente.example` holds three empty values; `grep zda_` + 43 chars over the repo (excluding node_modules, .git, dist) found nothing. `.env.agente` is gitignored and dockerignored. |
| Stray files | None created; `git status` shows only the two pre-existing untracked docs paths. |

## Issues

CRITICAL: none.

WARNING:
- W1. Backoff differs from the spec's literal numbers. Spec "Growth and cap" says that with random fixed at 1 the delays are 1, 2, 4 ... capped at 60 s. The implementation (and design.md line 112, `tope = min(60 s, 1 s * 2^(n+1))`, delay in [tope/2, tope]) gives 2, 4, 8 ... 60 s at random 1 and 1, 2, 4, 8, 16, 30, 30 at random 0. Both satisfy "each within [d/2, d]", min 1 s and max 60 s, but the first delay at random 1 is 2 s, not 1 s. The tests lock the implemented series. Tasks state the spec wins; either amend the spec scenario wording or the formula.
- W2. Task 1.8 box is unchecked although unit 1 (429 lines) was resolved by splitting into PRs; update the box or note the resolution. Tasks 6.1 and 6.2 remain for the orchestrator at archive (6.2: crash handler exit 1 equals config error; user to confirm).
- W3. Packaging scenarios "Engine unaffected" and "Agent image" were not re-run by this verify (images not rebuilt, per instruction); they rest on the apply-recorded docker runs (4.9, 4.10). Compose refusal was re-verified here. Node 22 TLS source citation (5.7) was read from v24.19.0, not Node 22 (known).

SUGGESTION:
- S1. `puente.ts` swallows a thrown `abrirDatos` with `replica.destroy()` and no log; consider a `sesion-fallida`-free local event only if operators need it (not required by spec).
- S2. The `docs/design/` and `docs/verificacion-tesis-2026-10-01.md` untracked files remain outside this change.

## Verdict

PASS WITH WARNINGS. 0 CRITICAL, 3 WARNING, 2 SUGGESTION. Next: sdd-archive after the user decides W1 and confirms 6.2.
