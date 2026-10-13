const xml = `<?xml version="1.0"?><gesmes:Envelope><Cube>
<Cube time='2026-10-12'><Cube currency='USD' rate='1.0900'/><Cube currency='PLN' rate='4.2500'/><Cube currency='HUF' rate='395.10'/><Cube currency='RON' rate='4.9770'/><Cube currency='BGN' rate='1.9558'/><Cube currency='CHF' rate='0.9400'/></Cube>
<Cube time='2026-10-09'><Cube currency='USD' rate='1.0800'/><Cube currency='PLN' rate='4.2600'/><Cube currency='RON' rate='4.9760'/></Cube>
</Cube></gesmes:Envelope>`;
let calls = 0;
globalThis.fetch = (async () => { calls++; if (process.env.DOWN) throw new Error("down"); return new Response(xml); }) as typeof fetch;
const { toRon } = await import("../src/lib/fuel/fx");
let bad = 0; const ok = (n: string, c: boolean) => { console.log(c ? "PASS" : "FAIL", n); if (!c) bad++; };
if (!process.env.DOWN) {
  ok("sâmbătă → cursul de vineri", (await toRon(100, "EUR", "2026-10-10"))?.fxDate === "2026-10-09");
  ok("PLN prin EUR", (await toRon(100, "PLN", "2026-10-12"))?.ron === 117.11);
  ok("HUF azi → ultimul publicat", (await toRon(10000, "HUF", "2026-10-13"))?.fxDate === "2026-10-12");
  ok("„€” → EUR", (await toRon(100, "€", "2026-10-12"))?.cur === "EUR");
  ok("lei → RON identic", (await toRon(100, "lei", "2026-10-12"))?.ron === 100);
  ok("USD (neeuropean) → null", (await toRon(100, "USD", "2026-10-12")) === null);
  ok("un singur fetch", calls === 1);
}
if (bad) process.exit(1); console.log("smoke:fx OK");
