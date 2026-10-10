import { NextResponse } from "next/server";
import { repo } from "@/lib/repo";
import { TOOLS, detectLocale, parseToolCall, render, ruleIntent, type ToolCall } from "@/lib/ask";
import { isLocale, type Locale } from "@/lib/i18n";
import { groqChat } from "@/lib/groq";

export const preferredRegion = "fra1";
export const dynamic = "force-dynamic";
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

/** Trimite la Groq DOAR întrebarea și lista de funcții; nicio dată din flotă. */
async function route(question: string, names: string[]): Promise<ToolCall | null> {
  const j = await groqChat({
    model: MODEL, temperature: 0,
    messages: [
      { role: "system", content: `You route a fleet owner's question (Romanian, English or Polish) to exactly one function. Current month: October 2026. Known vehicles: ${names.join(", ")}. Always call a function; never answer in text.` },
      { role: "user", content: question.slice(0, 500) },
    ],
    tools: TOOLS.map((f) => ({ type: "function", function: f })),
    tool_choice: "required",
  });
  const call = (j.choices as { message?: { tool_calls?: { function: { name: string; arguments: string } }[] } }[] | undefined)?.[0]?.message?.tool_calls?.[0]?.function;
  return call ? parseToolCall(call.name, call.arguments) : null;
}

export async function POST(req: Request) {
  let body: { question?: unknown; locale?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const q = typeof body.question === "string" ? body.question.trim() : "";
  if (!q || q.length > 500) return NextResponse.json({ error: "question" }, { status: 400 });
  const loc: Locale = detectLocale(q, isLocale(body.locale) ? body.locale : "ro");
  const r = repo();
  const [vehicles, trips, clients, alerts] = await Promise.all([r.vehicles(), r.trips(), r.clients(), r.alerts()]);
  const data = { vehicles, trips, clients, alerts };
  let reason: string | null = null;
  try {
    const call = await route(q, vehicles.map((v) => v.name));
    if (call) return NextResponse.json({ ...render(loc, data, call, "ai"), locale: loc });
    reason = "no-tool";
  } catch (e) { reason = e instanceof Error ? e.message : "error"; }
  return NextResponse.json({ ...render(loc, data, ruleIntent(q), "rules"), reason, locale: loc });
}
