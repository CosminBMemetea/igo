import { NextResponse } from "next/server";

/** Enhanced management forms keep entered values on error; plain HTML forms still redirect. */
export function formReply(req: Request, path: string, error?: string, status = 400) {
  if (req.headers.get("accept")?.includes("application/json")) {
    return error ? NextResponse.json({ error }, { status }) : NextResponse.json({ ok: true, redirect: path });
  }
  return NextResponse.redirect(new URL(error ? `${path}${path.includes("?") ? "&" : "?"}e=${encodeURIComponent(error)}` : path, req.url), 303);
}
export function duplicateError(e: unknown) {
  const x = e as { message?: string; code?: string; cause?: { code?: string } };
  return x.code === "23505" || x.cause?.code === "23505" || x.message === "exists" || x.message === "dup";
}
