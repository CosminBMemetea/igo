import { PUSH_WORKER } from "@/lib/push-worker";
export const dynamic = "force-static";
export function GET() { return new Response(PUSH_WORKER, { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "public, max-age=0, must-revalidate", "service-worker-allowed": "/" } }); }
