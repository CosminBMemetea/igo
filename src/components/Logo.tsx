/** Querra Fleet: semnul Q (coada = drum, cu punct GPS albastru #3B82F6) + wordmark „Querra” normal, „Fleet” subțire în accent. */
export function QMark({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden>
      <circle cx="22" cy="21" r="14" fill="none" stroke="currentColor" strokeWidth="3.2" />
      <path d="M24 26.5 C27.5 32 31 34.5 36 34.5" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="38.5" cy="34.5" r="6.5" fill="#3B82F6" opacity=".2" />
      <circle cx="38.5" cy="34.5" r="3.6" fill="#3B82F6" />
    </svg>
  );
}
export function Logo({ height = 26, title = "Querra Fleet" }: { height?: number; title?: string }) {
  return (
    <span className="wordmark" role="img" aria-label={title} style={{ fontSize: height * 0.72, gap: height * 0.28 }}>
      <QMark size={height} />
      <span className="wm"><b>Querra</b> <i>Fleet</i></span>
    </span>
  );
}
