import { sql } from "drizzle-orm";
import { db, dbConfigured } from "@/db/client";
import { reportOperationFailure } from "@/lib/operation-error";
export const dynamic = "force-dynamic";
/** Starea bazei de date (fără date sensibile). */
export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  if (!dbConfigured()) return Response.json({ db: "not-configured" }, { headers });
  const t = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([db().execute(sql`select 1`), new Promise((_, r) => { timer = setTimeout(() => r(new Error("timeout")), 8000); })]);
    return Response.json({ db: "ok", ms: Date.now() - t }, { headers });
  } catch (e) {
    return Response.json({ db: "error", ms: Date.now() - t, error: "unavailable", reference: reportOperationFailure("health", e) }, { status: 503, headers });
  } finally { if (timer !== undefined) clearTimeout(timer); }
}
