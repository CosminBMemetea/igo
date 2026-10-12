// „Reluarea zilei” pe acasă: mini-hartă SVG cu camionul care merge în buclă pe traseu (animație SVG nativă, fără JS / fără dale).
import Link from "next/link";
import { REF_DAY } from "@/lib/demo-time";
import { demoReplay } from "@/lib/replay";
import { t, fmtNum, type Locale } from "@/lib/i18n";

export function ReplayTeaser({ loc, vehicleId = "bh21qrt", tripId }: { loc: Locale; vehicleId?: string; tripId?: string | null }) {
  const d = demoReplay(vehicleId, REF_DAY, null);
  if (!d || d.path.length < 2) return null;
  // proiecție simplă (lng·cos(lat), lat) → viewBox 320×140, ~120 puncte
  const step = Math.max(1, Math.floor(d.path.length / 120));
  const pts = d.path.filter((_, i) => i % step === 0 || i === d.path.length - 1);
  const k = Math.cos((pts[0][0] * Math.PI) / 180);
  const xs = pts.map((p) => p[1] * k), ys = pts.map((p) => -p[0]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const W = 320, H = 140, pad = 14, sc = Math.min((W - 2 * pad) / (x1 - x0 || 1), (H - 2 * pad) / (y1 - y0 || 1));
  const ox = (W - (x1 - x0) * sc) / 2, oy = (H - (y1 - y0) * sc) / 2;
  const path = pts.map((p, i) => `${i ? "L" : "M"}${(ox + (p[1] * k - x0) * sc).toFixed(1)} ${(oy + (-p[0] - y0) * sc).toFixed(1)}`).join("");
  const href = tripId ? `/replay?trip=${tripId}` : `/replay?v=${vehicleId}`;
  return (
    <Link href={href} className="rteaser fade d2" aria-label={t(loc, "rp.dayTitle")}>
      <div className="rt-txt">
        <div className="eyebrow">{t(loc, "rp.dayTitle")}</div>
        <div className="rt-h">{d.plate} · {d.route}</div>
        <p className="sub">{t(loc, "rp.daySub")}</p>
        <div className="rt-meta">{fmtNum(loc, d.km)} km · {d.events.filter((e) => e.kind === "fuel").length} ⛽ · {d.events.filter((e) => e.kind === "pause").length} ☕</div>
        <span className="btn pri rt-btn"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M8 5l11 7-11 7z" fill="currentColor" /></svg>{t(loc, "rp.cta")}</span>
      </div>
      <svg className="rt-map" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        <path d={path} className="rt-route" />
        <path d={path} className="rt-done" pathLength={1} />
        <circle r="5" className="rt-truck"><animateMotion dur="9s" repeatCount="indefinite" path={path} /></circle>
        <circle r="11" className="rt-glow"><animateMotion dur="9s" repeatCount="indefinite" path={path} /></circle>
      </svg>
    </Link>
  );
}
