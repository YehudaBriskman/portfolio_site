import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import Select from "@/components/ui/Select";
import { DisclosureButton } from "@/components/ui/Disclosure";
import { usePhone } from "@/hooks/usePhone";
import type { Text } from "@/content/schema";
import { useIssue } from "./editor";
import { useEditLang } from "./editLang";
import { ReorderRows, ReorderToggle } from "./Reorder";
import { useContentWords } from "./words";
import { useFormText, useFormWords } from "./formWords";
import styles from "./EditorPhone.module.css";

/*
 * The fields the content editors are built from (#163). Each one is shaped
 * like a part of the schema, and looks its own error up by the schema path
 * (`items.0.fact.en`), so a message from the client check and one from the
 * server land in the same place.
 *
 * Ids are the field's path in the form (`project-fact-en`), which is what a
 * label points at and what a test or a screenshot script reaches for.
 */

function ErrorLine({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null;
  return (
    <p id={id} className="a-error">
      {message}
    </p>
  );
}

type TextFieldProps = {
  id: string;
  path: string;
  label: string;
  hint?: string;
  multiline?: boolean;
  value: Text | null;
  /** Null when the field may be left empty: both languages cleared means absent. */
  nullable?: boolean;
  onChange: (next: Text | null) => void;
};

/**
 * A bilingual field: English, which the site always has, and Hebrew, which
 * falls back to English wherever it is left empty.
 */
export function TextField({ id, path, label, hint, multiline, value, nullable, onChange }: TextFieldProps) {
  const own = useIssue(path);
  const enError = useIssue(`${path}.en`) ?? own;
  const heError = useIssue(`${path}.he`);
  const en = value?.en ?? "";
  const he = value?.he ?? "";

  const set = (next: { en: string; he: string }) => {
    if (nullable && !next.en && !next.he) return onChange(null);
    onChange(next.he ? { en: next.en, he: next.he } : { en: next.en });
  };

  const Input = multiline ? "textarea" : "input";
  const cls = multiline ? "a-textarea" : "a-input";
  const phoneLang = useEditLang();
  const w = useContentWords();
  const f = useFormWords();
  const tr = useFormText();
  label = tr(label);
  hint = hint && tr(hint);

  const enInput = (
    <div className="min-w-0">
      <label htmlFor={`${id}-en`} className="sr-only">
        {label}, {f.english}
      </label>
      <Input
        id={`${id}-en`}
        lang="en"
        dir="ltr"
        className={multiline ? `${cls} min-h-[5.5rem]` : cls}
        value={en}
        placeholder={f.english}
        aria-invalid={enError ? true : undefined}
        aria-describedby={enError ? `${id}-en-error` : undefined}
        onChange={(e) => set({ en: e.target.value, he })}
      />
      <ErrorLine id={`${id}-en-error`} message={enError} />
    </div>
  );
  const heInput = (
    <div className="min-w-0">
      <label htmlFor={`${id}-he`} className="sr-only">
        {label}, {f.hebrewOptional}
      </label>
      <Input
        id={`${id}-he`}
        lang="he"
        dir="rtl"
        className={multiline ? `${cls} min-h-[5.5rem]` : cls}
        value={he}
        placeholder="עברית (לא חובה)"
        aria-invalid={heError ? true : undefined}
        aria-describedby={heError ? `${id}-he-error` : undefined}
        onChange={(e) => set({ en, he: e.target.value })}
      />
      <ErrorLine id={`${id}-he-error`} message={heError} />
    </div>
  );

  /* On a phone only the language being edited is mounted; a message about the
     other one stays visible (named by its language) so a failed publish never
     points at a field the owner cannot see. */
  if (phoneLang) {
    const other = phoneLang.lang === "en" ? heError : enError;
    const otherName = phoneLang.lang === "en" ? w.lang.he : w.lang.en;
    return (
      <fieldset className="min-w-0" data-path={path}>
        <legend className="a-label">{label}</legend>
        {phoneLang.lang === "en" ? enInput : heInput}
        {other && <ErrorLine id={`${id}-other-error`} message={w.lang.hiddenError(otherName, other)} />}
        {hint && <p className="a-hint">{hint}</p>}
      </fieldset>
    );
  }

  return (
    <fieldset className="min-w-0" data-path={path}>
      <legend className="a-label">{label}</legend>
      <div className="grid gap-3 md:grid-cols-2">
        {enInput}
        {heInput}
      </div>
      {hint && <p className="a-hint">{hint}</p>}
    </fieldset>
  );
}

type PlainFieldProps = {
  id: string;
  path: string;
  label: string;
  hint?: string;
  value: string;
  mono?: boolean;
  type?: "text" | "url" | "email";
  inputMode?: "numeric";
  dir?: "ltr" | "auto";
  onChange: (next: string) => void;
};

/** One string, the same in both languages: a name, a slug, a URL. */
export function PlainField({ id, path, label, hint, value, mono, type = "text", inputMode, dir = "auto", onChange }: PlainFieldProps) {
  const error = useIssue(path);
  const tr = useFormText();
  label = tr(label);
  hint = hint && tr(hint);
  return (
    <div className="min-w-0" data-path={path}>
      <label htmlFor={id} className="a-label">
        {label}
      </label>
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        dir={dir}
        className={mono ? "a-input a-input-mono" : "a-input"}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && (
        <p id={`${id}-hint`} className="a-hint">
          {hint}
        </p>
      )}
      <ErrorLine id={`${id}-error`} message={error} />
    </div>
  );
}

/** A whole number, kept a number in the working copy. */
export function NumberField(props: Omit<PlainFieldProps, "value" | "onChange" | "inputMode"> & { value: number; onChange: (n: number) => void }) {
  const { value, onChange, ...rest } = props;
  return (
    <PlainField
      {...rest}
      mono
      dir="ltr"
      inputMode="numeric"
      value={Number.isFinite(value) ? String(value) : ""}
      onChange={(s) => onChange(s.trim() === "" ? Number.NaN : Number(s))}
    />
  );
}

type SelectFieldProps<V extends string> = {
  id: string;
  path: string;
  label: string;
  value: V;
  options: readonly V[];
  onChange: (next: V) => void;
};

export function SelectField<V extends string>({ id, path, label, value, options, onChange }: SelectFieldProps<V>) {
  const error = useIssue(path);
  label = useFormText()(label);
  return (
    <div className="min-w-0" data-path={path}>
      <label htmlFor={id} className="a-label">
        {label}
      </label>
      <Select
        id={id}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value as V)}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </Select>
      <ErrorLine id={`${id}-error`} message={error} />
    </div>
  );
}

type ListFieldProps<T> = {
  id: string;
  path: string;
  legend: string;
  hint?: string;
  items: readonly T[];
  /** What each row is called, for the move and remove buttons' names. */
  name: (item: T, i: number) => string;
  make: () => T;
  max?: number;
  addLabel?: string;
  onChange: (next: T[]) => void;
  children: (item: T, i: number) => ReactNode;
};

/**
 * A list with an order: add, remove, and move up or down. Buttons, not drag,
 * so it works the same from a keyboard and a phone.
 */
export function ListField<T>({ id, path, legend, hint, items, name: rawName, make, max, addLabel = "Add", onChange, children }: ListFieldProps<T>) {
  const error = useIssue(path);
  const tr = useFormText();
  legend = tr(legend);
  hint = hint && tr(hint);
  addLabel = tr(addLabel);
  /* The default names ("New phrase") are English literals too. */
  const name = (item: T, i: number) => (() => { const n = rawName(item, i); return /^New /.test(n) ? tr(n) : n; })();
  const phone = usePhone();
  const [reordering, setReordering] = useState(false);
  const move = (from: number, to: number) => {
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };
  /* A phone: the records as plain cards, with the buttons that change the
     order or remove one behind one Reorder button (see Reorder.tsx). */
  if (phone) {
    return (
      <fieldset id={id} className="min-w-0" data-path={path}>
        <legend className="a-label">{legend}</legend>
        {hint && <p className="a-hint -mt-1 mb-3">{hint}</p>}
        {items.length > 0 && (
          <div className="mb-2 flex justify-end">
            <ReorderToggle on={reordering} onToggle={() => setReordering((v) => !v)} />
          </div>
        )}
        {reordering ? (
          <ReorderRows items={items} name={(item, i) => `${i + 1}. ${name(item, i)}`} onChange={onChange} />
        ) : (
          <ol className="space-y-3">
            {items.map((item, i) => (
              <li key={i} className="a-box rounded-[var(--a-r-box)] p-3">
                <p className={styles.itemTitle}>
                  {i + 1}. <bdi>{name(item, i)}</bdi>
                </p>
                <div className="space-y-4">{children(item, i)}</div>
              </li>
            ))}
          </ol>
        )}
        {error && <p className="a-error">{error}</p>}
        {!reordering && (max === undefined || items.length < max) && (
          <button type="button" className="a-btn a-btn-ghost mt-3 min-h-11 rounded-[var(--a-r-ctl)]" onClick={() => onChange([...items, make()])}>
            {addLabel}
          </button>
        )}
      </fieldset>
    );
  }

  return (
    <fieldset id={id} className="min-w-0" data-path={path}>
      <legend className="a-label">{legend}</legend>
      {hint && <p className="a-hint -mt-1 mb-3">{hint}</p>}
      <ol className="space-y-3">
        {items.map((item, i) => (
          // Index keys: a row is its position, and the inputs inside it are
          // controlled, so a move re-renders the values in their new places.
          <li key={i} className="a-box rounded-[var(--a-r-box)] p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="a-box-title min-w-0 flex-1 basis-32 truncate" title={`${i + 1}. ${name(item, i)}`}>
                {i + 1}. {name(item, i)}
              </span>
              <span className="ms-auto flex gap-1">
                <button
                  type="button"
                  className="a-btn a-btn-ghost a-icon-btn h-11 min-h-11 w-11 rounded-[var(--a-r-ctl)] md:h-8 md:min-h-8 md:w-8"
                  aria-label={`Move ${name(item, i)} up`}
                  disabled={i === 0}
                  onClick={() => move(i, i - 1)}
                >
                  <span aria-hidden="true">↑</span>
                </button>
                <button
                  type="button"
                  className="a-btn a-btn-ghost a-icon-btn h-11 min-h-11 w-11 rounded-[var(--a-r-ctl)] md:h-8 md:min-h-8 md:w-8"
                  aria-label={`Move ${name(item, i)} down`}
                  disabled={i === items.length - 1}
                  onClick={() => move(i, i + 1)}
                >
                  <span aria-hidden="true">↓</span>
                </button>
                <button
                  type="button"
                  className="a-btn a-btn-ghost a-icon-btn h-11 min-h-11 w-11 rounded-[var(--a-r-ctl)] md:h-8 md:min-h-8 md:w-8"
                  aria-label={`Remove ${name(item, i)}`}
                  onClick={() => onChange(items.filter((_, j) => j !== i))}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </span>
            </div>
            <div className="space-y-4">{children(item, i)}</div>
          </li>
        ))}
      </ol>
      {error && <p className="a-error">{error}</p>}
      {(max === undefined || items.length < max) && (
        <button type="button" className="a-btn a-btn-ghost mt-3 min-h-11 rounded-[var(--a-r-ctl)] md:min-h-8" onClick={() => onChange([...items, make()])}>
          {addLabel}
        </button>
      )}
    </fieldset>
  );
}

/** Lines of prose, each bilingual: the shape the story and How I work share. */
export function LinesField({
  id,
  path,
  legend,
  lines,
  onChange,
}: {
  id: string;
  path: string;
  legend: string;
  lines: readonly Text[];
  onChange: (next: Text[]) => void;
}) {
  return (
    <ListField
      id={id}
      path={path}
      legend={legend}
      items={lines}
      name={(l) => l.en.slice(0, 40) || "New line"}
      make={() => ({ en: "" })}
      max={6}
      addLabel="Add a line"
      onChange={onChange}
    >
      {(line, i) => (
        <TextField
          id={`${id}-${i}`}
          path={`${path}.${i}`}
          label={`Line ${i + 1}`}
          multiline
          value={line}
          onChange={(t) => onChange(lines.map((l, j) => (j === i ? (t ?? { en: "" }) : l)))}
        />
      )}
    </ListField>
  );
}

/** Searching the groups of a page (site copy): the query, and who matches it. */
export const GroupSearchContext = createContext<string>("");

const matches = (query: string, title: string, keywords: readonly string[] = []) => {
  const q = query.trim().toLowerCase();
  return q === "" || title.toLowerCase().includes(q) || keywords.some((k) => k.toLowerCase().includes(q));
};
export const groupMatches = matches;

/** An event a link to a field in a closed group sends the group. */
export const OPEN_GROUP_EVENT = "a-open-group";

type SectionProps = {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  /** A phone shows the group closed unless it is the first one to need you. */
  defaultOpen?: boolean;
  /** Words a search over the groups also matches (the labels of its fields). */
  keywords?: readonly string[];
};

/**
 * A titled group of fields inside an editor. On a desktop a heading and its
 * fields; on a phone a closed-by-default group (a toggle with `aria-expanded`
 * over a region) so the form is a handful of rows, not forty fields. A group
 * with a message in it opens itself, and one a search names opens too.
 */
export function Section(raw: SectionProps) {
  const tr = useFormText();
  const props = { ...raw, title: tr(raw.title), keywords: raw.keywords?.map(tr) };
  const phone = usePhone();
  if (!phone) {
    return (
      <section className="a-section">
        <h2 className="a-section-title flex flex-wrap items-center justify-between gap-2">
          <span>{props.title}</span>
          {props.aside}
        </h2>
        {props.children}
      </section>
    );
  }
  return <PhoneGroup {...props} />;
}

function PhoneGroup({ title, aside, children, defaultOpen = false, keywords }: SectionProps) {
  const w = useContentWords().group;
  const id = useId();
  const query = useContext(GroupSearchContext);
  const [open, setOpen] = useState(defaultOpen);
  const [problems, setProblems] = useState(0);
  const body = useRef<HTMLDivElement>(null);
  const seen = useRef(0);
  const searching = query.trim() !== "";
  const listed = matches(query, title, keywords);

  /* A message arrived inside the group (the check, or the server): open it. */
  useEffect(() => {
    const n = body.current?.querySelectorAll(".a-error").length ?? 0;
    setProblems(n);
    if (n > seen.current) setOpen(true);
    seen.current = n;
  });

  useEffect(() => {
    const el = body.current?.closest("[data-group]");
    if (!el) return;
    const on = () => setOpen(true);
    el.addEventListener(OPEN_GROUP_EVENT, on);
    return () => el.removeEventListener(OPEN_GROUP_EVENT, on);
  }, []);

  if (!listed) return null;
  const shown = open || (searching && listed);

  return (
    <section className={styles.group} data-group="" data-open={shown}>
      <h2 className={styles.groupHead}>
        <DisclosureButton expanded={shown} controls={id} onToggle={() => setOpen(!shown)}>
          {title}
        </DisclosureButton>
        {problems > 0 && (
          <span className={styles.groupMeta} title={w.attention(problems)}>
            <TriangleAlert size={16} aria-hidden="true" focusable="false" />
            <span className="sr-only">{w.attention(problems)}</span>
          </span>
        )}
        {aside}
      </h2>
      <div id={id} ref={body} role="region" aria-label={title} className={styles.groupBody} hidden={!shown}>
        {children}
      </div>
    </section>
  );
}
