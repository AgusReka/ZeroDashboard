(() => {
const { Icon, Button, Field, DataTable, Banner, StatusBadge, ConnectivityIndicator } = window.ZeroDashboardDesignSystem_589ca0;
const D = window.DATOS_MUESTRA;

function ScreenAgentes() {
  const [agentes, setAgentes] = React.useState(D.agentes.map(a => Object.assign({ revocado: false }, a)));
  const [revocar, setRevocar] = React.useState(null);
  const [nuevo, setNuevo] = React.useState(null);
  const cols = [
    { key: 'tenant', label: 'Tenant', render: (v, r) => <span><b style={{ fontWeight: 600 }}>{v}</b><span className="zd-meta" style={{ display: 'block' }}>{r.nombre}</span></span> },
    { key: 'estado', label: 'Conectividad', render: (v, r) => r.revocado ? <StatusBadge estado="pausada" icon="ban" label="Token revocado" /> : <ConnectivityIndicator estado={v} ultimoLatido={r.latido} /> },
    { key: 'token', label: 'Token', align: 'mono' }, { key: 'alta', label: 'Alta', align: 'mono' },
    { key: 'id', label: '', render: (v, r) => r.revocado ? null : <Button size="sm" variant="ghost" icon="key-round" onClick={() => setRevocar(r)}>Revocar</Button> }];
  return (
    <section data-screen-label="Agentes" data-change="CH-19b CH-19d1 CH-19d2" data-estado="pendiente" style={{ display: 'grid', gap: 'var(--space-6)' }}>
      <PageHeader eyebrow="Operación" title="Agentes y conectividad" desc="Cada tenant conecta su base mediante un agente. Vista global: todos los tenants." change="CH-19b · CH-19d1 · CH-19d2" estado="PENDIENTE"
        actions={<Button variant="primary" icon="plus" onClick={() => setNuevo('zd_ag_5Qm2-7c1e-Rk9p-03bd')}>Nuevo agente</Button>} />
      <div data-change="CH-19d2" data-estado="pendiente">
        <Banner tone="warn" title="2 automatizaciones en riesgo: Panadería La Espiga no responde hace 3 h">
          <span style={{ display: 'block', marginBottom: 'var(--space-3)' }}>Si el agente no vuelve antes de su horario, la ejecución va a fallar.</span>
          <table className="zd-table zd-table--compact" style={{ background: 'var(--surface-card)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}><thead><tr><th>Tenant</th><th>Automatización</th><th>Próxima ejecución</th></tr></thead>
            <tbody>{D.enRiesgo.map((r, i) => <tr key={i}><td>{r.tenant}</td><td>{r.automatizacion}</td><td className="is-mono">{r.proxima}</td></tr>)}</tbody></table>
        </Banner>
      </div>
      {nuevo ? <Banner tone="ok" title="Agente creado. Copiá el token ahora: no se vuelve a mostrar." onDismiss={() => setNuevo(null)} actions={<Button size="sm" icon="copy">Copiar</Button>}><pre>{nuevo}</pre></Banner> : null}
      <DataTable caption="Agentes" columns={cols} rows={agentes} rowKey="id" />
      {revocar ? <Modal title={'Revocar el token de ' + revocar.tenant} onClose={() => setRevocar(null)} actions={<><Button onClick={() => setRevocar(null)}>Cancelar</Button><Button variant="danger" icon="key-round" onClick={() => { setAgentes(a => a.map(x => x.id === revocar.id ? Object.assign({}, x, { revocado: true }) : x)); setRevocar(null); }}>Revocar token</Button></>}>
        <p style={{ margin: 0 }}>El agente <b>{revocar.nombre}</b> deja de conectarse de inmediato. Las automatizaciones de <b>{revocar.tenant}</b> fallarán hasta que se dé de alta un agente nuevo.</p>
      </Modal> : null}
    </section>
  );
}

function ScreenConexion() {
  const [test, setTest] = React.useState(null);
  const probar = () => { setTest('probando'); setTimeout(() => setTest('ok'), 800); };
  const cols = [
    { key: 'entidad', label: 'Entidad', align: 'mono' }, { key: 'campo', label: 'Campo canónico', align: 'mono' }, { key: 'tipo', label: 'Tipo' },
    { key: 'origen', label: 'Columna del tenant', render: v => v ? <span className="zd-mono">{v}</span> : <select className="zd-select" style={{ minHeight: 28, width: 200 }} aria-label="Elegir columna"><option>Elegir columna…</option><option>productos.minimo</option><option>stock.minimo</option></select> },
    { key: 'estado', label: 'Validación', render: (v, r) => v === 'ok' ? <StatusBadge estado="exitosa" label="Mapeado" /> : v === 'falta' ? <StatusBadge estado="fallida" label="Falta mapear" /> : <span style={{ display: 'grid', gap: 2, justifyItems: 'start' }}><StatusBadge estado="pausada" icon="ban" label="Inaplicable" /><span className="zd-meta">{r.motivo}</span></span> }];
  return (
    <section data-screen-label="Conexión y mapeo" data-change="CH-03 CH-09 CH-10" data-estado="parcial" style={{ display: 'grid', gap: 'var(--space-8)' }}>
      <PageHeader eyebrow="Datos" title="Conexión y mapeo" desc="Conexión de solo lectura a la base del tenant y mapeo de su esquema al contrato canónico." change="CH-03 · CH-09 · CH-10" estado="PARCIAL" />
      <div className="zd-card zd-form" data-change="CH-03" data-estado="parcial">
        <h2 className="zd-h2">Conexión</h2>
        <div className="zd-form-row"><Field label="Host" defaultValue="replica.dontito.local" mono /><Field label="Puerto" type="number" defaultValue={5432} /><Field label="Base" defaultValue="tienda" mono /></div>
        <div className="zd-form-row"><Field label="Usuario (solo lectura)" defaultValue="zd_lectura" mono /><Field label="Contraseña" type="password" defaultValue="secreto" /></div>
        <div className="zd-form-actions"><Button variant="primary" icon="plug" loading={test === 'probando'} onClick={probar}>Probar conexión</Button><Button icon="save">Guardar</Button></div>
        {test === 'ok' ? <Banner inline tone="ok" title="Conexión exitosa · 42 ms">El usuario tiene permisos de solo lectura. PostgreSQL 15.4 · 38 tablas visibles.</Banner> : null}
      </div>
      <div style={{ display: 'grid', gap: 'var(--space-5)' }} data-change="CH-09 CH-10" data-estado="parcial">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)' }}><h2 className="zd-h2" style={{ flex: 1 }}>Mapeo de esquema</h2><Button icon="file-check">Validar mapeo</Button></div>
        <Banner inline tone="warn" title="1 campo requerido sin mapear">Sin <span className="zd-mono">producto.stock_minimo</span> no se puede usar la plantilla «Alerta de stock físico».</Banner>
        <DataTable compact caption="Mapeo" columns={cols} rows={D.mapeo} />
      </div>
    </section>
  );
}

function ScreenSinMockup({ titulo, change, estado, desc }) {
  const { EmptyState } = window.ZeroDashboardDesignSystem_589ca0;
  return (
    <section data-screen-label={titulo} data-change={change} data-estado={estado.toLowerCase()} style={{ display: 'grid', gap: 'var(--space-6)' }}>
      <PageHeader eyebrow="Especificada, sin mockup" title={titulo} desc={desc} change={change} estado={estado} />
      <div className="zd-card" style={{ padding: 0 }}><EmptyState icon="file-text" title="Pantalla especificada sin mockup">La especificación (propósito, datos, estados y acciones) está en guidelines/pantallas.md. Componé la pantalla con DataTable, Field, Banner y StatusBadge.</EmptyState></div>
    </section>
  );
}
Object.assign(window, { ScreenAgentes, ScreenConexion, ScreenSinMockup });
})();
