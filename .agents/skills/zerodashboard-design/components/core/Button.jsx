import React from 'react';
import { Icon } from './Icon.jsx';
export function Button({ variant = 'secondary', size = 'md', icon, iconRight, iconOnly = false, label, block = false, loading = false, disabled, type = 'button', children, className = '', ...rest }) {
  const cls = ['zd-btn', 'zd-btn--' + variant, size !== 'md' ? 'zd-btn--' + size : '', iconOnly ? 'zd-btn--icon' : '', block ? 'zd-btn--block' : '', className].filter(Boolean).join(' ');
  return (
    <button type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} aria-label={iconOnly ? label : undefined} title={iconOnly ? label : undefined} {...rest}>
      {loading ? <Icon name="loader-circle" spin /> : icon ? <Icon name={icon} /> : null}
      {!iconOnly && (children ?? label)}
      {iconRight && !iconOnly ? <Icon name={iconRight} /> : null}
    </button>
  );
}
