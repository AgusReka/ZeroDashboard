(() => {
const { Icon, Button, Field, DataTable, Banner, StatusBadge } = window.ZeroDashboardDesignSystem_589ca0;
const D = window.DATOS_MUESTRA;

const DETALLE = {
  fallida: ['error', 'La ejecución falló'],
  reintentando: ['info', 'Reintentando (intento 2 de 3)'],
  omitida: ['neutral', 'Omitida por solapamiento'],
  interrumpida: ['warn', 'Ejecución interrumpida'],
  duplicado_evitado: ['neutral', 'Notificación duplicada evitada'],
  sin_datos: ['neutral', 'Sin datos: se envió el correo de "sin novedades"']
};

function Detalle({ e, onClose }) {
  const d = DETALLE[e.estado];
  return (
    <aside className="zd-card" aria-label={'Detalle de ' + e.id} style={{ display: 'grid', gap: 'var(--space-6)', alignContent: 'start', position: 'sticky', top: 'calc(var(--tenantbar-h) + 24px)' }}>
      <div className="zd-card__head"><div style={{ display: 'grid', gap: 'var(--space-2)' }}><span className="zd-tag">{e.id}</span><h2 className="zd-h2">{e.automatizacion}</h2></div><Button size="sm" variant="ghost" iconOnly icon="x" label="Cerrar detalle" onClick={onClose} /></div>
      <StatusBadge estado={e.estado} attempt={e.intento} />
      <dl className="zd-kv">
        <dt>Inicio</dt><dd className="zd-mono">{e.inicio}</dd>
        <dt>Fin</dt><dd className="zd-mono">{e.fin}</dd>
        <dt>Duración</dt><dd className="zd-num">{e.duracion}</dd>
        <dt>Filas</dt><dd className="zd-num">{e.filas === null || e.filas === undefined ? '—' : e.filas}</dd>
      </dl>
      {d ? <Banner inline tone={d[0]} title={d[1]} icon={e.estado === 'duplicado_evitado' ? 'copy-check' : e.estado === 'omitida' ? 'skip-forward' : undefined}>{e.estado === 'fallida' ? <pre>{e.error}</pre> : e.error || 'No hubo filas que cumplieran la condición.'}</Banner> : null}
      {e.estado === 'fallida' ? <Button icon="database">Abrir consulta</Button> : null}
    </aside>
  );
}

function ScreenEjecuciones() {
  const [sel, setSel] = React.useState(D.ejecuciones[0].id);
  const [filtro, setFiltro] = React.useState('');
  const [page, setPage] = React.useState(1);
  const rows = D.ejecuciones.filter(e => !filtro || e.estado === filtro);
  const e = D.ejecuciones.find(x => x.id === sel);
  const cols = [
    { key: 'id', label: 'Ejecución', align: 'mono' }, { key: 'automatizacion', label: 'Automatización' },
    { key: 'inicio', label: 'Inicio', align: 'mono' }, { key: 'fin', label: 'Fin', align: 'mono' },
    { key: 'duracion', label: 'Duración', align: 'num' }, { key: 'filas', label: 'Filas', align: 'num' },
    { key: 'estado', label: 'Estado', render: (v, r) => <StatusBadge estado={v} attempt={r.intento} /> }];
  return (
    <section data-screen-label="Ejecuciones" data-change="CH-13 CH-17a CH-17b CH-18" data-estado="existe" style={{ display: 'grid', gap: 'var(--space-6)' }}>
      <PageHeader eyebrow="Automatización" title="Ejecuciones" desc="Registro de cada corrida: inicio, fin, duración, filas, estado y error." change="CH-13 · CH-17a/b · CH-18" estado="EXISTE"
        actions={<Button icon="refresh-cw">Actualizar</Button>} />
      <div style={{ display: 'flex', gap: 'var(--space-5)', alignItems: 'end', flexWrap: 'wrap' }}>
        <div style={{ width: 240 }}><Field label="Automatización" as="select"><option>Todas</option>{D.automatizaciones.map(a => <option key={a.id}>{a.nombre}</option>)}</Field></div>
        <div style={{ width: 220 }}><Field label="Estado" as="select" value={filtro} onChange={ev => setFiltro(ev.target.value)}><option value="">Todos</option><option value="exitosa">Exitosa</option><option value="fallida">Fallida</option><option value="reintentando">Reintentando</option><option value="omitida">Omitida por solapamiento</option><option value="interrumpida">Interrumpida</option><option value="duplicado_evitado">Duplicado evitado</option><option value="sin_datos">Sin datos</option></Field></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: e ? 'minmax(0,1fr) 340px' : '1fr', gap: 'var(--space-6)', alignItems: 'start' }}>
        <DataTable compact caption="Ejecuciones" columns={cols} rows={rows} rowKey="id" selectedKey={sel} onRowClick={r => setSel(r.id)} page={page} pageSize={25} total={312} onPageChange={setPage} nullLabel="—" emptyMessage="No hay ejecuciones con ese estado." />
        {e ? <Detalle e={e} onClose={() => setSel(null)} /> : null}
      </div>
    </section>
  );
}
window.ScreenEjecuciones = ScreenEjecuciones;
})();
