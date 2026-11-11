import { useId, useState } from "react";
import { ContentInvalidError } from "@/services/adminContent";
import { adminAnnounce, type AnnounceSummary } from "@/services/adminAnnounce";
import { useMarketingWords } from "./words";

type Kind = "custom" | "story" | "home";

/* The text goes to the server as text and is shown as text; the two addresses are checked there against the site's own origin. */
export default function NewAnnouncement({ onCreated, onCancel }: { onCreated: (ev: AnnounceSummary) => void; onCancel: () => void }) {
  const w = useMarketingWords();
  const uid = useId();
  const [kind, setKind] = useState<Kind>("custom");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [url, setUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string[] | "failed" | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await adminAnnounce.create({
        kind,
        title: title.trim(),
        summary: summary.trim(),
        ...(kind === "custom" && url.trim() ? { url: url.trim() } : {}),
        ...(kind === "custom" && imageUrl.trim() ? { imageUrl: imageUrl.trim() } : {}),
      });
      onCreated(r.event);
    } catch (err) {
      setError(err instanceof ContentInvalidError ? err.issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)) : "failed");
      setBusy(false);
    }
  };

  return (
    <form className="a-box mk-new-form" onSubmit={submit} aria-labelledby={`${uid}-h`}>
      <div className="a-box-row">
        <h2 id={`${uid}-h`} className="a-row-title">
          {w.newHeading}
        </h2>
      </div>
      <div className="mk-form">
        <p className="a-hint !mt-0">{w.newIntro}</p>
        <div>
          <label className="a-label" htmlFor={`${uid}-kind`}>
            {w.newKind}
          </label>
          <select id={`${uid}-kind`} className="a-select" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
            {(["custom", "story", "home"] as const).map((k) => (
              <option key={k} value={k}>
                {w.newKinds[k]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="a-label" htmlFor={`${uid}-title`}>
            {w.newTitle}
          </label>
          <input id={`${uid}-title`} className="a-input" dir="auto" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="a-label" htmlFor={`${uid}-sum`}>
            {w.newSummary}
          </label>
          <textarea id={`${uid}-sum`} className="a-textarea" dir="auto" rows={3} maxLength={500} value={summary} onChange={(e) => setSummary(e.target.value)} />
        </div>
        {kind === "custom" && (
          <>
            <div>
              <label className="a-label" htmlFor={`${uid}-url`}>
                {w.newUrl}
              </label>
              <input id={`${uid}-url`} className="a-input" type="url" dir="ltr" aria-describedby={`${uid}-url-h`} value={url} onChange={(e) => setUrl(e.target.value)} />
              <span id={`${uid}-url-h`} className="a-hint">
                {w.newUrlHint}
              </span>
            </div>
            <div>
              <label className="a-label" htmlFor={`${uid}-img`}>
                {w.newImage}
              </label>
              <input id={`${uid}-img`} className="a-input" type="url" dir="ltr" aria-describedby={`${uid}-img-h`} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
              <span id={`${uid}-img-h`} className="a-hint">
                {w.newImageHint}
              </span>
            </div>
          </>
        )}
        {error && (
          <div role="alert" className="a-error">
            {error === "failed" ? (
              w.newFailed
            ) : (
              <>
                {w.newInvalid}
                <ul>
                  {error.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
        <div className="mk-actions">
          <button type="submit" className="a-btn a-btn-primary mk-btn" disabled={busy || title.trim() === ""}>
            {busy ? w.newCreating : w.newCreate}
          </button>
          <button type="button" className="a-btn mk-btn" onClick={onCancel}>
            {w.newCancel}
          </button>
        </div>
      </div>
    </form>
  );
}
