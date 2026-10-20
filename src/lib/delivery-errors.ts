/** Only stable codes are persisted: provider bodies may contain addresses, keys or payloads. */
export class DeliveryError extends Error {
  constructor(public code: string, public retryable: boolean, public retryAfterMs = 0, public removeDevice = false) { super(code); }
}
export function retryAfter(value: string | null, now = Date.now()) {
  if (!value) return 0;
  const seconds = Number(value);
  const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now;
  return Number.isFinite(ms) ? Math.max(0, Math.min(ms, 24 * 3600000)) : 0;
}
export function httpFailure(channel: "email" | "push", status: number, after: string | null) {
  return new DeliveryError(`${channel}-http-${status}`, status === 408 || status === 425 || status === 429 || status >= 500, retryAfter(after), channel === "push" && (status === 404 || status === 410));
}
/** Shape check instead of `instanceof`: test runners (tsx) and bundles can load two copies of this module. */
export const isDeliveryError = (e: unknown): e is DeliveryError =>
  e instanceof DeliveryError || (e instanceof Error && typeof (e as DeliveryError).code === "string" && typeof (e as DeliveryError).retryable === "boolean" && typeof (e as DeliveryError).retryAfterMs === "number");
