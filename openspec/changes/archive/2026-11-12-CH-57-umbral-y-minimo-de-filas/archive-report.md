# Archive Report: CH-57

**Change**: CH-57 — Threshold and minimum rows, told apart (DEC-209)
**Archived at**: 2026-11-12, on branch `ch57/archivo` from master (`057f564`). Merged PR: #280 (`size:exception`, approved by the user).
**Destination**: `openspec/changes/archive/2026-11-12-CH-57-umbral-y-minimo-de-filas/`

**Main specs synced**:
- `automation-templates`: 1 added requirement («Optional Operator Texts per Template Parameter»). 18 requirements, each title once.
- `query-console`: 3 added requirements («Template Editor Writes Parameter Texts», «Automation Parameter Labels», «Minimum Rows Help on Both Forms and Channels»). 84 requirements, each title once.
- Both deltas held ADDED requirements only. They were appended at the end of their spec.

**Final state**:
- Tasks 13/13 complete. The one deviation from the design (`propertyNames` on the parameter items, so that an unknown key answers 400 instead of being stripped) is recorded in `design.md`.
- No separate verify report: the verification is recorded in `tasks.md` and in the PR description.
- Evidence on master (`057f564`): `npm run test:db` 2381/2381; `tsc` clean. On the PR branch: `consola.test.ts` 546/546 and `scripts/smoke.sh` passed. Master holds the same code plus #279, which is documentation only.

**Archive gate**: manual, as in CH-50 to CH-56.

**Follow-ups**: none.
