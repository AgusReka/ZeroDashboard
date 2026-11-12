# Archive Report: CH-52

**Change**: CH-52 — One feedback system, errors as sentences, voseo and labelled time zone
**Archived at**: 2026-11-12, on branch `consola-ux/archivo` from master (`9e91876`), together with the rest of the console UX batch (CH-50 to CH-56). Merged PRs: #268 (a), #269 (b).
**Destination**: `openspec/changes/archive/2026-11-11-CH-52-avisos-y-errores/`

**Main spec synced**: `query-console`, 0 modified and 5 added requirement(s). The seven deltas of the batch were applied in their order (CH-50, CH-51, CH-52, CH-53, CH-54, CH-55, CH-56) by one script: every MODIFIED requirement matched exactly one main requirement by its title without the trailing id list, and was replaced whole; a later delta of the same requirement wins (CH-56 over CH-53 for «Create and Edit Forms Open in a Pop-up»). Added requirements were appended at the end. The delta-only «(Previously: …)» notes were dropped; the ones already in the main spec were kept. After the merge the spec has 81 requirements, each title once.

**Final state**:
- Tasks 14/14 complete.
- No separate verify report: the verification of each slice is recorded in the change's `tasks.md` and in its PR description.
- Batch evidence on master (`9e91876`): `consola.test.ts` 536/536; `npm run test:db` 2360/2364, the four failures being the known ones in `src/conexiones/conexiones.test.ts` (5.1, 5.3, 5.4, CH-07); `tsc` clean. `scripts/smoke.sh` stops at the CH-03 «reachable target» step, and stops at the same step on `53bb1a5`, so it is not caused by this batch.

**Archive gate**: manual, as in CH-40 to CH-49, because the native validator does not admit a run whose exit code is 1 only from the known environmental failures.
