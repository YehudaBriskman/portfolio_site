export type LinkRow = { label: string; url: string };

/**
 * Narrow schema-inferred links into rows the editor can hold.
 *
 * `strict` is off in tsconfig.app.json, which collapses zod's optionality
 * detection so every inferred property arrives as optional. Filling the gaps
 * here keeps that quirk at one boundary instead of spread across both editors.
 */
export function toLinkRows(links: ReadonlyArray<{ label?: string; url?: string }>): LinkRow[] {
  return links.map((l) => ({ label: l.label ?? "", url: l.url ?? "" }));
}

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

  return (
    <div>
      <span className="a-label">Links</span>
      <ul className="space-y-3">
        {links.map((l, i) => (
          /* Stacked on a phone: a label, a URL and a remove button side by side
             left each field about 90px, which no URL survives. */
          <li key={i} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="sm:max-w-[12rem] sm:flex-1">
              <span className="sr-only">Link label</span>
              <input
                value={l.label}
                onChange={(e) => set(i, "label", e.target.value)}
                className="a-input"
                placeholder="Source"
              />
            </label>
            <label className="min-w-0 sm:flex-1">
              <span className="sr-only">Link URL</span>
              <input
                value={l.url}
                onChange={(e) => set(i, "url", e.target.value)}
                className="a-input a-input-mono"
                inputMode="url"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="https://github.com/…"
              />
            </label>
            <button
              type="button"
              onClick={() => onChange(links.filter((_, n) => n !== i))}
              className="a-btn a-btn-ghost a-icon-btn shrink-0 self-end sm:self-auto"
              aria-label={`Remove link ${l.label || i + 1}`}
            >
              <span aria-hidden="true">✕</span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => onChange([...links, { label: "", url: "" }])}
        className="a-btn mt-4"
      >
        Add link
      </button>
    </div>
  );
}
