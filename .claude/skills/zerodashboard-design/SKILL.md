---
name: zerodashboard-design
description: Use this skill to design or evolve ZeroDashboard interfaces (console P1, client panel P2, email) for production or prototypes, and in the PROPOSE and APPLY stages of the SDD flow. Contains brand foundations, tokens, components, admin-UI patterns with citable rule ids, copy rules and per-screen specs.
user-invocable: true
---

Read the README.md file within this skill first, then:
- guidelines/admin.md for admin-interface patterns (multi-tenant navigation, page anatomy, SQL workbench, technical forms, tables, states, graded confirmations, microcopy, guided flows, consistency, the G3' constraint) and the PROPOSE/APPLY checklist. Cite its rule ids (N3, W6, C2…) in proposals.
- guidelines/consola.md for console screen specs: read its "Estado real" table first, because the implemented console differs from the v2 spec.
- guidelines/lenguaje.md for glossary, error formulas and copy rules; guidelines/pantallas.md for the panel and email.

Authority when sources disagree: behaviour → the current code and the EXPLORE audit; interface pattern → guidelines/admin.md; screens → guidelines/consola.md; visuals → README.md and tokens.json.

Evolve the existing console; never rebuild it, never invent capabilities, never copy the visual identity of external references (take only layout and interaction patterns). Production is plain HTML + CSS + inline JS (no build): link styles.css and use the .zd-* classes rendered by the server; client-side state goes through attributes (hidden, disabled, aria-*, data-*), because the G3' guard forbids the script from assigning zd-* classes.

If creating visual artifacts (mocks, throwaway prototypes), copy assets out and create static HTML files for the user to view. If the user invokes this skill without other guidance, ask what they want to build or design and act as an expert designer who outputs HTML artifacts or production code, depending on the need.
