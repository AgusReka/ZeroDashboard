```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:5fe7b87d44353f825a9c455cb6f89a00b07ece128d6881c31e1c7e73bd60181a
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 9/9
scenarios: 22/22
test_command: TEST_DB_PORT=5434 npm test
test_exit_code: 0
test_output_hash: sha256:a3309aadd6bb12aa0b83f319324de4b63406b520fd50a8f83e101c821d913b54
build_command: npx tsc --noEmit
build_exit_code: 0
build_output_hash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

## Verification Report

**Change**: CH-19c1-canal-lado-motor
**Version**: N/A
**Mode**: Standard (openspec `strict_tdd: false`; RED before GREEN recorded per task in apply-progress)
**Branch / HEAD**: `ch19c1/destino-con-canal` at `54de207`. The working tree has only the two untracked, excluded docs paths.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 36 (1.1-1.10, 2.1-2.7, 3.1-3.7, 4.1-4.5, 5.1-5.6, 6.1) |
| Tasks complete | 35 |
| Tasks incomplete | 1 (6.1, archive-time and orchestrator-owned; expected) |

### Build and tests (run by this verifier)

| Command | Exit | Result |
|---------|------|--------|
| `npx tsc --noEmit` | 0 | No output |
| `TEST_DB_PORT=5434 npm test` | 0 | tests 767, suites 115, pass 767, fail 0, cancelled 0, skipped 0, todo 0 |

The total matches the expected 767 (baseline 725 + 42). No suite skipped itself, so no live suite needed a solo re-run. Output went to the scratchpad only.

### Spec compliance matrix

All 9 requirements and 22 scenarios have a covering test that passed in the full run.

| Requirement / scenario | Covering test | Status |
|---|---|---|
| Catalog: compiles, no runtime exports | `agente-protocolo.test.ts` P1, P3 | COMPLIANT |
| Catalog: session open carries no tenant | type (tsc) plus `registro-agentes.test.ts` "apertura-sesion carries no tenant" | COMPLIANT |
| Catalog: failure uses a closed code | P3 `@ts-expect-error` (tsc clean) | COMPLIANT |
| Channel threaded: caller passes channel | `conexion-destino.test.ts` H1 (same reference) | COMPLIANT |
| Channel threaded: agent row gets channel | H1 (opener asked with tenant, host, puerto), E1 | COMPLIANT |
| Channel threaded: no agent stays direct | H1 (`canal` undefined, no spy call) | COMPLIANT |
| Channel threaded: default opener fails closed | H1 (inert factory, `ESINAGENTE`), A3, E2 | COMPLIANT |
| Registry: control replacement 4001 | R1 | COMPLIANT |
| Registry: ninth session refused | R2 | COMPLIANT |
| Registry: pending session expires | R3 | COMPLIANT |
| Upgrade auth: indistinguishable 401 | U1 (raw bytes compared) | COMPLIANT |
| Upgrade auth: deactivated tenant 403 | U2 | COMPLIANT |
| Upgrade auth: foreign or unknown session 404 | U3 | COMPLIANT |
| Framing: binary on control 1003 | U5 | COMPLIANT |
| Framing: text on data 1003 | U3, A10 | COMPLIANT |
| Framing: oversized 1009 / unknown 1008 | U5 | COMPLIANT |
| No control channel: agent offline | A3, R4, R6, E2, E3 (not retried) | COMPLIANT |
| Tenant checked at use | R6, E4 | COMPLIANT |
| Failure reported by agent | R5, U6, E5 | COMPLIANT |
| Registration: revoking closes sockets | U11 (`agentes-rutas.test.ts`) | COMPLIANT |
| Registration: baja closes sockets | U12 (`tenants.test.ts`) | COMPLIANT |
| Registration: revoke with no live sockets | U11 (no-socket part) | COMPLIANT |

Additional covered design cases: U4 (reset during lookup), U7 (non-upgrade GET gives 400), U8 (no tenant context and no secret in logs), U9 (shutdown under 2500 ms), U10 (20 s ping, missed pong terminates, idle data socket stays), A6 and A7 (live PostgreSQL over a real ws pair, backpressure), A8 and A9.

### Correctness checks requested

| Check | Evidence | Result |
|---|---|---|
| No sensitive value logged | The only log calls are src/agente-servidor.ts line 79 (canal, estado), line 115 (canal, nombreError) and line 139 (canal, agenteId, codigoCierre). registro-agentes.ts and canal-agente.ts have no log call (comments only). U8 asserts the full log has no token, hash, tenant id, host or sessionId | OK. agenteId is logged, as the design allows |
| Upgrade path never enters a tenant context | The only database access of the listener is buscarPorTokenHash (the prisma type is narrowed to it). U8 asserts the active tenant is null during the lookup | OK |
| src/contexto-tenant.ts unchanged | git diff master --stat for the file is empty | OK |
| Sockets close in preClose | The preClose hook calls cancelarPing and registro.cerrarTodo. There is no onClose hook. Moving it to onClose makes U9 fail (mutation recorded in apply-progress) | OK |
| No queue, grace wait, direct-dial fallback or store-and-forward | registro-agentes.ts uses setTimeout only for the 30 s pending TTL. There is no net.connect, createConnection or queue in the engine files. destinoDeConexion returns no direct fallback for agent-bound rows. E2 proves it with a reachable row; the mutation recorded in apply-progress makes E1-E5 and H1 fail | OK |
| Scheduler has no new job | src/planificador.ts diff only threads the canales dependency to destinoDeConexion. The only new timers are the ping interval and the pending TTL, both unref-ed and outside the scheduler | OK |
| ws and @types/ws pinned exactly; no other dependency change | package.json diff: ws 8.22.0 and @types/ws 8.18.2, no caret. package-lock.json resolves ws 8.22.0 | OK |
| No env var added | .env.example has no diff. The new modules have no process.env reference. LIMITES are constants | OK |
| Catalog exports types only | src/agente-protocolo.ts has only export type and export interface. P1 and P3 assert no runtime value | OK |
| 1009 reflected in spec, design and U5 | The spec Framing and Limits requirement and its scenario say 1009 for a message over 4 KiB. The design Upgrade listener section says the ws limit closes with 1009. U5 asserts a 4097-byte text message closes with 1009 | OK |
| Rules 1-4 | There is no SQL on the upgrade path. The tenant comes from the token row (rule 2). The read-only layers are untouched. There is no SQL concatenation | OK |
| Rule 5 | Frame contents are never read or logged (only JSON control messages are parsed). The apertura-sesion message has no tenant | OK |
| Rule 7 | Tests use generated tokens. There is no .env or .env.example diff | OK |

### Design coherence

| Decision | Followed? | Notes |
|---|---|---|
| ESINAGENTE one code for every no-channel cause | Yes | Includes tenant mismatch, cap, TTL, cerrando |
| Agent codes copied only from the closed 7 | Yes | R5 |
| Host and port bound at factory creation | Yes | canalPara closes over the request |
| Two WebSocketServer instances with 4 KiB / 1 MiB and deflate off | Yes | |
| preClose shutdown hook | Yes | U9 plus mutation check |
| Refusal as a bare status line, no body | Yes | |
| Logging closed field set | Yes | |
| Registry rules (control close guard, sessions survive replacement) | Yes | R1 |

Deviations recorded in apply-progress, none breaking a spec:

- prisma is narrowed to the token lookup on the upgrade path.
- programarPing is a repeating timer injected into the listener.
- The route Pick types are narrower than the shared Pick of the design.
- A data socket whose session vanished between reservation and attach is terminated.
- cerrarAgente also destroys the attached channel at once.
- A 503 for limits does not exist, as neither the spec nor the design asks for one.

### Issues

**CRITICAL**: none.

**WARNING**

1. Task 6.1 (hand-edit the Purpose lines of the two main specs) is unchecked. It is orchestrator-owned and archive-time, a known item that does not block verification. It must be done at archive.
2. The design Open Question about DEC-122 saying onClose while the implementation uses preClose is still open. It is a one-line clarification in docs/01-decisiones.md, owned by the orchestrator.
3. The E1-E5, A6/A7, U11 and U12 cases depend on live PostgreSQL (port 5434). With PostgreSQL absent, those suites skip themselves and the scenarios would show as untested. This run had PostgreSQL, so all 767 ran.

**SUGGESTION**

1. Task order in unit 4 (the e2e RED written before caller threading) differs from tasks.md. This is documented and harmless.
2. The repository root has files named 200 (tracked) and prisma;C (dated 2026-09-15), which pre-date this change. This verification created no stray file.

### Verdict

PASS WITH WARNINGS. Build and tests are green (767/767), every requirement and scenario has a passing covering test, and all requested constraints hold. The warnings are orchestrator-owned archive items.
