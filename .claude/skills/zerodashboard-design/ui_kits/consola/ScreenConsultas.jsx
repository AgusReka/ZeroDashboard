(() => {
const { Icon, Button, Field, DataTable, Banner, LoadingState, EmptyState, StatusBadge } = window.ZeroDashboardDesignSystem_589ca0;
const D = window.DATOS_MUESTRA;

const RESULT_COLS = [
  { key: 'sku', label: 'sku', align: 'mono' }, { key: 'nombre', label: 'nombre' }, { key: 'deposito', label: 'deposito' },
  { key: 'stock_actual', label: 'stock_actual', align: 'num' }, { key: 'stock_minimo', label: 'stock_minimo', align: 'num' }];

function Resultado({ sim, page, setPage }) {
  if (sim === 'cargando') return <div className="zd-card" style={{ padding: 0 }}><LoadingState label="Ejecutando consulta…" /></div>;
  if (sim === 'rechazo') return <Banner tone="error" title="La consulta fue rechazada: solo se permiten lecturas">Se encontró <span className="zd-mono">UPDATE</span> en la línea 3. Usá <span className="zd-mono">SELECT</span> o <span className="zd-mono">WITH … SELECT</span>.<pre>ERROR  sentencia_no_lectura  línea 3, columna 1</pre></Banner>;
  if (sim === 'timeout') return <Banner tone="error" title="La consulta superó el tiempo máximo (30 s)" actions={<Button size="sm" icon="refresh-cw">Reintentar</Button>}>La base del tenant no respondió a tiempo. Probá acotar el rango o agregar un filtro por índice.<pre>ERROR  timeout  30.000 ms  ten_7f3a</pre></Banner>;
  if (sim === 'vacio') return <div className="zd-card" style={{ padding: 0 }}><EmptyState icon="table" title="La consulta no devolvió filas">Con <span className="zd-mono">:umbral = 25</span> ningún producto está por debajo del mínimo.</EmptyState></div>;
  return (
    <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
      {sim === 'tope' ? <Banner inline tone="warn" title="Tope de filas alcanzado">Se muestran las primeras 1.000 filas de 4.812. Agregá un filtro para ver el resto.</Banner> : null}
      <DataTable compact caption="Resultado de la consulta" columns={RESULT_COLS} rows={D.productos} page={page} pageSize={8} total={sim === 'tope' ? 1000 : D.productos.length} onPageChange={setPage} footerNote={<span className="zd-num">1,8 s · solo lectura</span>} />
    </div>
  );
}

function Versiones({ onClose }) {
  return (
    <aside className="zd-card" data-change="CH-25" data-estado="pendiente" style={{ display: 'grid', gap: 'var(--space-5)', alignContent: 'start' }}>
      <div className="zd-card__head"><div><span className="zd-eyebrow">CH-25 · pendiente</span><h2 className="zd-h2">Versiones</h2></div><Button size="sm" variant="ghost" iconOnly icon="x" label="Cerrar versiones" onClick={onClose} /></div>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 'var(--space-2)' }}>
        {D.versiones.map((v, i) => (
          <li key={v.v} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 'var(--space-4)', alignItems: 'center', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', background: i === 0 ? 'var(--surface-selected)' : 'transparent' }}>
            <span className="zd-tag">v{v.v}</span>
            <span><span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'block' }}>{v.nota}</span><span className="zd-meta">{v.fecha} · {v.autor}</span></span>
            {i === 0 ? <StatusBadge estado="activa" label="Actual" /> : <Button size="sm" variant="ghost" icon="git-compare">Comparar</Button>}
          </li>
        ))}
      </ol>
    </aside>
  );
}

function ScreenConsultas() {
  const [sel, setSel] = React.useState(D.consultasGuardadas[0].id);
  const [sim, setSim] = React.useState('exito');
  const [page, setPage] = React.useState(1);
  const [vers, setVers] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const q = D.consultasGuardadas.find(x => x.id === sel);
  const run = () => { setRunning(true); setTimeout(() => setRunning(false), 700); };
  return (
    <section data-screen-label="Consultas" data-change="CH-04 CH-05 CH-11" data-estado="existe" style={{ display: 'grid', gap: 'var(--space-8)' }}>
      <PageHeader eyebrow="Datos" title="Consultas" desc="Editor de solo lectura sobre la base del tenant activo. Se rechaza toda sentencia que no sea de lectura." change="CH-04 · CH-05 · CH-11" estado="EXISTE"
        actions={<Button variant="primary" icon="plus">Nueva consulta</Button>} />
      <div style={{ display: 'grid', gridTemplateColumns: vers ? '240px minmax(0,1fr) 300px' : '240px minmax(0,1fr)', gap: 'var(--space-6)', alignItems: 'start' }}>
        <aside data-change="CH-05" data-estado="existe" style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <span className="zd-eyebrow">Consultas guardadas</span>
          {D.consultasGuardadas.map(c => (
            <button key={c.id} onClick={() => setSel(c.id)} className="zd-card" style={{ textAlign: 'left', padding: 'var(--space-5)', cursor: 'pointer', font: 'inherit', color: 'inherit', borderColor: sel === c.id ? 'var(--accent)' : undefined, background: sel === c.id ? 'var(--surface-selected)' : undefined, boxShadow: 'none', display: 'grid', gap: 'var(--space-2)' }}>
              <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{c.nombre}</span>
              <span className="zd-meta">{c.descripcion}</span>
              <span className="zd-meta">v{c.version} · {c.editada}</span>
            </button>
          ))}
        </aside>
        <div style={{ display: 'grid', gap: 'var(--space-6)', minWidth: 0 }}>
          <div className="zd-card" style={{ display: 'grid', gap: 'var(--space-6)' }}>
            <div className="zd-form-row"><Field label="Nombre" defaultValue={q.nombre} key={'n' + sel} /><Field label="Descripción" optional defaultValue={q.descripcion} key={'d' + sel} /></div>
            <Field label="Consulta (solo lectura)" as="textarea" mono rows={7} defaultValue={D.sqlEjemplo} help="Parámetros con dos puntos: :umbral. Tope: 1.000 filas · 30 s." />
            <div data-change="CH-11" data-estado="existe" style={{ display: 'grid', gap: 'var(--space-4)' }}>
              <span className="zd-label">Parámetros declarados</span>
              {D.parametros.map(p => (
                <div key={p.nombre} style={{ display: 'grid', gridTemplateColumns: '140px 120px 1fr', gap: 'var(--space-5)', alignItems: 'end' }}>
                  <span className="zd-tag" style={{ height: 'var(--control-h)', fontSize: 'var(--text-sm)' }}>:{p.nombre}</span>
                  <Field label="Tipo" as="select" defaultValue={p.tipo}><option>entero</option><option>texto</option><option>fecha</option><option>decimal</option></Field>
                  <Field label={'Valor de prueba' + (p.requerido ? '' : '')} optional={!p.requerido} defaultValue={p.valor} placeholder="NULL" />
                </div>
              ))}
            </div>
            <div className="zd-form-actions">
              <Button variant="primary" icon="play" loading={running} onClick={run}>Ejecutar consulta</Button>
              <Button icon="save">Guardar</Button>
              <Button variant="ghost" icon="history" onClick={() => setVers(v => !v)} aria-pressed={vers}>Versiones</Button>
              <span style={{ flex: 1 }} />
              <label className="zd-meta" style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>Simular estado (mockup)
                <select className="zd-select" style={{ width: 150, minHeight: 28 }} value={sim} onChange={e => setSim(e.target.value)}>
                  <option value="exito">Éxito</option><option value="tope">Tope de filas</option><option value="vacio">Sin filas</option><option value="cargando">Cargando</option><option value="rechazo">Rechazo (no lectura)</option><option value="timeout">Timeout</option>
                </select></label>
            </div>
          </div>
          {running ? <div className="zd-card" style={{ padding: 0 }}><LoadingState label="Ejecutando consulta…" /></div> : <Resultado sim={sim} page={page} setPage={setPage} />}
        </div>
        {vers ? <Versiones onClose={() => setVers(false)} /> : null}
      </div>
    </section>
  );
}
window.ScreenConsultas = ScreenConsultas;
})();
