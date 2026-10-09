---
name: zerodashboard-design
description: Use this skill to generate well-branded interfaces and assets for ZeroDashboard, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for protoyping.
user-invocable: true
---

Read the readme.md file within this skill, and explore the other available files (guidelines/pantallas.md for per-screen specs and the change → screens table, guidelines/lenguaje.md for copy rules, guidelines/consola.md for the console's navigation and screens — read its section 7 before implementing any of them).
If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand — production is plain HTML + CSS + JS (no build): link styles.css and use the .zd-* classes.
If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

Alcance: CH-27 / P-06 "Último resultado" está fuera de alcance (DEC-93, D-1). No diseñes ni implementes vistas con filas de resultados en el panel.
