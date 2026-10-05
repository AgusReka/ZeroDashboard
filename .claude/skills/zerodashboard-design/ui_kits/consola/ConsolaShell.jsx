(() => {
const { Icon, Button, TenantBar, ConnectivityIndicator } = window.ZeroDashboardDesignSystem_589ca0;

const NAV = [
  { group: 'Datos', items: [
    { id: 'conexion', label: 'Conexión y mapeo', icon: 'plug' },
    { id: 'contrato', label: 'Contrato canónico', icon: 'layers' },
    { id: 'consultas', label: 'Consultas', icon: 'database' }] },
  { group: 'Automatización', items: [
    { id: 'automatizaciones', label: 'Automatizaciones', icon: 'calendar-clock' },
    { id: 'ejecuciones', label: 'Ejecuciones', icon: 'activity' }] },
  { group: 'Operación', items: [
    { id: 'agentes', label: 'Agentes y conectividad', icon: 'server' },
    { id: 'frescura', label: 'Frescura', icon: 'timer' },
    { id: 'auditoria', label: 'Auditoría', icon: 'scroll-text' },
    { id: 'alta', label: 'Tiempos de alta', icon: 'gauge' }] }
];

const shellStyles = {
  grid: { display: 'grid', gridTemplateColumns: 'var(--sidebar-w) minmax(0,1fr)', minHeight: 'calc(100vh - var(--tenantbar-h))' },
  side: { borderRight: '1px solid var(--border-1)', background: 'var(--surface-card)', padding: 'var(--space-6) var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', position: 'sticky', top: 'var(--tenantbar-h)', height: 'calc(100vh - var(--tenantbar-h))', overflow: 'auto' },
  brand: { display: 'grid', padding: '0 var(--space-4)' },
  navItem: (on) => ({ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', width: '100%', height: 32, padding: '0 var(--space-4)', border: 0, borderRadius: 'var(--radius-md)', background: on ? 'var(--surface-selected)' : 'transparent', color: on ? 'var(--accent-text)' : 'var(--text-2)', font: 'inherit', fontSize: 'var(--text-sm)', fontWeight: on ? 600 : 500, cursor: 'pointer', textAlign: 'left' }),
  main: { padding: 'var(--space-8) var(--space-9)', maxWidth: 'var(--content-max)', width: '100%', display: 'grid', gap: 'var(--space-8)', alignContent: 'start' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(12,15,18,.45)', display: 'grid', placeItems: 'center', zIndex: 100 }
};

function Sidebar({ current, onNav, theme, onTheme }) {
  return (
    <nav style={shellStyles.side} aria-label="Secciones de la consola">
      <div style={shellStyles.brand}><span style={{ fontWeight: 700, fontSize: 'var(--text-md)', letterSpacing: '-.02em' }}>ZeroDashboard</span><span className="zd-eyebrow">Consola · Implementador</span></div>
      {NAV.map(g => (
        <div key={g.group} style={{ display: 'grid', gap: 2 }}>
          <span className="zd-eyebrow" style={{ padding: '0 var(--space-4) var(--space-3)' }}>{g.group}</span>
          {g.items.map(it => (
            <button key={it.id} style={shellStyles.navItem(current === it.id)} aria-current={current === it.id ? 'page' : undefined} onClick={() => onNav(it.id)}><Icon name={it.icon} />{it.label}</button>
          ))}
        </div>
      ))}
      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: '0 var(--space-4)' }}>
        <Icon name="user" /><span className="zd-meta" style={{ flex: 1 }}>lucia@zerodashboard</span>
        <Button size="sm" variant="ghost" iconOnly icon={theme === 'dark' ? 'sun' : 'moon'} label="Cambiar modo claro/oscuro" onClick={onTheme} />
      </div>
    </nav>
  );
}

function PageHeader({ eyebrow, title, desc, actions, change, estado }) {
  return (
    <header style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 260, display: 'grid', gap: 'var(--space-2)' }}>
        {eyebrow ? <span className="zd-eyebrow">{eyebrow}</span> : null}
        <h1 className="zd-h1">{title}</h1>
        {desc ? <p className="zd-muted" style={{ margin: 0, fontSize: 'var(--text-sm)' }}>{desc}</p> : null}
      </div>
      {change ? <span className="zd-tag" title="Change y estado de diseño">{change} · {estado}</span> : null}
      {actions ? <div style={{ display: 'flex', gap: 'var(--space-4)' }}>{actions}</div> : null}
    </header>
  );
}

function Modal({ title, children, actions, onClose }) {
  return (
    <div style={shellStyles.overlay} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="zd-card" style={{ width: 'min(480px, 92vw)', boxShadow: 'var(--shadow-3)', display: 'grid', gap: 'var(--space-6)' }} onClick={e => e.stopPropagation()}>
        <h2 className="zd-h2">{title}</h2>
        {children}
        <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'flex-end' }}>{actions}</div>
      </div>
    </div>
  );
}

function TenantSwitcher({ tenants, current, onPick, onClose }) {
  const [sel, setSel] = React.useState(current.id);
  const t = tenants.find(x => x.id === sel);
  return (
    <Modal title="Cambiar tenant activo" onClose={onClose} actions={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" disabled={sel === current.id} onClick={() => onPick(t)}>Operar sobre {t.nombre}</Button></>}>
      <div style={{ display: 'grid', gap: 'var(--space-3)' }} role="radiogroup" aria-label="Tenants">
        {tenants.map(x => (
          <label key={x.id} className="zd-template" style={{ flexDirection: 'row', alignItems: 'center', padding: 'var(--space-5)', gap: 'var(--space-5)' }}>
            <input type="radio" name="tenant" checked={sel === x.id} onChange={() => setSel(x.id)} />
            <Icon name="building-2" />
            <span style={{ flex: 1 }}><span className="zd-template__name">{x.nombre}</span> <span className="zd-tag">{x.id}</span></span>
            <ConnectivityIndicator estado={x.agente} />
          </label>
        ))}
      </div>
      <p className="zd-meta" style={{ margin: 0 }}>Todo lo que hagas después del cambio se aplica al tenant elegido. La barra violeta muestra siempre cuál es.</p>
    </Modal>
  );
}

function ConsolaShell({ tenant, tenants, onTenant, current, onNav, children }) {
  const [switching, setSwitching] = React.useState(false);
  const [theme, setTheme] = React.useState(document.documentElement.dataset.theme || 'light');
  const toggle = () => { const n = theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = n; setTheme(n); };
  return (
    <>
      <TenantBar tenant={tenant} onChange={() => setSwitching(true)}>
        <ConnectivityIndicator estado={tenant.agente} ultimoLatido={tenant.latido} onDark />
      </TenantBar>
      <div style={shellStyles.grid}>
        <Sidebar current={current} onNav={onNav} theme={theme} onTheme={toggle} />
        <main style={shellStyles.main}>{children}</main>
      </div>
      {switching ? <TenantSwitcher tenants={tenants} current={tenant} onClose={() => setSwitching(false)} onPick={t => { onTenant(t); setSwitching(false); }} /> : null}
    </>
  );
}

Object.assign(window, { ConsolaShell, PageHeader, Modal, NAV });
})();
