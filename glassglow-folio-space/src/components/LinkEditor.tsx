export type LinkRow = { label: string; url: string };

/* Shared by posts and collections — both carry the same shape of links. */
export default function LinkEditor({
  links,
  onChange,
}: {
  links: LinkRow[];
  onChange: (next: LinkRow[]) => void;
}) {
  const set = (i: number, k: keyof LinkRow, v: string) =>
    onChange(links.map((l, n) => (n === i ? { ...l, [k]: v } : l)));

  const field =
    "w-full border-0 border-b border-edge bg-transparent px-0 py-2 text-sm text-bone placeholder:text-bone/25 focus:border-sodium focus:outline-none";

  return (
    <div>
      <span className="mono text-[0.625rem] uppercase tracking-[0.22em] text-bone/45">Links</span>
      <ul className="mt-3 space-y-3">
        {links.map((l, i) => (
          <li key={i} className="flex items-end gap-3">
            <input
              value={l.label}
              onChange={(e) => set(i, "label", e.target.value)}
              className={`${field} max-w-[12rem]`}
              placeholder="Source"
            />
            <input
              value={l.url}
              onChange={(e) => set(i, "url", e.target.value)}
              className={`${field} mono text-xs`}
              placeholder="https://github.com/…"
            />
            <button
              type="button"
              onClick={() => onChange(links.filter((_, n) => n !== i))}
              className="mono shrink-0 pb-2 text-[0.625rem] uppercase tracking-[0.2em] text-bone/35 transition-colors hover:text-sodium"
            >
              remove
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => onChange([...links, { label: "", url: "" }])}
        className="mono mt-4 text-[0.625rem] uppercase tracking-[0.2em] text-bone/45 transition-colors hover:text-sodium"
      >
        + add link
      </button>
    </div>
  );
}
