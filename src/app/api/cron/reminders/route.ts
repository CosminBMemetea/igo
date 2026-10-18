import { notificationJob } from "@/lib/notification-job";
import { drainDeliveries } from "@/lib/delivery";
import { NextResponse } from "next/server";
import { dbConfigured, store } from "@/lib/store";
import { runReminders } from "@/lib/reminders";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
/** Vercel Cron: daily 03:00 UTC (05:00/06:00 Bucharest). CRON_SECRET is mandatory; User-Agent never authorizes a request. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const ok = !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!dbConfigured()) return NextResponse.json({ skipped: "no database" });
  const reminders = await notificationJob(store(), "reminders", () => runReminders(store(), undefined, null, "ro", { defer: true }));
  const delivery = await notificationJob(store(), "deliveries", () => drainDeliveries(store()));
  return NextResponse.json({ ...reminders, delivery });
}
