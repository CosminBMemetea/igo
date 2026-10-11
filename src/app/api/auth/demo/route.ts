import { back, withSession } from "@/lib/auth-cookie";
export const dynamic = "force-dynamic";
/** „Intră ca demo”: sesiune de utilizator (nu admin) pe firma demo. */
export async function POST(req: Request) {
  if ((process.env.SESSION_SECRET?.length ?? 0) < 32) return back(req, "/login?e=nosecret");
  return withSession(back(req, "/"), { role: "user", email: "demo@igo.demo", firm: "demo" });
}
