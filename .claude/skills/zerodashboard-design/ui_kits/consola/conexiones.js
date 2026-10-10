/* Conexiones y agentes (CH-03, CH-19b, CH-19d1, CH-19d2) + pantallas especificadas sin mockup. */
(function () {
  const Z = window.ZD, { D, esc, ic, badge, btn, banner, field, table } = Z;
  const fresh = () => ({ det: null, alta: false, probando: null, prueba: {}, nuevoAg: false, token: null, revocar: null, revocados: {}, agExtra: [] });
  let S = fresh();
  const tabs = (cur, nCx, nAg) => `<div class="zd-tabs" role="tablist" aria-label="Conexiones y agentes">${[['', 'Conexiones', 'cable', nCx], ['agentes', 'Agentes', 'server', nAg]].map(([k, l, i, n]) => `<a class="zd-tab" role="tab" href="#conexiones${k ? '/' + k : ''}" aria-selected="${cur === k}">${ic(i)}${l}<span class="zd-tab__count">${n}</span></a>`).join('')}</div>`;
  const kvgrid = pairs => `<dl class="zd-kvgrid">${pairs.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;

  function pruebaBadge(c) {
    const p = S.prueba[c.id] || c.prueba;
    if (S.probando === c.id) return `<span class="zd-badge zd-badge--info">${ic('loader-circle', 'style="animation:zd-spin 1s linear infinite"')}Probando…</span>`;
    return `<span style="display:grid;gap:2px;justify-items:start">${badge(p.ok ? 'probada' : 'noprobada')}<span class="zd-meta">${esc(p.cuando)}</span></span>`;
  }
  function pruebaDetalle(c) {
    const p = S.prueba[c.id] || c.prueba;
    if (S.probando === c.id) return banner('info', 'Probando la conexión…', '', '', { inline: true, icon: 'loader-circle' });
    return p.ok ? banner('ok', `Conexión OK · ${esc(p.latencia)}`, `${esc(c.motor)} · ${esc(p.tablas)} tablas visibles · usuario de solo lectura. Probada ${esc(p.cuando)}.`, '', { inline: true })
      : banner('error', esc(p.error), `Probada ${esc(p.cuando)}. Revisá usuario y contraseña en el origen.<pre>SQLSTATE ${esc(p.sqlstate)}</pre>`, '', { inline: true });
  }

  function conexiones(ctx) {
    const cx = D.conexiones[ctx.tenant.id] || [];
    const cols = [
      { label: 'Conexión', html: r => `<span style="display:grid;gap:2px"><b style="font-weight:600">${esc(r.nombre)}</b><span class="zd-meta zd-mono">${esc(r.id)}</span></span>` },
      { label: 'Motor', key: 'motor' },
      { label: 'Destino', html: r => `<span class="zd-mono" style="font-size:var(--text-xs)">${esc(r.host)}${r.puerto ? ':' + esc(r.puerto) : ''}/${esc(r.base)}</span>` },
      { label: 'Usuario', key: 'usuario', cls: 'is-mono' },
      { label: 'Última prueba', html: pruebaBadge },
      { label: 'Acciones', html: r => btn('Probar', { size: 'sm', variant: 'ghost', icon: 'plug', act: 'probar', arg: r.id, disabled: ctx.frozen || S.probando === r.id }) }];
    let over = '';
    const c = S.det && cx.find(x => x.id === S.det);
    if (c) over = Z.drawer(esc(c.id), esc(c.nombre), `${pruebaDetalle(c)}<dl class="zd-kv"><dt>Motor</dt><dd>${esc(c.motor)}</dd><dt>Host</dt><dd class="is-mono">${esc(c.host)}</dd><dt>Puerto</dt><dd class="is-mono">${c.puerto == null ? '—' : esc(c.puerto)}</dd><dt>Base</dt><dd class="is-mono">${esc(c.base)}</dd><dt>Usuario</dt><dd class="is-mono">${esc(c.usuario)}</dd><dt>Contraseña</dt><dd><span class="zd-badge">${ic('lock')}Guardada cifrada · no se muestra</span></dd><dt>Alta</dt><dd class="is-mono">${esc(c.alta)}</dd></dl>`, btn('Probar conexión', { variant: 'primary', icon: 'plug', act: 'probar', arg: c.id, disabled: ctx.frozen }));
    if (S.alta) over = Z.drawer('CH-03 · API sin pantalla', 'Nueva conexión', `<form id="f-cx" class="zd-form" data-submit-act="crearCx">${field('Nombre', `<input class="zd-input" id="c-n" name="nombre" placeholder="Réplica principal" autofocus required>`, { id: 'c-n' })}<div class="zd-form-row">${field('Host', `<input class="zd-input zd-input--code" id="c-h" name="host" required>`, { id: 'c-h' })}${field('Puerto', `<input class="zd-input" type="number" id="c-p" value="5432">`, { id: 'c-p' })}</div>${field('Base', `<input class="zd-input zd-input--code" id="c-b">`, { id: 'c-b' })}${field('Usuario (solo lectura)', `<input class="zd-input zd-input--code" id="c-u" autocomplete="off">`, { id: 'c-u' })}${field('Contraseña', `<input class="zd-input" type="password" id="c-pw" autocomplete="new-password">`, { id: 'c-pw', help: 'Se guarda cifrada. Después de guardar no se vuelve a mostrar; para cambiarla, cargá una nueva.' })}</form>`, btn('Cancelar', { act: 'close' }) + btn('Guardar y probar', { variant: 'primary', icon: 'plug', type: 'submit', attrs: ' form="f-cx"' }));
    return `${cx.length ? table(cols, cx, { caption: 'Conexiones del tenant activo', rowAct: 'det', selected: S.det }) : `<div class="zd-card" style="padding:0">${Z.empty('cable', 'Este tenant no tiene conexiones', 'Es el primer paso de la puesta en marcha: sin conexión no hay consultas ni automatizaciones.', btn('Nueva conexión', { variant: 'primary', icon: 'plus', act: 'alta', disabled: ctx.frozen }))}</div>`}${over}`;
  }

  function agentes(ctx) {
    const ags = (D.agentes[ctx.tenant.id] || []).concat(S.agExtra.filter(a => a.tenant === ctx.tenant.id)).map(a => Object.assign({}, a, S.revocados[a.id] ? { revocado: true } : {}));
    const riesgo = D.enRiesgo[ctx.tenant.id];
    const cols = [
      { label: 'Agente', html: r => `<span style="display:grid;gap:2px"><b style="font-weight:600">${esc(r.nombre)}</b><span class="zd-meta zd-mono">${esc(r.id)}</span></span>` },
      { label: 'Token', key: 'token', cls: 'is-mono' },
      { label: 'Alta', key: 'alta', cls: 'is-mono' },
      { label: 'Conectividad', html: r => r.revocado ? badge('revocado') : `<span style="display:grid;gap:4px;justify-items:start">${Z.conn(r.estado, r.latido ? 'último latido ' + r.latido : '')}<span class="zd-badge zd-badge--pending" title="Diseño anticipado: CH-19d1">${ic('circle-dashed')}Pendiente</span></span>` },
      { label: 'Acciones', html: r => r.revocado ? '' : btn('Revocar', { size: 'sm', variant: 'ghost', icon: 'key-round', act: 'askRevoke', arg: r.id, disabled: ctx.frozen }) }];
    let h = '';
    if (riesgo) h += `<div data-change="CH-19d2" data-estado="pendiente">${banner('warn', `${riesgo.length} automatizaciones en riesgo: el agente no responde hace 3 h`, `<span style="display:block;margin-bottom:var(--space-3)">Si no vuelve antes de su horario, la ejecución va a fallar. <span class="zd-badge zd-badge--pending">${ic('circle-dashed')}Pendiente · CH-19d2</span></span><table class="zd-table zd-table--compact" style="background:var(--surface-card);border-radius:var(--radius-md)"><thead><tr><th scope="col">Automatización</th><th scope="col">Próxima ejecución</th></tr></thead><tbody>${riesgo.map(r => `<tr><td>${esc(r.automatizacion)}</td><td class="is-mono">${esc(r.proxima)}</td></tr>`).join('')}</tbody></table>`)}</div>`;
    if (S.token) h += banner('ok', 'Agente creado. Copiá el token ahora: no se vuelve a mostrar.', `<pre>${esc(S.token)}</pre>`, btn('Copiar token', { size: 'sm', icon: 'copy', act: 'copy' }) + btn('Ya lo copié', { size: 'sm', variant: 'ghost', act: 'clearToken' }));
    h += ags.length ? table(cols, ags, { caption: 'Agentes del tenant activo' }) : `<div class="zd-card" style="padding:0">${Z.empty('server', 'Este tenant no tiene agentes', 'Un agente sirve cuando la base del cliente no acepta conexiones entrantes: se conecta desde adentro con un token.', btn('Nuevo agente', { variant: 'primary', icon: 'plus', act: 'askAgent', disabled: ctx.frozen }))}</div>`;
    if (S.nuevoAg) h += Z.dialog('Nuevo agente', `<form id="f-ag" class="zd-form" data-submit-act="crearAg">${field('Nombre', `<input class="zd-input" id="g-n" name="nombre" placeholder="PC administración" autofocus>`, { id: 'g-n', help: 'Para reconocerlo en esta lista. El token se muestra una sola vez.' })}</form>`, btn('Cancelar', { act: 'close' }) + btn('Crear agente', { variant: 'primary', icon: 'key-round', type: 'submit', attrs: ' form="f-ag"' }));
    if (S.revocar) { const a = ags.find(x => x.id === S.revocar); h += Z.dialog(`Revocar el token de ${esc(a.nombre)}`, `<p class="zd-dialog__body">El agente deja de conectarse de inmediato y el token no se puede reactivar. Las automatizaciones de <b>${esc(ctx.tenant.nombre)}</b> que usen este agente van a fallar hasta que des de alta uno nuevo.</p>`, btn('Cancelar', { act: 'close' }) + btn('Revocar token', { variant: 'danger', icon: 'key-round', act: 'doRevoke' })); }
    return h;
  }

  Z.screens.conexiones = {
    reset: () => { S = fresh(); },
    render(ctx, sub) {
      const isAg = sub === 'agentes';
      const head = Z.pageHead({ ctx, scope: 'tenant', title: 'Conexiones y agentes', change: isAg ? 'CH-19b · CH-19d1 · CH-19d2' : 'CH-03', estado: isAg ? 'API · conectividad PENDIENTE' : 'API sin pantalla', desc: 'Cómo llega ZeroDashboard a la réplica del tenant: conexión directa de solo lectura o agente saliente instalado en el cliente.', actions: isAg ? btn('Nuevo agente', { variant: 'primary', icon: 'plus', act: 'askAgent', disabled: !ctx.tenant || ctx.frozen }) : btn('Nueva conexión', { variant: 'primary', icon: 'plus', act: 'alta', disabled: !ctx.tenant || ctx.frozen }) });
      if (!ctx.tenant) return head + Z.noTenant('Las conexiones y los agentes');
      return `<section data-change="${isAg ? 'CH-19b CH-19d1 CH-19d2' : 'CH-03'}" data-estado="${isAg ? 'pendiente' : 'parcial'}" style="display:grid;gap:var(--space-6)">${head}${Z.frozenBanner(ctx)}${tabs(isAg ? 'agentes' : '', (D.conexiones[ctx.tenant.id] || []).length, (D.agentes[ctx.tenant.id] || []).length + S.agExtra.filter(a => a.tenant === ctx.tenant.id).length)}${isAg ? agentes(ctx) : conexiones(ctx)}</section>`;
    },
    on: {
      det: el => { S.det = el.dataset.arg; S.alta = false; },
      alta: () => { S.alta = true; S.det = null; },
      crearCx: f => { if (!f.elements.nombre.value.trim()) { f.elements.nombre.setAttribute('aria-invalid', 'true'); f.elements.nombre.focus(); return false; } S.alta = false; },
      probar: el => { const id = el.dataset.arg; S.probando = id; setTimeout(() => { S.probando = null; S.prueba[id] = { ok: true, cuando: 'recién', latencia: '44 ms', tablas: 38 }; Z.render(); }, 900); },
      askAgent: () => { S.nuevoAg = true; },
      crearAg: (f, ctx) => { const n = f.elements.nombre.value.trim() || 'Agente sin nombre'; S.agExtra.push({ id: 'ag_' + (10 + S.agExtra.length), tenant: ctx.tenant.id, nombre: n, token: 'zd_ag_••••7c1e', alta: '09/10 11:05', estado: 'sin_datos', latido: null }); S.token = 'zd_ag_5Qm2r8Kx-7c1e-Rk9pW3sd-03bdT6'; S.nuevoAg = false; },
      copy: () => { navigator.clipboard && navigator.clipboard.writeText(S.token); return false; },
      clearToken: () => { S.token = null; },
      askRevoke: el => { S.revocar = el.dataset.arg; },
      doRevoke: () => { S.revocados[S.revocar] = true; S.revocar = null; },
      close: () => { S.det = null; S.alta = false; S.nuevoAg = false; S.revocar = null; }
    }
  };

  const SPEC = {
    tenants: ['Tenants', 'global', 'Sin change de UI', 'API sin pantalla', 'Alta, listado y baja lógica de tenants. La baja congela todo y se confirma con «Dar de baja {nombre}».', 'C-02'],
    plantillas: ['Plantillas', 'global', 'CH-21 · CH-24', 'API sin pantalla', 'Catálogo de plantillas con su descripción, campos requeridos y tolerancia de frescura. Solo lectura.', 'C-03'],
    contrato: ['Contrato canónico', 'global', 'CH-08', 'API sin pantalla', 'Entidades, campos, tipos y dependencias que las plantillas esperan. Solo lectura.', 'C-04'],
    mapeo: ['Mapeo y validación', 'tenant', 'CH-09 · CH-10', 'API sin pantalla', 'Mapeo del esquema del tenant al contrato canónico y validación, con entidades inaplicables y su motivo.', 'C-06'],
    tiempos: ['Tiempos de alta', 'tenant', 'CH-15', 'API sin pantalla', 'Marcas de tiempo por etapa: alta, conexión, mapeo, validación, primera automatización, primera ejecución.', 'C-07'],
    frescura: ['Frescura de datos', 'tenant', 'CH-24', 'EXISTE', 'Ventana de desactualización, última actualización de la réplica, «Marcar réplica actualizada ahora» y tolerancia por plantilla.', 'C-11'],
    auditoria: ['Auditoría', 'tenant', 'Sin change', 'PENDIENTE', 'Registro de ejecuciones de consultas: qué, cuándo, contra qué tenant y, cuando exista, quién.', 'C-12']
  };
  Z.screens._spec = {
    render(ctx, sub, id) {
      const s = SPEC[id] || ['Pantalla no encontrada', 'global', '', '', 'Esta dirección no corresponde a ninguna pantalla de la consola.', ''];
      return `<section data-change="${esc(s[2])}" data-estado="${esc(s[3]).toLowerCase()}" style="display:grid;gap:var(--space-6)">${Z.pageHead({ ctx, scope: s[1], title: s[0], change: s[2], estado: s[3], desc: esc(s[4]) })}${s[1] === 'tenant' && ctx.tenant ? Z.frozenBanner(ctx) : ''}<div class="zd-card" style="padding:0">${Z.empty('file-text', 'Especificada, fuera de este mockup', `Datos, estados y acciones en <span class="zd-mono">guidelines/consola.md</span> (${esc(s[5])}). Se compone con DataTable, Field, Banner, StatusBadge y KeyValueList.`)}</div></section>`;
    }
  };
})();
