# UI kit — Consola (P1)
Mockup navegable: `index.html`. Pantallas: Consultas (CH-04/05/11, versiones CH-25), Automatizaciones + alta en dos pasos (CH-12/13, CH-21), Ejecuciones (CH-13/17a/17b/18), Agentes y conectividad (CH-19b/d1/d2), Conexión y mapeo (CH-03/09/10). Contrato, Frescura, Auditoría y Tiempos de alta: especificadas en `guidelines/pantallas.md`, sin mockup.
- `ConsolaShell.jsx` — barra de tenant + sidebar + selector de tenant + `PageHeader` + `Modal`.
- `Screen*.jsx` — una pantalla por archivo.
- Datos: `../datos-muestra.js`. En Consultas hay un selector "Simular estado (mockup)" para ver éxito / tope / vacío / cargando / rechazo / timeout.
