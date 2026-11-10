# Shared Visual System Specification (CH-48 delta)

## MODIFIED Requirements

### Requirement: Vendored Chart Library Is Pinned (CH-47, DEC-184, DEC-200)

`public/ui/vendor/chart.umd.js` MUST be the unmodified `dist/chart.umd.js` of the published `chart.js@4.6.1` package, including its trailing `sourceMappingURL` comment. The source map MUST NOT be shipped or served. A test MUST pin the file's sha256, `338399fb5bafe598d21cfc471b0590b61ceb321a985fade4f68499b151f67fbf`, so any change to the bytes needs an edit to that test. The repository MUST keep the file's bytes on every checkout: `.gitattributes` marks `public/ui/vendor/*` as `-text`. The MIT license of Chart.js MUST sit next to the file in `public/ui/vendor/`, and it is not served. The only page that loads the script is the authenticated client panel shell, with one `<script src="/ui/vendor/chart.umd.js">` placed before the dashboard script (CH-48, `client-panel-dashboard`). The login page and the console MUST NOT load it.
(Previously: no page loaded the script; CH-48 was to add the first consumer.)

#### Scenario: The bytes are the pinned release

- GIVEN `public/ui/vendor/chart.umd.js` on disk
- WHEN its sha256 is computed
- THEN it equals `338399fb5bafe598d21cfc471b0590b61ceb321a985fade4f68499b151f67fbf`
- AND its leading license banner names `Chart.js v4.6.1`

#### Scenario: The file is the loadable UMD build

- GIVEN the file's contents
- WHEN they run in a bare `node:vm` context with no DOM
- THEN the context exposes a `Chart` function
- AND `Chart.version` equals `4.6.1`

#### Scenario: Line endings cannot rewrite the file

- GIVEN `.gitattributes`
- WHEN `git check-attr text public/ui/vendor/chart.umd.js` is read
- THEN the attribute is `unset`

#### Scenario: The license travels with the copy

- GIVEN `public/ui/vendor/`
- WHEN its files are listed
- THEN it holds the Chart.js MIT license text next to `chart.umd.js`
- AND no route serves the license file

#### Scenario: Only the authenticated panel shell loads it

- GIVEN the HTML served by `GET /panel` with a valid session, by `GET /panel` without one, and by the console page
- WHEN each is searched for `/ui/vendor/chart.umd.js`
- THEN only the authenticated panel shell holds it, exactly once, in a `<script src>` that comes before the dashboard script
