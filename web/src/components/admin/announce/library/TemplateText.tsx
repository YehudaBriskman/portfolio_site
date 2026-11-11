import { useEffect, useId, useRef } from "react";
import type { AnnounceLang, AnnounceSnippet } from "@/services/adminAnnounce";
import { insertAt, type VarName } from "./variables";
import { useLibraryWords } from "./words";

/*
 * A template's textarea with the two ways of putting something into it: a
 * variable picker (one button per variable) and a snippet picker. Both insert
 * where the caret is and put the caret after what they added, so a keyboard
 * user can keep typing. The text is plain text in a textarea, never HTML.
 */
export default function TemplateText({
  label,
  value,
  onChange,
  lang,
  vars,
  snippets = [],
  max,
  rows = 6,
  placeholder,
  describedBy,
  hideHint,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  lang: AnnounceLang;
  vars: readonly VarName[];
  snippets?: AnnounceSnippet[];
  max: number;
  rows?: number;
  placeholder?: string;
  describedBy?: string;
  /** Leave the variables explainer out when several fields stand together and one note says it. */
  hideHint?: boolean;
  /** The counter line, shown under the box. */
  children?: React.ReactNode;
}) {
  const w = useLibraryWords();
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  const caret = useRef<number | null>(null);
  const pick = useRef<HTMLSelectElement>(null);

  /* The caret can only be placed once React has written the new value. */
  useEffect(() => {
    const el = ref.current;
    if (el && caret.current !== null) {
      el.focus();
      el.setSelectionRange(caret.current, caret.current);
      caret.current = null;
    }
  }, [value]);

  const put = (piece: string) => {
    const el = ref.current;
    const at = el ? [el.selectionStart, el.selectionEnd] : [value.length, value.length];
    const r = insertAt(value, piece, at[0], at[1]);
    if (r.text.length > max) return;
    caret.current = r.caret;
    onChange(r.text);
  };

  return (
    <div className="space-y-2">
      <label className="a-label !mb-0" htmlFor={`${id}-t`}>{label}</label>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`${w.variablesLabel}: ${label}`}>
        {vars.map((v) => (
          <button key={v} type="button" className="a-btn min-h-[44px] font-mono text-xs" aria-label={w.insertVar(`{${v}}`)} onClick={() => put(`{${v}}`)}>
            <span dir="ltr">{`{${v}}`}</span>
          </button>
        ))}
      </div>
      {!hideHint && <p className="a-hint !mt-0" id={`${id}-vh`}>{w.variablesHint}</p>}
      {snippets.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm font-bold" htmlFor={`${id}-s`}>{w.snippetLabel}</label>
          <select id={`${id}-s`} ref={pick} className="a-select min-h-[44px] max-w-full flex-1 sm:flex-none" defaultValue="">
            <option value="">{w.snippetNone}</option>
            {snippets.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({w.snippetKinds[s.kind]})</option>
            ))}
          </select>
          <button
            type="button"
            className="a-btn min-h-[44px]"
            onClick={() => {
              const s = snippets.find((x) => x.id === pick.current?.value);
              if (s) put(s.text);
            }}
          >
            {w.snippetInsert}
          </button>
        </div>
      )}
      <textarea
        id={`${id}-t`}
        ref={ref}
        className="a-textarea"
        rows={rows}
        maxLength={max}
        dir={lang === "he" ? "rtl" : "ltr"}
        lang={lang}
        value={value}
        placeholder={placeholder}
        aria-describedby={[describedBy, hideHint ? "" : `${id}-vh`].filter(Boolean).join(" ") || undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="a-hint !mt-0 tabular-nums">{w.textMax(value.length, max)}</p>
      {children}
    </div>
  );
}
