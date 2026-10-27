import { useState } from "react";

/*
 * The repository publish allowlist.
 *
 * This is the one place in the admin that should be slightly loud. An empty
 * allowlist means nothing is published from the repo, and that is both the
 * default and the safe state — so the empty case has to read as *correct*
 * rather than as unfinished, or someone will "fix" it by adding a path they
 * have not read.
 *
 * Until this existed the field was hardcoded to [] on every save, so any
 * allowlist configured elsewhere was silently destroyed.
 */

const MAX_PATHS = 20;
const MAX_LENGTH = 200;

export type DocPathsEditorProps = {
  paths: string[];
  repoLabel: string;
  onChange: (paths: string[]) => void;
};

function validate(value: string, existing: string[]): string | null {
  const v = value.trim();
  if (!v) return "Enter a path.";
  if (v.length > MAX_LENGTH) return `Longer than ${MAX_LENGTH} characters.`;
  if (v.startsWith("/")) return "Use a path relative to the repository root.";
  if (v.split("/").includes("..")) return "Paths may not climb out of the repository.";
  if (existing.includes(v)) return "Already listed.";
  if (existing.length >= MAX_PATHS) return `At most ${MAX_PATHS} paths.`;
  return null;
}

export default function DocPathsEditor({ paths, repoLabel, onChange }: DocPathsEditorProps) {
  const [entry, setEntry] = useState("");
  const [error, setError] = useState<string | null>(null);

  function add() {
    const problem = validate(entry, paths);
    if (problem) {
      setError(problem);
      return;
    }
    onChange([...paths, entry.trim()]);
    setEntry("");
    setError(null);
  }

  function remove(path: string) {
    onChange(paths.filter((p) => p !== path));
  }

  return (
    <div className={`a-card border-l-2 p-4 ${paths.length ? "border-l-sodium" : "border-l-edge"}`}>
      <p className="mono text-[0.6875rem] uppercase tracking-[0.22em] text-clay">
        {paths.length ? `${paths.length} of ${MAX_PATHS} paths published` : "Allowlist empty"}
      </p>

      {paths.length === 0 ? (
        <p className="mt-2 text-sm leading-relaxed text-bone/75">
          Nothing is published from <span className="mono text-bone">{repoLabel || "this repository"}</span>.
          Add a path only when you have read what is in it. A repository holds plenty that was
          never meant to be public.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {paths.map((p) => (
            <li key={p} className="flex items-center gap-3">
              <span className="mono min-w-0 flex-1 truncate text-sm text-bone">{p}</span>
              <span className="mono shrink-0 text-[0.625rem] uppercase tracking-[0.16em] text-clay">
                {/* The trailing slash decides folder-vs-file, and that is not
                    something anyone should have to guess. */}
                {p.endsWith("/") ? "everything under this folder" : "one file"}
              </span>
              <button
                type="button"
                onClick={() => remove(p)}
                className="a-btn a-btn-ghost a-icon-btn shrink-0"
                aria-label={`Remove ${p} from the allowlist`}
              >
                <span aria-hidden="true">✕</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Path to publish</span>
          <input
            value={entry}
            onChange={(e) => { setEntry(e.target.value); setError(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
            className="a-input a-input-mono"
            placeholder="docs/"
            autoCapitalize="off"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={error ? "true" : undefined}
          />
        </label>
        <button type="button" onClick={add} className="a-btn shrink-0">Add path</button>
      </div>
      {error && <p className="a-error">{error}</p>}
      <p className="a-hint">
        A trailing slash publishes a whole folder; without one it is a single file. Wildcards are
        not expanded; they match literally.
      </p>
    </div>
  );
}
