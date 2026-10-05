(() => {
const { Icon, Button, Field, Banner } = window.ZeroDashboardDesignSystem_589ca0;

const panelStyles = {
  header: { position: 'sticky', top: 0, zIndex: 20, background: 'var(--surface-card)', borderBottom: '1px solid var(--border-1)' },
  headerIn: { maxWidth: 'var(--panel-max)', margin: '0 auto', padding: '0 var(--space-6)', minHeight: 60, display: 'flex', alignItems: 'center', gap: 'var(--space-5)' },
  main: { maxWidth: 'var(--panel-max)', margin: '0 auto', padding: 'var(--space-9) var(--space-6) var(--space-12)', display: 'grid', gap: 'var(--gap-section)' }
};

function PanelShell({ sesion, onSalir, children }) {
  return (
    <>
      <header style={panelStyles.header}>
        <div style={panelStyles.headerIn}>
          <span style={{ fontWeight: 700, fontSize: 'var(--text-lg)', letterSpacing: '-.02em' }}>ZeroDashboard</span>
          <span aria-hidden="true" style={{ width: 1, height: 20, background: 'var(--border-2)' }} />
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontWeight: 600, color: 'var(--text-2)', fontSize: 'var(--text-sm)' }}><Icon name="store" />{sesion.negocio}</span>
          <span style={{ flex: 1 }} />
          <Button variant="ghost" icon="log-out" onClick={onSalir}>Salir</Button>
        </div>
      </header>
      <main style={panelStyles.main}>{children}</main>
    </>
  );
}

function BackLink({ onClick, children }) {
  return <button onClick={onClick} className="zd-btn zd-btn--ghost" style={{ justifySelf: 'start', paddingLeft: 0 }}><Icon name="arrow-left" />{children}</button>;
}

function ScreenIngreso({ onIngresar }) {
  const [err, setErr] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const submit = e => { e.preventDefault(); const v = e.target.elements.correo.value; if (!v.includes('@')) { setErr(true); return; } setErr(false); setLoading(true); setTimeout(onIngresar, 600); };
  return (
    <section data-screen-label="Ingreso" data-change="CH-22" data-estado="pendiente" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 'var(--space-6)' }}>
      <div style={{ width: 'min(420px, 100%)', display: 'grid', gap: 'var(--space-8)' }}>
        <div style={{ display: 'grid', gap: 'var(--space-3)', textAlign: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 'var(--text-2xl)', letterSpacing: '-.02em' }}>ZeroDashboard</span>
          <p className="zd-muted" style={{ margin: 0 }}>Tus avisos y reportes automáticos, en un solo lugar.</p>
        </div>
        <form className="zd-card zd-form" onSubmit={submit} noValidate>
          <h1 className="zd-h2">Ingresar</h1>
          <Field label="Correo" name="correo" type="email" autoComplete="email" defaultValue="tito@dontito.com.ar" error={err ? 'Escribí un correo válido, por ejemplo nombre@tutienda.com.ar.' : null} />
          <Field label="Contraseña" name="clave" type="password" autoComplete="current-password" defaultValue="••••••••" />
          <Button type="submit" variant="primary" block loading={loading}>Ingresar</Button>
          <a href="#" className="zd-link" style={{ fontSize: 'var(--text-sm)', justifySelf: 'center' }}>Olvidé mi contraseña</a>
        </form>
        <p className="zd-meta" style={{ textAlign: 'center', margin: 0 }}>Entrás directo a tu negocio; no hace falta elegirlo.</p>
      </div>
    </section>
  );
}

Object.assign(window, { PanelShell, ScreenIngreso, BackLink });
})();
