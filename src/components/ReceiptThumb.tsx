"use client";
import { useEffect, useState } from "react";
/** Miniatura pozei de bon. Demo: poza rămâne în browserul vizitatorului (localStorage), nu pe server. */
export const THUMB_KEY = (id: string) => `qf-thumb-${id}`;
export async function saveThumb(id: string, file: File) {
  try {
    const bmp = await createImageBitmap(file); const s = 120 / Math.max(bmp.width, bmp.height);
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    localStorage.setItem(THUMB_KEY(id), c.toDataURL("image/jpeg", 0.7));
  } catch { /* fără miniatură */ }
}
export function ReceiptThumb({ id, has, label, url }: { id: string; has?: boolean; label: string; url?: string | null }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => { try { setSrc(localStorage.getItem(THUMB_KEY(id))); } catch {} }, [id]);
  // firmă reală: poza e pe server → o vede și patronul (nu doar telefonul șoferului)
  if (url) return <a className="rthumb" href={url} target="_blank" rel="noreferrer" title={label}><img src={url} alt={label} loading="lazy" /></a>; // eslint-disable-line @next/next/no-img-element
  if (src) return <a className="rthumb" href={src} target="_blank" rel="noreferrer" title={label}><img src={src} alt={label} /></a>; // eslint-disable-line @next/next/no-img-element
  return has ? <span className="rthumb ph" title={label} aria-label={label}>📷</span> : null;
}
