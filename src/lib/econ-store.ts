// Ajustări economice: demo → cookie-ul sesiunii demo (nimic în DB); firmă reală → trucks.costs / trucks.archived_at.
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import type { CostProfile } from "./costs";
import type { Trip, Vehicle } from "./fleet/seed";

export const ECON_COOKIE = "qf-decon";
export interface DemoEcon { c: Record<string, Partial<CostProfile>>; a: string[]; t: Record<string, { r?: number; t?: number }> }
export async function readDemoEcon(): Promise<DemoEcon> {
  const raw = (await cookies()).get(ECON_COOKIE)?.value;
  if (!raw) return { c: {}, a: [], t: {} };
  try { const o = JSON.parse(decodeURIComponent(raw)) as Partial<DemoEcon>; return { c: o.c && typeof o.c === "object" ? o.c : {}, a: Array.isArray(o.a) ? o.a.filter((x) => typeof x === "string") : [], t: o.t && typeof o.t === "object" ? o.t : {} }; } catch { return { c: {}, a: [], t: {} }; }
}
export const writeDemoEcon = (res: NextResponse, e: DemoEcon) => res.cookies.set(ECON_COOKIE, encodeURIComponent(JSON.stringify(e)), { path: "/", maxAge: 60 * 60 * 24, sameSite: "lax", httpOnly: true });
export async function applyDemoEcon(vehicles: Vehicle[], trips: Trip[]): Promise<{ vehicles: Vehicle[]; trips: Trip[] }> {
  const e = (await readDemoEcon());
  return {
    vehicles: vehicles.map((v) => ({ ...v, costs: e.c[v.id] ? { ...(v.costs ?? {}), ...e.c[v.id] } : v.costs, archived: v.archived || e.a.includes(v.id) })),
    trips: trips.map((x) => { const o = e.t[x.id]; return o ? { ...x, revenue: o.r ?? x.revenue, tonnes: o.t ?? x.tonnes } : x; }),
  };
}
/** Flota activă (fără camioanele scoase din flotă) — pentru API live, ecranul șoferului și asistentul AI. */
export async function activeFleet(demo: boolean, vehicles: Vehicle[], trips: Trip[] = []): Promise<{ vehicles: Vehicle[]; trips: Trip[] }> {
  const a = demo ? (await applyDemoEcon(vehicles, trips)) : { vehicles, trips };
  const vs = a.vehicles.filter((v) => !v.archived), ids = new Set(vs.map((v) => v.id));
  return { vehicles: vs, trips: a.trips.filter((t) => ids.has(t.vehicleId)) };
}
