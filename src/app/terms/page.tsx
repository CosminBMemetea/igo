import { getPrefs } from "@/lib/prefs";
import { TERMS } from "@/lib/legal";
// DRAFT juridic — de revizuit de avocat (vezi src/lib/legal.ts).
export const dynamic = "force-dynamic";
export default function Page() {
  const { loc } = getPrefs();
  const d = TERMS[loc];
  return (
    <main className="legal">
      <h1 className="h1 fade">{d.title}</h1>
      <p className="hint">{d.updated}</p>
      <p className="sub fade d1">{d.intro}</p>
      {d.sections.map(([h, p]) => <section key={h} className="section"><h2>{h}</h2><p>{p}</p></section>)}
    </main>
  );
}
