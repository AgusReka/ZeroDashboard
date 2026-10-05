import React from 'react';
import { ICONS } from './iconData.js';
export function Icon({ name, size, label, spin = false, className = '', style = {} }) {
  const s = Object.assign({}, size ? { width: size, height: size } : {}, style);
  return (
    <svg className={'zd-icon' + (spin ? ' zd-icon--spin' : '') + (className ? ' ' + className : '')} style={s} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      role={label ? 'img' : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : 'true'} focusable="false"
      dangerouslySetInnerHTML={{ __html: ICONS[name] || ICONS['circle'] }} />
  );
}
