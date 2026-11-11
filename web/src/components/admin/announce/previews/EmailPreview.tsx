import { useId, useState } from "react";
import { emailFrameDoc } from "@/lib/share/preview";
import { Lines, Segmented } from "./parts";
import { usePreviewWords } from "./words";

type View = "html" | "text";
type Width = 600 | 390;
type Scheme = "light" | "dark";

/*
 * `html` is the server-built, already-escaped email. It goes in a sandboxed
 * iframe with an EMPTY sandbox attribute: no scripts, no same-origin, no
 * forms, no popups. Without scripts the frame cannot report its height and
 * without same-origin the parent cannot read it, so the frame has a fixed
 * height and scrolls inside itself; the page around it never gets a second
 * scrollbar.
 */
export default function EmailPreview({ html, text, subject }: { html: string; text?: string; subject?: string }) {
  const w = usePreviewWords();
  const id = useId();
  const [view, setView] = useState<View>("html");
  const [width, setWidth] = useState<Width>(600);
  const [scheme, setScheme] = useState<Scheme>("light");
  if (!html.trim()) return <p className="pv-hint">{w.emailEmpty}</p>;
  return (
    <div className="pv">
      <div className="pv-seg" style={{ gap: ".75rem 1.25rem" }}>
        <Segmented
          label={w.emailView}
          value={view}
          onChange={setView}
          options={[
            { value: "html", label: w.emailHtml },
            { value: "text", label: w.emailText },
          ]}
        />
        {view === "html" && (
          <>
            <Segmented
              label={w.emailWidth}
              value={width}
              onChange={setWidth}
              options={[
                { value: 600, label: `${w.desktop} 600` },
                { value: 390, label: `${w.mobile} 390` },
              ]}
            />
            <Segmented
              label={w.emailTheme}
              value={scheme}
              onChange={setScheme}
              options={[
                { value: "light", label: w.light },
                { value: "dark", label: w.dark },
              ]}
            />
          </>
        )}
      </div>
      {view === "html" ? (
        <>
          <div className="pv-email-stage">
            <iframe
              id={id}
              className="pv-email-frame"
              title={w.emailTitle(subject || w.emailNoSubject)}
              sandbox=""
              srcDoc={emailFrameDoc(html)}
              referrerPolicy="no-referrer"
              style={{ width, colorScheme: scheme }}
            />
          </div>
          <p className="pv-hint">{w.emailSandboxed}</p>
          {scheme === "dark" && <p className="pv-hint">{w.emailDarkHint}</p>}
        </>
      ) : text?.trim() ? (
        <div className="pv-email-text" role="region" aria-label={w.emailText} tabIndex={0}>
          <Lines text={text} />
        </div>
      ) : (
        <p className="pv-hint">{w.emailNoText}</p>
      )}
    </div>
  );
}
