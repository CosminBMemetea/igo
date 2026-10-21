// Mock local pentru API-ul Vercel Blob (put / delete) + servirea obiectelor. Doar pentru smoke; nimic nu iese din mașină.
import { createServer } from "node:http";
export async function startBlobMock() {
  const objects = new Map<string, { type: string; bytes: Buffer }>(), log: string[] = [];
  let n = 0;
  const srv = createServer(async (req, res) => {
    const chunks: Buffer[] = []; for await (const c of req) chunks.push(Buffer.from(c));
    const body = Buffer.concat(chunks), u = new URL(req.url!, "http://x"), base = `http://127.0.0.1:${port}`;
    log.push(`${req.method} ${u.pathname}`);
    if (req.method === "PUT") {
      const pathname = u.searchParams.get("pathname") ?? u.pathname.slice(1), key = `o/${++n}-${pathname.replace(/[^\w.-]+/g, "_")}`;
      objects.set(key, { type: String(req.headers["x-content-type"] ?? "application/octet-stream"), bytes: body });
      res.setHeader("content-type", "application/json");
      return res.end(JSON.stringify({ url: `${base}/${key}`, downloadUrl: `${base}/${key}?download=1`, pathname, contentType: req.headers["x-content-type"], contentDisposition: "inline", etag: `"${n}"` }));
    }
    if (req.method === "POST" && u.pathname === "/delete") {
      for (const url of (JSON.parse(body.toString() || "{}").urls ?? []) as string[]) objects.delete(new URL(url).pathname.slice(1));
      res.setHeader("content-type", "application/json"); return res.end("{}");
    }
    const o = objects.get(u.pathname.slice(1));
    if (req.method === "GET" && o) { res.setHeader("content-type", o.type); return res.end(o.bytes); }
    res.statusCode = 404; res.end("not found");
  });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
  const port = (srv.address() as { port: number }).port;
  return { url: `http://127.0.0.1:${port}`, objects, log, close: () => srv.close() };
}
