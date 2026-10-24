import { NextResponse } from "next/server";
import { notificationJob } from "@/lib/notification-job";
import { drainDeliveries } from "@/lib/delivery";
import { dbConfigured, store } from "@/lib/store";
import { retrySpeedAlerts } from "@/lib/speed-service";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
/**
 * Vercel Cron (daily on Hobby): retries owner speed alerts that are due and still unsent (open or closed events), then drains the outbox.
 * Readings already retry opportunistically per firm; this pass covers firms whose trucks stopped sending.
 * CRON_SECRET is mandatory (Vercel sends it as a Bearer token); without it the route refuses.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!dbConfigured()) return NextResponse.json({ skipped: "no database" });
  const speed = await notificationJob(store(), "speed-alerts", () => retrySpeedAlerts(store()));
  const delivery = await notificationJob(store(), "deliveries", () => drainDeliveries(store()));
  return NextResponse.json({ speed, delivery });
}
