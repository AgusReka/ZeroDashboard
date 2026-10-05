import React from 'react';
import { Icon } from '../core/Icon.jsx';
export function EmptyState({ icon = 'inbox', title, children, actions }) {
  return (
    <div className="zd-state" role="status">
      <span className="zd-state__icon"><Icon name={icon} /></span>
      <p className="zd-state__title">{title}</p>
      {children ? <p className="zd-state__body">{children}</p> : null}
      {actions ? <div className="zd-state__actions">{actions}</div> : null}
    </div>
  );
}
