# Archive Report: CH-39

**Change**: CH-39 — Message text: header and per-row line (story N7)
**Archived at**: 2026-10-29, on branch `ch39b/texto-mensaje-consola`, before the PRs were opened
**Destination**: `openspec/changes/archive/2026-10-29-CH-39-texto-del-mensaje/`

**Main specs synced**:
- `automation-templates`:
  - Added "Optional Message Texts, Paired and Checked Against the Test Columns (DEC-188, DEC-192)".
  - "Testing an Unsaved Template (DEC-191, D4)" was replaced in place: the test accepts both texts and skips the test-columns check; two scenarios were added.
  - The Purpose says the template may declare its message text, and cites DEC-188 and DEC-192.
  - Requirements go from 16 to 17, and scenarios from 35 to 48.
- `email-notification`:
  - Added "Message Built From the Template's Texts (DEC-188, DEC-192)" and "Missing Column Falls Back to the Table (DEC-188)".
  - "Body Contains Only Query Result Columns (rule 5, DEC-71)", "Renderer Escapes Cells and Column Names" and "Message Carries a text/plain Alternative" were replaced in place, with the new scenarios kept alongside the existing ones.
  - The Purpose says a template with texts gets a header and one line per row, and cites DEC-188 and DEC-192.
  - Requirements go from 14 to 16, and scenarios from 28 to 35.
- `execution-log`:
  - Added "Ejecucion Records the Fallback to the Table (DEC-188, DEC-192)".
  - "Runs Listing Exposes the Notification Outcome (DEC-80, DEC-83)" was replaced in place: it also exposes `mensajeRespaldo`.
  - The Purpose cites `mensajeRespaldo`, DEC-188 and DEC-192.
  - Requirements go from 13 to 14, and scenarios from 30 to 34.
- `initial-template-catalog`:
  - Added "Seeded Entries Declare No Message Texts (DEC-188)".
  - The Purpose says the entries keep the table, and cites DEC-188.
  - Requirements go from 13 to 14, and scenarios from 31 to 33.
- `query-console`:
  - "Templates Screen" was replaced in place: the panel shows the message texts, and «Viewing a template» was updated. Added "A template without message texts".
  - Added "Template Message Texts in the Pop-Up (DEC-188, DEC-192)", right after the pop-up requirement.
  - Added "Runs View Shows the Fallback to the Table (DEC-188, DEC-192)", right after "Runs View Shows Readable Messages for solapamiento and interrumpida".
  - The Purpose is unchanged, as in CH-38.
  - Requirements go from 51 to 53, and scenarios from 156 to 162.

## Artifacts

exploration.md, proposal.md, specs (automation-templates, email-notification, execution-log, initial-template-catalog, query-console), design.md, tasks.md, verify-report.md, archive-report.md.

## Decisions

- **DEC-188 (b)**.
- **DEC-192**, taken by the user on 2026-10-27 in the exploration:
  - the columns come from `columnasPrueba` and are not stored (1(a));
  - `Ejecucion.mensajeRespaldo` records the fallback (2(a));
  - both texts or none (3(a));
  - the glossary applies to the text minus its placeholders, with caps of 200 and 300 characters (4(a));
  - a duplicate copies the message texts (5(a)).
  - Two design refinements were confirmed by the user on 2026-10-29: the header is static, and a line needs at least one placeholder.
  - DEC-192 is written on branch `v2/dec-192`, from `v2/dec-191`, and was uncommitted at archive time.
- **Delivery**: two stacked PRs (exploration option 6(b)).
  - CH-39a, backend: branch `ch39a/texto-mensaje`, commits `40a33ec` (planning) and `6b00a8d` (code), about 907 changed lines, with `size:exception` accepted by the user.
  - CH-39b, console: branch `ch39b/texto-mensaje-consola`, commit `c24ede3`, about 360 lines.

## Verify summary

PASS with warnings (see `verify-report.md`):
- `tsc` clean, and the Prisma schema valid.
- `test:db` 1619 of 1623 passing; the only failures are the 4 known `conexiones` false positives.
- 19 of 19 tasks; 37 of 37 scenarios (36 covered, 1 weak); 0 critical, 0 warning, 6 suggestions.

Deviations accepted during verification (CH-39b):
- The fallback is shown inside the Notificación cell, so the 8-cell row pinned by CH-17b is kept.
- The fallback wording names the missing columns: «falta la columna x» / «faltan las columnas a, b». The send-failure copy reads «Iba a enviarse la tabla».
- The header-marker 400 reads «El encabezado no admite columnas».

S4 (design said `.zd-field__hint`, code uses `class="ayuda"`) was reconciled in `design.md` before archive.

## Follow-ups

- **S1.** The body-excludes-internals check, with message texts set.
- **S2.** An assertion that the copy contains no backtick.
- **S3.** Newlines in the literal text of the line and the header.
- **S5.** A test for a null message text.
- **S6.** A stray blank line in `consola.test.ts`.
- **Bitácora.** The CH-39 entry in `docs/bitacora/`.
- **CH-42 and CH-44.** The CH-42 preview and the CH-44 Telegram work reuse `marcadores-mensaje.ts` and `respaldoDe`.
