import React from 'react';
import { Button } from '../core/Button.jsx';
export function Drawer({ open = true, eyebrow, title, children, footer, onClose, wide = false }) {
  React.useEffect(() => {
    if (!open || !onClose) return;
    const k = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <aside className={'zd-drawer' + (wide ? ' zd-drawer--wide' : '')} role="dialog" aria-modal="false" aria-label={typeof title === 'string' ? title : undefined}>
      <div className="zd-drawer__head">
        <div>{eyebrow ? <span className="zd-eyebrow">{eyebrow}</span> : null}<h2 className="zd-h2">{title}</h2></div>
        {onClose ? <Button size="sm" variant="ghost" iconOnly icon="x" label="Cerrar panel" onClick={onClose} /> : null}
      </div>
      <div className="zd-drawer__body">{children}</div>
      {footer ? <div className="zd-drawer__foot">{footer}</div> : null}
    </aside>
  );
}
