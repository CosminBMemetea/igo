import "server-only";
import { NextResponse } from "next/server";
import { store } from "./store";
import { decide } from "./access";
import { SESSION_COOKIE, SESSION_TTL_S, signSession, type Session } from "./session";
export async function withSession(res: NextResponse, s: Omit<Session, "exp">) {
  const secret = process.env.SESSION_SECRET!;
  const version = s.uid ? (await store().userById(s.uid))?.sessionVersion ?? 0 : 0;
  const token = await signSession({ ...s, version, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_S }, secret);
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_TTL_S });
  return res;
}
/** Doar redirecționări relative, pe același site. */
export const back = (req: Request, path: string) => NextResponse.redirect(new URL(path, req.url), 303);
/** ?next= după login: doar cale relativă pe același site, pe care rolul o poate deschide; altfel null (pagina implicită). */
export function safeNext(raw: unknown, s: Omit<Session, "exp">): string | null {
  const n = typeof raw === "string" ? raw.trim() : "";
  if (!n || n.length > 200 || !/^\/(?![/\\])[A-Za-z0-9\-_/?=&.%~]*$/.test(n) || /^\/(login|api|signup)\b/.test(n)) return null;
  const path = n.split("?")[0];
  return decide(path, { ...s, exp: Math.floor(Date.now() / 1000) + 60 }).kind === "allow" ? n : null;
}
