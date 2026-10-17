import { verifyToken, type Session } from "./session";
export const MOBILE_TTL_S = 12 * 60 * 60;
export type MobileSession = Session & { purpose: "driver-mobile"; role: "driver"; uid: string; version: number };
export function mobileRoute(path: string, method: string): boolean {
  return method === "GET" ? ["/api/driver/mobile", "/api/driver/tracking"].includes(path)
    : method === "POST" && ["/api/driver/shift", "/api/driver/private", "/api/driver/ping"].includes(path);
}
export async function verifyMobileSession(token: string | undefined, secret: string | undefined): Promise<MobileSession | null> {
  const s = await verifyToken<MobileSession>(token, secret);
  return s?.purpose === "driver-mobile" && s.role === "driver" && typeof s.uid === "string" && !!s.uid
    && typeof s.firm === "string" && s.firm !== "demo" && typeof s.email === "string"
    && Number.isInteger(s.version) && s.version >= 0 ? s : null;
}
