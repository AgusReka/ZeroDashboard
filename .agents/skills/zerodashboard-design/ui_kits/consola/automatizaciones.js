/* Automatizaciones — lista, alta en dos pasos, ejecuciones (CH-12, CH-13, CH-17a/b, CH-21). */
(function () {
  const Z = window.ZD, { D, esc, ic, badge, btn, banner, field, table } = Z;
  const fresh = () => ({ paso: 0, cx: null, tpl: 'stock_fisico', freq: 'diaria', hora: '08:00', desactivar: null, notice: null, filtro: '', sel: null, extra: {} });
  let S = fresh();
  const FREQ = { diaria: ['Todos los días', '*'], 'lun-vie': ['Lunes a viernes', '1-5'], 'lun-sab': ['Lunes a sábado', '1-6'], '2h': ['Cada 2 horas', null] };
  const cron = () => { if (S.freq === '2h') return ['0 */2 * * *', 'Cada 2 horas, a la hora en punto']; const [h, m] = S.hora.split(':').map(Number); return [`${m} ${h} * * ${FREQ[S.freq][1]}`, `${FREQ[S.freq][0]} a las ${S.hora}`]; };
  const autos = ctx => (D.automatizaciones[ctx.tenant.id] || []).map(a => Object.assign({}, a, S.extra[a.id] || {}));
  const crumbs = rest => `<a href="#automatizaciones">Automatizaciones</a>${ic('chevron-right')}<span>${rest}</span>`;
  const notifBadge = n => { const m = { enviada: ['ok', 'mail-check', 'Enviada'], 'no enviada': ['error', 'mail-x', 'No enviada'], 'sin datos': ['neutral', 'inbox', 'Sin datos: no se envió'], pendiente: ['info', 'clock', 'Pendiente'], 'no corresponde': ['neutral', 'circle-dashed', 'No corresponde'] }[n]; return `<span class="zd-badge${m[0] !== 'neutral' ? ' zd-badge--' + m[0] : ''}">${ic(m[1])}${esc(m[2])}</span>`; };

  function lista(ctx) {
    const rows = autos(ctx);
    const cols = [
      { label: 'Automatización', html: r => `<span style="display:grid;gap:2px"><b style="font-weight:600">${esc(r.plantilla)}</b><span class="zd-meta zd-mono">${esc(r.id)}</span></span>` },
      { label: 'Conexión', key: 'conexion', cls: 'is-mono' },
      { label: 'Cron', html: r => `<span style="display:grid;gap:2px"><span class="zd-mono" style="font-size:var(--text-xs)">${esc(r.cron)}</span><span class="zd-meta">${esc(r.cronTexto)}</span></span>` },
      { label: 'Estado', html: r => badge(r.estado) },
      { label: 'Alta', key: 'alta', cls: 'is-mono' },
      { label: 'Acciones', html: r => `<span style="display:flex;gap:var(--space-2)">${btn('Ver ejecuciones', { size: 'sm', variant: 'ghost', icon: 'activity', act: 'ver', arg: r.id })}${r.estado === 'activa' ? btn('Desactivar', { size: 'sm', variant: 'ghost', icon: 'power', act: 'askOff', arg: r.id, disabled: ctx.frozen }) : ''}</span>` }];
    return `<section data-change="CH-12 CH-13" data-estado="existe" style="display:grid;gap:var(--space-6)">${Z.pageHead({ ctx, scope: 'tenant', title: 'Automatizaciones', change: 'CH-12 · CH-13 · CH-21', estado: 'EXISTE', desc: 'Programadas por cron con el patrón fijo consulta → condición → notificación → registro.', actions: btn('Nueva automatización', { variant: 'primary', icon: 'plus', act: 'alta', disabled: ctx.frozen }) })}
      ${Z.frozenBanner(ctx)}${S.notice ? banner('ok', esc(S.notice), '', btn('Cerrar aviso', { iconOnly: true, size: 'sm', variant: 'ghost', icon: 'x', act: 'clearNotice' })) : ''}
      ${rows.length ? table(cols, rows, { caption: 'Automatizaciones del tenant activo' }) : `<div class="zd-card" style="padding:0">${Z.empty('calendar-clock', 'Este tenant no tiene automatizaciones', 'Creá la primera a partir de una plantilla del catálogo.', btn('Nueva automatización', { variant: 'primary', icon: 'plus', act: 'alta', disabled: ctx.frozen }))}</div>`}</section>
      ${S.desactivar ? Z.dialog(`Desactivar ${esc(S.desactivar)}`, `<p class="zd-dialog__body">Deja de ejecutarse desde ahora. El historial de ejecuciones se conserva y la automatización sigue en la lista como desactivada.</p>`, btn('Cancelar', { act: 'cancelOff' }) + btn('Desactivar ' + S.desactivar, { variant: 'danger', icon: 'power', act: 'doOff' }), { closeAct: 'cancelOff' }) : ''}`;
  }

  function alta(ctx) {
    const cx = D.conexiones[ctx.tenant.id] || [];
    const sel = S.cx || (cx[0] && cx[0].id);
    const steps = ['Conexión y plantilla', 'Parámetros, horario y destinatario'].map((s, i) => `<li class="zd-step${i < S.paso ? ' is-done' : ''}"${i === S.paso ? ' aria-current="step"' : ''}><span class="zd-step__n">${i < S.paso ? ic('check') : i + 1}</span><span>${s}</span></li>`).join('');
    let body;
    if (S.paso === 0) {
      const cards = D.plantillas.map(p => `<label class="zd-template"><input type="radio" name="tpl" value="${esc(p.id)}" data-change-act="tpl"${S.tpl === p.id ? ' checked' : ''}${p.motivo ? ' disabled aria-describedby="why-' + esc(p.id) + '"' : ''}><span class="zd-template__icon">${ic(p.icon)}</span><span class="zd-template__name">${esc(p.nombre)}</span><span class="zd-template__desc">${esc(p.descripcion)}</span><span class="zd-meta">Tolerancia de frescura: ${esc(p.tolerancia)}</span>${p.motivo ? `<span class="zd-template__why" id="why-${esc(p.id)}">${ic('lock')}${esc(p.motivo)}</span>` : ''}<span class="zd-template__check">${ic('circle-check')}</span></label>`).join('');
      body = `<div class="zd-card zd-form">
        <div style="max-width:420px">${field('Conexión', `<select class="zd-select" id="a-cx" data-change-act="cx">${cx.map(c => `<option value="${esc(c.id)}"${c.id === sel ? ' selected' : ''}>${esc(c.id)} · ${esc(c.nombre)}</option>`).join('')}</select>`, { id: 'a-cx', help: 'La plantilla se valida contra el mapeo de esta conexión.' })}</div>
        <fieldset class="zd-templates" data-change="CH-21" data-estado="existe"><legend class="zd-label" style="margin-bottom:var(--space-4)">Plantilla</legend>${cards}</fieldset>
        <div class="zd-form-actions">${btn('Cancelar', { variant: 'ghost', act: 'cancelAlta' })}<span style="flex:1"></span>${btn('Continuar', { variant: 'primary', act: 'paso', arg: 1 })}</div></div>`;
    } else {
      const p = D.plantillas.find(x => x.id === S.tpl);
      const [expr, txt] = cron();
      body = `<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,360px);gap:var(--space-6);align-items:start">
        <form class="zd-card zd-form" id="f-alta" data-submit-act="crear">
          <div style="display:flex;flex-wrap:wrap;align-items:center;gap:var(--space-4)"><span class="zd-badge">${ic(p.icon)}${esc(p.nombre)}</span><span class="zd-tag">${esc(sel)}</span>${btn('Cambiar', { size: 'sm', variant: 'ghost', act: 'paso', arg: 0 })}</div>
          <fieldset style="border:0;margin:0;padding:0;display:grid;gap:var(--space-5)"><legend class="zd-label" style="margin-bottom:var(--space-4)">Parámetros de la plantilla</legend>
            <div class="zd-form-row">${field('Umbral (:umbral)', `<div class="zd-input-group"><input class="zd-input" type="number" min="1" id="a-u" value="20"><span class="zd-input-suffix">unidades</span></div>`, { id: 'a-u' })}${field('Depósito (:deposito)', `<input class="zd-input" id="a-d" placeholder="Todos">`, { id: 'a-d', optional: true })}</div></fieldset>
          <div class="zd-form-row">${field('Frecuencia', `<select class="zd-select" id="a-f" data-change-act="freq">${Object.entries(FREQ).map(([k, v]) => `<option value="${k}"${k === S.freq ? ' selected' : ''}>${v[0]}</option>`).join('')}</select>`, { id: 'a-f' })}${field('Hora', `<input class="zd-input" type="time" id="a-h" value="${esc(S.hora)}" data-input-act="hora"${S.freq === '2h' ? ' disabled' : ''}>`, { id: 'a-h' })}</div>
          <div class="zd-cron" aria-live="polite">${ic('clock')}<span class="zd-meta">Cron resultante</span><code id="a-cron">${esc(expr)}</code><span id="a-cron-t" class="zd-muted" style="font-size:var(--text-sm)">${esc(txt)}</span></div>
          ${field('Destinatario', `<input class="zd-input" type="email" id="a-to" value="compras@dontito.com.ar">`, { id: 'a-to', help: 'Un correo. La notificación usa el formato de la plantilla.' })}
          <div class="zd-form-actions">${btn('Volver', { icon: 'arrow-left', act: 'paso', arg: 0 })}<span style="flex:1"></span>${btn('Crear automatización', { variant: 'primary', icon: 'check', type: 'submit' })}</div>
        </form>
        <figure style="margin:0;display:grid;gap:var(--space-3)"><figcaption class="zd-label">Vista previa del correo</figcaption><iframe src="../correo/reporte.html" title="Vista previa del correo" style="width:100%;height:520px;border:1px solid var(--border-1);border-radius:var(--radius-lg);background:#f0f2f4"></iframe></figure></div>`;
    }
    return `<section data-change="CH-21" data-estado="existe" style="display:grid;gap:var(--space-6)">${Z.pageHead({ ctx, scope: 'tenant', crumbs: crumbs('Nueva'), title: 'Nueva automatización', change: 'CH-21', estado: 'EXISTE' })}<ol class="zd-steps" aria-label="Pasos">${steps}</ol>${body}</section>`;
  }

  function ejecuciones(ctx, id) {
    const a = autos(ctx).find(x => x.id === id);
    if (!a) return `<div class="zd-card" style="padding:0">${Z.empty('circle-help', 'No existe esa automatización en este tenant', 'Puede que pertenezca a otro tenant.', btn('Volver a automatizaciones', { act: 'back' }))}</div>`;
    const rows = D.ejecuciones.filter(e => !S.filtro || e.estado === S.filtro);
    const cols = [
      { label: 'Inicio', key: 'inicio', cls: 'is-mono' }, { label: 'Fin', key: 'fin', cls: 'is-mono' }, { label: 'Duración', key: 'duracion', cls: 'is-num' },
      { label: 'Filas', key: 'filas', cls: 'is-num', html: r => r.filas == null ? '—' : esc(r.filas) },
      { label: 'Estado', html: r => badge(r.estado, r.estado === 'reintentando' ? `Reintentando (${r.intentos}/3)` : null) },
      { label: 'Notificación', html: r => notifBadge(r.notificacion) },
      { label: 'Intentos', key: 'intentos', cls: 'is-num' },
      { label: 'Error', html: r => r.error ? `<span class="zd-meta" style="display:block;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.error)}">${esc(r.error)}</span>` : '—' }];
    const e = S.sel && D.ejecuciones.find(x => x.id === S.sel);
    return `<section data-change="CH-13 CH-17a CH-17b" data-estado="existe" style="display:grid;gap:var(--space-6)">${Z.pageHead({ ctx, scope: 'tenant', crumbs: crumbs(esc(a.id)), title: 'Ejecuciones de ' + a.id, change: 'CH-13 · CH-17a · CH-17b', estado: 'EXISTE', desc: esc(a.plantilla) + ' · ' + esc(a.cronTexto), actions: btn('Actualizar', { icon: 'refresh-cw', act: 'noop' }) })}
      <div class="zd-card"><dl class="zd-kvgrid"><div><dt>Conexión</dt><dd class="zd-mono">${esc(a.conexion)}</dd></div><div><dt>Cron</dt><dd class="zd-mono">${esc(a.cron)}</dd></div><div><dt>Destinatario</dt><dd>${esc(a.destinatario)}</dd></div><div><dt>Estado</dt><dd>${badge(a.estado)}</dd></div></dl></div>
      <div style="display:flex;gap:var(--space-5);align-items:end"><div style="width:240px">${field('Estado', `<select class="zd-select" id="e-f" data-change-act="filtro"><option value="">Todos</option>${['ok', 'fallo', 'omitida', 'interrumpida', 'reintentando'].map(k => `<option value="${k}"${S.filtro === k ? ' selected' : ''}>${({ ok: 'OK', fallo: 'Fallo', omitida: 'Omitida por solapamiento', interrumpida: 'Interrumpida', reintentando: 'Reintentando' })[k]}</option>`).join('')}</select>`, { id: 'e-f' })}</div><span class="zd-meta" style="padding-bottom:8px">${rows.length} de ${D.ejecuciones.length} ejecuciones</span></div>
      ${table(cols, rows, { caption: 'Ejecuciones', rowAct: 'det', selected: S.sel, empty: 'No hay ejecuciones con ese estado.' })}</section>
      ${e ? Z.drawer(esc(e.id), 'Detalle de la ejecución', `${badge(e.estado)}<dl class="zd-kv"><dt>Inicio</dt><dd class="is-mono">${esc(e.inicio)}</dd><dt>Fin</dt><dd class="is-mono">${esc(e.fin)}</dd><dt>Duración</dt><dd>${esc(e.duracion)}</dd><dt>Filas</dt><dd>${e.filas == null ? '—' : esc(e.filas)}</dd><dt>Intentos</dt><dd>${esc(e.intentos)}</dd><dt>Notificación</dt><dd>${notifBadge(e.notificacion)}</dd></dl>${e.error ? `<div class="zd-field"><span class="zd-label">Error</span><pre class="zd-code" style="margin:0;white-space:pre-wrap">${esc(e.error)}</pre></div>` : ''}`) : ''}`;
  }

  Z.screens.automatizaciones = {
    reset: () => { S = fresh(); },
    render(ctx, sub) {
      if (!ctx.tenant) return Z.pageHead({ ctx, scope: 'tenant', title: 'Automatizaciones', change: 'CH-12 · CH-13 · CH-21', estado: 'EXISTE' }) + Z.noTenant('Las automatizaciones');
      if (sub === 'alta') return ctx.frozen ? lista(ctx) : alta(ctx);
      if (sub) return ejecuciones(ctx, sub);
      return lista(ctx);
    },
    on: {
      alta: () => { S.paso = 0; Z.go('automatizaciones/alta'); return false; },
      cancelAlta: () => { Z.go('automatizaciones'); return false; },
      back: () => { Z.go('automatizaciones'); return false; },
      paso: el => { S.paso = Number(el.dataset.arg); },
      cx: el => { S.cx = el.value; return false; },
      tpl: el => { S.tpl = el.value; },
      freq: el => { S.freq = el.value; },
      hora: el => { S.hora = el.value || '08:00'; const [e, t] = cron(); document.getElementById('a-cron').textContent = e; document.getElementById('a-cron-t').textContent = t; return false; },
      crear: () => { S.notice = `Se creó la automatización. Primera ejecución: ${cron()[1].toLowerCase()}.`; S.paso = 0; Z.go('automatizaciones'); return false; },
      ver: el => { S.sel = null; S.filtro = ''; Z.go('automatizaciones/' + el.dataset.arg); return false; },
      askOff: el => { S.desactivar = el.dataset.arg; },
      cancelOff: () => { S.desactivar = null; },
      doOff: () => { S.extra[S.desactivar] = { estado: 'inactiva' }; S.notice = `${S.desactivar} quedó desactivada.`; S.desactivar = null; },
      filtro: el => { S.filtro = el.value; },
      det: el => { S.sel = el.dataset.arg; },
      clearNotice: () => { S.notice = null; },
      noop: () => false,
      close: () => { S.desactivar = null; S.sel = null; }
    }
  };
})();
