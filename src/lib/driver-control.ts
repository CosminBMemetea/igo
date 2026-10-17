/** Bounded request: a dropped network or an HTML login redirect cannot lock shift buttons. */
export async function postDriverControl(path: string, body: object, send: typeof fetch = fetch, timeoutMs = 12000) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await send(path, { method: "POST", signal: controller.signal, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => null);
    return { ok: response.ok && !response.redirected && data?.ok === true, status: response.status, data };
  } catch { return { ok: false, status: 0, data: null }; }
  finally { clearTimeout(timer); }
}
