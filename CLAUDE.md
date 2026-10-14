# CLAUDE.md

Las reglas del proyecto están en `AGENTS.md`. Léelo antes de cambiar nada.

## Skill de diseño del front

`zerodashboard-design` es la skill para el **diseño del front**: úsala en cualquier trabajo de interfaz (pantallas, componentes, estilos, copy visual) antes de escribir HTML/CSS/JS de la UI. Está en `.claude/skills/zerodashboard-design/` (copia en `.agents/skills/zerodashboard-design/`).

### Skills de apoyo (subordinadas)

`interface-design` e `impeccable` (instaladas el 2026-10-14 en `.agents/skills/`) sirven para revisar patrones de ABM y de usabilidad de panel: flujos de alta y edición, validación, confirmaciones, estados vacíos y de error, jerarquía y textos. Siempre van **después** de `zerodashboard-design` y nunca la contradicen:

- No cambian tokens, colores, tipografías ni componentes del sistema; si sugieren algo que choca con la guía, gana la guía y se anota como propuesta.
- No reemplazan la identidad visual existente: solo refinan dentro de ella.
- El CLI de `impeccable` (`scripts/impeccable`, que descarga un binario de GitHub) y sus hooks no se ejecutan ni se instalan sin autorización explícita del usuario. Se usan sus referencias (`reference/*.md`) como lectura.
