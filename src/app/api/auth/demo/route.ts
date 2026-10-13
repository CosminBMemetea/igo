import { cookies } from "next/headers";
import { back, safeNext, withSession } from "@/lib/auth-cookie";
import { DEMO_SID, newDemoSession } from "@/lib/demo-shift";
export const dynamic = "force-dynamic";
/** „Intră ca demo”: sesiune de utilizator (nu admin) pe firma demo.
 *  Datele demo (tura, bonurile șoferului) țin de sesiunea demo a browserului (cookie qf-dsid, 24 h): comutarea patron ↔ șofer le păstrează;
 *  doar „reset=1” sau expirarea (24 h) pornesc o sesiune demo nouă. Nimic în DB. */
export async function POST(req: Request) {
  if ((process.env.SESSION_SECRET?.length ?? 0) < 32) return back(req, "/login?e=nosecret");
  const fd = await req.formData().catch(() => null), as = fd?.get("as"), next = fd?.get("next");
  const sess = as === "driver" ? { role: "driver" as const, email: "sofer@querrafleet.demo", firm: "demo" } : { role: "user" as const, email: "demo@querrafleet.demo", firm: "demo" };
  const res = back(req, safeNext(next, sess) ?? (as === "driver" ? "/driver" : "/feed"));
  // sesiunea demo (24 h) se păstrează la orice intrare (șofer → ieșire → patron vede tura și bonul);
  // se reia de la zero doar la prima vizită, după expirare sau cu butonul explicit „Pornește un demo nou” (reset=1)
  if (fd?.get("reset") === "1" || !cookies().get(DEMO_SID)) newDemoSession(res);
  return withSession(res, sess);
}
