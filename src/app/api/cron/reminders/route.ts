import { NextResponse } from "next/server";
import { dbConfigured, store } from "@/lib/store";
import { runReminders } from "@/lib/reminders";
export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
/** Vercel Cron (vercel.json, zilnic ~06:00 Europe/Bucharest). Cu CRON_SECRET: cere „Authorization: Bearer …”; fără: doar user-agentul vercel-cron. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const ok = secret ? req.headers.get("authorization") === `Bearer ${secret}` : /vercel-cron/i.test(req.headers.get("user-agent") ?? "");
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!dbConfigured()) return NextResponse.json({ skipped: "no database" });
  return NextResponse.json(await runReminders(store()));
}
