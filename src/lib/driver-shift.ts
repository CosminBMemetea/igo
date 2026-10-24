// Tura curentă a camionului, aceeași pe Acasă și în bara de tură de pe celelalte taburi.
import "server-only";
import type { Tenant } from "./tenant";
import { demoShift } from "./demo-shift";

export async function currentShift(tn: Tenant, vehicleId: string, nowMs = Date.now()) {
  const shift0 = (tn.demo ? (await demoShift(vehicleId)) : null) ?? (await tn.repo.shift(vehicleId));
  // demo: o tură nu durează peste 12 h și nu începe în viitor (cookie de ieri / noaptea înainte de 05:30) → tură proaspătă, realistă (~2,5 h)
  const age = shift0 && !shift0.end ? nowMs - Date.parse(shift0.start) : 0;
  if (tn.demo && shift0 && !shift0.end && (age < 0 || age > 12 * 3600e3 || Number.isNaN(age))) {
    const st = new Date(nowMs - 2.5 * 3600e3).toISOString();
    return { ...shift0, start: st, privateSince: shift0.privateSince ? st : null };
  }
  return shift0;
}
