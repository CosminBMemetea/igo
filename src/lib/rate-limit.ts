// DB-backed limits for costly or abusable endpoints (shared auth_throttle table, keys "rl:*").
// Fails closed: if the counter cannot be written, the costly action does not run.
import { NextResponse } from "next/server";
import { store } from "./store";
export type Limit = { key: string; limit: number; windowS: number };
export const clientIp = (req: Request) => (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
/** null = allowed; otherwise the reason and how long to wait. Checks every limit (per user, per firm, per IP). */
export async function checkLimits(limits: Limit[]): Promise<{ error: "rate" | "unavailable"; retryAfterS: number } | null> {
  try {
    const s = store(), results = await Promise.all(limits.map((l) => s.rateHit(`rl:${l.key}`, l.limit, l.windowS)));
    const blocked = results.filter((r) => !r.ok);
    return blocked.length ? { error: "rate", retryAfterS: Math.max(...blocked.map((r) => r.retryAfterS)) } : null;
  } catch { return { error: "unavailable", retryAfterS: 60 }; }
}
export const limitResponse = (r: { error: "rate" | "unavailable"; retryAfterS: number }) =>
  NextResponse.json({ error: r.error }, { status: r.error === "rate" ? 429 : 503, headers: { "retry-after": String(r.retryAfterS), "cache-control": "no-store" } });
