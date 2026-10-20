// Parsing of LLM JSON replies (receipt OCR).
/** Model output → object. Tolerates <think> blocks, ```json fences and text around the object. */
export function parseModelJson(content: unknown): Record<string, unknown> | null {
  const txt = String(content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").replace(/```(?:json)?/gi, "").trim();
  for (const candidate of [txt, txt.slice(txt.indexOf("{"), txt.lastIndexOf("}") + 1)]) {
    if (!candidate) continue;
    try { const v = JSON.parse(candidate); if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>; } catch { /* try the next form */ }
  }
  return null;
}
