import type { Shift } from "./repo";

/** Visitor-local demo work total; retain completed shifts and exclude private pauses. */
export type DemoWorkShift = Shift & { workMs?: number; workAt?: number };
export function demoWorkMs(shift: DemoWorkShift | null, now: number): number {
  if (!shift) return 0;
  if (Number.isFinite(shift.workMs) && Number.isFinite(shift.workAt)) {
    return Math.max(0, shift.workMs!) + (!shift.end && !shift.privateSince ? Math.max(0, now - shift.workAt!) : 0);
  }
  const end = shift.end ? Date.parse(shift.end) : shift.privateSince ? Date.parse(shift.privateSince) : now;
  const elapsed = end - Date.parse(shift.start);
  // Seeded shifts use the demo clock; present an active seed as 2.5 hours when outside the real clock.
  return Number.isFinite(elapsed) && elapsed >= 0 && elapsed <= 12 * 3600000 ? elapsed : 2.5 * 3600000;
}
export function carryDemoWork(next: Shift, previous: DemoWorkShift | null, now: number): DemoWorkShift {
  return { ...next, workMs: demoWorkMs(previous, now), workAt: now };
}
