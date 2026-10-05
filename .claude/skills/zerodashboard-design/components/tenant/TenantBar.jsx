import React from 'react';
import { Icon } from '../core/Icon.jsx';
export function TenantBar({ tenant, onChange, children }) {
  if (!tenant) {
    return (
      <div className="zd-tenantbar zd-tenantbar--none" role="region" aria-label="Tenant activo" data-change="CH-06" data-estado="existe">
        <Icon name="triangle-alert" />
        <span className="zd-tenantbar__name" style={{ fontSize: 'var(--text-sm)' }}>Ningún tenant seleccionado</span>
        <span>Elegí uno para operar.</span>
        <span className="zd-tenantbar__spacer" />
        {onChange ? <button type="button" className="zd-tenantbar__btn" onClick={onChange}><Icon name="arrow-left-right" />Elegir tenant</button> : null}
      </div>
    );
  }
  return (
    <div className="zd-tenantbar" role="region" aria-label="Tenant activo" data-change="CH-06" data-estado="existe">
      <Icon name="building-2" />
      <span className="zd-tenantbar__label">Tenant activo</span>
      <span className="zd-tenantbar__name">{tenant.nombre}</span>
      {tenant.id ? <span className="zd-tenantbar__id">{tenant.id}</span> : null}
      <span className="zd-tenantbar__spacer" />
      {children}
      {onChange ? <button type="button" className="zd-tenantbar__btn" onClick={onChange}><Icon name="arrow-left-right" />Cambiar tenant</button> : null}
    </div>
  );
}
