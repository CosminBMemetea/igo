import { back, safeNext, withSession } from "@/lib/auth-cookie";
export const dynamic = "force-dynamic";
/** „Intră ca demo”: sesiune de utilizator (nu admin) pe firma demo. */
export async function POST(req: Request) {
  if ((process.env.SESSION_SECRET?.length ?? 0) < 32) return back(req, "/login?e=nosecret");
  // „Vezi demo ca șofer”: sesiune de șofer pe firma demo (tot în memorie; tura/pauza în cookie)
  const fd = await req.formData().catch(() => null), as = fd?.get("as"), next = fd?.get("next");
  const sess = as === "driver" ? { role: "driver" as const, email: "sofer@querrafleet.demo", firm: "demo" } : { role: "user" as const, email: "demo@querrafleet.demo", firm: "demo" };
  return withSession(back(req, safeNext(next, sess) ?? (as === "driver" ? "/driver" : "/")), sess);
}
