import { NextResponse } from "next/server";
import { groqChat, hasGroq } from "@/lib/groq";
import { tenant } from "@/lib/tenant";
import { realToday } from "@/lib/demo-time";
export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";
// Llama 4 Scout a fost oprit de Groq (17.07.2026, „groq-404”): modelele de viziune curente, în ordine.
const MODELS = [process.env.GROQ_VISION_MODEL, "qwen/qwen3.8-27b", "qwen/qwen3.6-27b"].filter((x): x is string => !!x);
const MAX = 4 * 1024 * 1024; // limita Groq pentru imagini base64 (clientul micșorează poza înainte)
const PROMPT = `Read this fuel receipt photo. Reply ONLY with JSON:
{"operator":string|null,"station":string|null,"date":"YYYY-MM-DD"|null,"plate":string|null,"litres":number|null,"amount":number|null,"odometerKm":number|null}
- operator: the fuel brand/company (e.g. "OMV", "Petrom", "MOL", "Rompetrol", "Lukoil", "Shell").
- station: only the station name or location (e.g. "Oradea 3", "Arad Vest"), without the operator name and without the street address.
- date: the transaction date printed on the receipt.
- plate: vehicle registration number if printed (e.g. "BH 21 QRT").
- litres: fuel quantity; amount: total paid; odometerKm: odometer/km if printed.
Use null when not visible. Numbers use a dot as decimal separator. Do not guess.`;

/** Demo: exemplu fix, folosit DOAR când apelul AI chiar eșuează; clientul îl marchează „Exemplu demo”. */
const sample = (why: string) => NextResponse.json({ fields: { operator: "OMV", station: "Cluj-Napoca", date: realToday(), plate: null, litres: 152.4, amount: 1112.5, odometerKm: 547912 }, model: "demo-sample", sample: true, why });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: Request) {
  const demo = (await tenant()).demo;
  const fd = await req.formData().catch(() => null);
  const photo = fd?.get("photo");
  if (!(photo instanceof File) || !photo.type.startsWith("image/")) return NextResponse.json({ error: "photo" }, { status: 400 });
  if (photo.size > MAX) return NextResponse.json({ error: "too-large" }, { status: 413 });
  if (!hasGroq()) return demo ? sample("no-key") : NextResponse.json({ error: "ai-unavailable" }, { status: 503 });
  const b64 = Buffer.from(await photo.arrayBuffer()).toString("base64");
  let last = "groq";
  for (const m of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const j = await groqChat({
          model: m, temperature: 0, response_format: { type: "json_object" },
          messages: [{ role: "user", content: [{ type: "text", text: PROMPT }, { type: "image_url", image_url: { url: `data:${photo.type};base64,${b64}` } }] }],
        }, 15000);
        const txt = String((j.choices as { message?: { content?: string } }[] | undefined)?.[0]?.message?.content ?? "{}").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
        const raw = JSON.parse(txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1) || "{}") as Record<string, unknown>;
        const num = (x: unknown) => { const n = typeof x === "string" ? Number(x.replace(",", ".")) : x; return typeof n === "number" && n > 0 && n < 10_000_000 ? n : null; };
        const str = (x: unknown, n: number) => (typeof x === "string" && x.trim() ? x.replace(/\s+/g, " ").trim().slice(0, n) : null);
        const fields = { operator: str(raw.operator, 40), station: str(raw.station, 80), date: typeof raw.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : null, plate: str(raw.plate, 16)?.toUpperCase() ?? null, litres: num(raw.litres), amount: num(raw.amount), odometerKm: num(raw.odometerKm) };
        return NextResponse.json({ fields, model: m, sample: false }, { headers: { "cache-control": "no-store" } });
      } catch (e) {
        last = e instanceof Error ? e.message : "error";
        if (/429|5\d\d|abort/i.test(last) && attempt === 0) { await sleep(1500); continue; } // limită de rată / pană scurtă: o reîncercare
        break; // 404/400 (model indisponibil) sau a doua eroare: următorul model
      }
    }
  }
  console.error("receipt-extract failed:", last);
  return demo ? sample(last) : NextResponse.json({ error: last }, { status: 502 });
}
