"use client";
/** Lista exemplelor CSV din caseta laterală: „Încearcă” trimite exemplul către caseta de import (eveniment), ↓ descarcă fișierul. */
export function SampleList({ samples, tryLabel }: { samples: [string, string][]; tryLabel: string }) {
  return (
    <div className="slist">
      {samples.map(([k, n]) => (
        <div key={k} className="srow">
          <button type="button" className="sname" onClick={() => window.dispatchEvent(new CustomEvent("qf-sample", { detail: { k, n } }))} title={tryLabel}>{n}</button>
          <span className="sgo" aria-hidden="true">{tryLabel} →</span>
          <a className="sdl" href={`/samples/${k}.csv`} download aria-label={`${n} — CSV`} title="CSV">↓</a>
        </div>
      ))}
    </div>
  );
}
