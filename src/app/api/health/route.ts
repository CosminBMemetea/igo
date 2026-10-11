import { sql } from "drizzle-orm";
import { db, dbConfigured } from "@/db/client";
export const dynamic = "force-dynamic";
/** Starea bazei de date (fără date sensibile). */
export async function GET() {
  if (!dbConfigured()) return Response.json({ db: "not-configured" });
  const t = Date.now();
  try {
    await Promise.race([db().execute(sql`select 1`), new Promise((_, r) => setTimeout(() => r(new Error("timeout")), 8000))]);
    return Response.json({ db: "ok", ms: Date.now() - t });
  } catch (e) {
    return Response.json({ db: "error", ms: Date.now() - t, error: String((e as Error).message ?? e).slice(0, 160).replace(/postgres(ql)?:\/\/\S+/g, "[url]") }, { status: 503 });
  }
}
