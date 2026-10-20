import { NextResponse } from "next/server";
import { tenant, writableFirm } from "@/lib/tenant";
import { checkLimits, limitResponse } from "@/lib/rate-limit";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
export async function GET() {
  if (!(await writableFirm())) return NextResponse.json({ enabled: false }, { status: 403 });
  return NextResponse.json({ enabled: !!process.env.GROQ_API_KEY });
}
export async function POST(req: Request) {
  const firm = await writableFirm();
  if (!firm) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const limited = await checkLimits([{ key: `stt:u:${(await tenant()).uid ?? "admin"}`, limit: 60, windowS: 3600 }, { key: `stt:f:${firm.id}`, limit: 400, windowS: 86400 }]);
  if (limited) return limitResponse(limited);
  const key = process.env.GROQ_API_KEY;
  if (!key) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  if (Number(req.headers.get("content-length")) > 2_200_000) return NextResponse.json({ error: "size" }, { status: 413 });
  const form = await req.formData().catch(() => null), file = form?.get("audio");
  if (!(file instanceof File) || !file.size || file.size > 2_000_000 || !/^(audio\/(webm|mp4|ogg|wav|mpeg)|video\/webm)(;|$)/.test(file.type)) return NextResponse.json({ error: "audio" }, { status: 400 });
  const body = new FormData();
  body.set("file", file); body.set("model", "whisper-large-v3-turbo"); body.set("response_format", "json");
  const lang = String(form?.get("language")); if (["ro", "en", "pl"].includes(lang)) body.set("language", lang);
  try {
    const response = await fetch(`${process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1"}/audio/transcriptions`, { method: "POST", headers: { authorization: `Bearer ${key}` }, body, signal: AbortSignal.timeout(25000) });
    if (!response.ok) return NextResponse.json({ error: response.status === 429 ? "rate" : "service" }, { status: 503 });
    const result = await response.json();
    const text = typeof result.text === "string" ? result.text.trim().slice(0, 1000) : "";
    return text ? NextResponse.json({ text }) : NextResponse.json({ error: "silence" }, { status: 422 });
  } catch { return NextResponse.json({ error: "service" }, { status: 503 }); }
}
