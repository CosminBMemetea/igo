import { notificationJob } from "@/lib/notification-job";
import { dbConfigured, store } from "@/lib/store";
import { drainDeliveries } from "@/lib/delivery";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
/** Schedule every 5 minutes on an eligible plan or an authenticated external scheduler. */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!dbConfigured()) return Response.json({ error: "database-required" }, { status: 503 });
  return Response.json(await notificationJob(store(), "deliveries", () => drainDeliveries(store())));
}
