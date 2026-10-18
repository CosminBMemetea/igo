import { NextResponse } from "next/server";

/** Enhanced management forms keep entered values on error; plain HTML forms still redirect. */
export function formReply(req: Request, path: string, error?: string, status = 400) {
  if (req.headers.get("accept")?.includes("application/json")) {
    return error ? NextResponse.json({ error }, { status }) : NextResponse.json({ ok: true, redirect: path });
  }
  const dest = new URL(path, req.url);
  if (error) dest.searchParams.set("e", error);
  return NextResponse.redirect(dest, 303);
}
export function duplicateError(e: unknown) {
  const x = e as { message?: string; code?: string; cause?: { code?: string } };
  return x.code === "23505" || x.cause?.code === "23505" || x.message === "exists" || x.message === "dup";
}
