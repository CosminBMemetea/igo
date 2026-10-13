// Pre-calculează geometria pe drumuri reale pentru traseele demo (OSRM public, DOAR la dezvoltare) → src/lib/fleet/roads.json.
// Rulare: npx tsx scripts/fetch-roads.mts   (nu se apelează OSRM la rulare)
import fs from "node:fs";
import { TRUCKS } from "../src/lib/fleet/data";
type P = [number, number];
function dp(pts: P[], eps: number): P[] {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  let idx = 0, max = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i], dx = b[1] - a[1], dy = b[0] - a[0];
    const d = Math.abs(dy * p[1] - dx * p[0] + b[1] * a[0] - b[0] * a[1]) / (Math.hypot(dx, dy) || 1);
    if (d > max) { max = d; idx = i; }
  }
  return max > eps ? [...dp(pts.slice(0, idx + 1), eps).slice(0, -1), ...dp(pts.slice(idx), eps)] : [a, b];
}
async function road(pts: P[]): Promise<{ path: P[]; km: number }> {
  const q = pts.map((p) => `${p[1]},${p[0]}`).join(";");
  const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${q}?overview=full&geometries=geojson`, { headers: { "user-agent": "igo-demo-precompute" } });
  const j = (await r.json()) as { routes: { distance: number; geometry: { coordinates: [number, number][] } }[] };
  const raw = j.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng] as P);
  const h = raw.length >> 1, simp = [...dp(raw.slice(0, h + 1), 0.0002).slice(0, -1), ...dp(raw.slice(h), 0.0002)];
  return { path: (pts.length > 4 ? simp : dp(raw, 0.0006)).map(([a, b]) => [+a.toFixed(5), +b.toFixed(5)] as P), km: Math.round(j.routes[0].distance / 100) / 10 };
}
const out: Record<string, { path: P[]; km: number }> = JSON.parse(fs.readFileSync(new URL("../src/lib/fleet/roads.json", import.meta.url), "utf8"));
const ONLY = process.env.ONLY_MISSING === "1";
for (const t of TRUCKS) { if (ONLY && out[t.id]) continue; out[t.id] = await road(t.route.map((w) => w.at)); console.log(t.id, out[t.id].km, "km", out[t.id].path.length, "pts"); await new Promise((r) => setTimeout(r, 1100)); }
const loop: P[] = [[47.0465, 21.9189], [47.065, 21.94], [47.07, 21.9], [47.05, 21.88], [47.035, 21.93], [47.0465, 21.9189]];
if (!ONLY || !out.van) out.van = await road(loop); console.log("van", out.van.km, out.van.path.length);
fs.writeFileSync(new URL("../src/lib/fleet/roads.json", import.meta.url), JSON.stringify(out));
