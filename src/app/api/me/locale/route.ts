import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { store } from "@/lib/store";
import { dbConfigured } from "@/db/client";
export const dynamic = "force-dynamic";
/** Schimbă limba: cookie + (dacă e un cont real) salvată pe utilizator. Doar căi interne în `next`. */
export async function GET(req: Request) {
  const u = new URL(req.url), l = u.searchParams.get("l") ?? "";
  const n = u.searchParams.get("next") ?? "/", next = n.startsWith("/") && !n.startsWith("//") ? n : "/";
  const res = NextResponse.redirect(new URL(next, req.url), 303);
  if (l !== "ro" && l !== "en" && l !== "pl") return res;
  res.cookies.set("igo-locale", l, { path: "/", maxAge: 31536000, sameSite: "lax" });
  const uid = headers().get("x-igo-uid");
  if (uid && dbConfigured()) await store().setUserLocale(uid, l).catch(() => {});
  return res;
}
