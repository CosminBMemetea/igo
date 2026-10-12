import { back, withSession } from "@/lib/auth-cookie";
export const dynamic = "force-dynamic";
/** „Intră ca demo”: sesiune de utilizator (nu admin) pe firma demo. */
export async function POST(req: Request) {
  if ((process.env.SESSION_SECRET?.length ?? 0) < 32) return back(req, "/login?e=nosecret");
  // „Vezi demo ca șofer”: sesiune de șofer pe firma demo (tot în memorie; tura/pauza în cookie)
  const as = (await req.formData().catch(() => null))?.get("as");
  if (as === "driver") return withSession(back(req, "/driver"), { role: "driver", email: "sofer@querrafleet.demo", firm: "demo" });
  return withSession(back(req, "/"), { role: "user", email: "demo@querrafleet.demo", firm: "demo" });
}
