import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { getPrefs } from "@/lib/prefs";
import { writableFirm } from "@/lib/tenant";
import { speedCsv } from "@/lib/speed";
import { speedFilter, speedReport, fmtLocal } from "@/lib/speed-report";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const role = (await headers()).get("x-igo-role"), firm = await writableFirm();
  if (!firm || (role !== "owner" && role !== "admin")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const q = Object.fromEntries(new URL(req.url).searchParams);
  const { loc } = await getPrefs();
  const { rows } = await speedReport(store(), firm.id, speedFilter(q));
  return new NextResponse("\ufeff" + speedCsv(rows, fmtLocal, loc), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="depasiri-viteza.csv"`, "Cache-Control": "no-store" } });
}
