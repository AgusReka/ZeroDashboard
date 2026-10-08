# Tasks: CH-24 — Data freshness per tenant and per template

Branch base: the current stack (`master` is behind CH-22 and CH-23, which are not merged). Strict order inside each PR: tests first where the repo does.

## Review Workload Forecast
- Estimated changed lines: ~590 (PR1 ~260, PR2 ~330)
- 400-line budget risk: High
- Chained PRs recommended: Yes
- Decision needed before apply: Yes (session strategy `single-pr`: split into chained PRs or accept `size:exception`)

## PR1 — Server: columns, rule, route
- [ ] 1.1 `prisma/schema.prisma` + migration `2026100800000N_tenant_frescura`; run `npm run prisma:generate`.
- [ ] 1.2 `src/frescura.ts`: `LIMITE_VENTANA_MINUTOS`, `evaluarFrescura`, `resolverFrescura`.
- [ ] 1.3 `src/frescura.test.ts` (pure): the vectors `(null,60) (0,0) (60,60) (61,60) (180,120) (30,120)`, bounds 0 and 525600, rejected types (string, decimal, negative, boolean, object, above the limit), `actualizadaAhora` strict boolean, injected clock, empty body.
- [ ] 1.4 `TenantPublico` gains the two fields; update the existing tenant tests that assert the exact keys.
- [ ] 1.5 `PUT /tenants/:id/frescura` in `src/tenants.ts` (strict schema with both properties as `{}`, 404, 409, scoped single `update`).
- [ ] 1.6 `src/tenants-frescura.test.ts` (live database): each spec scenario, nothing stored on a 400/409, another tenant untouched.
- [ ] 1.7 `src/planificador.test.ts`: a stale window does not change a run (spec "The Engine Is Not Affected").

## PR2 — Console: C-22 section
- [ ] 2.1 Markup for `#frescura` and the script: keep tenant rows from `cargarTenants`, `mostrarFrescura`, `estadoFrescura`, `hace`, template table from `GET /plantillas`.
- [ ] 2.2 Save and mark actions with the exact bodies, error handling (`manejarFalloDeTenant`, 400 text), disabled state with no tenant.
- [ ] 2.3 `src/consola.test.ts`: strings, vectors, relative-time cases, request bodies, error branches. Load `zerodashboard-design` before writing markup.
- [ ] 2.4 Manual check by the user in the running app (rebuild with `docker compose up -d --build app`).

## Close
- [ ] 3.1 Verify against the spec, merge the delta into `openspec/specs/data-freshness/spec.md`, archive.
