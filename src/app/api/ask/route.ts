import { activeFleet } from "@/lib/econ-store";
import { NextResponse } from "next/server";
import { tenant } from "@/lib/tenant";
import { TOOLS, detectLocale, parseToolCall, render, ruleIntent, type ToolCall } from "@/lib/ask";
import { isLocale, type Locale } from "@/lib/i18n";
import { groqChat } from "@/lib/groq";
import { checkLimits, clientIp } from "@/lib/rate-limit";

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
  const tn = await tenant(), r = tn.repo;
  const [v0, t0, clients, a0] = await Promise.all([r.vehicles(), r.trips(), r.clients(), r.alerts()]);
  const { vehicles, trips } = (await activeFleet(tn.demo, v0, t0)), alerts = a0.filter((a) => vehicles.some((v) => v.id === (a as { vehicleId?: string }).vehicleId) || !(a as { vehicleId?: string }).vehicleId);
  const data = { vehicles, trips, clients, alerts };
  let reason: string | null = null;
  // Demo is public: answer with the local rules, no Groq call. Real firms: limited per user and per firm.
  const limited = tn.demo ? { error: "demo" } : await checkLimits([{ key: `ask:u:${tn.uid ?? clientIp(req)}`, limit: 60, windowS: 3600 }, { key: `ask:f:${tn.firm?.id ?? "none"}`, limit: 500, windowS: 86400 }]);
  if (limited) return NextResponse.json({ ...render(loc, data, ruleIntent(q), "rules"), reason: limited.error, locale: loc });
  try {
    const call = await route(q, vehicles.map((v) => v.name));
    if (call) return NextResponse.json({ ...render(loc, data, call, "ai"), locale: loc });
    reason = "no-tool";
  } catch (e) { reason = e instanceof Error ? e.message : "error"; }
  return NextResponse.json({ ...render(loc, data, ruleIntent(q), "rules"), reason, locale: loc });
}
