import { verifyToken } from "@/lib/session";
import { verifyLogoutReceipt } from "@/lib/mobile-logout";
import { store } from "@/lib/store";
import { notificationBody } from "@/lib/notification-auth";
export const dynamic = "force-dynamic";
/** Deliberately does not require the removed login bearer. The receipt grants revocation only. */
export async function POST(req: Request) {
  const body = await notificationBody(req).catch(() => null);
  const push = typeof body?.receipt === "string" ? await verifyToken<{ purpose: string; id: string; firm: string; uid: string; exp: number }>(body.receipt, process.env.SESSION_SECRET) : null;
  if (push?.purpose === "driver-push-revoke" && typeof push.id === "string" && push.id && typeof push.firm === "string" && typeof push.uid === "string") {
    await store().removePushDevice(push.firm, push.uid, push.id);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  }
  const receipt = await verifyLogoutReceipt(body?.receipt);
  if (!receipt) return Response.json({ error: "receipt" }, { status: 400 });
  const s = store();
  await s.revokeMobileSession(receipt.sessionId, new Date(receipt.exp * 1000).toISOString());
  const devices = await s.pushDevices(receipt.firm, receipt.uid);
  for (const device of devices) if (device.nativeSessionId === receipt.sessionId)
    await s.removePushDevice(receipt.firm, receipt.uid, device.id);
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
