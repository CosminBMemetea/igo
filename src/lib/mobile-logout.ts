import { createHash } from "node:crypto";
import { signToken, verifyToken } from "./session";
import type { MobileSession } from "./mobile-session";
export const mobileSessionId = (token: string) => createHash("sha256").update(token).digest("hex");
type Receipt = { purpose: "driver-mobile-logout"; sessionId: string; firm: string; uid: string; exp: number };
/** Can only revoke this session; cannot read data, change a shift or authenticate. */
export async function logoutReceipt(token: string, session: MobileSession) {
  return signToken({ purpose: "driver-mobile-logout", sessionId: mobileSessionId(token), firm: session.firm, uid: session.uid, exp: session.exp } satisfies Receipt, process.env.SESSION_SECRET!);
}
export async function verifyLogoutReceipt(value: unknown) {
  if (typeof value !== "string" || value.length > 4096) return null;
  const r = await verifyToken<Receipt>(value, process.env.SESSION_SECRET);
  return r?.purpose === "driver-mobile-logout" && /^[a-f0-9]{64}$/.test(r.sessionId)
    && typeof r.firm === "string" && !!r.firm && typeof r.uid === "string" && !!r.uid ? r : null;
}
