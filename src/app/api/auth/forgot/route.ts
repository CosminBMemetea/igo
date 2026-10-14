import { back } from "@/lib/auth-cookie";
import { store } from "@/lib/store";
import { normLogin } from "@/lib/validate";
import { resetToken } from "@/lib/reset";
import { queueEmail } from "@/lib/email";
import { t, type Locale } from "@/lib/i18n";
import { getPrefs } from "@/lib/prefs";
export const dynamic = "force-dynamic";
/** Cere link de resetare. Răspuns identic dacă emailul există sau nu (fără enumerare de conturi); limitat pe IP și pe email. */
export async function POST(req: Request) {
  const secret = process.env.SESSION_SECRET;
  if ((secret?.length ?? 0) < 32) return back(req, "/login?e=nosecret");
  const fd = await req.formData().catch(() => null), email = normLogin(String(fd?.get("email") ?? "").trim().slice(0, 200));
  const s = store(), ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  const [a, b] = await Promise.all([s.authFail(`fp:${ip}`, 10, 30), s.authFail(`fe:${email}`, 3, 30)]).catch(() => [{ lockedUntil: null }, { lockedUntil: null }]);
  if (!a.lockedUntil && !b.lockedUntil && email.includes("@")) {
    const u = await s.userByLogin(email);
    if (u && u.role === "owner" && !u.disabledAt && u.email) {
      const loc = (u.locale as Locale) || getPrefs().loc, url = new URL(`/reset?t=${encodeURIComponent(await resetToken(u.id, u.passwordHash, secret!))}`, req.url).toString();
      await queueEmail(s, u.firmId, `reset:${u.id}:${Date.now()}`, { to: u.email, subject: t(loc, "rst.mailSubj"), text: t(loc, "rst.mailBody", { url }) }).catch(() => null);
    }
  }
  return back(req, "/forgot?sent=1");
}
