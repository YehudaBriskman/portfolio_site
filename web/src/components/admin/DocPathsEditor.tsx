import { useState } from "react";
import { useAreaEditorWords, type AreaEditorWords } from "@/i18n/areaEditor";

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

function validate(value: string, existing: string[], w: AreaEditorWords): string | null {
  const v = value.trim();
  if (!v) return w.enterPath;
  if (v.length > MAX_LENGTH) return w.pathLong(MAX_LENGTH);
  if (v.startsWith("/")) return w.pathRelative;
  if (v.split("/").includes("..")) return w.pathClimb;
  if (existing.includes(v)) return w.pathListed;
  if (existing.length >= MAX_PATHS) return w.pathMax(MAX_PATHS);
  return null;
}

export default function DocPathsEditor({ paths, repoLabel, onChange }: DocPathsEditorProps) {
  const w = useAreaEditorWords();
  const [entry, setEntry] = useState("");
  const [error, setError] = useState<string | null>(null);

  function add() {
    const problem = validate(entry, paths, w);
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
      <p className="mono text-sm uppercase tracking-[0.22em] text-clay">
        {paths.length ? w.pathsCount(paths.length, MAX_PATHS) : w.allowEmpty}
      </p>

      {paths.length === 0 ? (
        <p className="mt-2 text-sm leading-relaxed text-bone/75">
          {w.nothingA}<bdi className="mono text-bone" dir="ltr">{repoLabel || w.thisRepo}</bdi>{w.nothingB}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {paths.map((p) => (
            <li key={p} className="flex items-center gap-3">
              <span className="mono min-w-0 flex-1 truncate text-sm text-bone" title={p}>{p}</span>
              <span className="mono shrink-0 text-sm uppercase tracking-[0.16em] text-clay">
                {/* The trailing slash decides folder-vs-file, and that is not
                    something anyone should have to guess. */}
                {p.endsWith("/") ? w.folder : w.oneFile}
              </span>
              <button
                type="button"
                onClick={() => remove(p)}
                className="a-btn a-btn-ghost a-icon-btn shrink-0"
                aria-label={w.removePath(p)}
              >
                <span aria-hidden="true">✕</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label className="min-w-0 flex-1">
          <span className="sr-only">{w.pathToPublish}</span>
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
        <button type="button" onClick={add} className="a-btn shrink-0">{w.addPath}</button>
      </div>
      {error && <p className="a-error">{error}</p>}
      <p className="a-hint">
        {w.pathsHint}
      </p>
    </div>
  );
}
