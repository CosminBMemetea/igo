import { NextResponse } from "next/server";
import { groqChat, hasGroq } from "@/lib/groq";
export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";
const MODEL = process.env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";
const MAX = 4 * 1024 * 1024; // limita Groq pentru imagini base64

/** Poză bon → câmpuri. Fără GROQ_API_KEY: 503 și șoferul completează manual. */
export async function POST(req: Request) {
  if (!hasGroq()) return NextResponse.json({ error: "ai-unavailable" }, { status: 503 });
  const fd = await req.formData().catch(() => null);
  const photo = fd?.get("photo");
  if (!(photo instanceof File) || !photo.type.startsWith("image/")) return NextResponse.json({ error: "photo" }, { status: 400 });
  if (photo.size > MAX) return NextResponse.json({ error: "too-large" }, { status: 413 });
  const b64 = Buffer.from(await photo.arrayBuffer()).toString("base64");
  try {
    const j = await groqChat({
      model: MODEL, temperature: 0, response_format: { type: "json_object" },
      messages: [{ role: "user", content: [
        { type: "text", text: 'Read this fuel receipt. Reply ONLY with JSON: {"date":"YYYY-MM-DD"|null,"station":string|null,"litres":number|null,"amount":number|null,"odometerKm":number|null}. Use null when not visible. Numbers use a dot as decimal separator.' },
        { type: "image_url", image_url: { url: `data:${photo.type};base64,${b64}` } },
      ] }],
    }, 15000);
    const txt = (j.choices as { message?: { content?: string } }[] | undefined)?.[0]?.message?.content ?? "{}";
    const raw = JSON.parse(txt) as Record<string, unknown>;
    const num = (x: unknown) => (typeof x === "number" && x > 0 && x < 10_000_000 ? x : null);
    const fields = { date: typeof raw.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : null, station: typeof raw.station === "string" ? raw.station.slice(0, 80) : null, litres: num(raw.litres), amount: num(raw.amount), odometerKm: num(raw.odometerKm) };
    return NextResponse.json({ fields, model: MODEL });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 502 });
  }
}
