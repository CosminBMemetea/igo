import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { trustedMutationOrigin } from "../src/lib/request-origin";
const require = createRequire(import.meta.url);
const marker = "PRIVATE_QA_RECEIPT_AND_DATABASE_DETAILS";
const logs: unknown[][] = [];
let timers = 0;
function load(path: string, mocks: Record<string, unknown>) {
  const module = { exports: {} as any };
  const source = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  new Function("require", "module", "exports", "console", "setTimeout", "clearTimeout", source)(
    (id: string) => id in mocks ? mocks[id] : require(id), module, module.exports,
    { error: (...args: unknown[]) => logs.push(args), warn: (...args: unknown[]) => logs.push(args) },
    () => ++timers, () => --timers,
  );
  return module.exports;
}
const reporter = load("src/lib/operation-error.ts", {});
const health = load("src/app/api/health/route.ts", {
  "@/db/client": { dbConfigured: () => true, db: () => ({ execute: async () => { throw new Error(marker); } }) },
  "@/lib/operation-error": reporter,
});
const response = await health.GET();
assert.equal(response.status, 503);
assert.equal((await response.text()).includes(marker), false, "public health must not expose database errors");
assert.equal(response.headers.get("cache-control"), "no-store");
assert.equal(timers, 0, "successful or failed health requests must release their timeout");
reporter.reportOperationFailure("security-test", { code: marker });
assert.equal(JSON.stringify(logs).includes(marker), false, "untrusted error codes must not leak into logs");
console.log("PASS error boundary: database messages/codes stay out of HTTP/logs; health timeout released");

let demo = false;
const receiptMarker = "SECRET_QA";
const receipt = load("src/app/api/receipt/extract/route.ts", {
  "@/lib/groq": { hasGroq: () => true, groqChat: async () => ({
    choices: [{ message: { content: `{"x":${receiptMarker}}` } }],
  }) },
  "@/lib/tenant": { tenant: async () => ({ demo }) },
  "@/lib/demo-time": { realToday: () => "2026-10-20" },
  "@/lib/imgsniff": { sniffImage: () => "jpeg", MIME: { jpeg: "image/jpeg" } },
  "@/lib/fuel/fx": { normCur: () => "RON" },
  "@/lib/operation-error": reporter,
});
for (demo of [false, true]) {
  const fd = new FormData();
  fd.set("photo", new Blob(["synthetic-photo"], { type: "image/jpeg" }), "qa.jpg");
  const r = await receipt.POST(new Request("https://qa.example.test/api/receipt/extract", { method: "POST", body: fd }));
  assert.equal(r.status, demo ? 200 : 502);
  assert.equal((await r.text()).includes(receiptMarker), false, "OCR parser errors must not expose receipt text, including demo");
}
assert.equal(JSON.stringify(logs).includes(receiptMarker), false);
console.log("PASS receipt error privacy: real and demo responses/logs contain no provider or parsed receipt details");

const testEmail = load("src/app/api/admin/test-email/route.ts", {
  "next/headers": { headers: async () => new Headers({ "x-igo-role": "admin" }) },
  "@/lib/auth-cookie": { back: (req: Request, path: string) => Response.redirect(new URL(path, req.url), 303) },
  "@/lib/email": { emailProvider: () => ({ send: async () => { throw new Error(marker); } }) },
  "@/lib/validate": { clip: (value: unknown) => String(value ?? "") },
  "@/lib/operation-error": reporter,
});
const emailForm = new FormData(); emailForm.set("to", "qa@example.test");
const emailResponse = await testEmail.POST(new Request("https://qa.example.test/api/admin/test-email", { method: "POST", body: emailForm }));
assert.equal(emailResponse.status, 303);
assert.equal(emailResponse.headers.get("location")?.includes(marker), false, "provider failure must not enter URL/history");
assert.equal(JSON.stringify(logs).includes(marker), false);
console.log("PASS email error privacy: provider errors stay out of browser URLs and application logs");

for (const origin of ["https://other.example.test", "https://sibling.example.test", "null"]) {
  assert.equal(trustedMutationOrigin(new Request("https://qa.example.test/api/auth/login", {
    method: "POST", headers: { origin, "sec-fetch-site": "same-site" },
  })), false, "same-site sibling origins are not trusted");
}
assert.equal(trustedMutationOrigin(new Request("https://qa.example.test/api/files", {
  method: "POST", headers: { origin: "https://qa.example.test", "sec-fetch-site": "same-origin" },
})), true);
assert.equal(trustedMutationOrigin(new Request("https://qa.example.test/api/files", {
  method: "POST", headers: { "sec-fetch-site": "cross-site" },
})), false);
assert.equal(trustedMutationOrigin(new Request("https://qa.example.test/api/driver/shift", {
  method: "POST", headers: { authorization: "Bearer synthetic-native-token" },
})), true, "native clients retain their independent authentication path");
console.log("PASS browser origin boundary: same-origin allowed; foreign/sibling/null origins rejected; native compatible");
