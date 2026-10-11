# Proposal: CH-30a — Console shell and `#` navigation over the existing screens

**Status**: ready for spec and design. Inputs: `openspec/changes/CH-30-rediseno-de-la-consola/exploration.md` (umbrella), DEC-164 to DEC-166, the design guide `.claude/skills/zerodashboard-design/guidelines/consola.md` (sections 1 and 5).

## Intent
- Give the console the navigation of the design guide: a side navigation and one screen visible at a time, chosen by `location.hash`, in the one document `/consola` serves (DEC-164).
- Put the result of a query right below the execute button: today it sits after Automatizaciones and Frescura.
- Change no behaviour: every id is moved, never renamed; the script, its tests and the smoke checks keep working.

## Scope

### In Scope
- `public/ui/components/components.css` copied again from the skill, byte for byte: it lacks the console v2 block (shell, side navigation, page header, scope tag, `.zd-operator`), which the "Vendored Files Are Verbatim" requirement already demands.
- Markup: the tenant bar unchanged on top; below it `.zd-shell` with a `nav.zd-sidenav` and a `main.zd-page`. Three screens, each a `section` with a page header: **Consultas** (the form, then the status line, the results table and the pager, then the saved queries), **Automatizaciones**, **Frescura de datos**. The alert banner stays above every screen.
- Navigation: only the three existing screens in this change (DEC-165's full list arrives screen by screen in CH-30b to CH-30e). `#consultas` is the default; an unknown hash shows Consultas; the active link carries `aria-current="page"`.
- Script: show one screen by hash, on load and on `hashchange`. Nothing else in the script changes.
- Bridge `<style>`: the centered-column rule is replaced by the shell; a narrow-screen rule stacks the navigation above the content.

### Out of Scope
- New screens (CH-30b to CH-30e) and their navigation items.
- The "tenant dado de baja" state of the bar: `GET /tenants` lists only active tenants, so the state cannot occur until CH-30b's Tenants screen lists deactivated ones.
- Sub-views of Automatizaciones (`#automatizaciones/alta`, `#automatizaciones/{id}`) and the versions drawer: later, with their screens.
- Icons in the navigation (text only here); the light/dark toggle (DEC-165).

## Capabilities

### Modified Capabilities
- `query-console`: the shell, the navigation and the results placement.

## Approach
Follow the design guide's incremental adoption, steps 3 to 5 for the existing screens only: wrap, then show one section per hash, then reorder inside Consultas. Each screen is a `section` with an id the script toggles through `hidden`; the script looks nodes up only by id (verified), so hidden screens break nothing. The results block moves inside the Consultas screen, right after the form.

## Affected Areas
- `public/ui/components/components.css` (re-vendored)
- `src/consola.ts` (markup, bridge style, a short script function)
- `src/consola.test.ts` (harness: `location.hash` and `hashchange`; new guarded ids; order and navigation cases)

## Risks
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| A guarded id duplicated or lost while moving markup | Medium | G1 checks every guarded id exactly once; the full console suite runs on every move |
| The script assigns a `zd-*` class (guard G3') | Low | Screens toggle `hidden` and `aria-current` only |
| The page reads worse at 360 px | Medium | Narrow-screen rule; manual visual pass |
| The panel picks up console styles | Low | The new classes are only used by the console; the panel suites stay green |

## Review Workload Forecast
- One PR: re-vendored sheet (~70), markup and style (~90), script (~35), tests (~120): ~315 lines. **400-line budget risk: Low; Chained PRs recommended: No.**
