# Exploration: CH-52 — One feedback system and human errors

Source: the console UX audit (EXPLORE, 2026-11-11), `guidelines/admin.md` §7 (E1–E6), M4, M5, T7, and `guidelines/lenguaje.md` (error formula, HTTP translation table, voseo). `Lnnn` = line in `src/consola/consola.ts`.

## Current state (verified)
- **Three feedback mechanisms:**
  1. `#banner.banner`, a global red `role="alert"` paragraph in `main` (L174 style, markup after the sidebar).
  2. `.zd-banner` built by `avisoResultado` (L67), with `data-tono`.
  3. `p.ayuda role="status"` lines, one per screen. `.ayuda` is used 73 times and `.zd-help` 6 times, only in the connection dialog.
- The global banner sits behind open dialogs. `llevarBannerA` (L1832) moves it by hand.
- **Raw errors:**
  - "No se pudo leer /plantillas (HTTP 500)" (L5805);
  - many messages end in "(HTTP n)";
  - list errors name API paths.
- **Register mix:** voseo dominates (~81 hits), with ~10 "usted" forms: "Verifique" (L2426), "Use un rol" (L1503), "acote" (L1932), "Revise estos campos" (L2297), "Escriba direcciones" (L3519), "elija Correo" (L3525).
- **M5 mismatch:** the save hint says "Probá la consulta…" (L4474, L1160), but the button is «Ejecutar consulta».
- **Timezones:** lists and Auditoría format in the browser's zone (L4950), automations in the deployment's zone (L2851). No label says which.
- **Loading states are ad hoc:** "Cargando…", "Probando…".

## Hypotheses
- Moving each action's feedback next to its control changes what tests read. Tests read `#banner` text in many cases; the exact count is in tasks.

## Open questions
- Unifying the timezone itself (one zone everywhere) is a behaviour change. Here we only **label** each zone (T7). Unifying is left as a product question.
