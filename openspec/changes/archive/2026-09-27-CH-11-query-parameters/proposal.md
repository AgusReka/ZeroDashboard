# Proposal: CH-11 — Query Parameters (B3)

**Status**: ready for spec and design (OQ-1 resolved by DEC-55, 2026-09-27).

## Intent

B3: P1 parametrizes a query with declared, typed parameters, substituted only through driver parameters (rule 4). Today user SQL has no parameter concept; the only binds belong to pagination. CH-12 `Plantilla` needs a reusable declare-and-substitute primitive (DEC-52).

## Scope

### In Scope
- Declaration `{nombre, tipo}`, `tipo` in `texto|numero|booleano|fecha` (DEC-49); all required, no defaults (DEC-50).
- Plain-text rewrite `:nombre` to `$k`, a repeated name bound once; tested edges: `::cast`, string literals, quoted identifiers, dollar-quoting, comments (DEC-47).
- Numbering per execution: declared `$1..$n`, pagination `$(n+1)/$(n+2)` (DEC-53).
- Two-layer validation: application shape check, legible `400` naming the parameter; Postgres as final arbiter via existing classification (DEC-51).
- `POST /consultas/ejecutar`: inline declaration + values, not persisted (DEC-48).
- `ConsultaGuardada`: declaration persisted on create, returned by get-by-id; no update route (DEC-10).
- Console: one input per declared parameter; declaration saved and loaded with the query.

### Out of Scope
- Defaults, optional parameters, `identificador`, any `src/contrato.ts` change.
- Parameters in `VistaCanonica` (DEC-54); `WITH` composition (DEC-31, CH-12).
- Condition/format/freshness; stored values for unattended runs (CH-12/13/14, D2).
- Execute-saved-query-by-id route (would need a new DEC).
- Any SQL parser dependency.

## Capabilities

### New Capabilities
- `query-parameters`: declaration shape, name grammar, type vocabulary, rewrite rules and edges, shape validation, bind numbering.

### Modified Capabilities
- `query-execution`: wrapper binds move from fixed `$1/$2` to `$(n+1)/$(n+2)`; inline parameters; parameter errors.
- `saved-queries`: create/get carry the declaration; Purpose's "no migration" no longer holds.
- `query-console`: parameter inputs; save/load declaration.

## Approach

Pure module `src/parametros.ts` (types, shape validation, rewrite returning `{texto, valores}`) consumed by `ejecutarConsulta`/`paginar`; routes only validate schema and delegate. A zero-parameter query yields today's exact statement. Tenant stays server-resolved.

## Affected Areas

| Area | Impact |
|------|--------|
| `src/parametros.ts` | New |
| `src/consulta-ejecucion.ts`, `src/consultas.ts` | Modified |
| `src/consultas-guardadas.ts`, `prisma/schema.prisma` + migration | Modified |
| `src/consola.ts` | Modified |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Rewrite touches `:` inside literals/casts/`$$` | Med | Enumerated edge-case unit tests |
| Off-by-one between declared and pagination binds | Med | Numbering derived per execution; boundary tests |
| Scope creep toward CH-12 | Low | Out-of-scope list |

## Rollback Plan

Revert slices in reverse order; migration is additive with a down path. The zero-parameter path is unchanged, so partial rollback preserves current behavior.

## Open Questions

Resolved by the user on 2026-09-27 and registered in `docs/01-decisiones.md`:

- **OQ-1** (storage of the saved declaration) → DEC-55: JSON column `parametros` on `ConsultaGuardada`, default `[]`, validated in the application.
- **Spec-level**: declared-but-unused parameter → rejected 400 (DEC-56); undeclared `:x` in SQL → rejected 400 (DEC-57); value for an undeclared name → rejected 400 (DEC-58); hand-written `$n` in user SQL outside literals/comments → always rejected 400 (DEC-59); wire formats: `texto` JSON string, `booleano` JSON boolean, `numero` JSON number only, `fecha` ISO 8601 date or date-time string (DEC-60).

## Size Forecast

~750–950 changed lines with tests. `400-line budget risk: High`. Chained PRs recommended: primitive, execution wiring, saved-query persistence, console.

## Success Criteria

- [ ] Parametrized query executes with values bound only as driver parameters.
- [ ] Missing or malformed value returns `400` naming the parameter.
- [ ] Saved declaration round-trips through create/get.
- [ ] Zero-parameter queries behave byte-identically to today.
- [ ] All rewrite edge cases covered by tests.
