import React from 'react';
import { Icon } from '../core/Icon.jsx';
function Item({ it, current, onNavigate }) {
  const on = current === it.id;
  return (
    <a className="zd-sidenav__item" href={it.href || '#' + it.id} aria-current={on ? 'page' : undefined}
      onClick={onNavigate ? (e) => { e.preventDefault(); onNavigate(it.id); } : undefined}>
      <Icon name={it.icon || 'circle'} /><span>{it.label}</span>
      {it.meta ? <span className="zd-sidenav__meta">{it.meta}</span> : null}
    </a>
  );
}
export function SideNav({ brand = 'ZeroDashboard', surfaceLabel = 'Consola', global = [], tenantName, tenantGroups = [], current, onNavigate, footer }) {
  return (
    <nav className="zd-sidenav" aria-label="Secciones de la consola">
      <div className="zd-sidenav__brand"><span className="zd-sidenav__brandname">{brand}</span><span className="zd-eyebrow">{surfaceLabel}</span></div>
      {global.length ? (
        <div className="zd-sidenav__group">
          <span className="zd-sidenav__heading"><Icon name="globe" />Global</span>
          {global.map(it => <Item key={it.id} it={it} current={current} onNavigate={onNavigate} />)}
        </div>
      ) : null}
      {tenantGroups.length ? (
        <div className="zd-sidenav__scope">
          <div className="zd-sidenav__tenant"><span className="zd-sidenav__heading" style={{ padding: 0 }}><Icon name="building-2" />Tenant activo</span><b>{tenantName || 'Ninguno'}</b></div>
          {tenantGroups.map(g => (
            <React.Fragment key={g.label}>
              <span className="zd-sidenav__subheading">{g.label}</span>
              {g.items.map(it => <Item key={it.id} it={it} current={current} onNavigate={onNavigate} />)}
            </React.Fragment>
          ))}
        </div>
      ) : null}
      {footer ? <div className="zd-sidenav__foot">{footer}</div> : null}
    </nav>
  );
}
