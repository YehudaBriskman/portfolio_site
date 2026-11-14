import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent } from "react";
import {
  Bold, Code, Heading2, Heading3, Italic, Link, Link2, List, ListChecks, ListOrdered, Quote, SquareCode, Strikethrough,
  type LucideIcon,
} from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { usePhone } from "@/hooks/usePhone";
import MediaPicker from "@/components/admin/MediaPicker";
import { checkFile, media, type MediaItem } from "@/services/media";
import { altFromFile, applyEdit, edit, imageMarkdown, openWikilink, SHORTCUTS, type Edit, type Op } from "./markdownOps";
import type { EditorWords } from "./words";
import styles from "./NoteEditor.module.css";

/*
 * The body field of the note editor (#250): a plain textarea, because a
 * textarea is what every assistive technology already knows how to edit,
 * with a formatting toolbar, shortcuts, a `[[` autocomplete, and pictures
 * uploaded to the media library by pasting or dropping them.
 *
 * Toolbar actions go through the browser's insertText, so Ctrl+Z undoes them
 * like typing. Where insertText is missing (jsdom), the value is set instead.
 */

export type WikiTarget = { kind: "note" | "area" | "project"; target: string; title: string };

type Props = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Rewrite the body this editor was showing when called, by function of its text then. An upload ends later, maybe after the editor was pointed at the other language, and must land in the body it started in. */
  onRewrite?: (fn: (current: string) => string) => void;
  lang: "en" | "he";
  targets: readonly WikiTarget[];
  words: EditorWords;
  describedBy?: string;
  /** Its own name, where two bodies sit side by side (#305). */
  label?: string;
  /** Something to tell the author: an upload done or failed. */
  onStatus: (message: string, bad?: boolean) => void;
  onSave: () => void;
  onTogglePreview: () => void;
};

const TOOLS: ({ op: Op; Icon: LucideIcon; keys?: string } | "sep")[] = [
  { op: "h2", Icon: Heading2 },
  { op: "h3", Icon: Heading3 },
  "sep",
  { op: "bold", Icon: Bold, keys: "Control+B" },
  { op: "italic", Icon: Italic, keys: "Control+I" },
  { op: "strike", Icon: Strikethrough },
  { op: "code", Icon: Code, keys: "Control+E" },
  "sep",
  { op: "link", Icon: Link, keys: "Control+K" },
  { op: "wikilink", Icon: Link2 },
  "sep",
  { op: "quote", Icon: Quote },
  { op: "ul", Icon: List },
  { op: "ol", Icon: ListOrdered },
  { op: "task", Icon: ListChecks },
  { op: "codeblock", Icon: SquareCode },
];

const KIND_ORDER = { note: 0, area: 1, project: 2 } as const;

/** Where the caret sits inside a textarea, in its own pixels (a mirror measure). */
function caretAt(ta: HTMLTextAreaElement, index: number) {
  const cs = getComputedStyle(ta);
  const div = document.createElement("div");
  for (const p of [
    "boxSizing", "width", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "borderTopWidth",
    "borderRightWidth", "borderBottomWidth", "borderLeftWidth", "fontFamily", "fontSize", "fontWeight",
    "lineHeight", "letterSpacing", "tabSize", "direction",
  ] as const) {
    div.style[p] = cs[p];
  }
  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.style.whiteSpace = "pre-wrap";
  div.style.overflowWrap = "break-word";
  div.textContent = ta.value.slice(0, index);
  const mark = document.createElement("span");
  mark.textContent = "​";
  div.appendChild(mark);
  document.body.appendChild(div);
  const top = mark.offsetTop - ta.scrollTop;
  const left = mark.offsetLeft;
  const line = parseFloat(cs.lineHeight) || 24;
  div.remove();
  return { top: Math.max(0, Math.min(top + line, ta.clientHeight)), left };
}

export default function BodyEditor({ id, value, onChange, onRewrite, lang, targets, words, describedBy, label, onStatus, onSave, onTogglePreview }: Props) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const latest = useRef(value);
  const pendingSel = useRef<[number, number] | null>(null);
  const uploads = useRef(0);
  const [focusTool, setFocusTool] = useState(0);
  const [drop, setDrop] = useState(false);
  const phone = usePhone();
  const [formatOpen, setFormatOpen] = useState(false);
  const [ac, setAc] = useState<{ from: number; query: string; top: number; left: number } | null>(null);
  const [active, setActive] = useState(0);
  const dismissed = useRef<number | null>(null);
  const listId = useId();
  const optId = (i: number) => `${listId}-o${i}`;
  const rtl = lang === "he";

  useEffect(() => {
    latest.current = value;
  }, [value]);

  useLayoutEffect(() => {
    if (!pendingSel.current || !ta.current) return;
    ta.current.setSelectionRange(...pendingSel.current);
    pendingSel.current = null;
  }, [value]);

  const apply = useCallback(
    (e: Edit) => {
      const el = ta.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(e.from, e.to);
      const expected = applyEdit(el.value, e);
      let done: boolean;
      try {
        done = typeof document.execCommand === "function" && document.execCommand("insertText", false, e.text);
      } catch {
        done = false;
      }
      if (done && el.value === expected) {
        el.setSelectionRange(e.selStart, e.selEnd);
        return;
      }
      pendingSel.current = [e.selStart, e.selEnd];
      onChange(expected);
    },
    [onChange],
  );

  const run = (op: Op) => {
    const el = ta.current;
    if (!el) return;
    const placeholder = op === "link" ? words.linkText : words.placeholderText;
    apply(edit({ value: el.value, start: el.selectionStart, end: el.selectionEnd }, op, placeholder));
    if (op === "wikilink") queueMicrotask(sense);
  };

  /* ---------------------------------------------------------------- [[ */

  const options = useMemo(() => {
    if (!ac) return [];
    const q = ac.query.trim().toLowerCase();
    return targets
      .filter((t) => !q || t.target.includes(q) || t.title.toLowerCase().includes(q))
      .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.title.localeCompare(b.title))
      .slice(0, 8);
  }, [ac, targets]);

  function sense() {
    const el = ta.current;
    if (!el || el.selectionStart !== el.selectionEnd) return setAc(null);
    const open = openWikilink(el.value, el.selectionStart);
    if (!open || dismissed.current === open.from) {
      if (!open) dismissed.current = null;
      return setAc(null);
    }
    if (!ac || ac.from !== open.from || ac.query !== open.query) setActive(0);
    setAc({ ...open, ...caretAt(el, el.selectionStart) });
  }

  function accept(t: WikiTarget) {
    const el = ta.current;
    if (!el || !ac) return;
    const caret = el.selectionStart;
    const closing = el.value.slice(caret, caret + 2) === "]]" ? 2 : 0;
    const text = `[[${t.target}|${t.title.replace(/[|\]]/g, " ")}]]`;
    apply({ from: ac.from, to: caret + closing, text, selStart: ac.from + text.length, selEnd: ac.from + text.length });
    setAc(null);
  }

  /* ------------------------------------------------------------- keys */

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (ac) {
      const n = options.length;
      if (e.key === "ArrowDown" && n) return void (e.preventDefault(), setActive((i) => (i + 1) % n));
      if (e.key === "ArrowUp" && n) return void (e.preventDefault(), setActive((i) => (i - 1 + n) % n));
      if ((e.key === "Enter" || e.key === "Tab") && n) return void (e.preventDefault(), accept(options[active]));
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        dismissed.current = ac.from;
        return setAc(null);
      }
    }
    const mod = e.ctrlKey || e.metaKey;
    if (!mod || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === "s") return void (e.preventDefault(), onSave());
    if (k === "p" && e.shiftKey) return void (e.preventDefault(), onTogglePreview());
    if (!e.shiftKey && SHORTCUTS[k]) {
      e.preventDefault();
      run(SHORTCUTS[k]);
    }
  }

  function onToolbarKey(e: KeyboardEvent<HTMLDivElement>) {
    const count = TOOLS.filter((t) => t !== "sep").length;
    const next = rtl ? "ArrowLeft" : "ArrowRight";
    const prev = rtl ? "ArrowRight" : "ArrowLeft";
    let i = focusTool;
    if (e.key === next) i = (i + 1) % count;
    else if (e.key === prev) i = (i - 1 + count) % count;
    else if (e.key === "Home") i = 0;
    else if (e.key === "End") i = count - 1;
    else return;
    e.preventDefault();
    setFocusTool(i);
    e.currentTarget.querySelectorAll<HTMLButtonElement>("button")[i]?.focus();
  }

  /* ---------------------------------------------------------- pictures */

  async function upload(files: File[]) {
    const el = ta.current;
    if (!el) return;
    const rewrite = onRewrite ?? ((fn: (current: string) => string) => onChange(fn(latest.current)));
    for (const file of files) {
      const why = checkFile(file, "image");
      if (why) {
        onStatus(words.uploadFailed(file.name, why), true);
        continue;
      }
      const n = ++uploads.current;
      const token = `![${words.uploading(file.name)} (${n})]()`;
      const at = el.selectionEnd;
      const lead = at > 0 && el.value[at - 1] !== "\n" ? "\n\n" : "";
      apply({ from: el.selectionStart, to: at, text: `${lead}${token}\n`, selStart: el.selectionStart + lead.length + token.length + 1, selEnd: el.selectionStart + lead.length + token.length + 1 });
      onStatus(words.uploading(file.name));
      const alt = altFromFile(file.name);
      try {
        const item = await media.upload(file, { alt, caption: "", credit: "" }, "image");
        rewrite((cur) => cur.replace(token, imageMarkdown(item.alt || alt, item.url)));
        onStatus(words.uploaded(file.name));
      } catch (err) {
        rewrite((cur) => cur.replace(`${token}\n`, "").replace(token, ""));
        onStatus(words.uploadFailed(file.name, err instanceof Error ? err.message : "?"), true);
      }
    }
  }

  const imagesOf = (list: FileList | null) => [...(list ?? [])].filter((f) => f.type.startsWith("image/"));

  function onPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const files = imagesOf(e.clipboardData.files);
    if (!files.length) return;
    e.preventDefault();
    void upload(files);
  }

  function onDragOver(e: DragEvent<HTMLTextAreaElement>) {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDrop(true);
  }

  function onDrop(e: DragEvent<HTMLTextAreaElement>) {
    setDrop(false);
    const files = imagesOf(e.dataTransfer.files);
    if (!files.length) return;
    e.preventDefault();
    ta.current?.focus();
    void upload(files);
  }

  function insertPicked(item: MediaItem) {
    const el = ta.current;
    if (!el) return;
    const md = imageMarkdown(item.alt, item.url);
    const at = el.selectionStart;
    const lead = at > 0 && el.value[at - 1] !== "\n" ? "\n\n" : "";
    apply({ from: at, to: el.selectionEnd, text: `${lead}${md}\n`, selStart: at + lead.length + md.length + 1, selEnd: at + lead.length + md.length + 1 });
  }

  let toolIndex = -1;
  const open = Boolean(ac);

  return (
    <div>
      {/* One strip, as GitHub's: the formatting tools, then the library (#288). */}
      <div className={styles.bar}>
        {phone ? (
          /* One button instead of thirteen: the tools are the same, in a sheet. */
          <>
            <button type="button" className="a-btn a-btn-ghost min-h-[44px]" data-format-sheet aria-haspopup="dialog" onMouseDown={(e) => e.preventDefault()} onClick={() => setFormatOpen(true)}>
              {words.format}
            </button>
            <BottomSheet open={formatOpen} onClose={() => setFormatOpen(false)} title={words.formatTitle} snap="half">
              <div className="grid grid-cols-4 gap-2">
                {TOOLS.flatMap((t) => (t === "sep" ? [] : [t])).map((t) => (
                  <button
                    key={t.op}
                    type="button"
                    className="a-btn a-btn-ghost min-h-[44px] justify-center"
                    aria-label={words.tools[t.op]}
                    onClick={() => run(t.op)}
                  >
                    <t.Icon size={20} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </BottomSheet>
          </>
        ) : (
        <div
          role="toolbar"
          aria-label={words.toolbar}
          aria-controls={id}
          className={styles.toolbar}
          onKeyDown={onToolbarKey}
        >
          {TOOLS.map((t, i) => {
            if (t === "sep") return <span key={`s${i}`} className={styles.toolSep} aria-hidden="true" />;
            toolIndex++;
            const mine = toolIndex;
            const label = words.tools[t.op];
            return (
              <button
                key={t.op}
                type="button"
                className={styles.tool}
                tabIndex={mine === focusTool ? 0 : -1}
                aria-label={label}
                title={t.keys ? `${label} (${t.keys.replace("Control", "Ctrl")})` : label}
                aria-keyshortcuts={t.keys}
                onFocus={() => setFocusTool(mine)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => run(t.op)}
              >
                <t.Icon size={18} aria-hidden="true" />
              </button>
            );
          })}
        </div>
        )}
        <div className={styles.barEnd}>
          <MediaPicker
            value=""
            onChange={() => undefined}
            onPickItem={insertPicked}
            label={words.tools.image}
            showCurrent={false}
          />
        </div>
      </div>

      <div className={styles.field}>
        <textarea
          ref={ta}
          id={id}
          value={value}
          lang={lang}
          dir={rtl ? "rtl" : "ltr"}
          spellCheck
          className={styles.textarea}
          aria-label={label}
          aria-describedby={describedBy}
          aria-autocomplete="list"
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open && options.length ? optId(active) : undefined}
          data-drop={drop || undefined}
          onChange={(e) => {
            latest.current = e.target.value;
            onChange(e.target.value);
            sense();
          }}
          onKeyDown={onKeyDown}
          onKeyUp={(e) => {
            if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) sense();
          }}
          onClick={sense}
          onBlur={() => setAc(null)}
          onPaste={onPaste}
          onDragOver={onDragOver}
          onDragLeave={() => setDrop(false)}
          onDrop={onDrop}
          placeholder={words.bodyPlaceholder}
        />
        {ac && (
          <ul
            id={listId}
            role="listbox"
            aria-label={words.suggestions}
            className={styles.suggest}
            style={{ top: ac.top + 4, insetInlineStart: Math.min(ac.left, 9999) }}
          >
            {options.length === 0 && (
              <li role="presentation" className={styles.optionEmpty}>
                {words.noSuggestions}
              </li>
            )}
            {options.map((o, i) => (
              <li
                key={`${o.kind}:${o.target}`}
                id={optId(i)}
                role="option"
                aria-selected={i === active}
                className={styles.option}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => accept(o)}
                onMouseEnter={() => setActive(i)}
              >
                <span className={styles.optionKind}>
                  {o.kind === "note" ? words.kindNote : o.kind === "area" ? words.kindArea : words.kindProject}
                </span>
                <span className={styles.optionTitle}>{o.title}</span>
                <span className={styles.optionTarget} dir="ltr">
                  [[{o.target}]]
                </span>
              </li>
            ))}
          </ul>
        )}
        <span className="sr-only" aria-live="polite">
          {ac ? (options.length ? `${words.suggestions}: ${options.length}` : words.noSuggestions) : ""}
        </span>
      </div>
    </div>
  );
}
