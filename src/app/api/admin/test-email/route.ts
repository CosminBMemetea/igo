import { headers } from "next/headers";
import { back } from "@/lib/auth-cookie";
import { emailProvider } from "@/lib/email";
import { clip } from "@/lib/validate";
import { reportOperationFailure } from "@/lib/operation-error";
export const dynamic = "force-dynamic";
const g = globalThis as unknown as { __qfTestMail?: number };
/** Admin: trimite un email de test prin furnizorul configurat (Resend). Nu intră în coada de reamintiri. */
export async function POST(req: Request) {
  if ((await headers()).get("x-igo-role") !== "admin") return back(req, "/");
  const to = clip((await req.formData()).get("to"), 200).trim();
  const q = (p: Record<string, string>) => back(req, `/admin?${new URLSearchParams(p)}#test-email`);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return q({ te: "bad" });
  if (g.__qfTestMail && Date.now() - g.__qfTestMail < 30_000) return q({ te: "wait" });
  const p = emailProvider();
  if (!p) return q({ te: "none" });
  g.__qfTestMail = Date.now();
  try {
    const r = await p.send({ to, subject: "Querra Fleet – email de test", text: "Salut,\n\nAcesta este un email de test trimis din pagina de admin Querra Fleet. Dacă îl vezi, trimiterea prin Resend funcționează.\n\nQuerra Fleet" });
    return q({ te: "sent", id: r.id });
  } catch (e) { return q({ te: "err", msg: reportOperationFailure("admin-test-email", e) }); }
}
