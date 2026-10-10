/** Siluete stilizate (fără fotografii, fără drepturi de autor). */
export function VehicleArt({ kind }: { kind: "truck" | "agri" | "van" }) {
  const g = (
    <defs>
      <linearGradient id="vg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--fg2)" stopOpacity=".9" /><stop offset="1" stopColor="var(--bg3)" /></linearGradient>
      <radialGradient id="vs" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#000" stopOpacity=".45" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
    </defs>
  );
  if (kind === "agri")
    return (
      <svg className="veh fade d1" viewBox="0 0 640 380" aria-hidden>{g}
        <ellipse cx="320" cy="338" rx="290" ry="22" fill="url(#vs)" />
        <path d="M40 250 h150 v-30 h-150z" fill="url(#vg)" opacity=".8" /><rect x="18" y="226" width="40" height="40" rx="6" fill="url(#vg)" opacity=".6" />
        <path d="M180 140 h170 l40 -50 h90 v70 l40 0 v120 H180z" fill="url(#vg)" /><path d="M395 98 h70 v52 h-90z" fill="var(--bg)" opacity=".55" />
        <rect x="250" y="60" width="90" height="70" rx="10" fill="url(#vg)" /><path d="M330 80 l110 -40 v16 l-100 36z" fill="url(#vg)" opacity=".7" />
        <circle cx="245" cy="290" r="48" fill="var(--bg3)" /><circle cx="245" cy="290" r="24" fill="var(--fg3)" />
        <circle cx="475" cy="300" r="36" fill="var(--bg3)" /><circle cx="475" cy="300" r="16" fill="var(--fg3)" />
        <rect x="182" y="200" width="290" height="4" fill="var(--acc)" opacity=".9" />
      </svg>
    );
  return (
    <svg className="veh fade d1" viewBox="0 0 640 380" aria-hidden>{g}
      <ellipse cx="320" cy="338" rx="290" ry="22" fill="url(#vs)" />
      {kind === "truck" ? <rect x="40" y="90" width="380" height="200" rx="8" fill="url(#vg)" opacity=".85" /> : <rect x="120" y="140" width="300" height="150" rx="14" fill="url(#vg)" opacity=".85" />}
      <path d="M430 130 h90 l60 80 v80 h-150z" fill="url(#vg)" /><path d="M445 145 h68 l42 58 h-110z" fill="var(--bg)" opacity=".55" />
      <rect x="40" y="276" width="540" height="6" fill="var(--acc)" opacity=".9" />
      {(kind === "truck" ? [110, 190, 500] : [190, 500]).map((x) => <g key={x}><circle cx={x} cy="300" r="34" fill="var(--bg3)" /><circle cx={x} cy="300" r="14" fill="var(--fg3)" /></g>)}
    </svg>
  );
}
