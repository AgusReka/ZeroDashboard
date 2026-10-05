import React from 'react';
import { Icon } from '../core/Icon.jsx';
import { Button } from '../core/Button.jsx';
const ICONS = { info: 'info', ok: 'circle-check', warn: 'triangle-alert', error: 'circle-alert', neutral: 'info' };
export function Banner({ tone = 'info', title, children, actions, icon, inline = false, onDismiss, role }) {
  const r = role || (tone === 'error' || tone === 'warn' ? 'alert' : 'status');
  return (
    <div className={'zd-banner zd-banner--' + tone + (inline ? ' zd-banner--inline' : '')} role={r}>
      <Icon name={icon || ICONS[tone]} />
      <div>
        {title ? <p className="zd-banner__title">{title}</p> : null}
        {children ? <div className="zd-banner__body">{children}</div> : null}
      </div>
      <div className="zd-banner__actions">
        {actions}
        {onDismiss ? <Button size="sm" variant="ghost" iconOnly icon="x" label="Cerrar aviso" onClick={onDismiss} /> : null}
      </div>
    </div>
  );
}
