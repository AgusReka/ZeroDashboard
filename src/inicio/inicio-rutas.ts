import type { FastifyInstance } from 'fastify';

/**
 * UX review lote 4 (DEC-203): the start page and the two trailing-slash redirects.
 *
 * - `GET /` serves one static HTML page with two doors: «Ir a mi panel» (primary, for who
 *   administers a business, P2) and «Ir a la consola» (secondary, for who configures
 *   ZeroDashboard for a client, P1). Screen spec: `guidelines/pantallas.md`, I-01.
 * - `GET /consola/` and `GET /panel/` answer `308` with `Location` to `/consola` and
 *   `/panel`. Fastify does not ignore the trailing slash, so those were other URLs with no
 *   route and got the guard's JSON `401`. `308` keeps the method and says so (DEC-203).
 *
 * **The registrar takes the app and nothing else**, like `registerContratoRoutes`
 * (DEC-24): no database client, no session resolver. No handler here reads the cookie, a
 * header or a parameter, and none sets a cookie. That structural absence is what makes the
 * three exact exemption rows safe (`EXENCIONES_OPERADOR` in `src/consola/consola-auth.ts` and
 * `INICIO_EXENTOS` in `src/aislamiento/contexto-tenant.ts`): the request never reaches
 * anything a session or a tenant could protect. The only handler that reads the session
 * stays `GET /consola` and `GET /panel`, which this module never touches.
 *
 * The page is a constant: nothing is interpolated into it, so there is nothing to escape.
 * No script, and no inline handler: the two doors are plain links.
 */

const DOCUMENTO_INICIO = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ZeroDashboard</title>
<!-- An empty icon, so the browser does not ask the server for /favicon.ico on every load. -->
<link rel="icon" href="data:,">
<!-- CH-21a (DEC-124): the shared stylesheet, served by the exact exempt GET routes. -->
<link rel="stylesheet" href="/ui/styles.css">
<style>
  /* I-01: one centered column on a full viewport, like the panel's login. Tokens only. */
  .inicio { min-height: 100vh; display: grid; place-items: center; padding: var(--space-6); }
  .inicio__caja { width: min(420px, 100%); display: grid; gap: var(--space-8); }
  .inicio__marca { display: grid; gap: var(--space-3); text-align: center; }
  .inicio__marca strong { font-size: var(--text-2xl); letter-spacing: -.02em; }
  .inicio__marca .zd-muted { margin: 0; }
  .inicio__titulo { margin: 0; text-align: center; }
  .inicio__puerta { display: grid; gap: var(--space-5); }
  .inicio__puerta h2, .inicio__puerta p { margin: 0; }
  /* The secondary door has no card: a thin rule and quieter text keep the panel door first. */
  .inicio__puerta--secundaria { padding-top: var(--space-8); border-top: var(--border-width) solid var(--border-1); }
  .inicio__puerta--secundaria p { color: var(--text-2); }
  /* The shared link rule (.zd-root a, specificity 0,1,1) beats the button variants (0,1,0):
     without these a link drawn as a button keeps the link color and its underline. */
  .zd-root a.zd-btn { text-decoration: none; }
  .zd-root a.zd-btn--primary, .zd-root a.zd-btn--primary:hover { color: var(--text-on-accent); }
  .zd-root a.zd-btn--secondary, .zd-root a.zd-btn--secondary:hover { color: var(--text-1); }
</style>
</head>
<body class="zd-root" data-surface="panel">
<!-- I-01 Inicio (DEC-203): static, no data, no session. -->
<main class="inicio" data-screen-label="Inicio" data-change="DEC-203" data-estado="existe">
  <div class="inicio__caja">
    <div class="inicio__marca">
      <strong>ZeroDashboard</strong>
      <p class="zd-muted">Tus avisos y reportes automáticos, en un solo lugar.</p>
    </div>
    <h1 class="zd-h2 inicio__titulo">¿Por dónde querés entrar?</h1>
    <section class="zd-card inicio__puerta" aria-labelledby="puerta-panel">
      <h2 id="puerta-panel" class="zd-h3">Administro un negocio</h2>
      <p class="zd-muted">Mirá tus avisos y ajustá cuándo y a quién te llegan.</p>
      <a class="zd-btn zd-btn--primary zd-btn--block" href="/panel">Ir a mi panel</a>
    </section>
    <section class="inicio__puerta inicio__puerta--secundaria" aria-labelledby="puerta-consola">
      <h2 id="puerta-consola" class="zd-h3">Configuro ZeroDashboard para un cliente</h2>
      <p>Conectá la base de un cliente y armá sus consultas y automatizaciones.</p>
      <a class="zd-btn zd-btn--secondary zd-btn--block" href="/consola">Ir a la consola</a>
    </section>
  </div>
</main>
</body>
</html>
`;

export function registerInicioRoutes(app: FastifyInstance): void {
  app.get('/', async (_request, reply) => {
    return reply.code(200).type('text/html; charset=utf-8').header('cache-control', 'no-cache').send(DOCUMENTO_INICIO);
  });
  // A fixed destination, never built from the request: nothing the client sends reaches `Location`.
  app.get('/consola/', async (_request, reply) => reply.redirect('/consola', 308));
  app.get('/panel/', async (_request, reply) => reply.redirect('/panel', 308));
}
