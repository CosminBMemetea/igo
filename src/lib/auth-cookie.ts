import "server-only";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_TTL_S, signSession, type Role } from "./session";
export async function withSession(res: NextResponse, role: Role, email: string) {
  const secret = process.env.SESSION_SECRET!;
  const token = await signSession({ role, email, firm: "demo", exp: Math.floor(Date.now() / 1000) + SESSION_TTL_S }, secret);
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_TTL_S });
  return res;
}
/** Doar redirecționări relative, pe același site. */
export const back = (req: Request, path: string) => NextResponse.redirect(new URL(path, req.url), 303);
