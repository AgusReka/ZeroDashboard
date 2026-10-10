/* Consola — esqueleto (HTML + CSS + JS plano). Todo valor de datos pasa por esc(): se escribe como texto, nunca como marcado. */
(function () {
  const D = window.DATOS_CONSOLA, I = window.ZD_ICONS;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ic = (n, attrs = '') => `<svg class="zd-icon" ${attrs} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${I[n] || I.circle}</svg>`;
  const EST = {
    ok: ['ok', 'circle-check', 'OK'], fallo: ['error', 'circle-x', 'Fallo'], omitida: ['neutral', 'skip-forward', 'Omitida por solapamiento'],
    interrumpida: ['warn', 'ban', 'Interrumpida'], reintentando: ['info', 'refresh-cw', 'Reintentando'],
    activa: ['ok', 'circle-check', 'Activa'], inactiva: ['neutral', 'pause', 'Desactivada'], vigente: ['ok', 'circle-check', 'Vigente'],
    probada: ['ok', 'circle-check', 'Conexión OK'], noprobada: ['error', 'circle-x', 'Falló la prueba'], revocado: ['neutral', 'ban', 'Revocado'],
    pendiente: ['neutral', 'circle-dashed', 'Pendiente'], baja: ['neutral', 'archive', 'Dado de baja']
  };
  const badge = (k, label) => { const e = EST[k]; return `<span class="zd-badge${e[0] !== 'neutral' ? ' zd-badge--' + e[0] : ''}${k === 'pendiente' ? ' zd-badge--pending' : ''}">${ic(e[1])}${esc(label || e[2])}</span>`; };
  const btn = (label, o = {}) => {
    const cls = ['zd-btn', 'zd-btn--' + (o.variant || 'secondary'), o.size ? 'zd-btn--' + o.size : '', o.iconOnly ? 'zd-btn--icon' : '', o.block ? 'zd-btn--block' : ''].filter(Boolean).join(' ');
    return `<button type="${o.type || 'button'}" class="${cls}"${o.act ? ` data-act="${o.act}"` : ''}${o.arg != null ? ` data-arg="${esc(o.arg)}"` : ''}${o.disabled ? ' disabled' : ''}${o.iconOnly ? ` aria-label="${esc(label)}" title="${esc(label)}"` : ''}${o.attrs || ''}>${o.icon ? ic(o.icon) : ''}${o.iconOnly ? '' : esc(label)}</button>`;
  };
  const banner = (tone, title, body = '', actions = '', o = {}) => {
    const icons = { info: 'info', ok: 'circle-check', warn: 'triangle-alert', error: 'circle-alert', neutral: 'info' };
    return `<div class="zd-banner zd-banner--${tone}${o.inline ? ' zd-banner--inline' : ''}" role="${tone === 'error' || tone === 'warn' ? 'alert' : 'status'}"${o.attrs || ''}>${ic(o.icon || icons[tone])}<div><p class="zd-banner__title">${title}</p>${body ? `<div class="zd-banner__body">${body}</div>` : ''}</div><div class="zd-banner__actions">${actions}</div></div>`;
  };
  let fid = 0;
  const field = (label, control, o = {}) => `<div class="zd-field"><label class="zd-label" for="${o.id}">${esc(label)}${o.optional ? '<span class="zd-optional"> (opcional)</span>' : ''}</label>${control}${o.help ? `<span class="zd-help" id="${o.id}-h">${esc(o.help)}</span>` : ''}</div>`;
  const nid = () => 'f' + (++fid);
  const fmt = v => v === null || v === undefined ? '<span class="is-null">NULL</span>' : esc(v);
  const table = (cols, rows, o = {}) => `<div class="zd-table-wrap"><div class="zd-table-scroll"><table class="zd-table zd-table--compact"><caption class="zd-sr">${esc(o.caption)}</caption><thead><tr>${cols.map(c => `<th scope="col" class="${c.cls || ''}">${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map(r => `<tr${o.rowAct ? ` data-act="${o.rowAct}" data-arg="${esc(r.id)}" tabindex="0" style="cursor:pointer"` : ''}${o.selected && o.selected === r.id ? ' aria-selected="true"' : ''}>${cols.map(c => `<td class="${c.cls || ''}">${c.html ? c.html(r) : fmt(r[c.key])}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${cols.length}" class="zd-muted" style="text-align:center;padding:24px">${esc(o.empty || 'Sin filas.')}</td></tr>`}</tbody></table></div>${o.foot || ''}</div>`;
  const scope = (kind, ctx) => kind === 'global'
    ? `<span class="zd-scope zd-scope--global">${ic('globe')}Global · todos los tenants</span>`
    : ctx.tenant ? `<span class="zd-scope zd-scope--tenant">${ic('building-2')}Tenant activo: ${esc(ctx.tenant.nombre)}</span>` : `<span class="zd-scope zd-scope--none">${ic('triangle-alert')}Sin tenant activo</span>`;
  const pageHead = o => `<header class="zd-pagehead"><div class="zd-pagehead__text">${o.crumbs ? `<nav class="zd-pagehead__crumbs" aria-label="Ruta">${o.crumbs}</nav>` : ''}<div class="zd-pagehead__meta">${scope(o.scope, o.ctx)}${o.change ? `<span class="zd-tag" title="Change y estado de diseño">${esc(o.change)} · ${esc(o.estado)}</span>` : ''}</div><h1 class="zd-h1">${esc(o.title)}</h1>${o.desc ? `<p class="zd-pagehead__desc">${o.desc}</p>` : ''}</div>${o.actions ? `<div class="zd-pagehead__actions">${o.actions}</div>` : ''}</header>`;
  const dialog = (title, body, actions, o = {}) => `<div class="zd-dialog-backdrop" data-act="${o.closeAct || 'close'}" data-self="1"><div class="zd-dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-t"><h2 class="zd-dialog__title" id="dlg-t">${title}</h2>${body}<div class="zd-dialog__actions">${actions}</div></div></div>`;
  const drawer = (eyebrow, title, body, foot = '', o = {}) => `<aside class="zd-drawer${o.wide ? ' zd-drawer--wide' : ''}" role="dialog" aria-modal="false" aria-labelledby="drw-t"><div class="zd-drawer__head"><div>${eyebrow ? `<span class="zd-eyebrow">${eyebrow}</span>` : ''}<h2 class="zd-h2" id="drw-t">${title}</h2></div>${btn('Cerrar panel', { iconOnly: true, icon: 'x', variant: 'ghost', size: 'sm', act: o.closeAct || 'close' })}</div><div class="zd-drawer__body">${body}</div>${foot ? `<div class="zd-drawer__foot">${foot}</div>` : ''}</aside>`;
  const empty = (icon, title, body, actions = '') => `<div class="zd-state" role="status"><span class="zd-state__icon">${ic(icon)}</span><p class="zd-state__title">${esc(title)}</p>${body ? `<p class="zd-state__body">${body}</p>` : ''}${actions ? `<div class="zd-state__actions">${actions}</div>` : ''}</div>`;
  const conn = (estado, latido, onDark) => { const L = { conectado: 'Conectado', desconectado: 'Desconectado', sin_datos: 'Sin latidos' }; return `<span class="zd-conn zd-conn--${estado.replace('_', '-')}" data-change="CH-19d1" data-estado="pendiente"><span class="zd-conn__dot" aria-hidden="true"${onDark ? ' style="box-shadow:0 0 0 2px rgba(255,255,255,.5)"' : ''}></span><span class="zd-conn__label"${onDark ? ' style="color:inherit"' : ''}>${L[estado]}</span>${latido ? `<span class="zd-conn__beat"${onDark ? ' style="color:inherit;opacity:.85"' : ''}>· ${esc(latido)}</span>` : ''}</span>`; };
  const frozenBanner = ctx => ctx.frozen ? banner('neutral', `${esc(ctx.tenant.nombre)} está dado de baja desde el ${esc(ctx.tenant.baja)}`, 'La baja es lógica y congela todo: podés ver la configuración y el historial, pero no crear, ejecutar ni modificar nada.', '', { icon: 'archive' }) : '';
  const noTenant = (what) => `<div class="zd-card" style="padding:0">${empty('building-2', 'Elegí un tenant para operar', `${esc(what)} pertenecen a un tenant. Elegí uno en la barra de arriba.`, btn('Elegir tenant', { variant: 'primary', icon: 'arrow-left-right', act: 'app:switch' }))}</div>`;

  window.ZD = { D, esc, ic, badge, btn, banner, field, nid, fmt, table, pageHead, dialog, drawer, empty, conn, frozenBanner, noTenant, screens: {} };

  const NAV = [
    { scope: 'global', items: [['tenants', 'Tenants', 'building-2', 'API'], ['plantillas', 'Plantillas', 'file-text', 'API'], ['contrato', 'Contrato canónico', 'layers', 'API']] },
    { scope: 'tenant', sub: 'Puesta en marcha', items: [['conexiones', 'Conexiones y agentes', 'cable'], ['mapeo', 'Mapeo y validación', 'list-checks', 'API'], ['tiempos', 'Tiempos de alta', 'gauge', 'API']] },
    { scope: 'tenant', sub: 'Trabajo diario', items: [['consultas', 'Consultas', 'database'], ['automatizaciones', 'Automatizaciones', 'calendar-clock'], ['frescura', 'Frescura de datos', 'timer'], ['auditoria', 'Auditoría', 'scroll-text', 'Pendiente']] }
  ];

  const state = { tenantId: localStorage.getItem('zd-consola-tenant') ?? 'ten_7f3a', switching: false, switchSel: null };
  const ctxOf = () => { const t = D.tenants.find(x => x.id === state.tenantId) || null; return { tenant: t, frozen: !!t && t.estado === 'baja' }; };
  const route = () => { const h = (location.hash || '#consultas').slice(1).split('/'); return { id: h[0] || 'consultas', sub: h.slice(1).join('/') }; };

  function renderBar(ctx) {
    const t = ctx.tenant;
    const op = `<span class="zd-operator" title="Reservado para la identidad del operador. No implementado: la consola no tiene autenticación.">${ic('user-round')}Operador: no implementado</span>`;
    if (!t) return `<div class="zd-tenantbar zd-tenantbar--none" role="region" aria-label="Tenant activo" data-change="CH-06" data-estado="existe">${ic('triangle-alert')}<span class="zd-tenantbar__name" style="font-size:var(--text-sm)">Ningún tenant seleccionado</span><span>Elegí uno para operar.</span><span class="zd-tenantbar__spacer"></span>${op}<button type="button" class="zd-tenantbar__btn" data-act="app:switch">${ic('arrow-left-right')}Elegir tenant</button></div>`;
    return `<div class="zd-tenantbar" role="region" aria-label="Tenant activo" data-change="CH-06" data-estado="existe">${ic('building-2')}<span class="zd-tenantbar__label">Tenant activo</span><span class="zd-tenantbar__name">${esc(t.nombre)}</span><span class="zd-tenantbar__id">${esc(t.id)}</span>${ctx.frozen ? `<span class="zd-tenantbar__flag">${ic('archive')}Dado de baja · congelado</span>` : ''}<span class="zd-tenantbar__spacer"></span>${conn(t.agente, t.latido ? 'último latido ' + t.latido : '', true)}${op}<button type="button" class="zd-tenantbar__btn" data-act="app:switch">${ic('arrow-left-right')}Cambiar tenant</button></div>`;
  }
  function renderNav(ctx, cur) {
    const item = ([id, label, icon, meta]) => `<a class="zd-sidenav__item" href="#${id}"${cur === id ? ' aria-current="page"' : ''}>${ic(icon)}<span>${esc(label)}</span>${meta ? `<span class="zd-sidenav__meta" title="${meta === 'API' ? 'Existe la API, la pantalla es nueva' : 'Diseño anticipado'}">${meta}</span>` : ''}</a>`;
    let html = `<div class="zd-sidenav__brand"><span class="zd-sidenav__brandname">ZeroDashboard</span><span class="zd-eyebrow">Consola</span></div>`;
    html += `<div class="zd-sidenav__group"><span class="zd-sidenav__heading">${ic('globe')}Global</span>${NAV[0].items.map(item).join('')}</div>`;
    html += `<div class="zd-sidenav__scope"><div class="zd-sidenav__tenant"><span class="zd-sidenav__heading" style="padding:0">${ic('building-2')}Tenant activo</span><b>${ctx.tenant ? esc(ctx.tenant.nombre) : 'Ninguno'}</b></div>`;
    NAV.slice(1).forEach(g => { html += `<span class="zd-sidenav__subheading">${g.sub}</span>${g.items.map(item).join('')}`; });
    html += `</div><div class="zd-sidenav__foot"><span class="zd-meta" style="flex:1">Modo</span>${btn('Cambiar modo claro/oscuro', { iconOnly: true, size: 'sm', variant: 'ghost', icon: document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon', act: 'app:theme' })}</div>`;
    return html;
  }
  function renderSwitcher() {
    const sel = state.switchSel ?? state.tenantId;
    const t = D.tenants.find(x => x.id === sel);
    const opts = D.tenants.map(x => `<label class="zd-template" style="flex-direction:row;align-items:center;padding:var(--space-5);gap:var(--space-5)"><input type="radio" name="tenant" value="${esc(x.id)}" data-change-act="app:pick"${sel === x.id ? ' checked' : ''}>${ic('building-2')}<span style="flex:1;display:grid;gap:2px"><span class="zd-template__name">${esc(x.nombre)}</span><span class="zd-meta">${esc(x.id)} · alta ${esc(x.alta)}</span></span>${x.estado === 'baja' ? badge('baja') : conn(x.agente)}</label>`).join('');
    const label = !t ? 'Elegí un tenant' : t.id === state.tenantId ? 'Ya es el tenant activo' : 'Operar sobre ' + t.nombre;
    return dialog('Cambiar tenant activo', `<div style="display:grid;gap:var(--space-3)" role="radiogroup" aria-label="Tenants">${opts}</div><p class="zd-meta" style="margin:0">Todo lo que hagas después del cambio se aplica al tenant elegido. Para dar de alta o de baja, usá <a href="#tenants" data-act="app:closeSwitch">Tenants</a>.</p>`, btn('Cancelar', { act: 'app:closeSwitch' }) + btn(label, { variant: 'primary', act: 'app:confirmSwitch', disabled: !t || t.id === state.tenantId }), { closeAct: 'app:closeSwitch' });
  }

  const root = document.getElementById('app');
  function render() {
    const ctx = ctxOf(), r = route();
    const scr = window.ZD.screens[r.id] || window.ZD.screens._spec;
    root.innerHTML = renderBar(ctx) + `<div class="zd-shell"><nav class="zd-sidenav" aria-label="Secciones de la consola">${renderNav(ctx, r.id)}</nav><main class="zd-page" id="zd-main" data-screen-label="${esc(r.id)}">${scr.render(ctx, r.sub, r.id)}</main></div>` + (state.switching ? renderSwitcher() : '');
    const af = root.querySelector('.zd-dialog [autofocus], .zd-drawer [autofocus]') || root.querySelector('.zd-dialog .zd-btn--primary:not(:disabled), .zd-dialog input');
    if (af) af.focus();
  }
  window.ZD.render = render;
  window.ZD.ctx = ctxOf;
  window.ZD.go = h => { if (location.hash === '#' + h) render(); else location.hash = h; };

  const appActs = {
    switch: () => { state.switching = true; state.switchSel = null; },
    closeSwitch: () => { state.switching = false; },
    pick: el => { state.switchSel = el.value; },
    confirmSwitch: () => { state.tenantId = state.switchSel; localStorage.setItem('zd-consola-tenant', state.tenantId); state.switching = false; Object.values(window.ZD.screens).forEach(s => s.reset && s.reset()); },
    theme: () => { const n = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = n; }
  };
  function dispatch(act, el, ev) {
    if (act.startsWith('app:')) { appActs[act.slice(4)](el, ev); render(); return; }
    const scr = window.ZD.screens[route().id] || window.ZD.screens._spec;
    const fn = scr.on && scr.on[act];
    if (fn && fn(el, ctxOf(), ev) !== false) render();
  }
  root.addEventListener('click', ev => {
    const el = ev.target.closest('[data-act]');
    if (!el || el.disabled) return;
    if (el.dataset.self && ev.target !== el) return;
    if (el.tagName === 'A' && el.getAttribute('href')?.startsWith('#') && el.dataset.act === 'app:closeSwitch') { state.switching = false; return; }
    ev.preventDefault();
    dispatch(el.dataset.act, el, ev);
  });
  root.addEventListener('keydown', ev => {
    if (ev.key === 'Escape') { if (state.switching) { state.switching = false; render(); } else if (root.querySelector('.zd-dialog, .zd-drawer')) dispatch('close', null, ev); }
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('tr[data-act]')) { ev.preventDefault(); dispatch(ev.target.dataset.act, ev.target, ev); }
    if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey) && ev.target.matches('textarea')) dispatch('run', ev.target, ev);
  });
  root.addEventListener('change', ev => { const a = ev.target.dataset.changeAct; if (a) dispatch(a, ev.target, ev); });
  root.addEventListener('input', ev => { const a = ev.target.dataset.inputAct; if (a) dispatch(a, ev.target, ev); });
  root.addEventListener('submit', ev => { ev.preventDefault(); const a = ev.target.dataset.submitAct; if (a) dispatch(a, ev.target, ev); });
  window.addEventListener('hashchange', () => { state.switching = false; render(); window.scrollTo(0, 0); });
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', render); else setTimeout(render, 0);
})();
