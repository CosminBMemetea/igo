import type { Store } from "./store/types";
/** GPS positions are kept 90 days (privacy page). Trip records keep km, costs and status. */
export const POSITION_RETENTION_DAYS = 90;
export const positionCutoff = (now = Date.now()) => new Date(now - POSITION_RETENTION_DAYS * 86400000).toISOString().slice(0, 10); // day prefix: works for local "YYYY-MM-DDTHH:mm" and ISO `at` values
/** Speeding events follow the same 90-day horizon as GPS points (privacy page). */
export const SPEED_RETENTION_DAYS = 90;
export async function purgeOldPositions(s: Store, now = Date.now()) {
  return { positionsDeleted: await s.purgePositions(positionCutoff(now)), speedEventsDeleted: await s.purgeSpeedEvents(new Date(now - SPEED_RETENTION_DAYS * 86400_000).toISOString()) };
}
