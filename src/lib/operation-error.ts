/** Only explicitly known errors may cross the HTTP boundary. Never return a query or parameters. */
export function operationCode(error: unknown): string | undefined {
  const e = error as { message?: string; cause?: { message?: string } };
  const known = ["size", "type", "empty", "trip", "doc", "trip-closed", "truck-busy", "tracking-inactive", "assignment"];
  return known.find(code => e?.message === code || e?.cause?.message === code);
}
export function reportOperationFailure(operation: string, error: unknown): string {
  const reference = crypto.randomUUID();
  const e = error as { code?: string; cause?: { code?: string } };
  const rawCode = e?.cause?.code ?? e?.code;
  const code = typeof rawCode === "string" && /^[0-9A-Z]{5}$/.test(rawCode) ? rawCode : "unknown";
  console.error("[operation-failed]", { operation, reference, code });
  return reference;
}
