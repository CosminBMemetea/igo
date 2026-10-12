// Service worker minimal (fără cache): există ca /sw.js să nu mai redirecționeze spre login.
export const dynamic = "force-static";
const JS = `self.addEventListener("install",()=>self.skipWaiting());self.addEventListener("activate",(e)=>e.waitUntil(self.clients.claim()));`;
export function GET() { return new Response(JS, { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "public, max-age=0, must-revalidate", "service-worker-allowed": "/" } }); }
