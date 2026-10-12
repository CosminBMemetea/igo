import { back } from "@/lib/auth-cookie";
import { store } from "@/lib/store";
import { writableFirm } from "@/lib/tenant";
import { clip } from "@/lib/validate";
import { headers } from "next/headers";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const f = await writableFirm(); if (!f) return back(req, "/setup?e=nofirm");
  const fd = await req.formData();
  const name = clip(fd.get("name"), 120), cui = clip(fd.get("cui"), 20).toUpperCase().replace(/\s/g, "") || null, currency = fd.get("currency") === "EUR" ? "EUR" : "RON";
  if (name.length < 2) return back(req, "/setup?step=1&e=firm");
  if (cui && !/^(RO)?\d{2,10}$/.test(cui)) return back(req, "/setup?step=1&e=cui");
  await store().updateFirm(f.id, { name, cui, currency, detailsDone: true });
  const l = String(fd.get("locale") ?? ""), res = back(req, "/setup?step=2");
  if (l === "ro" || l === "en" || l === "pl") {
    const uid = headers().get("x-igo-uid"); if (uid) await store().setUserLocale(uid, l);
    res.cookies.set("igo-locale", l, { path: "/", maxAge: 31536000, sameSite: "lax" });
  }
  return res;
}
