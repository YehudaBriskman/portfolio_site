import Select from "@/components/ui/Select";
import type { ReactNode } from "react";
import type { Text } from "@/content/schema";
import { useIssue } from "./editor";

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

  return (
    <fieldset className="min-w-0" data-path={path}>
      <legend className="a-label">{label}</legend>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor={`${id}-en`} className="sr-only">
            {label}, English
          </label>
          <Input
            id={`${id}-en`}
            lang="en"
            dir="ltr"
            className={multiline ? `${cls} min-h-[5.5rem]` : cls}
            value={en}
            placeholder="English"
            aria-invalid={enError ? true : undefined}
            aria-describedby={enError ? `${id}-en-error` : undefined}
            onChange={(e) => set({ en: e.target.value, he })}
          />
          <ErrorLine id={`${id}-en-error`} message={enError} />
        </div>
        <div className="min-w-0">
          <label htmlFor={`${id}-he`} className="sr-only">
            {label}, Hebrew (optional)
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
export function ListField<T>({ id, path, legend, hint, items, name, make, max, addLabel = "Add", onChange, children }: ListFieldProps<T>) {
  const error = useIssue(path);
  const move = (from: number, to: number) => {
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };
  return (
    <fieldset id={id} className="min-w-0" data-path={path}>
      <legend className="a-label">{legend}</legend>
      {hint && <p className="a-hint -mt-1 mb-3">{hint}</p>}
      <ol className="space-y-3">
        {items.map((item, i) => (
          // Index keys: a row is its position, and the inputs inside it are
          // controlled, so a move re-renders the values in their new places.
          <li key={i} className="a-box p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="a-box-title min-w-0 flex-1 truncate" title={`${i + 1}. ${name(item, i)}`}>
                {i + 1}. {name(item, i)}
              </span>
              <span className="flex gap-1">
                <button
                  type="button"
                  className="a-btn a-btn-ghost a-icon-btn"
                  aria-label={`Move ${name(item, i)} up`}
                  disabled={i === 0}
                  onClick={() => move(i, i - 1)}
                >
                  <span aria-hidden="true">↑</span>
                </button>
                <button
                  type="button"
                  className="a-btn a-btn-ghost a-icon-btn"
                  aria-label={`Move ${name(item, i)} down`}
                  disabled={i === items.length - 1}
                  onClick={() => move(i, i + 1)}
                >
                  <span aria-hidden="true">↓</span>
                </button>
                <button
                  type="button"
                  className="a-btn a-btn-ghost a-icon-btn"
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
        <button type="button" className="a-btn a-btn-ghost mt-3" onClick={() => onChange([...items, make()])}>
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

/** A titled group of fields inside an editor. */
export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="a-section">
      <h2 className="a-section-title flex flex-wrap items-center justify-between gap-2">
        <span>{title}</span>
        {aside}
      </h2>
      {children}
    </section>
  );
}
