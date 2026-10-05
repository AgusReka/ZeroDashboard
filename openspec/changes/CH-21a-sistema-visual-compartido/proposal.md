# Proposal: CH-21a — Shared Visual System (skill stylesheet on the existing console)

**Status**: ready for spec and design. Inputs: `exploration.md`, DEC-124 (firm, 2026-10-04).

## Intent

- The console styles itself with a 44-line inline `<style>` (`src/consola.ts:35-78`). CH-22 adds a second surface (panel) that must share one visual system.
- Serve the `zerodashboard-design` stylesheet once, and apply it to the console without changing behavior, ids or JS.

## Scope

### In Scope
- `public/ui/`: verbatim copy of the five skill CSS files (A2).
- Registrar: fixed file list, read at boot, fail-closed if missing, exact `GET /ui/...` routes mirroring the tree so `@import` resolves (A1).
- `esExenta` rows derived from the same list; no prefix, wildcard or `HEAD` (A3).
- Engine image: one `COPY --from=build /app/public ./public` (A4).
- Console: drop inline `<style>`, add `<link>`, `zd-*` only on static markup, console bridge CSS for script-managed nodes, zero JS diff.
- Tests: registrar, exemption, markup-id guard, link assertion; smoke headerless `GET`.

### Out of Scope
- Moving HTML or JS out of `src/consola.ts` (undecided until CH-22, A5).
- Panel, CSP, theme toggle, sidebar or multi-screen layout, `zd-*` on script-built nodes or a token-aware `porClase` (CH-21c), banner icon restructure, any engine change (rule 6).

## Capabilities

### New Capabilities
- `shared-visual-system`: fixed-list asset serving, verbatim provenance, exact `GET`-only tenant-header exemption, fail-closed boot.

### Modified Capabilities
- `query-console`: "Console Page Is Servable" (links the shared stylesheet; the documented ids stay exactly once; inline script unchanged; no backtick). "Row-Cap Cutoff Is Surfaced Legibly" and "Permanent Active-Tenant Indicator (T4)": add scenarios showing the cut message and the no-tenant state stay visually distinct.
- `tenant-isolation`: none (exemptions live in the owning capability, as with `/contrato`).

## Approach

DEC-124 option (b). The handlers read buffers loaded at boot. No path comes from the request and no Prisma client is passed in, so rule 2 holds structurally (DEC-24 argument). Rules 1, 3, 4, 5 and 7 are untouched.

## Affected Areas

| Area | Impact |
|------|--------|
| `public/ui/**` (5 files) | New |
| registrar module and its test, `src/server.ts` | New / Modified |
| `src/contexto-tenant.ts` and its test | Modified |
| `src/consola.ts`, `src/consola.test.ts` | Modified (markup and CSS only) |
| `Dockerfile` (engine stage), `scripts/smoke.sh` | Modified |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Renamed or lost ids go unnoticed | Med | Markup-id guard test (`IDS` + `barra-tenant`, `resultados`, `guardado`, `automatizaciones`; `banner` role/hidden; `limite` attrs) |
| `.zd-banner` shows an empty hidden banner | High if used | No `zd-banner` on `#banner`; bridge `[hidden]{display:none !important}` |
| Script `className` overwrite drops `zd-*` | High if used | `zd-*` on static nodes only; bridge targets script classes |
| Tenant bar state needs `:has()` | Low | `.zd-tenantbar:has(.sin-tenant)`; the text still states no tenant |
| No automated visual check | Med | Manual screenshot checklist, light and dark, ~360 px and 1280 px |
| Skill drift | Med | Documented re-copy procedure plus a per-file `diff -q` loop |
| Forgotten `COPY` | Low | Boot fails closed; the smoke test fetches the stylesheet |

## Rollback Plan

Revert PR2 to restore the inline `<style>` in `src/consola.ts`. Revert PR1 to remove the files, routes, exemption rows and the `COPY` line. There is no schema, env or dependency change. After PR1, engine boot depends on `public/ui/`, and the revert removes that dependency.

## Dependencies

- DEC-124 on this branch (PR0). CH-21b/c and CH-22/23 build on this change.

## Review Workload Forecast

| PR | Content | Lines |
|----|---------|-------|
| PR0 | DEC-124 and exploration (committed) | ~50 |
| PR1 | Mechanism + vendored CSS | ~517 total (254 authored + 263 vendored), `size:exception` for the vendored lines. Parity is checked with a per-file `diff -q` loop over the five files plus `git ls-files -s` blob ids. `diff -r` is not used because the skill folder holds other files |
| PR2 | Console adoption | ~190 |

`Chained PRs recommended: Yes`; `Decision needed before apply: No`.

## Open Questions

- The bridge CSS location is not decided by DEC-124. Option one: a sixth listed file in `public/ui/` (non-verbatim, adds a route and an exemption row). Option two: a reduced inline `<style>`. This is for the design phase, or for the user if it counts as architecture.
- Cache policy (`no-cache` with ETag or a short `max-age`) is not fixed.

## Success Criteria

- [ ] A per-file `diff -q` shows the five `public/ui` files are identical to the skill.
- [ ] A headerless `GET` returns 200 with `text/css` and the file bytes for each route. `HEAD` and unknown `/ui/*` return 400.
- [ ] The exemption rows equal the registered routes (same list). A missing file fails boot.
- [ ] `/consola` links `/ui/styles.css`. The inline script is byte-identical, the id guard passes, there is no backtick, and existing tests pass unchanged.
- [ ] The engine image boots and the smoke test passes. The manual light/dark checklist is signed off.
