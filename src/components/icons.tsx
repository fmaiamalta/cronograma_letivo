const base = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

export const IconTrash = () => (
  <svg {...base}><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>
);
export const IconUp = () => (
  <svg {...base}><path d="M12 19V5M5 12l7-7 7 7" /></svg>
);
export const IconDown = () => (
  <svg {...base}><path d="M12 5v14M19 12l-7 7-7-7" /></svg>
);
export const IconTimeline = () => (
  <svg {...base}><path d="M3 6h10M7 12h12M5 18h8" /></svg>
);
export const IconClock = () => (
  <svg {...base}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 4v16" /></svg>
);
export const IconCalendar = () => (
  <svg {...base}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></svg>
);
export const IconBook = () => (
  <svg {...base}><path d="M4 4h10a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z" /><path d="M4 16a4 4 0 0 1 4-4h10" /></svg>
);
export const IconCheck = () => (
  <svg {...base}><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M8 12l3 3 5-6" /></svg>
);
