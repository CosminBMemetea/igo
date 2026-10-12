// Demo: tura și pauza privată se țin într-un cookie (depozitul demo e în memorie, per instanță serverless),
// ca „Privat” să nu se piardă la reîncărcare (GDPR: pauza privată trebuie să rămână privată).
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import type { Shift } from "./repo";
const C = "qf-dshift";
type Map = Record<string, Shift>;
const read = (): Map => { try { return JSON.parse(cookies().get(C)?.value ?? "{}") as Map; } catch { return {}; } };
export const demoShift = (vehicleId: string): Shift | null => read()[vehicleId] ?? null;
export function saveDemoShift(res: NextResponse, s: Shift) {
  const m = read(); m[s.vehicleId] = s;
  res.cookies.set(C, JSON.stringify(m), { path: "/", maxAge: 60 * 60 * 24, sameSite: "lax", httpOnly: true });
  return res;
}

/** Demo: ultima alimentare trimisă de șofer (doar în cookie-ul vizitatorului, nu în memoria comună). */
const F = "qf-dfill";
export const demoLastFill = (vehicleId: string): { litres: number; station: string } | null => { try { return (JSON.parse(cookies().get(F)?.value ?? "{}") as Record<string, { litres: number; station: string }>)[vehicleId] ?? null; } catch { return null; } };
export function saveDemoFill(res: NextResponse, vehicleId: string, litres: number, station: string) {
  let m: Record<string, { litres: number; station: string }> = {};
  try { m = JSON.parse(cookies().get(F)?.value ?? "{}"); } catch {}
  m[vehicleId] = { litres, station: station.slice(0, 60) };
  res.cookies.set(F, JSON.stringify(m), { path: "/", maxAge: 60 * 60 * 24, sameSite: "lax", httpOnly: true });
  return res;
}
