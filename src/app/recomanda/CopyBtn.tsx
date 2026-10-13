"use client";
import { useState } from "react";
export function CopyBtn({ text, label, done }: { text: string; label: string; done: string }) {
  const [ok, setOk] = useState(false);
  return <button type="button" className="btn pri sm" onClick={() => { navigator.clipboard?.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1800); }).catch(() => null); }}>{ok ? done : label}</button>;
}
