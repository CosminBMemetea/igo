// Ajustări economice: demo → cookie-ul sesiunii demo (nimic în DB); firmă reală → trucks.costs / trucks.archived_at.
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import type { CostProfile } from "./costs";
import type { Trip, Vehicle } from "./fleet/seed";

export const ECON_COOKIE = "qf-decon";
export interface DemoEcon { c: Record<string, Partial<CostProfile>>; a: string[]; t: Record<string, { r?: number; t?: number }> }
export function readDemoEcon(): DemoEcon {
  const raw = cookies().get(ECON_COOKIE)?.value;
  if (!raw) return { c: {}, a: [], t: {} };
  try { const o = JSON.parse(decodeURIComponent(raw)) as Partial<DemoEcon>; return { c: o.c && typeof o.c === "object" ? o.c : {}, a: Array.isArray(o.a) ? o.a.filter((x) => typeof x === "string") : [], t: o.t && typeof o.t === "object" ? o.t : {} }; } catch { return { c: {}, a: [], t: {} }; }
}
export const writeDemoEcon = (res: NextResponse, e: DemoEcon) => res.cookies.set(ECON_COOKIE, encodeURIComponent(JSON.stringify(e)), { path: "/", maxAge: 60 * 60 * 24, sameSite: "lax", httpOnly: true });
export function applyDemoEcon(vehicles: Vehicle[], trips: Trip[]): { vehicles: Vehicle[]; trips: Trip[] } {
  const e = readDemoEcon();
  return {
    vehicles: vehicles.map((v) => ({ ...v, costs: e.c[v.id] ? { ...(v.costs ?? {}), ...e.c[v.id] } : v.costs, archived: v.archived || e.a.includes(v.id) })),
    trips: trips.map((x) => { const o = e.t[x.id]; return o ? { ...x, revenue: o.r ?? x.revenue, tonnes: o.t ?? x.tonnes } : x; }),
  };
}
