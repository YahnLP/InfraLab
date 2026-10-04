import type { DeviceKind } from '../../core';

/** Glyphes schématiques, tracés dans une boîte de 48 × 48 centrée sur (0,0). Trait = currentColor. */
const G: Record<DeviceKind, string> = {
  internet: '<path d="M-14 8h26a8 8 0 0 0 1-16 11 11 0 0 0-21-3 9 9 0 0 0-6 19z"/>',
  router: '<circle r="14"/><path d="M0-8v16M-8 0h16M0-8l-3 3M0-8l3 3M0 8l-3-3M0 8l3-3"/>',
  firewall: '<rect x="-16" y="-14" width="32" height="28" rx="2"/><path d="M-16-5h32M-16 4h32M-4-14v9M6-5v9M-4 4v10"/>',
  switch: '<rect x="-18" y="-8" width="36" height="16" rx="2"/><path d="M-12 0h3M-5 0h3M2 0h3M9 0h3"/>',
  wifi_ap: '<circle cx="0" cy="8" r="2"/><path d="M-6 2a8 8 0 0 1 12 0M-11-3a15 15 0 0 1 22 0M-16-8a22 22 0 0 1 32 0"/>',
  workstation: '<rect x="-14" y="-14" width="28" height="19" rx="2"/><path d="M0 5v7M-7 13h14"/>',
  laptop: '<rect x="-12" y="-13" width="24" height="16" rx="2"/><path d="M-17 8h34l-3 4h-28z"/>',
  tablet: '<rect x="-10" y="-15" width="20" height="30" rx="3"/><path d="M-2 11h4"/>',
  phone: '<path d="M-9-14h18v28h-18z"/><path d="M-5-9h10M-5-3h2M0-3h2M5-3h0M-5 3h2M0 3h2M5 3h0"/>',
  server: '<rect x="-14" y="-15" width="28" height="9" rx="1"/><rect x="-14" y="-4" width="28" height="9" rx="1"/><rect x="-14" y="7" width="28" height="9" rx="1"/><path d="M-10-10.5h2M-10 .5h2M-10 11.5h2"/>',
  nas: '<rect x="-14" y="-14" width="28" height="28" rx="2"/><path d="M-9-6h18M-9 2h18M6 9h2"/>',
  printer: '<rect x="-14" y="-4" width="28" height="14" rx="2"/><path d="M-8-4v-9h16v9M-8 10v4h16v-4"/>',
  hypervisor: '<rect x="-16" y="-15" width="32" height="30" rx="2"/><rect x="-11" y="-10" width="10" height="8"/><rect x="1" y="-10" width="10" height="8"/><rect x="-11" y="2" width="22" height="8"/>',
  vm: '<rect x="-14" y="-12" width="28" height="24" rx="2" stroke-dasharray="3 2"/><path d="M-8 4l4-10 4 10M2 4v-10l4 6 4-6v10"/>',
  generic: '<rect x="-14" y="-14" width="28" height="28" rx="3"/><path d="M-4-5a4 4 0 1 1 6 3c-2 1-2 2-2 4M0 8v1"/>',
};

export function glyph(kind: DeviceKind): string { return G[kind]; }

/** Version autonome pour la palette (HTML). */
export function glyphSvg(kind: DeviceKind, size = 28): string {
  return `<svg width="${size}" height="${size}" viewBox="-24 -24 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${G[kind]}</svg>`;
}
