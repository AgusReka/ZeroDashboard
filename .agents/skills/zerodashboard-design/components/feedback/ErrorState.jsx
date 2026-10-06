import React from 'react';
import { Icon } from '../core/Icon.jsx';
export function ErrorState({ title = 'Algo salió mal', children, detail, actions, icon = 'circle-alert' }) {
  return (
    <div className="zd-state zd-state--error" role="alert">
      <span className="zd-state__icon"><Icon name={icon} /></span>
      <p className="zd-state__title">{title}</p>
      {children ? <p className="zd-state__body">{children}</p> : null}
      {detail ? <code className="zd-code" style={{ maxWidth: '100%', textAlign: 'left', fontSize: 'var(--text-xs)' }}>{detail}</code> : null}
      {actions ? <div className="zd-state__actions">{actions}</div> : null}
    </div>
  );
}
