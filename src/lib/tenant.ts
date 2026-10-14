import { redirect } from "next/navigation";
// Querra Fleet: ce firmă vede cererea curentă. Rolul/firma vin DOAR din antetele puse de middleware după verificarea sesiunii.
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { demoRepo, type IgoRepository } from "./repo";
import { FirmRepository } from "./firm-repo";
import { dbConfigured, store, type FirmRow } from "./store";
import type { Role } from "./session";

export const ADMIN_FIRM_COOKIE = "igo-firm";
export interface Tenant { role: Role | null; uid: string | null; email: string | null; ownFirmId: string | null; firm: FirmRow | null; demo: boolean; repo: IgoRepository; dbOk: boolean; lost: boolean }
/** O singură dată per cerere (layout + pagină împart firma și repo-ul memoizat). */
export const tenant = cache(tenantUncached);
async function tenantUncached(): Promise<Tenant> {
  const h = headers();
  const r = h.get("x-igo-role");
  const role = (["admin", "owner", "driver", "user"] as const).find((x) => x === r) ?? null;
  const e = h.get("x-igo-email");
  const base = { role, uid: h.get("x-igo-uid"), email: e ? decodeURIComponent(e) : null, dbOk: dbConfigured() };
  const own = role === "owner" || role === "driver" ? h.get("x-igo-firm") : null;
  const firmId = role === "admin" ? cookies().get(ADMIN_FIRM_COOKIE)?.value ?? "demo" : own ?? "demo";
  // sesiune fără stare: verificăm contul la fiecare cerere — șofer dezactivat / cont șters → afară imediat
  if (own) {
    if (!base.uid) redirect("/api/auth/logout?e=off");
    if (process.env.NODE_ENV === "production" && !base.dbOk) throw new Error("Database required for real accounts");
    const u = await store().userById(base.uid);
    if (!u || u.disabledAt || !u.passwordHash || u.firmId !== own || u.role !== role || (u.sessionVersion ?? 0) !== Number(h.get("x-igo-version") ?? 0)) redirect("/api/auth/logout?e=off");
  }
  const firm = firmId === "demo" ? null : await store().firm(firmId);
  // demo dacă: utilizator demo, adminul n-a ales o firmă, firma are „Date demo” pornit (nu pentru șofer), sau firma lipsește (memorie resetată)
  const demo = !firm || (role !== "driver" && firm.demoMode);
  return { ...base, ownFirmId: own, firm, demo, repo: demo ? demoRepo() : new FirmRepository(store(), firm), lost: firmId !== "demo" && !firm };
}

/** Firma în care se poate scrie: proprietarul → firma lui; adminul → firma aleasă în /admin (niciodată demo). */
export async function writableFirm(): Promise<FirmRow | null> {
  const tn = await tenant();
  return !tn.demo && (tn.role === "owner" || tn.role === "admin") ? tn.firm : null;
}
