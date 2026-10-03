# Archive Report: CH-19c1 — Engine Side of the Agent Channel

**Change**: CH-19c1-canal-lado-motor
**Archived**: 2026-10-03
**Status**: Complete

## Summary

The engine side of the outbound agent channel has been fully implemented, verified, and archived. Six stacked PRs delivered 1,732 changed lines of code and tests (excluding the lockfile and OpenSpec documents) across five units and one test-only PR: (1) the `ws` module, catalog, and `CanalAgente` duplex contract; (2) in-memory session registry with limits and TTL; (3a) authenticated WebSocket upgrade listener; (3b) 20s ping and 4002 close on revoke/baja; (4) `destinoDeConexion` returns a channel for agent-bound connections.

## Delivery

The change was delivered as six stacked PRs:

| PR | Unit | Focus | Lines | Status |
|----|------|-------|-------|--------|
| #64 | 1 | `ws`, catalog, `CanalAgente` | ~305 | Merged |
| #65 | 2-Tests | Moved 1 MiB slicing, far-side close, text frame tests | ~152 | Merged |
| #66 | 2 | In-memory registry with session limits | ~188 | Merged |
| #67 | 3a | Upgrade listener, auth, `preClose` hook | ~380 | Merged |
| #68 | 3b | 20s ping, 4002 close on revoke/baja | ~110 | Merged |
| #69 | 4 | `destinoDeConexion` returns channel, five callers | ~220 | Merged |

**Total**: ~1,000 lines planned; 1,732 measured in the final PRs (331 + 152 + 340 + 380 + 201 + 328). Two units first measured over 400 in code and tests and were resolved before delivery: unit 1 at 461 (A6-A10 moved out, then to their own PR #65 at 152), unit 2 at 492 (the 152 moved tests shipped separately, leaving the registry at 340), and the attempt ledger twice recorded more than the code and tests alone because it counts OpenSpec documents (554 for unit 2, 450 for unit 3a), each cleared by an audited maintainer reset authorized by the author. Final per-PR sizes: unit 1 331, moved tests 152, unit 2 340, unit 3a 380, unit 3b 201, unit 4 328 (all within 400).

## Specs Synced

Both main specs updated to reflect the final implementation:

| Spec | Requirements | Action |
|------|--------------|--------|
| `agent-channel` | 2 MODIFIED + 6 ADDED | Updated Purpose, replaced "Channel Is Optional" with "Channel Is Threaded" (modified), removed "Channel Failure Modes", added Registry, Upgrade Auth, Framing, No-Channel, Tenant Check, Agent Failure |
| `agent-registration` | 1 ADDED | Updated Purpose to reflect socket closure on revoke/baja with 4002, added "Revoke and Tenant Baja Close Live Sockets" requirement |

**Purpose Updates (Task 6.1)**:
- agent-channel: Now describes the engine-side implementation: in-memory session registry, authenticated WebSocket upgrade, channel for connections with an agent. The agent process is 19c2.
- agent-registration: Now reflects that revoke and baja close live sockets with 4002; the channel itself is described in agent-channel.

## Spec Alignment

**1009 (Message Too Big)**: The delta requirement "Framing and Limits" in agent-channel specifies that oversized control messages close with 1009. The spec states: "the `ws` limit closes with it before any engine code runs" (1 MiB limit for data, 4 KiB for control). This aligns with the verify report's check: "U5 asserts a 4097-byte text message closes with 1009".

## Verification

**Verdict**: PASS WITH WARNINGS (from verify-report, commit `54de207`)

| Metric | Value |
|--------|-------|
| Test suite | 767/767 pass, 0 failures |
| Requirements | 9/9 covered (100%) |
| Scenarios | 22/22 covered (100%) |
| Critical findings | 0 |
| Type-check | Clean (`npx tsc --noEmit`) |

**Warnings**:
1. Task 6.1 (hand-edit Purpose lines) — now checked at archive. Completed.
2. DEC-122 open question about `preClose` vs `onClose` — **resolved**. DEC-122 explicitly names `preClose` as the intended hook: "orderly close on shutdown, via the preClose lifecycle hook". Implementation confirmed in code and verified by test U9 (shutdown under 2500 ms, with mutation check showing hang if moved to `onClose`).
3. PostgreSQL test dependency — Some scenarios (E1-E5, A6/A7, U11, U12) require live PostgreSQL. All 22 scenarios passed with PG available. No scenarios untested.

All design cases covered: registry control replacement (R1), TTL expiration (R3), tenant mismatch (R6, E4), failed send (R4), all seven closed codes copied exactly (R5), control replacement doesn't lose sessions, upgrade indistinguishable 401 (U1), deactivated tenant 403 (U2), foreign/unknown session 404 (U3), socket reset during lookup (U4), non-upgrade GET 400 (U7), no tenant context in upgrade path (U8), shutdown under 2500 ms (U9), 20s ping and missed pong (U10), live PostgreSQL with backpressure (A6-A7), far-side close (A8-A9), no direct dial fallback (E2), text frame 1003 (A10).

## Archive Contents

- ✅ `proposal.md` — Change scope, intent, risks, rollback plan
- ✅ `specs/` — Delta specs for agent-channel (2 MODIFIED + 6 ADDED), agent-registration (1 ADDED)
- ✅ `design.md` — Architecture decisions, sequence, interfaces, registry rules, upgrade listener details
- ✅ `tasks.md` — 36 tasks total, all complete (1.1-1.10, 2.1-2.7, 3.1-3.7, 4.1-4.5, 5.1-5.6, 6.1)

## Source of Truth Updated

The following main specs now reflect the final implementation:
- `openspec/specs/agent-channel/spec.md` — Complete description of the channel architecture, registry, authentication, framing, and failure modes
- `openspec/specs/agent-registration/spec.md` — Agent lifecycle, including socket closure on revoke and baja

## Related Decisions

- **DEC-112**: Channel seam for agent-side duplex injection
- **DEC-113**: Duplex contract and TLS off
- **DEC-114**: Token carries no tenant
- **DEC-115**: Host and port from Conexion row
- **DEC-117**: Closed set of replica error codes
- **DEC-118**: Heartbeat / ping message
- **DEC-121**: Token creation and lookup
- **DEC-122**: `sesion-fallida`, close codes 4001/4002, preClose hook, no retry/queue/wait/direct-dial fallback

## No Further Work Required

The change is fully archived. All implementation tasks are complete. The spec sources of truth have been synced with the delta requirements. The agent process and the proxy/TLS/operator auth remain out of scope (19c2, 19d1, 19d2, 19e).

Related changes (`CH-19-conectividad-definitiva/`) remain in place for future context. Documentation (`docs/`) was not modified.

## Key Learnings

1. The gentle-ai sdd-archive-compose tool requires precise delta spec structure; manual edits were required when the tool could not parse the delta format.
2. The 1009 framing error (message too big) was originally in the design but required explicit spec alignment.
3. The preClose hook lifecycle is critical for proper shutdown; the mutation test (U9) verified that onClose would cause hangs.
4. Manual Purpose editing as part of task 6.1 ensures specifications reflect implementation intent rather than relying solely on automated delta composition.
