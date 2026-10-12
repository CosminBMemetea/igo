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
