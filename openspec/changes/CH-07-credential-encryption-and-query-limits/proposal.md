# Proposal: CH-07 — Credential Encryption and Query Limits

## Source

- `docs/02-mapa-de-changes.md`, release R1, CH-07: "Clave maestra fuera de la base. Timeout y tope de filas."
- `docs/mapa-historias.md`, stories A2 ("credenciales cifradas en reposo con clave fuera de la base" — *comprometer la base no alcanza para descifrarlas*) and A4 ("timeout y tope configurables, con corte y mensaje claro"), both R1.
- `docs/01-decisiones.md`: **no existing decision covers encryption, key sourcing, or query limits.** DEC-16/17/18 are proposed below and require the user's confirmation before `sdd-apply`.
- Code read: `prisma/schema.prisma`, `src/conexiones.ts`, `src/consultas.ts`, `src/consulta-ejecucion.ts`, `src/config.ts`, `.env.example`.

## Why

`Conexion.credencial` is a plaintext column — CH-03 deferred A2 here explicitly. Under DEC-03 (multi-tenant hosted by the implementer) one compromised own-database hands over every tenant's replica credential; that is risk 1 of `mapa-historias.md` §7, currently unmitigated.

A4 is half-present: `QUERY_TIMEOUT_MS` already bounds runtime (CH-04), but the row ceiling is a hardcoded `maximum: 200` in a JSON schema, and nothing distinguishes "stopped at the cap" from "here is your page, ask for the next one".

## What Changes

- The credential is enciphered before it reaches the own database and deciphered only on the two paths that dial a target (`POST /conexiones/:id/prueba`, `POST /consultas/ejecutar`). The column stays `String`; the stored value becomes a versioned envelope, so no column-type migration.
- The master key is read from the environment at boot. Absent, short, or malformed key ⇒ the process refuses to start. No key material in the own database, in the schema, or in the repository.
- Row ceiling and query timeout become configuration rather than literals, and an execution stopped by either returns an explicit legible cutoff, distinct from ordinary pagination.
- The console reports that cutoff (precedent DEC-07/DEC-12: the P1 surface ships with the change that creates the behavior).

## Proposed Decisions — user confirmation required before apply

| # | Proposal | Rejected |
|---|---|---|
| DEC-16 | AES-256-GCM through built-in `node:crypto`; per-row random IV; versioned envelope (`v1:iv:tag:ciphertext`, base64) | `pgcrypto` (the key would travel into the very database A2 assumes compromised); libsodium (new dependency); unauthenticated CBC |
| DEC-17 | Master key from an environment variable, fail-closed at boot; the version prefix keeps rotation possible later, no rotation tooling now | KMS / cloud secret manager (D-2 is open, there is no deployment target yet); key file on disk; key in the database |
| DEC-18 | The cap is enforced by the application and reported as its own verdict (e.g. `tope-de-filas`), not as another page | reusing `hayMas` (it invites a next page, which is exactly what the cap denies); engine-side `LIMIT` alone (silent truncation) |

## Open Questions — user-owned, deliberately not inferred

1. **Key scope**: one master key per deployment, or one per tenant? This changes the blast radius of risk 1 and the Cap. 4 argument; it is not a technical detail.
2. **Limit granularity**: global environment defaults, per `Conexion`, or per tenant? A4 says "configurables" without naming a subject. A per-connection answer adds columns to `Conexion` and a migration.
3. **Pre-CH-07 rows**: backfill-encipher existing plaintext credentials in the migration, or treat them as development data to be re-registered?

A2 and A4 stay in one change as the map assigns them; nothing in the docs argues for splitting them, and both touch the same two execution paths.

## Design-Level Scoping (carry into `sdd-design`)

- Where encipher/decipher sits: an explicit call at the three known call sites, or a Prisma extension (DEC-13 precedent) — the extension is structural but collides with the `select`-projection discipline of `ConexionPublica`.
- Whether the cap is applied via the existing `LIMIT`+1 probe row or as a separate ceiling above the page size.
- Which failure envelope the console renders for a cap cut versus a timeout.

## Out of Scope

Key rotation tooling; KMS/secret-manager integration (D-2); A5 execution audit (CH-20); per-tenant quotas or request rate limiting; enciphering anything other than `Conexion.credencial`; persisting results (D-1 open).

## Non-Negotiable Rules in Effect (`docs/00-contexto.md` §5)

- **Rule 7**: the master key lives only in `.env`, with a placeholder in `.env.example`. Neither the key nor a deciphered credential may appear in any response, error, or log line — the existing "credential never exposed" requirements of `connection-registration` and `query-execution` now also cover the deciphered value.
- **Rule 4**: limits are bound as driver parameters (`set_config`, `LIMIT $1`), never spliced into SQL text.

## Review Workload

Crypto module + config + boot check + one write path + two read paths + execution limits + console + tests is past the 400-line budget, as CH-03 through CH-06 all were. **Chained PRs recommended**, strategy `auto-chain`; provisional slices: (1) crypto module, config and boot check; (2) encipher/decipher wiring and the row-migration stance; (3) configurable limits and the cutoff verdict; (4) console and smoke. `sdd-tasks` owns the binding forecast.

## Rollback Plan

Revert in reverse slice order. Slices 1, 3 and 4 revert cleanly — restoring the defaults reproduces today's 200-row / 15 000 ms behavior. Slice 2 is the dangerous one: once rows hold ciphertext, reverting the code leaves credentials unreadable. `sdd-design` must choose one mitigation and state it: either the read path tolerates a legacy plaintext value for one change window, or the reverse (decipher) migration ships alongside the forward one.

## Impact

### New Capabilities

- `credential-encryption`: credentials enciphered at rest under a key held outside the own database, deciphered only to dial a target, with fail-closed startup when the key is absent or invalid.

### Modified Capabilities

- `connection-registration`: the stored credential is ciphertext; the connectivity test deciphers it in memory only.
- `query-execution`: timeout and row cap are configured rather than literal, and a capped execution reports a distinct cutoff verdict.
- `query-console`: the cutoff is legible to P1.
- `domain-data-model`: only if open question 2 resolves to per-connection limits (new columns + migration).

## Success Criteria

- [ ] A dump of the own database contains no readable credential, and no value in it can be deciphered without the environment key.
- [ ] The application refuses to start when the master key is absent, too short, or malformed.
- [ ] An already-registered connection still tests and executes end to end after the change.
- [ ] Timeout and row cap can be changed without editing source, and each cut produces a message P1 can act on.
- [ ] Neither the master key nor a deciphered credential appears in any response body, log line, or error.
