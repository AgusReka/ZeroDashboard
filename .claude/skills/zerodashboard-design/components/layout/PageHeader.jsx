import React from 'react';
import { ScopeTag } from './ScopeTag.jsx';
export function PageHeader({ title, description, scope, tenantName, crumbs, change, estado, actions }) {
  return (
    <header className="zd-pagehead">
      <div className="zd-pagehead__text">
        {crumbs ? <nav className="zd-pagehead__crumbs" aria-label="Ruta">{crumbs}</nav> : null}
        {scope || change ? (
          <div className="zd-pagehead__meta">
            {scope ? <ScopeTag scope={scope} tenantName={tenantName} /> : null}
            {change ? <span className="zd-tag" title="Change y estado de diseño">{change}{estado ? ' · ' + estado : ''}</span> : null}
          </div>
        ) : null}
        <h1 className="zd-h1">{title}</h1>
        {description ? <p className="zd-pagehead__desc">{description}</p> : null}
      </div>
      {actions ? <div className="zd-pagehead__actions">{actions}</div> : null}
    </header>
  );
}
