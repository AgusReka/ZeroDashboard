# UI kit — Consola v2 (P1)
Mockup navegable en **HTML + CSS + JS plano** (sin build), igual que la implementación real. Especificación: `guidelines/consola.md`.
- `index.html` — carga `styles.css`, `assets/icons.js`, datos y scripts. `<body data-surface="consola">`.
- `app.js` — esqueleto: barra de tenant (ninguno / activo / dado de baja, selector), navegación lateral, ruteo por hash, helpers (`esc` escribe los datos como texto).
- `consultas.js` — editor + resultado pegado + guardadas + versiones (panel, comparar sin diff, restaurar).
- `automatizaciones.js` — lista, alta en dos pasos con cron en vivo, ejecuciones con detalle.
- `conexiones.js` — Conexiones | Agentes; también las pantallas especificadas sin mockup.
- `datos-consola.js` — DATOS DE MUESTRA.
Probá cambiar a "Dietética Raíces" (dado de baja) y a "Panadería La Espiga" (agente desconectado, automatizaciones en riesgo). En Consultas, "Mockup: simular resultado" recorre todos los estados.
