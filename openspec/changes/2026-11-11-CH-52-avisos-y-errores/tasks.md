# Tasks: CH-52 — One feedback system and human errors

Inputs: proposal.md, specs/query-console/spec.md, design.md.

Delivery: the session is **single-pr**, but this change is forecast above the 400-line budget. The user authorized splitting during tasks, so it ships as **two chained PRs**:
- **52a**: banner, placement and busy buttons.
- **52b**: errors as sentences, voseo, M5 and zones.

Each PR stays under 400 lines. Chain strategy: stacked-to-main (user's choice, 2026-11-11): 52b branches from 52a, targets it, and they merge in order. No new DEC.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~650 total: 52a ~320 (150 production + 170 tests), 52b ~330 (170 production + 160 tests) |
| 400-line budget risk | High as one PR; Low per slice |
| Chained PRs recommended | Yes |
| Suggested split | 52a → 52b |
| Delivery strategy | single-pr per slice (split authorized by the user on 2026-11-11) |
| Chain strategy | stacked-to-main (user's choice, 2026-11-11) |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Low per slice

### Suggested Work Units

| Unit | Goal | Focused test command | Runtime harness | Rollback boundary |
|------|------|----------------------|-----------------|-------------------|
| 52a | `#banner` as `zd-banner`, `avisar` placement, feedback inside pop-ups, `ocupado`/`libre` | `npx tsx --test src/consola/consola.test.ts` | `npm test`; typecheck | Revert 52a |
| 52b | `mensajeDeError` at every call site, voseo, M5, zone labels | same | `npm test`; typecheck; smoke | Revert 52b |

## 52a — Banner, placement, busy buttons
- [ ] a.1 Markup: `#banner` becomes a `zd-banner` with `banner-texto` and `banner-detalle` (`zd-mono`, `hidden`); add them to `IDS`.
- [ ] a.2 Delete the `.banner` bridge rules. Add `button[aria-busy="true"]` min-width.
- [ ] a.3 `mostrarBanner(texto, detalle?)`, `mostrarConfirmacion` and `ocultarBanner` set `data-tono` and the text nodes, with no `className`.
- [ ] a.4 `avisar(texto, { tono, detalle, dialogo, linea, junto })`. Extend `avisarEnDialogo` with tone and detail. Remove `llevarBannerA` and pass `dialogo`/`linea` at its callers.
- [ ] a.5 `ocupado(boton, gerundio)` and `libre(boton)`. Migrate the ad hoc busy sites (connection test, mapping validate, template and report test, query execute, saves).
- [ ] a.6 Tests:
  - the banner tone is set by attribute;
  - a refusal inside an open pop-up leaves `#banner` hidden;
  - busy set and cleared;
  - existing banner assertions updated to `banner-texto`.

## 52b — Errors, copy, zones
- [ ] b.1 `mensajeDeError({ estado, cuerpo, accion, objeto })` per design §3, reusing the existing per-code map.
- [ ] b.2 Replace every list-load, save, test and delete error string. The grep is `No se pudo leer|\(HTTP|HTTP ' \+`, and the result must be zero hits outside `mensajeDeError`.
- [ ] b.3 Voseo:
  - lines L1503, L1932, L2297, L2426, L3519 and L3525;
  - any further hit of `Verifique|Revise|Escriba|elija|acote|Use un`.
- [ ] b.4 L4474: «Ejecutá la consulta para poder guardarla.»
- [ ] b.5 Zone labels: «Hora de tu navegador» on lists, Auditoría and versions; «Hora del servidor» on automations and runs.
- [ ] b.6 Tests:
  - 5xx, 404, 403, 409 fallback and network sentences;
  - no `/` path in any shown error;
  - the voseo structural guard;
  - zone labels present.

## Verify
- [ ] v.1 `npm test`, `npx tsc -p tsconfig.json --noEmit` and `scripts/smoke.sh` pass after each slice.
- [ ] v.2 Every E1–E4, M4, M5 and T7 item of `guidelines/admin.md` §14 holds for the touched screens.
