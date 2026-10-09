import React from 'react';
import { Icon } from '../core/Icon.jsx';
export function ScopeTag({ scope = 'tenant', tenantName }) {
  if (scope === 'global') return <span className="zd-scope zd-scope--global"><Icon name="globe" />Global · todos los tenants</span>;
  if (!tenantName) return <span className="zd-scope zd-scope--none"><Icon name="triangle-alert" />Sin tenant activo</span>;
  return <span className="zd-scope zd-scope--tenant"><Icon name="building-2" />Tenant activo: {tenantName}</span>;
}
