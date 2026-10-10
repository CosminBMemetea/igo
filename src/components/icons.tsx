const P: Record<string, string> = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  live: '<path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  trips: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7"/>',
  alerts: '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.01"/>',
  crm: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
  docs: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  receipts: '<path d="M5 3h14v18l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21z"/><path d="M9 8h6M9 12h6"/>',
  invoices: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h5M14 17h2"/>',
  driver: '<rect x="7" y="2" width="10" height="20" rx="3"/><path d="M11 18h2"/>',
  features: '<rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  camera: '<path d="M3 8h4l2-3h6l2 3h4v11H3z"/><circle cx="12" cy="13" r="3.5"/>',
  fuel: '<path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M14 9h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V8l-3-3"/>',
  play: '<path d="M7 5l12 7-12 7z" fill="currentColor"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
};
export type IconName = keyof typeof P;
export function Icon({ name, size }: { name: IconName; size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden dangerouslySetInnerHTML={{ __html: P[name] }} />;
}
