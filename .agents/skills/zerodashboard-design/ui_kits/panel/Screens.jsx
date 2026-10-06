(() => {
const { Icon, Button, Field, Banner, AutomationCard, StatusBadge, DataTable } = window.ZeroDashboardDesignSystem_589ca0;
const D = window.DATOS_MUESTRA;

function ActivarFrescura({ auto, onClose, onActivar }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(12,15,18,.45)', display: 'grid', placeItems: 'center', zIndex: 100, padding: 'var(--space-6)' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="frescura-t" className="zd-card" data-change="CH-26" data-estado="pendiente" style={{ width: 'min(520px,100%)', boxShadow: 'var(--shadow-3)', display: 'grid', gap: 'var(--space-6)' }} onClick={e => e.stopPropagation()}>
        <h2 className="zd-h2" id="frescura-t">Antes de activar «{auto.titulo}»</h2>
        <Banner tone="warn" title="Los datos de tu tienda llegan con atraso">Hoy la información se actualizó {D.frescuraPanel.ultimaActualizacion}. Este aviso necesita datos de hace menos de {auto.tolerancia} para ser confiable, así que podría avisarte tarde.</Banner>
        <p style={{ margin: 0 }}>Podés activarlo igual. Si la actualización mejora, el aviso empieza a funcionar a tiempo sin que hagas nada.</p>
        <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Button onClick={onClose}>Ahora no</Button>
          <Button variant="primary" onClick={onActivar}>Activar de todos modos</Button>
        </div>
      </div>
    </div>
  );
}

function ScreenMisAutomatizaciones({ onAjustar, onResultado }) {
  const [items, setItems] = React.useState(D.panel);
  const [activando, setActivando] = React.useState(null);
  const [ok, setOk] = React.useState(null);
  const activas = items.filter(a => !a.disponible);
  const disponibles = items.filter(a => a.disponible);
  const activar = a => { setItems(xs => xs.map(x => x.id === a.id ? Object.assign({}, x, { disponible: false, estado: 'activa', ultima: 'Todavía no se ejecutó', proxima: 'Mañana 08:00', frecuencia: 'Todos los días' }) : x)); setActivando(null); setOk(a.titulo); };
  return (
    <section data-screen-label="Mis automatizaciones" data-change="CH-22" data-estado="pendiente" style={{ display: 'grid', gap: 'var(--gap-section)' }}>
      <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
        <h1 className="zd-h1">Mis automatizaciones</h1>
        <p className="zd-muted" style={{ margin: 0 }}>Lo que revisamos por vos y te mandamos por correo.</p>
      </div>
      {ok ? <Banner tone="ok" title={'Activaste «' + ok + '»'} onDismiss={() => setOk(null)}>La primera revisión es mañana a las 08:00.</Banner> : null}
      <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
        <h2 className="zd-h2">Activas</h2>
        {activas.map(a => (
          <AutomationCard key={a.id} titulo={a.titulo} descripcion={a.descripcion} estado={a.estado} ultima={a.ultima} proxima={a.proxima} frecuencia={a.frecuencia}
            alert={a.falla ? <div data-change="CH-22" data-estado="pendiente"><Banner inline tone="error" title={a.falla.titulo}>{a.falla.cuerpo}</Banner></div> : null}>
            <Button icon="sliders-horizontal" onClick={() => onAjustar(a)}>Ajustar</Button>
            <Button variant="ghost" icon="table" onClick={() => onResultado(a)}>Ver último resultado</Button>
          </AutomationCard>
        ))}
      </div>
      {disponibles.length ? (
        <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
          <h2 className="zd-h2">Disponibles para activar</h2>
          {disponibles.map(a => <AutomationCard key={a.id} disponible titulo={a.titulo} descripcion={a.descripcion}><Button variant="primary" icon="plus" onClick={() => setActivando(a)}>Activar</Button></AutomationCard>)}
        </div>
      ) : null}
      {activando ? <ActivarFrescura auto={activando} onClose={() => setActivando(null)} onActivar={() => activar(activando)} /> : null}
    </section>
  );
}

function ScreenAjustes({ auto, onVolver }) {
  const [saved, setSaved] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const guardar = e => { e.preventDefault(); const u = Number(e.target.elements.umbral ? e.target.elements.umbral.value : 1); if (u < 1) { setErr('El mínimo tiene que ser 1 o más.'); setSaved(false); return; } setErr(null); setSaved(true); };
  const esStock = auto.id === 'au_11';
  return (
    <section data-screen-label="Ajustes" data-change="CH-23" data-estado="pendiente" style={{ display: 'grid', gap: 'var(--gap-section)', maxWidth: 640 }}>
      <BackLink onClick={onVolver}>Mis automatizaciones</BackLink>
      <div style={{ display: 'grid', gap: 'var(--space-3)' }}><h1 className="zd-h1">Ajustar «{auto.titulo}»</h1><p className="zd-muted" style={{ margin: 0 }}>Los cambios rigen desde la próxima revisión.</p></div>
      {saved ? <Banner tone="ok" title="Guardamos tus cambios" onDismiss={() => setSaved(false)}>Se aplican desde la próxima revisión: {auto.proxima.toLowerCase()}.</Banner> : null}
      <form className="zd-card zd-form" onSubmit={guardar} noValidate>
        {esStock ? <Field label="Avisarme cuando un producto tenga menos de" name="umbral" type="number" min={1} defaultValue={auto.umbral} suffix="unidades" help="Vale para todos tus productos." error={err} /> : null}
        <div className="zd-form-row">
          <Field label="Hora de envío" as="select" defaultValue={auto.hora}><option>07:00</option><option>07:30</option><option>08:00</option><option>09:00</option><option>12:00</option><option>18:00</option></Field>
          <Field label="Días" as="select" defaultValue={auto.dias}><option value="todos">Todos los días</option><option value="lun-sab">Lunes a sábado</option><option value="lun-vie">Lunes a viernes</option></Field>
        </div>
        <Field label="Enviar a" type="email" defaultValue={auto.correo} help="Podés poner varios correos separados por coma." />
        <div className="zd-form-actions"><Button type="submit" variant="primary" icon="check">Guardar cambios</Button><Button onClick={onVolver}>Cancelar</Button></div>
      </form>
    </section>
  );
}

function Barras({ rows }) {
  const max = Math.max.apply(null, rows.map(r => r.stock_minimo));
  return (
    <figure style={{ margin: 0, display: 'grid', gap: 'var(--space-5)' }} aria-label="Stock actual comparado con el mínimo">
      {rows.map(r => (
        <div key={r.sku} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px,200px) 1fr auto', gap: 'var(--space-5)', alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--text-sm)' }}>{r.nombre}</span>
          <span style={{ position: 'relative', height: 14, background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)' }}>
            <span style={{ position: 'absolute', inset: '0 auto 0 0', width: ((r.stock_actual || 0) / max * 100) + '%', background: 'var(--warn)', borderRadius: 'var(--radius-sm)' }} />
            <span title="Mínimo" style={{ position: 'absolute', top: -3, bottom: -3, left: (r.stock_minimo / max * 100) + '%', width: 2, background: 'var(--text-1)' }} />
          </span>
          <span className="zd-num" style={{ fontSize: 'var(--text-sm)', minWidth: 70, textAlign: 'right' }}>{r.stock_actual ?? '—'} / {r.stock_minimo}</span>
        </div>
      ))}
      <figcaption className="zd-meta" style={{ display: 'flex', gap: 'var(--space-6)' }}><span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--warn)', borderRadius: 2, marginRight: 6 }} />Stock actual</span><span><span style={{ display: 'inline-block', width: 2, height: 10, background: 'var(--text-1)', marginRight: 6 }} />Mínimo</span></figcaption>
    </figure>
  );
}

function ScreenResultado({ auto, onVolver }) {
  const [vista, setVista] = React.useState('tabla');
  const rows = D.productos.filter(p => p.stock_actual !== null && p.stock_actual < 20).slice(0, 5);
  const cols = [{ key: 'nombre', label: 'Producto' }, { key: 'deposito', label: 'Dónde' }, { key: 'stock_actual', label: 'Quedan', align: 'num' }, { key: 'stock_minimo', label: 'Mínimo', align: 'num' }];
  return (
    <section data-screen-label="Último resultado" data-change="CH-27" data-estado="pendiente" style={{ display: 'grid', gap: 'var(--gap-section)' }}>
      <BackLink onClick={onVolver}>Mis automatizaciones</BackLink>
      <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240, display: 'grid', gap: 'var(--space-3)' }}><h1 className="zd-h1">Último resultado</h1><p className="zd-muted" style={{ margin: 0 }}>{auto.titulo} · hoy 08:00 · {rows.length} productos con poco stock</p></div>
        <div role="group" aria-label="Vista" style={{ display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-1)', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)' }}>
          {[['tabla', 'Tabla', 'table'], ['grafico', 'Gráfico', 'chart-column']].map(([k, l, i]) => <Button key={k} variant={vista === k ? 'secondary' : 'ghost'} icon={i} aria-pressed={vista === k} onClick={() => setVista(k)}>{l}</Button>)}
        </div>
      </div>
      {vista === 'tabla' ? <DataTable caption="Productos con poco stock" columns={cols} rows={rows} nullLabel="—" /> : <div className="zd-card"><Barras rows={rows} /></div>}
    </section>
  );
}

Object.assign(window, { ScreenMisAutomatizaciones, ScreenAjustes, ScreenResultado });
})();
