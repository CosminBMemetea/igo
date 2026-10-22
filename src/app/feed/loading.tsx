// Schelet instant pentru /feed (afișat cât se randează serverul; datele vin de obicei sub 1 s).
export default function Loading() {
  return (
    <main className="fpage skel fskel" aria-busy="true">
      <div className="fcol">
        <div className="sk sk-eyebrow" /><div className="sk sk-title" /><div className="sk sk-sub" />
        <div className="fsk-st">{[0, 1, 2, 3, 4].map((i) => <i key={i} className="sk" />)}</div>
        <div className="fsk-ch">{[0, 1, 2, 3].map((i) => <i key={i} className="sk" />)}</div>
        {[0, 1, 2].map((i) => <div key={i} className="sk fsk-card" />)}
      </div>
    </main>
  );
}
