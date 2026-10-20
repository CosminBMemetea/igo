// DB-backed limits for costly or abusable endpoints (shared auth_throttle table, keys "rl:*").
// Fails closed: if the counter cannot be written, the costly action does not run (and it is logged).
import { NextResponse } from "next/server";
import { store } from "./store";
export type Limit = { key: string; limit: number; windowS: number };
export type LimitResult = { error: "rate" | "unavailable" | null; retryAfterS: number; remaining: number };
export const clientIp = (req: Request) => (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
/** Counts one hit on every limit (per user, per firm, per IP). error=null means allowed. */
export async function hitLimits(limits: Limit[]): Promise<LimitResult> {
  try {
    const s = store(), results = await Promise.all(limits.map((l) => s.rateHit(`rl:${l.key}`, l.limit, l.windowS)));
    const remaining = Math.max(0, Math.min(...results.map((r, i) => limits[i].limit - (r.used ?? 0))));
    const blocked = results.filter((r) => !r.ok);
    if (blocked.length) { console.warn("[rate-limit] blocked", limits.map((l) => l.key.split(":").slice(0, 2).join(":")).join(",")); return { error: "rate", retryAfterS: Math.max(...blocked.map((r) => r.retryAfterS)), remaining: 0 }; }
    return { error: null, retryAfterS: 0, remaining };
  } catch (e) {
    console.error("[rate-limit] unavailable, failing closed:", e instanceof Error ? e.message.slice(0, 200) : e);
    return { error: "unavailable", retryAfterS: 60, remaining: 0 };
  }
}
/** Undo the hits of an allowed request whose costly work failed upstream. Best effort, logged. */
export async function refundLimits(limits: Limit[]): Promise<void> {
  try { const s = store(); await Promise.all(limits.map((l) => s.rateRefund(`rl:${l.key}`))); }
  catch (e) { console.error("[rate-limit] refund failed:", e instanceof Error ? e.message.slice(0, 200) : e); }
}
/** Back-compat: null = allowed. */
export async function checkLimits(limits: Limit[]) { const r = await hitLimits(limits); return r.error ? (r as LimitResult & { error: "rate" | "unavailable" }) : null; }
export const limitResponse = (r: { error: "rate" | "unavailable"; retryAfterS: number }) =>
  NextResponse.json({ error: r.error }, { status: r.error === "rate" ? 429 : 503, headers: { "retry-after": String(r.retryAfterS), "cache-control": "no-store" } });
