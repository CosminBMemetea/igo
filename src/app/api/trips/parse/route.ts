import { NextResponse } from "next/server";
import { tenant } from "@/lib/tenant";
import { store } from "@/lib/store";
import { groqChat, hasGroq } from "@/lib/groq";
import { estimateKm, matchDriver, parseQuick, type Parsed } from "@/lib/trip-new";
import { localNow, isDate } from "@/lib/validate";
export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
/** Text / voce → câmpurile cursei. La AI trimitem DOAR textul tastat și data de azi (fără date din flotă); numele șoferului îl potrivim local. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof b?.text === "string" ? b.text.trim().slice(0, 300) : "";
  if (!text) return NextResponse.json({ error: "empty" }, { status: 400 });
  const tn = await tenant(), today = localNow().slice(0, 10);
  if (!tn.firm || (tn.role !== "owner" && tn.role !== "admin")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  let p: Parsed = parseQuick(text, today), ai = false;
  if (hasGroq() && (!p.from || !p.to)) {
    try {
      const j = await groqChat({ model: MODEL, temperature: 0, response_format: { type: "json_object" }, messages: [
        { role: "system", content: `Extract a truck trip from the user's text (Romanian, English or Polish). Today is ${today}. Reply ONLY JSON: {"from":string|null,"to":string|null,"date":"YYYY-MM-DD"|null,"driver":string|null,"client":string|null,"tonnes":number|null}. Resolve relative dates (mâine = tomorrow). Keep city names as written.` },
        { role: "user", content: text } ] }, 7000);
      const c = (j.choices as { message?: { content?: string } }[] | undefined)?.[0]?.message?.content;
      const x = c ? JSON.parse(c) as Record<string, unknown> : {};
      const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 80) : undefined);
      p = { from: str(x.from) ?? p.from, to: str(x.to) ?? p.to, date: typeof x.date === "string" && isDate(x.date) ? x.date : p.date, driver: str(x.driver) ?? p.driver, client: str(x.client) ?? p.client, tonnes: typeof x.tonnes === "number" && x.tonnes >= 0 && x.tonnes <= 60 ? x.tonnes : p.tonnes }; ai = true;
    } catch { /* rămâne interpretarea locală */ }
  }
  const drivers = !tn.demo && tn.firm ? (await store().users(tn.firm.id)).filter((u) => u.role === "driver" && !u.disabledAt) : [];
  const d = matchDriver(p.driver, drivers);
  return NextResponse.json({ ...p, driverId: d?.id ?? null, truckId: d?.truckId ?? null, km: p.from && p.to ? estimateKm(p.from, p.to) : null, ai });
}
