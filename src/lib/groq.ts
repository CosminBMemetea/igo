import "server-only";
// Groq (compatibil OpenAI). Cheia stă DOAR pe server (GROQ_API_KEY); nu se trimit date din flotă la model.
const BASE = process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
export const hasGroq = () => !!process.env.GROQ_API_KEY;
export async function groqChat(body: Record<string, unknown>, timeoutMs = 9000): Promise<Record<string, unknown>> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("no-key");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${BASE}/chat/completions`, { method: "POST", signal: ctrl.signal, headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) {
      // 429: Groq spune cât să așteptăm (retry-after, secunde) — îl transmitem apelantului
      const ra = Number(r.headers.get("retry-after")); const e = new Error(`groq-${r.status}`) as Error & { retryAfter?: number };
      if (Number.isFinite(ra) && ra > 0) e.retryAfter = ra;
      throw e;
    }
    return (await r.json()) as Record<string, unknown>;
  } finally { clearTimeout(timer); }
}
