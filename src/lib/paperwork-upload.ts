import type { PaperFile } from "./paperwork";

/** Each photo has its own result: a later success must never hide an earlier failure. */
export async function uploadPaperworkPhotos<T extends { name: string }>(files: T[], send: (file: T) => Promise<PaperFile>) {
  const added: PaperFile[] = [], failed: { name: string; reason: string }[] = [];
  for (const file of files.slice(0, 8)) {
    try { added.push(await send(file)); }
    catch (error) { failed.push({ name: file.name, reason: error instanceof Error ? error.message : "Upload failed" }); }
  }
  return { added, failed, skipped: Math.max(0, files.length - 8) };
}
