import assert from "node:assert/strict";
import { loadReceiptDraft, saveReceiptDraft, type ReceiptDraft } from "../src/lib/receipt-draft";
// Node has no IndexedDB: exercise the failure fallback without masking persistence errors.
const draft: ReceiptDraft = { vehicleId: "truck-a", key: "stable-key", form: true, fields: { litres: "123", odo: "123456", amount: "", station: "Test" }, photo: new File(["photo-bytes"], "receipt.jpg", { type: "image/jpeg" }), currency: "EUR", date: "2026-10-16", plate: "A", aiOk: false };
await assert.rejects(saveReceiptDraft("firm:driver-a", draft));
const restored = await loadReceiptDraft("firm:driver-a");
assert.equal(restored?.vehicleId, "truck-a");
assert.equal(restored?.key, "stable-key");
assert.equal(restored?.fields.litres, "123");
assert.equal(await restored?.photo?.text(), "photo-bytes");
await assert.rejects(loadReceiptDraft("firm:driver-b"));
await assert.rejects(saveReceiptDraft("firm:driver-a", { ...draft, fields: { ...draft.fields, litres: "456" } }));
assert.equal((await loadReceiptDraft("firm:driver-a"))?.fields.litres, "456");
console.log("PASS receipt fallback: fields/photo/original truck retained, account isolation, later writes survive storage errors");
