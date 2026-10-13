# Tasks: CH-30a — Console shell and `#` navigation

Branch base: `master` (after CH-20). Strict TDD: the test cases first, against `npm test`.

## Review Workload Forecast
- Estimated changed lines: ~315
- 400-line budget risk: Low
- Chained PRs recommended: No
- Decision needed before apply: No

## PR0 — Planning
- [x] 0.1 DEC-164 to DEC-166, the CH-30 umbrella exploration marked decided, the change map split into CH-30a to CH-30e, and this change's proposal, spec, design and tasks (`ch30a/exploracion`).

## PR1 — Shell and navigation
- [x] 1.1 Re-vendor `public/ui/components/components.css` from the skill (byte for byte).
- [x] 1.2 RED (10 failures): harness (`location.hash`, `hashchange`, attributes), new ids, default screen, switching, unknown hash, current link, results order, banner outside the screens.
- [x] 1.3 GREEN: markup in the shell, bridge style, `mostrarPantalla()`.
- [x] 1.4 Manual visual pass at 360 px and 1280 px, light and dark. Done by the user on 2026-10-13.

## Close
- [x] 2.1 Full suite, `tsc --noEmit`, `npm run build`. 1258/1262 (only the 4 known `conexiones` false positives); smoke not run (verify-report W1).
- [x] 2.2 Verify, archive, sync `query-console` into `openspec/specs/`, mark CH-30a in `docs/02-mapa-de-changes.md`.
