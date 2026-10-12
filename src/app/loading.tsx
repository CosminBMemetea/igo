// Querra Fleet: schelet afișat instant la navigare (Next îl pre-încarcă pentru linkuri) — pagina reală îl înlocuiește.
export default function Loading() {
  return (
    <main className="skel" aria-busy="true" aria-live="polite">
      <div className="sk sk-eyebrow" />
      <div className="sk sk-title" />
      <div className="sk sk-sub" />
      <div className="sk-grid"><div className="sk sk-card" /><div className="sk sk-card" /></div>
      <div className="sk-list">{Array.from({ length: 5 }, (_, i) => <div key={i} className="sk sk-row" style={{ animationDelay: `${i * 60}ms` }} />)}</div>
    </main>
  );
}
