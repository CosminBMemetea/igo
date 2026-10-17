import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { back } from "@/lib/auth-cookie";
import { store } from "@/lib/store";
import { queueEmail } from "@/lib/email";
import { clip, isEmail, isPhone, normEmail, normPhone } from "@/lib/validate";
import { normRef } from "@/lib/referral";
import { LT, lfill, FUEL_CARDS } from "@/lib/lead-i18n";
import type { Locale } from "@/lib/i18n";
export const dynamic = "force-dynamic";
// limitare: în memoria instanței (rafale) + în DB pe hash de IP (3 / 10 min, 10 / zi)
const hits = new Map<string, number[]>();
/** „Încearcă gratuit 30 de zile”: salvează lead-ul, anunță adminul, trimite confirmare doar lead-ului (fără marketing). */
export async function POST(req: Request) {
  const fd = await req.formData().catch(() => null);
  if (!fd) return back(req, "/incearca?e=1");
  const ref = normRef(fd.get("ref")), keep = ref ? `&ref=${ref}` : "";
  // honeypot + trimis prea repede (< 2 s) → răspundem „trimis”, fără să salvăm
  const t0 = Number(fd.get("t0")) || 0;
  if (clip(fd.get("website"), 200) || (t0 && Date.now() - t0 < 2000)) return back(req, "/incearca?sent=1");
  const h = await headers(), ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "0";
  const ipHash = createHash("sha256").update(`${process.env.SESSION_SECRET ?? ""}:${ip}`).digest("base64url").slice(0, 24);
  const now = Date.now(), recent = (hits.get(ipHash) ?? []).filter((x) => now - x < 10 * 60e3);
  if (recent.length >= 3) return back(req, `/incearca?e=rate${keep}`);
  const s = store();
  if ((await s.leadsFromIp(ipHash, new Date(now - 10 * 60e3).toISOString())) >= 3 || (await s.leadsFromIp(ipHash, new Date(now - 864e5).toISOString())) >= 10) return back(req, `/incearca?e=rate${keep}`);
  const firm = clip(fd.get("firm"), 120), person = clip(fd.get("person"), 80), phone = normPhone(clip(fd.get("phone"), 30)), email = normEmail(clip(fd.get("email"), 200));
  const n = Math.round(Number(fd.get("trucks"))), trucks = Number.isFinite(n) && n >= 1 && n <= 5000 ? n : null;
  const card = String(fd.get("fuelCard") ?? ""), fuelCard = (FUEL_CARDS as readonly string[]).includes(card) ? card : null;
  const gps = fd.get("gps") === "yes" ? true : fd.get("gps") === "no" ? false : null;
  const loc = (["ro", "en", "pl"].includes(String(fd.get("locale"))) ? String(fd.get("locale")) : "ro") as Locale;
  if (firm.length < 2 || person.length < 2 || !isPhone(phone) || !isEmail(email) || !trucks || fd.get("consent") !== "1") return back(req, `/incearca?e=1${keep}`);
  const utm = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].map((k) => [k, clip(fd.get(k), 80)]).filter(([, v]) => v);
  hits.set(ipHash, [...recent, now]); if (hits.size > 5000) hits.clear();
  const lead = await s.addLead({ firm, person, phone, email, trucks, fuelCard, gps, gpsProvider: clip(fd.get("gpsProvider"), 80) || null, locale: loc, source: utm.length ? "utm" : ref ? "referral" : "incearca", referralCode: ref, utm: utm.length ? JSON.stringify(Object.fromEntries(utm)) : null, ipHash, consentAt: new Date().toISOString() });
  const L = LT[loc], R = LT.ro, admin = process.env.ADMIN_EMAIL;
  try {
    if (admin) await queueEmail(s, null, `lead-admin-${lead.id}`, { to: admin, subject: lfill(R.mailAdminSubj, { firm, trucks }), text: [`${R.firm}: ${firm}`, `${R.person}: ${person}`, `${R.phone}: ${phone}`, `${R.email}: ${email}`, `${R.trucks}: ${trucks}`, `${R.card}: ${fuelCard ?? "—"}`, `GPS: ${gps == null ? "—" : gps ? "da" : "nu"}${lead.gpsProvider ? ` (${lead.gpsProvider})` : ""}`, `Ref: ${ref ?? "—"}`, `UTM: ${lead.utm ?? "—"}`, `Limba: ${loc}`].join("\n") });
    await queueEmail(s, null, `lead-confirm-${lead.id}`, { to: email, subject: L.mailLeadSubj, text: lfill(L.mailLead, { person, firm, phone }) });
  } catch { /* lead-ul e salvat; emailurile rămân în coadă / eșuate, vizibile în /admin */ }
  return back(req, "/incearca?sent=1");
}
