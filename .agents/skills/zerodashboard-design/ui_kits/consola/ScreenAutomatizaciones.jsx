(() => {
const { Icon, Button, Field, DataTable, Banner, StatusBadge, TemplatePicker, Stepper } = window.ZeroDashboardDesignSystem_589ca0;
const D = window.DATOS_MUESTRA;
const plantillaNombre = id => (D.plantillas.find(p => p.id === id) || {}).nombre;

function CorreoPreview({ plantilla }) {
  return (
    <div data-change="CH-21" data-estado="pendiente" style={{ display: 'grid', gap: 'var(--space-4)' }}>
      <span className="zd-label">Formato del correo (N3)</span>
      <div style={{ border: '1px solid var(--border-1)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: '#fff', color: '#13171b' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #e4e8eb', fontSize: 12, color: '#4a535c', display: 'grid', gap: 2 }}>
          <span><b>Asunto:</b> {plantilla === 'reporte_diario' ? 'Resumen del 03/10 — Almacén Don Tito' : '3 productos con poco stock — Almacén Don Tito'}</span>
          <span><b>Para:</b> compras@dontito.com.ar</span>
        </div>
        <div style={{ padding: 14, display: 'grid', gap: 8, fontSize: 13 }}>
          <b style={{ fontSize: 15 }}>{plantilla === 'reporte_diario' ? 'Así te fue ayer' : 'Estos productos están por debajo del mínimo'}</b>
          <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}><tbody>
            {D.productos.slice(0, 3).map(p => <tr key={p.sku}><td style={{ padding: '4px 0', borderBottom: '1px solid #e4e8eb' }}>{p.nombre}</td><td style={{ padding: '4px 0', borderBottom: '1px solid #e4e8eb', textAlign: 'right' }}>{p.stock_actual} / mín. {p.stock_minimo}</td></tr>)}
          </tbody></table>
          <span style={{ fontSize: 11, color: '#5f6973' }}>Versión completa en ui_kits/correo.</span>
        </div>
      </div>
    </div>
  );
}

function Alta({ onDone, onCancel }) {
  const [step, setStep] = React.useState(0);
  const [tpl, setTpl] = React.useState('stock_fisico');
  return (
    <section data-screen-label="Alta de automatización" data-change="CH-21" data-estado="pendiente" style={{ display: 'grid', gap: 'var(--space-8)' }}>
      <PageHeader eyebrow="Automatizaciones" title="Nueva automatización" desc="Patrón fijo: consulta → condición → notificación → registro." change="CH-21" estado="PENDIENTE"
        actions={<Button variant="ghost" icon="x" onClick={onCancel}>Cancelar</Button>} />
      <Stepper steps={['Elegir plantilla', 'Completar parámetros']} current={step} />
      {step === 0 ? (
        <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
          <TemplatePicker value={tpl} onChange={setTpl} options={D.plantillas} legend="Catálogo de plantillas" />
          <div className="zd-form-actions"><Button variant="primary" iconRight="arrow-right" onClick={() => setStep(1)}>Continuar</Button></div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 'var(--space-8)', alignItems: 'start' }}>
          <div className="zd-card zd-form">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}><StatusBadge estado="borrador" label={plantillaNombre(tpl)} icon="file-check" /><Button size="sm" variant="ghost" onClick={() => setStep(0)}>Cambiar plantilla</Button></div>
            <Field label="Nombre" defaultValue="Stock bajo — Sucursal Norte" />
            <Field label="Consulta guardada" as="select" defaultValue="q_31" help="Solo se listan consultas guardadas del tenant activo.">{D.consultasGuardadas.map(c => <option key={c.id} value={c.id}>{c.nombre} (v{c.version})</option>)}</Field>
            <div className="zd-form-row"><Field label="Umbral (:umbral)" type="number" defaultValue={25} suffix="unidades" /><Field label="Depósito (:deposito)" optional defaultValue="Sucursal Norte" /></div>
            <div className="zd-form-row"><Field label="Frecuencia" as="select" defaultValue="diaria"><option value="diaria">Todos los días</option><option>Lunes a sábado</option><option>Cada 2 horas</option></Field><Field label="Hora" type="time" defaultValue="08:00" /></div>
            <Field label="Enviar a" type="email" defaultValue="compras@dontito.com.ar" help="Separá varios destinatarios con coma." />
            <Banner inline tone="info" title="Se ejecuta por horario">La primera ejecución será mañana 04/10 a las 08:00.</Banner>
            <div className="zd-form-actions"><Button icon="arrow-left" onClick={() => setStep(0)}>Volver</Button><Button variant="primary" icon="check" onClick={onDone}>Crear automatización</Button></div>
          </div>
          <CorreoPreview plantilla={tpl} />
        </div>
      )}
    </section>
  );
}

function ScreenAutomatizaciones() {
  const [mode, setMode] = React.useState('lista');
  const [created, setCreated] = React.useState(false);
  if (mode === 'alta') return <Alta onCancel={() => setMode('lista')} onDone={() => { setCreated(true); setMode('lista'); }} />;
  const cols = [
    { key: 'nombre', label: 'Automatización', render: (v, r) => <span><b style={{ fontWeight: 600 }}>{v}</b><span className="zd-meta" style={{ display: 'block' }}>{plantillaNombre(r.plantilla)} · {r.consulta}</span></span> },
    { key: 'horario', label: 'Horario' }, { key: 'destino', label: 'Destino', align: 'mono' },
    { key: 'ultima', label: 'Última ejecución', render: (v, r) => <span style={{ display: 'grid', gap: 2, justifyItems: 'start' }}><StatusBadge estado={v} attempt={v === 'reintentando' ? '2/3' : undefined} /><span className="zd-meta">{r.ultimaHora}</span></span> },
    { key: 'proxima', label: 'Próxima', align: 'mono' },
    { key: 'estado', label: 'Estado', render: v => <StatusBadge estado={v} /> }];
  return (
    <section data-screen-label="Automatizaciones" data-change="CH-12 CH-13" data-estado="existe" style={{ display: 'grid', gap: 'var(--space-6)' }}>
      <PageHeader eyebrow="Automatización" title="Automatizaciones" desc="Ejecuciones programadas del tenant activo. No hay disparo por webhook." change="CH-12 · CH-13" estado="EXISTE"
        actions={<Button variant="primary" icon="plus" onClick={() => setMode('alta')}>Nueva automatización</Button>} />
      {created ? <Banner tone="ok" title="Automatización creada" onDismiss={() => setCreated(false)}>«Stock bajo — Sucursal Norte» corre por primera vez mañana a las 08:00.</Banner> : null}
      <DataTable caption="Automatizaciones" columns={cols} rows={D.automatizaciones} rowKey="id" />
    </section>
  );
}
window.ScreenAutomatizaciones = ScreenAutomatizaciones;
})();
