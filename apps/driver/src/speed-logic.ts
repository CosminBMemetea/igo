/** Keep in sync with src/lib/speed.ts (driverAlert). Local warning only; the server records events independently. */
const TOLERANCE_KMH = 3, MAX_PLAUSIBLE_KMH = 140, HOLD_MS = 5000, EVERY_MS = 120000;
export type State = { overSince: number | null; lastAlert: number | null };
export function driverAlert(st: State, kmh: number | null, limit: number, now: number) {
  const over = kmh != null && kmh > limit + TOLERANCE_KMH && kmh <= MAX_PLAUSIBLE_KMH;
  if (!over) return { st: { ...st, overSince: null }, alert: false, over };
  const overSince = st.overSince ?? now;
  const alert = now - overSince >= HOLD_MS && (st.lastAlert == null || now - st.lastAlert >= EVERY_MS);
  return { st: { overSince, lastAlert: alert ? now : st.lastAlert }, alert, over };
}
