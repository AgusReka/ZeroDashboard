/* Consultas — editor + resultado + guardadas con versiones (CH-04, CH-05, CH-11, CH-25). */
(function () {
  const Z = window.ZD, { D, esc, ic, badge, btn, banner, field, table } = Z;
  const fresh = () => ({ loaded: 'q_31', sql: D.sql, params: D.parametros.map(p => Object.assign({}, p)), perPage: 25, sim: 'ok', run: 'ok', page: 1, drawer: false, compare: null, restore: null, save: null, notice: null, versiones: D.versiones.map(v => Object.assign({}, v)) });
  let S = fresh();
  const vig = () => S.versiones[0];

  function resultado(ctx) {
    if (S.run === 'running') return `<div class="zd-card" style="padding:0"><div class="zd-state" role="status"><span class="zd-spinner" aria-hidden="true"></span><p class="zd-state__body">Ejecutando consulta…</p></div></div>`;
    if (S.run === null) return `<div class="zd-card" style="padding:0">${Z.empty('play', 'Todavía no ejecutaste esta consulta', 'El resultado aparece acá, justo debajo del editor.')}</div>`;
    if (S.run === 'error') return banner('error', 'Error de sintaxis cerca de «FORM»', 'Revisá la línea 3: probablemente quisiste escribir <span class="zd-mono">FROM</span>.<pre>SQLSTATE 42601 · línea 3, columna 1</pre>');
    if (S.run === 'escritura') return banner('error', 'Solo se permiten consultas de lectura', 'Se encontró <span class="zd-mono">UPDATE</span> en la línea 1. La conexión es de solo lectura: usá <span class="zd-mono">SELECT</span> o <span class="zd-mono">WITH … SELECT</span>.<pre>SQLSTATE 25006</pre>');
    if (S.run === 'timeout') return banner('error', 'La consulta superó el tiempo máximo (30 s)', 'La réplica no respondió a tiempo. Probá acotar el rango o filtrar por una columna indexada.<pre>SQLSTATE 57014</pre>', btn('Reintentar', { size: 'sm', icon: 'refresh-cw', act: 'run' }));
    const rows = S.run === 'vacio' ? [] : D.resultado;
    const tope = S.run === 'tope';
    const total = tope ? 1000 : rows.length;
    const pages = Math.max(1, Math.ceil(total / S.perPage));
    const cols = [{ key: 'sku', label: 'sku', cls: 'is-mono' }, { key: 'nombre', label: 'nombre' }, { key: 'deposito', label: 'deposito' }, { key: 'stock_actual', label: 'stock_actual', cls: 'is-num' }, { key: 'stock_minimo', label: 'stock_minimo', cls: 'is-num' }];
    const status = `<div class="zd-statusline" role="status">${ic('circle-check', 'style="color:var(--ok)"')}<b style="color:var(--text-1)">${total.toLocaleString('es-AR')} filas</b><span class="zd-statusline__sep"></span><span class="zd-num">1,8 s</span><span class="zd-statusline__sep"></span><span>conexión <span class="zd-mono">cx_01</span></span>${tope ? `<span class="zd-statusline__sep"></span><span class="zd-badge zd-badge--warn">${ic('triangle-alert')}Cortado en el tope (1.000 filas)</span>` : ''}</div>`;
    const foot = `<div class="zd-pager"><span class="zd-num">${total ? (S.page - 1) * S.perPage + 1 : 0}–${Math.min(S.page * S.perPage, total)} de ${total.toLocaleString('es-AR')}</span><span class="zd-pager__spacer"></span>${btn('Página anterior', { iconOnly: true, size: 'sm', icon: 'chevron-left', act: 'page', arg: S.page - 1, disabled: S.page <= 1 })}<span class="zd-num">Página ${S.page} de ${pages}</span>${btn('Página siguiente', { iconOnly: true, size: 'sm', icon: 'chevron-right', act: 'page', arg: S.page + 1, disabled: S.page >= pages })}</div>`;
    return `<div style="display:grid;gap:var(--space-4)">${status}${table(cols, rows, { caption: 'Resultado de la consulta', empty: 'La consulta no devolvió filas.', foot })}</div>`;
  }

  function editor(ctx) {
    const q = D.guardadas.find(x => x.id === S.loaded);
    const cx = D.conexiones[ctx.tenant.id] || [];
    const ctxStrip = q
      ? `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-4)"><span style="font-weight:600">${esc(q.nombre)}</span>${badge('vigente', 'Versión ' + vig().v + ' · vigente')}<span style="flex:1"></span>${btn('Guardar como nueva versión', { size: 'sm', icon: 'save', act: 'openSave', arg: 'version', disabled: ctx.frozen })}${btn('Versiones', { size: 'sm', icon: 'history', variant: 'ghost', act: 'versiones', attrs: ` aria-pressed="${S.drawer}"` })}</div>`
      : `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-4)"><span class="zd-muted">Consulta sin guardar</span><span style="flex:1"></span>${btn('Guardar consulta', { size: 'sm', icon: 'save', act: 'openSave', arg: 'nueva', disabled: ctx.frozen })}</div>`;
    const params = S.params.map((p, i) => `<div style="display:grid;grid-template-columns:minmax(0,1fr) 130px minmax(0,1fr) auto;gap:var(--space-4);align-items:end">
      ${field(i === 0 ? 'Nombre' : 'Nombre', `<input class="zd-input zd-input--code" id="pn${i}" value="${esc(p.nombre)}" data-input-act="param" data-arg="${i}" data-k="nombre">`, { id: 'pn' + i })}
      ${field('Tipo', `<select class="zd-select" id="pt${i}" data-change-act="param" data-arg="${i}" data-k="tipo">${['entero', 'decimal', 'texto', 'fecha', 'booleano'].map(t => `<option${t === p.tipo ? ' selected' : ''}>${t}</option>`).join('')}</select>`, { id: 'pt' + i })}
      ${field('Valor', `<input class="zd-input" id="pv${i}" value="${esc(p.valor)}" placeholder="NULL" data-input-act="param" data-arg="${i}" data-k="valor">`, { id: 'pv' + i })}
      ${btn('Quitar :' + p.nombre, { iconOnly: true, icon: 'trash-2', variant: 'ghost', act: 'delParam', arg: i })}</div>`).join('');
    return `<div class="zd-card zd-form" data-change="CH-04 CH-11" data-estado="existe">
      ${ctxStrip}
      <div class="zd-form-row">
        ${field('Conexión', `<select class="zd-select" id="q-cx">${cx.map(c => `<option value="${esc(c.id)}">${esc(c.id)} · ${esc(c.nombre)}</option>`).join('')}</select>`, { id: 'q-cx' })}
        ${field('Filas por página', `<select class="zd-select" id="q-pp" data-change-act="perPage">${[25, 50, 100].map(n => `<option${n === S.perPage ? ' selected' : ''}>${n}</option>`).join('')}</select>`, { id: 'q-pp' })}
      </div>
      ${field('SQL (solo lectura)', `<textarea class="zd-textarea zd-textarea--code" id="q-sql" rows="7" spellcheck="false" data-input-act="sql" aria-describedby="q-sql-h">${esc(S.sql)}</textarea>`, { id: 'q-sql', help: 'Parámetros con dos puntos (:umbral). Ctrl + Enter ejecuta. Tope: 1.000 filas · 30 s.' })}
      <fieldset style="border:0;margin:0;padding:0;display:grid;gap:var(--space-4)"><legend class="zd-label" style="margin-bottom:var(--space-3)">Parámetros declarados</legend>${params}<div>${btn('Agregar parámetro', { size: 'sm', icon: 'plus', variant: 'ghost', act: 'addParam' })}</div></fieldset>
      <div class="zd-form-actions">${btn('Ejecutar', { variant: 'primary', icon: 'play', act: 'run', disabled: ctx.frozen || S.run === 'running' })}<span class="zd-meta">Ctrl + Enter</span><span style="flex:1"></span>
        <label class="zd-meta" style="display:flex;gap:var(--space-3);align-items:center">Mockup: simular resultado <select class="zd-select" style="width:160px;min-height:28px" data-change-act="sim">${[['ok', 'Éxito'], ['tope', 'Cortado en el tope'], ['vacio', 'Sin filas'], ['error', 'Error de sintaxis'], ['escritura', 'Sentencia de escritura'], ['timeout', 'Timeout']].map(([v, l]) => `<option value="${v}"${v === S.sim ? ' selected' : ''}>${l}</option>`).join('')}</select></label></div>
    </div>`;
  }

  function guardadas(ctx) {
    return `<aside data-change="CH-05" data-estado="existe" style="display:grid;gap:var(--space-4)" aria-label="Consultas guardadas"><span class="zd-eyebrow">Guardadas (${D.guardadas.length})</span><ul class="zd-list">${D.guardadas.map(q => `<li><button class="zd-list__item" data-act="load" data-arg="${esc(q.id)}"${S.loaded === q.id ? ' aria-current="true"' : ''}><span style="font-weight:600;font-size:var(--text-sm)">${esc(q.nombre)}</span><span class="zd-meta">${esc(q.descripcion)}</span><span class="zd-meta">v${esc(q.vigente)} · ${esc(q.editada)}</span></button></li>`).join('')}</ul>${btn('Consulta nueva', { size: 'sm', icon: 'plus', variant: 'ghost', act: 'nueva' })}</aside>`;
  }

  function overlays(ctx) {
    let h = '';
    if (S.drawer) {
      const list = S.versiones.map((v, i) => `<li style="display:grid;grid-template-columns:auto minmax(0,1fr);gap:var(--space-2) var(--space-4);padding:var(--space-4);border-radius:var(--radius-md);${i === 0 ? 'background:var(--surface-selected)' : 'border:1px solid var(--border-1)'}"><span class="zd-tag">v${v.v}</span><span style="display:grid;gap:2px"><span style="font-size:var(--text-sm);font-weight:600">${v.nota ? esc(v.nota) : '<span class="zd-muted" style="font-weight:400">Sin nota</span>'}</span><span class="zd-meta">${esc(v.fecha)}</span></span><span></span><span style="display:flex;flex-wrap:wrap;gap:var(--space-3)">${i === 0 ? badge('vigente') : btn('Comparar con la actual', { size: 'sm', icon: 'columns-2', act: 'compare', arg: v.v }) + btn('Restaurar', { size: 'sm', variant: 'ghost', icon: 'rotate-ccw', act: 'askRestore', arg: v.v, disabled: ctx.frozen })}</span></li>`).join('');
      h += Z.drawer('CH-25 · Stock bajo por depósito', 'Versiones', `<ol class="zd-list" style="gap:var(--space-3)">${list}</ol><p class="zd-meta" style="margin:0">Restaurar crea una versión nueva con el texto elegido. Ninguna versión se borra.</p>`);
    }
    if (S.compare) {
      const v = S.versiones.find(x => x.v === S.compare);
      h += Z.drawer('Comparación de texto (sin diff)', `Versión ${v.v} y versión vigente`, `<div class="zd-compare"><figure><figcaption>${ic('history')}Versión ${v.v} · ${esc(v.fecha)}</figcaption><pre class="zd-code" style="margin:0">${esc(v.sql || S.sql)}</pre></figure><figure><figcaption>${ic('circle-check')}Vigente · versión ${vig().v}</figcaption><pre class="zd-code" style="margin:0">${esc(vig().sql || S.sql)}</pre></figure></div>`, btn('Volver a versiones', { icon: 'arrow-left', act: 'closeCompare' }) + btn('Restaurar versión ' + v.v, { variant: 'primary', icon: 'rotate-ccw', act: 'askRestore', arg: v.v, disabled: ctx.frozen }), { wide: true, closeAct: 'closeCompare' });
    }
    if (S.restore) {
      const n = vig().v + 1;
      h += Z.dialog(`Restaurar la versión ${S.restore}`, `<p class="zd-dialog__body">Se crea la versión ${n} con el texto de la versión ${S.restore} y pasa a ser la vigente. Las versiones anteriores se conservan.</p>`, btn('Cancelar', { act: 'cancelRestore' }) + btn('Restaurar versión ' + S.restore, { variant: 'primary', icon: 'rotate-ccw', act: 'doRestore' }), { closeAct: 'cancelRestore' });
    }
    if (S.save === 'version') h += Z.dialog(`Guardar como versión ${vig().v + 1}`, `<form id="f-ver" data-submit-act="doSave" class="zd-form">${field('Nota', `<input class="zd-input" id="v-nota" name="nota" placeholder="Qué cambió" autofocus>`, { id: 'v-nota', optional: true, help: 'Aparece en el historial de versiones.' })}</form>`, btn('Cancelar', { act: 'cancelSave' }) + btn(`Guardar versión ${vig().v + 1}`, { variant: 'primary', icon: 'save', type: 'submit', attrs: ' form="f-ver"' }), { closeAct: 'cancelSave' });
    if (S.save === 'nueva') h += Z.dialog('Guardar consulta', `<form id="f-new" data-submit-act="doSave" class="zd-form">${field('Nombre', `<input class="zd-input" id="n-nom" name="nombre" required autofocus>`, { id: 'n-nom' })}${field('Descripción', `<input class="zd-input" id="n-desc" name="descripcion">`, { id: 'n-desc', optional: true })}</form>`, btn('Cancelar', { act: 'cancelSave' }) + btn('Guardar consulta', { variant: 'primary', icon: 'save', type: 'submit', attrs: ' form="f-new"' }), { closeAct: 'cancelSave' });
    return h;
  }

  Z.screens.consultas = {
    reset: () => { S = fresh(); },
    render(ctx) {
      const head = Z.pageHead({ ctx, scope: 'tenant', title: 'Consultas', change: 'CH-04 · CH-05 · CH-11 · CH-25', estado: 'EXISTE', desc: 'SQL de solo lectura sobre una conexión del tenant activo. El resultado aparece debajo del editor.' });
      if (!ctx.tenant) return head + Z.noTenant('Las conexiones y las consultas guardadas');
      return `<section data-change="CH-04 CH-05 CH-11 CH-25" data-estado="existe" style="display:grid;gap:var(--space-8)">${head}${Z.frozenBanner(ctx)}${S.notice ? banner('ok', esc(S.notice), '', btn('Cerrar aviso', { iconOnly: true, size: 'sm', variant: 'ghost', icon: 'x', act: 'clearNotice' })) : ''}
        <div class="zd-split">${guardadas(ctx)}<div style="display:grid;gap:var(--space-6);min-width:0">${editor(ctx)}<section aria-label="Resultado" aria-live="polite" id="q-result">${resultado(ctx)}</section></div></div></section>${overlays(ctx)}`;
    },
    on: {
      run: (el, ctx) => { if (ctx.frozen) return false; S.run = 'running'; S.page = 1; setTimeout(() => { S.run = S.sim; Z.render(); document.getElementById('q-result')?.focus?.(); }, 600); },
      sim: el => { S.sim = el.value; S.run = el.value; S.page = 1; },
      page: el => { S.page = Number(el.dataset.arg); },
      perPage: el => { S.perPage = Number(el.value); S.page = 1; },
      sql: el => { S.sql = el.value; return false; },
      param: el => { S.params[el.dataset.arg][el.dataset.k] = el.value; return el.tagName === 'SELECT' ? undefined : false; },
      addParam: () => { S.params.push({ nombre: 'nuevo', tipo: 'texto', valor: '' }); },
      delParam: el => { S.params.splice(Number(el.dataset.arg), 1); },
      load: el => { S.loaded = el.dataset.arg; S.sql = D.sql; S.run = null; S.drawer = false; },
      nueva: () => { S.loaded = null; S.sql = ''; S.params = []; S.run = null; S.drawer = false; },
      versiones: () => { S.drawer = !S.drawer; S.compare = null; },
      compare: el => { S.compare = Number(el.dataset.arg); },
      closeCompare: () => { S.compare = null; },
      askRestore: el => { S.restore = Number(el.dataset.arg); },
      cancelRestore: () => { S.restore = null; },
      doRestore: () => { const n = vig().v + 1, src = S.versiones.find(x => x.v === S.restore); S.versiones[0].sql = S.versiones[0].sql || S.sql; S.versiones.unshift({ v: n, fecha: '09/10 11:02', nota: 'Restaurada desde la versión ' + S.restore, sql: src.sql }); S.sql = src.sql; S.notice = `Se creó la versión ${n} a partir de la versión ${S.restore}.`; S.restore = null; S.compare = null; },
      openSave: el => { S.save = el.dataset.arg; },
      cancelSave: () => { S.save = null; },
      doSave: (form) => { if (S.save === 'version') { const n = vig().v + 1; S.versiones[0].sql = S.versiones[0].sql || S.sql; S.versiones.unshift({ v: n, fecha: '09/10 11:00', nota: form.elements.nota.value, sql: S.sql }); S.notice = `Guardaste la versión ${n}. Es la vigente.`; } else { if (!form.elements.nombre.value.trim()) { form.elements.nombre.setAttribute('aria-invalid', 'true'); form.elements.nombre.focus(); return false; } S.notice = `Guardaste «${form.elements.nombre.value}».`; } S.save = null; },
      clearNotice: () => { S.notice = null; },
      close: () => { if (S.restore) S.restore = null; else if (S.save) S.save = null; else if (S.compare) S.compare = null; else S.drawer = false; }
    }
  };
})();
