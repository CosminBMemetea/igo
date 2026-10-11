/** iGo, varianta 1: wordmark subțire, punctul lui „i” = punct GPS albastru (#3B82F6). Vector desenat de mână, fără font. */
export function Logo({ height = 26, title = "iGo" }: { height?: number; title?: string }) {
  return (
    <svg className="wordmark" viewBox="2 3 86 42" height={height} role="img" aria-label={title}>
      <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 20v22" />
        <path d="M45.9 18.1A14 14 0 1 0 50 28h-11" />
        <circle cx="72" cy="31" r="11" />
      </g>
      <circle cx="8" cy="10.5" r="3.8" fill="#3B82F6" />
      <circle cx="8" cy="10.5" r="7" fill="#3B82F6" opacity=".18" />
    </svg>
  );
}
