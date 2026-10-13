/** Recunoaște poze după primii octeți (nu după extensie/MIME declarat): JPEG, PNG, WEBP, HEIC/HEIF. Client + server. */
export type ImgKind = "jpeg" | "png" | "webp" | "heic";
export function sniffImage(b: Uint8Array): ImgKind | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  const s = (i: number, n: number) => String.fromCharCode(...b.slice(i, i + n));
  if (s(0, 4) === "RIFF" && s(8, 4) === "WEBP") return "webp";
  if (s(4, 4) === "ftyp" && /^(heic|heix|hevc|mif1|msf1|heif)$/.test(s(8, 4))) return "heic";
  return null;
}
export const MIME: Record<ImgKind, string> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic" };
/** limita pentru poza originală din telefon, înainte de micșorare */
export const MAX_PHOTO_IN = 12 * 1024 * 1024;
