# Shared Visual System Specification (CH-47 delta)

## MODIFIED Requirements

### Requirement: Fixed-List Stylesheet Registrar

The system SHALL serve exactly six files from `public/ui/` at routes mirroring the folder layout:
- the five stylesheet files, so the relative `@import` lines in `styles.css` resolve: `/ui/styles.css`, `/ui/tokens/colors.css`, `/ui/tokens/typography.css`, `/ui/tokens/spacing.css`, `/ui/components/components.css`;
- the vendored chart library (CH-47, DEC-184, DEC-200): `/ui/vendor/chart.umd.js`.

Each row of the list SHALL declare its file and its content type. Routes MUST be exact `GET` routes only: no prefix, no wildcard, no `HEAD`. The list is closed; a new file MUST require editing the list and its test.

#### Scenario: Each listed file is served

- GIVEN the application is running
- WHEN a `GET` is made to each of the six routes without any `X-Tenant-Id` header
- THEN the response is `200` with the exact bytes of the matching `public/ui/` file

#### Scenario: Unlisted asset URL is rejected without leaking

- GIVEN the application is running
- WHEN a `GET` is made to `/ui/unknown.css`, `/ui/tokens/`, `/ui/vendor/`, `/ui/vendor/chart.umd.js.map` or `/ui-falso/styles.css` without the tenant header
- THEN the response is `400` with body `{"error":"tenant-no-indicado"}` and no file content, path, or directory listing

#### Scenario: HEAD is not served

- GIVEN the application is running
- WHEN a `HEAD` is made to `/ui/styles.css` or `/ui/vendor/chart.umd.js` without the tenant header
- THEN the response is `400 tenant-no-indicado`

#### Scenario: Relative imports resolve

- GIVEN `/ui/styles.css` is fetched
- WHEN each `@import` target in it is resolved relative to `/ui/styles.css`
- THEN every resolved URL is one of the four other stylesheet routes

### Requirement: Assets Are Loaded at Boot and Fail Closed

The registrar MUST read every listed file once at boot, and handlers MUST serve only those loaded buffers. No file path MAY derive from the request. If any listed file is missing or unreadable, boot MUST fail with an error naming the file and the server MUST NOT start serving.

#### Scenario: Missing file stops boot

- GIVEN `public/ui/tokens/spacing.css` does not exist
- WHEN the server is built or started
- THEN startup fails with an error naming that file
- AND no route is served

#### Scenario: Missing vendored script stops boot

- GIVEN `public/ui/vendor/chart.umd.js` does not exist
- WHEN the server is built or started
- THEN startup fails with an error naming `public/ui/vendor/chart.umd.js`

#### Scenario: Traversal has no path to the filesystem

- GIVEN the application is running
- WHEN a `GET` is made to `/ui/../package.json`, `/ui/%2e%2e/package.json` or `/ui/vendor/../../package.json`
- THEN the response contains no file outside the six listed buffers (`400 tenant-no-indicado` or an unmatched-route rejection)

#### Scenario: Files changed after boot are not re-read

- GIVEN the server has booted
- WHEN a listed file on disk is altered
- THEN subsequent responses still carry the bytes loaded at boot

### Requirement: Response Headers

Each asset response MUST carry the content type of its row, `Cache-Control: no-cache`, and a strong `ETag` computed once at boot from the file bytes:
- the stylesheet rows use `text/css; charset=utf-8`;
- the vendored script uses `text/javascript; charset=utf-8`.

The policy is `no-cache` because the files have unversioned names, so a `max-age` could mix old and new files across the `@import` chain or across a library update. A `GET` carrying an `If-None-Match` equal to the current ETag MUST get `304` with no body and the same `Cache-Control`; any other `If-None-Match` value MUST get `200` with the full body.

#### Scenario: Content type, cache policy and ETag

- GIVEN the application is running
- WHEN any listed route is fetched
- THEN `Content-Type` equals the content type of its row: `text/css; charset=utf-8` for the five stylesheets and `text/javascript; charset=utf-8` for `/ui/vendor/chart.umd.js`
- AND `Cache-Control` equals `no-cache`
- AND a strong `ETag` (no `W/` prefix) is present and is the same on repeated requests

#### Scenario: Matching If-None-Match returns 304

- GIVEN the current `ETag` of a listed asset
- WHEN a `GET` on that asset carries `If-None-Match` equal to it
- THEN the response is `304` with no body
- AND `Cache-Control` is `no-cache`

#### Scenario: Non-matching If-None-Match returns the full body

- GIVEN a listed asset
- WHEN a `GET` on it carries an `If-None-Match` that differs from the current `ETag`
- THEN the response is `200` with the full file bytes

### Requirement: Assets Carry No Tenant Data (Rule 2)

Asset handlers MUST NOT receive a Prisma client or any tenant-resolved object, and the content MUST be identical for every tenant and for requests with no tenant.

#### Scenario: Identical bytes with and without a tenant

- GIVEN a valid tenant id
- WHEN a listed route is fetched with and without `X-Tenant-Id`
- THEN both responses are byte-identical

#### Scenario: Registrar has no database dependency

- GIVEN the registrar module
- WHEN it is built in a test with no database client provided
- THEN it registers and serves all six routes

### Requirement: Vendored Files Are Verbatim

The five stylesheet files in `public/ui/` MUST be byte-identical to the corresponding files of the `zerodashboard-design` skill, unconcatenated and unmodified. Console-specific styling MUST NOT be added to them. The vendored script is covered by "Vendored Chart Library Is Pinned".

#### Scenario: Parity with the skill

- GIVEN `public/ui/` and the skill's CSS folder
- WHEN `diff -q` is run per file over the five stylesheet files (the skill folder contains other files)
- THEN it reports no difference for any of them

## ADDED Requirements

### Requirement: Vendored Chart Library Is Pinned (CH-47, DEC-184, DEC-200)

`public/ui/vendor/chart.umd.js` MUST be the unmodified `dist/chart.umd.js` of the published `chart.js@4.6.1` package, including its trailing `sourceMappingURL` comment. The source map MUST NOT be shipped or served. A test MUST pin the file's sha256, `338399fb5bafe598d21cfc471b0590b61ceb321a985fade4f68499b151f67fbf`, so any change to the bytes needs an edit to that test. The repository MUST keep the file's bytes on every checkout: `.gitattributes` marks `public/ui/vendor/*` as `-text`. The MIT license of Chart.js MUST sit next to the file in `public/ui/vendor/`, and it is not served. No page loads the script in this change; CH-48 adds the first consumer.

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
