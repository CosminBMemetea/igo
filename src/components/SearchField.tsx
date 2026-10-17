/** Server-rendered search control; submits its surrounding GET form. */
export function SearchField({ id, label, value, placeholder, button }: {
  id: string; label: string; value?: string; placeholder?: string; button: string;
}) {
  return <div className="search-field">
    <label htmlFor={id}>{label}</label>
    <div className="search-control">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
      <input id={id} type="search" name="q" defaultValue={value} placeholder={placeholder} enterKeyHint="search" autoComplete="off" />
      <button className="btn pri" type="submit">{button}</button>
    </div>
  </div>;
}
