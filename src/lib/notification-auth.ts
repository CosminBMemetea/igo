import { headers } from "next/headers";
import { store, dbConfigured } from "./store";
export const PUSH_COOKIE = "qfleet-push-device";
/** Fail with JSON rather than a login HTML redirect for expired API sessions. */
export async function notificationActor() {
  const h = await headers(), role = h.get("x-igo-role"), uid = h.get("x-igo-uid"), firmId = h.get("x-igo-firm");
  if (!uid || !firmId || firmId === "demo" || !["owner", "driver"].includes(role ?? "") || (process.env.NODE_ENV === "production" && !dbConfigured())) return null;
  const s = store(), user = await s.userById(uid), firm = await s.firm(firmId);
  if (!firm || !user || user.disabledAt || !user.passwordHash || user.firmId !== firmId || user.role !== role || (user.sessionVersion ?? 0) !== Number(h.get("x-igo-version"))) return null;
  return user;
}
export function notificationSameOrigin(req: Request) { return req.headers.get("origin") === new URL(req.url).origin && req.headers.get("sec-fetch-site") !== "cross-site"; }
export async function notificationBody(req: Request) {
  if (!req.headers.get("content-type")?.startsWith("application/json")) return null;
  const reader = req.body?.getReader();
  if (!reader) return null;
  const parts: Uint8Array[] = []; let size = 0;
  while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.byteLength; if (size > 6000) { await reader.cancel(); return null; } parts.push(chunk.value); }
  const value = JSON.parse(Buffer.concat(parts).toString("utf8"));
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
