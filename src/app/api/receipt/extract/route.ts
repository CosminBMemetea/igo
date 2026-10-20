import { NextResponse } from "next/server";
import { groqChat, hasGroq } from "@/lib/groq";
import { tenant } from "@/lib/tenant";
import { sniffImage, MIME } from "@/lib/imgsniff";
import { normCur } from "@/lib/fuel/fx";
import { reportOperationFailure } from "@/lib/operation-error";
import { checkLimits, clientIp, limitResponse } from "@/lib/rate-limit";
export const dynamic = "force-dynamic";
export const maxDuration = 30; // loc pentru o reîncercare după limita de rată Groq
// Llama 4 Scout a fost oprit de Groq (17.07.2026, „groq-404”): modelele de viziune curente, în ordine.
const MODELS = [process.env.GROQ_VISION_MODEL, "qwen/qwen3.8-27b", "qwen/qwen3.6-27b"].filter((x): x is string => !!x);
const MAX = 4 * 1024 * 1024; // limita Groq pentru imagini base64 (clientul micșorează poza înainte)
const PROMPT = `Read this fuel receipt photo. Reply ONLY with JSON:
{"operator":string|null,"station":string|null,"date":"YYYY-MM-DD"|null,"plate":string|null,"litres":number|null,"amount":number|null,"odometerKm":number|null,"currency":string|null}
- operator: the fuel brand/company (e.g. "OMV", "Petrom", "MOL", "Rompetrol", "Lukoil", "Shell").
- station: only the station name or location (e.g. "Oradea 3", "Arad Vest"), without the operator name and without the street address.
- date: the transaction date printed on the receipt.
- plate: vehicle registration number if printed (e.g. "BH 21 QRT").
- litres: fuel quantity; amount: total paid; odometerKm: odometer/km if printed.
- currency: ISO 4217 code of the amount (RON for "lei", EUR, PLN for "zł", HUF for "Ft", CZK for "Kč", BGN for "лв", CHF, GBP, SEK, DKK, NOK...).
Use null when not visible. Numbers use a dot as decimal separator. Do not guess.`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: Request) {
  const tn = await tenant(), demo = tn.demo;
  const fd = await req.formData().catch(() => null);
  const photo = fd?.get("photo");
  if (!(photo instanceof File)) return NextResponse.json({ error: "photo" }, { status: 400 });
  if (photo.size > MAX) return NextResponse.json({ error: "too-large" }, { status: 413 });
  // conținutul real, nu extensia: un .txt redenumit .jpg sau octeți aleatori nu ajung la AI și nu primesc exemplu
  const buf = Buffer.from(await photo.arrayBuffer()), kind = sniffImage(new Uint8Array(buf.subarray(0, 16)));
  if (!kind || kind === "heic") return NextResponse.json({ error: "not-image" }, { status: 415 });
  // Demo sessions are public: never spend real Groq vision calls on them.
  if (demo) return NextResponse.json({ demo: true, error: "demo" }, { headers: { "cache-control": "no-store" } });
  if (!hasGroq()) return NextResponse.json({ error: "ai-unavailable" }, { status: 503 });
  const limited = await checkLimits([{ key: `ocr:u10:${tn.uid ?? clientIp(req)}`, limit: 5, windowS: 600 }, { key: `ocr:u:${tn.uid ?? clientIp(req)}`, limit: 20, windowS: 3600 }, { key: `ocr:f:${tn.firm?.id ?? "none"}`, limit: 200, windowS: 86400 }]);
  if (limited) return limitResponse(limited);
  const b64 = buf.toString("base64");
  let failure: unknown;
  for (const m of MODELS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const j = await groqChat({
          model: m, temperature: 0, response_format: { type: "json_object" },
          messages: [{ role: "user", content: [{ type: "text", text: PROMPT }, { type: "image_url", image_url: { url: `data:${MIME[kind]};base64,${b64}` } }] }],
        }, 15000);
        const txt = String((j.choices as { message?: { content?: string } }[] | undefined)?.[0]?.message?.content ?? "{}").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
        const raw = JSON.parse(txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1) || "{}") as Record<string, unknown>;
        const num = (x: unknown) => { const n = typeof x === "string" ? Number(x.replace(",", ".")) : x; return typeof n === "number" && n > 0 && n < 10_000_000 ? n : null; };
        const str = (x: unknown, n: number) => (typeof x === "string" && x.trim() ? x.replace(/\s+/g, " ").trim().slice(0, n) : null);
        const fields = { operator: str(raw.operator, 40), station: str(raw.station, 80), date: typeof raw.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : null, plate: str(raw.plate, 16)?.toUpperCase() ?? null, litres: num(raw.litres), amount: num(raw.amount), odometerKm: num(raw.odometerKm), currency: normCur(raw.currency) };
        // nimic citit (poză goală, nu e bon): spunem asta, nu inventăm valori
        if (fields.litres == null && fields.amount == null && fields.odometerKm == null) return NextResponse.json({ error: "not-receipt" }, { status: 422 });
        return NextResponse.json({ fields, model: m, sample: false }, { headers: { "cache-control": "no-store" } });
      } catch (e) {
        failure = e;
        // limită de rată (429, des la poze trimise una după alta) / pană scurtă: așteptăm cât cere Groq (max 8 s) și reîncercăm
        const ra = (e as { retryAfter?: number }).retryAfter;
        if (e instanceof Error && (/^groq-(429|5\d\d)$/.test(e.message) || e.name === "AbortError") && attempt < 2) { await sleep(Math.min(8000, Math.max(1500, (ra ?? 2) * 1000))); continue; }
        break; // 404/400 (model indisponibil) sau a doua eroare: următorul model
      }
    }
  }
  // JSON parser errors may embed receipt text; never send or log their message.
  const reference = reportOperationFailure("receipt-extract", failure);
  return NextResponse.json({ error: "ai-unavailable", reference }, { status: 502, headers: { "Cache-Control": "no-store" } });
}
