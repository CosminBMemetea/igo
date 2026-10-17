import { headers } from "next/headers";
import { back } from "@/lib/auth-cookie";
import { store } from "@/lib/store";
import { ADMIN_FIRM_COOKIE } from "@/lib/tenant";
export const dynamic = "force-dynamic";
/** Doar adminul Querra: șterge definitiv o firmă și TOATE datele ei (tranzacție), după ce numele e tastat exact. */
export async function POST(req: Request) {
  if ((await headers()).get("x-igo-role") !== "admin") return back(req, "/login");
  const fd = await req.formData(), id = String(fd.get("id") ?? "").slice(0, 60), confirm = String(fd.get("confirm") ?? "").trim();
  const s = store(), f = id && id !== "demo" ? await s.firm(id) : null;
  if (!f) return back(req, "/admin?e=delnf#firms");
  if (confirm !== f.name.trim()) return back(req, `/admin?del=${encodeURIComponent(id)}&e=delname#del`);
  const { counts, blobUrls } = await s.deleteFirm(id);
  if (blobUrls.length && process.env.BLOB_READ_WRITE_TOKEN) { try { const { del } = await import("@vercel/blob"); await del(blobUrls); } catch { /* fișierele blob rămase nu mai au referință */ } }
  const left = await s.firmCounts(id), total = Object.values(left).reduce((a, n) => a + n, 0);
  const sum = Object.entries(counts).filter(([, n]) => n).map(([k, n]) => `${k}:${n}`).join(",");
  const res = back(req, `/admin?deleted=${encodeURIComponent(f.name.slice(0, 80))}&n=${encodeURIComponent(sum)}&left=${total}#firms`);
  if (req.headers.get("cookie")?.includes(`${ADMIN_FIRM_COOKIE}=${id}`)) res.cookies.set(ADMIN_FIRM_COOKIE, "demo", { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  return res;
}
