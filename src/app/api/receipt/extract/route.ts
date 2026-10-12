import { NextResponse } from "next/server";
import { groqChat, hasGroq } from "@/lib/groq";
import { tenant } from "@/lib/tenant";
import { realToday } from "@/lib/demo-time";
export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";
// Llama 4 Scout a fost oprit de Groq (17.07.2026, „groq-404”): încercăm modelele de viziune curente, în ordine.
const MODELS = [process.env.GROQ_VISION_MODEL, "qwen/qwen3.8-27b", "qwen/qwen3.6-27b"].filter((x): x is string => !!x);
const MAX = 4 * 1024 * 1024; // limita Groq pentru imagini base64

/** Poză bon → câmpuri. Fără GROQ_API_KEY: 503 și șoferul completează manual. */
/** Demo: extragere fixă, credibilă (bon OMV), ca demo-ul să meargă și fără AI sau când AI-ul pică. */
const canned = () => NextResponse.json({ fields: { date: realToday(), station: "OMV Cluj-Napoca", litres: 152.4, amount: 1112.5, odometerKm: 547912 }, model: "demo" });
export async function POST(req: Request) {
  const demo = (await tenant()).demo;
  if (!hasGroq()) return demo ? canned() : NextResponse.json({ error: "ai-unavailable" }, { status: 503 });
  const fd = await req.formData().catch(() => null);
  const photo = fd?.get("photo");
  if (!(photo instanceof File) || !photo.type.startsWith("image/")) return NextResponse.json({ error: "photo" }, { status: 400 });
  if (photo.size > MAX) return NextResponse.json({ error: "too-large" }, { status: 413 });
  const b64 = Buffer.from(await photo.arrayBuffer()).toString("base64");
  try {
    let j: Record<string, unknown> | null = null, MODEL = MODELS[0], last: unknown = null;
    for (const m of MODELS) {
      try {
        j = await groqChat({
          model: m, temperature: 0, response_format: { type: "json_object" },
          messages: [{ role: "user", content: [
            { type: "text", text: 'Read this fuel receipt. Reply ONLY with JSON: {"date":"YYYY-MM-DD"|null,"station":string|null,"litres":number|null,"amount":number|null,"odometerKm":number|null}. Use null when not visible. Numbers use a dot as decimal separator.' },
            { type: "image_url", image_url: { url: `data:${photo.type};base64,${b64}` } },
          ] }],
        }, 15000);
        MODEL = m; break;
      } catch (e) { last = e; if (!/404|400/.test(String(e instanceof Error ? e.message : e))) break; }
    }
    if (!j) throw last ?? new Error("groq");
    const txt = String((j.choices as { message?: { content?: string } }[] | undefined)?.[0]?.message?.content ?? "{}").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    const raw = JSON.parse(txt) as Record<string, unknown>;
    const num = (x: unknown) => (typeof x === "number" && x > 0 && x < 10_000_000 ? x : null);
    const fields = { date: typeof raw.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : null, station: typeof raw.station === "string" ? raw.station.slice(0, 80) : null, litres: num(raw.litres), amount: num(raw.amount), odometerKm: num(raw.odometerKm) };
    return NextResponse.json({ fields, model: MODEL });
  } catch (e) {
    if (demo) return canned();
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 502 });
  }
}
