# Proposal: CH-14 — Engine: Condition and Email Notification (X3, N1, N2)

**Status**: ready for spec and design. Inputs: explore.md, DEC-81..DEC-86.

## Intent

CH-13 runs automations but drops the rows. R1 needs the result to reach someone: by email (N1), only when there are rows (X3), and readable even when the data is incomplete (N2).

## Scope

### In Scope
- Nullable, validated `Automatizacion.destinatario`, set at creation only (DEC-82).
- Condition: zero rows never sends (DEC-84).
- Generic columns-driven HTML renderer: escaped cells, accent and subject emoji by `plantilla.automatizacion`, text/plain part, N2 degradation, truncation notice from `paginacion.hayMas` (DEC-84, DEC-85).
- nodemailer SMTP transport behind an injected `Notificador`, send timeout, Mailpit compose profile (DEC-81).
- Optional `SMTP_*` env; unset records `no-configurada` (DEC-86).
- Nullable `Ejecucion.notificacion`; a send failure sets `estado='fallo'`, `fase='notificacion'`, closed error category (DEC-83).
- Routes and console: recipient on create, notification column in runs view.

### Out of Scope
- N3 format, per-template HTML, "send when empty" (CH-21); retries, overlap (CH-17); duplicates (CH-18).
- Multi-section reports, recipient lists or edit, Telegram, freshness (CH-24), DEC-69/DEC-72.

## Capabilities

### New Capabilities
- `email-notification`: renderer, escaping, degradation, subject, transport, SMTP secrets handling.

### Modified Capabilities
- `automation-scheduling`: `destinatario` field; condition and notify step in the run pipeline.
- `execution-log`: `notificacion` outcomes; `notificacion` phase and send error categories.
- `tenant-isolation`: T2 proves each tenant's rows reach only its own recipient.
- `query-console`: recipient input; notification column.
- `project-environment`: `SMTP_*` placeholders, Mailpit profile.

## Approach

- Notify inline in `correr()`, between `resultadoDeCorrida` and `cierreDeResultado` (the only point where rows exist). Outbox is excluded: it is X5/X6 and widens the engine (rule 6).
- Outcome precedence for the spec: query failed → `null`; 0 rows → `omitida-sin-filas`; no recipient → `sin-destinatario`; SMTP unset → `no-configurada`; else `enviada` | `fallo-envio`.
- Rules 2/5/7: recipient from the tenant-scoped row; body holds only returned columns; secrets env-only, never logged.

## Affected Areas

| Area | Impact |
|------|--------|
| `prisma/schema.prisma` + migration | Modified (two nullable columns) |
| `src/correo.ts`, `src/notificador.ts` (+ tests) | New |
| `src/planificador.ts`, `src/automatizaciones*.ts`, `src/consola.ts` | Modified |
| `docker-compose.yml`, `.env.example`, `package.json` | Modified |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| HTML/header injection | Med | Escape cells; strip CR/LF; validate recipient |
| SMTP hang blocks tick | Med | Send timeout |
| Credentials leak | Low | Env only; closed categories |
| Duplicate/lost mail on crash | Low | Accepted until CH-17/18 |

## Rollback Plan

Unset `SMTP_*` to stop sending at once (runs record `no-configurada`). Then revert slices in reverse; the migration only adds nullable columns.

## Delivery (stacked-to-main, 7 slices)

1. Schema, nodemailer pin, `SMTP_*`, Mailpit
2. Pure renderer
3. Condition and outcome mapping
4. Transport wrapper, errors, timeout
5. Scheduler integration, fake notifier, T2 (may split)
6. Routes and console
7. Docs, verify, archive

`400-line budget risk: High`.

## Success Criteria

- [ ] Zero-row runs never send; row runs send exactly once.
- [ ] No `null`/`undefined`/broken cells; truncation notice shown.
- [ ] Every run records its `notificacion` outcome.
- [ ] T2 green.
