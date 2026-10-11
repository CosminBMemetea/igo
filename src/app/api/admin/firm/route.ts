import { back } from "@/lib/auth-cookie";
import { store } from "@/lib/store";
import { ADMIN_FIRM_COOKIE } from "@/lib/tenant";
export const dynamic = "force-dynamic";
/** Adminul alege ce firmă vede (middleware permite ruta doar pentru admin). */
export async function POST(req: Request) {
  const id = String((await req.formData()).get("id") ?? "demo");
  const ok = id === "demo" || !!(await store().firm(id));
  const res = back(req, ok ? "/" : "/admin");
  if (ok) res.cookies.set(ADMIN_FIRM_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 30 });
  return res;
}
