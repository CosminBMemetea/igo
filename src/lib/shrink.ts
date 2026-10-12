/** Poză din telefon (adesea 3–12 MB) → JPEG ≤ ~1600 px, sub limita Vercel/Groq (4,5 MB / 4 MB base64). Doar în browser. */
export async function shrinkImage(file: File, max = 1280, q = 0.85): Promise<File> {
  if (!file.type.startsWith("image/") || typeof createImageBitmap === "undefined") return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (k === 1 && file.size < 1_500_000) return file;
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const b = await new Promise<Blob | null>((res) => c.toBlob(res, "image/jpeg", q));
    return b ? new File([b], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch { return file; }
}
