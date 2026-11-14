import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePhone } from "@/hooks/usePhone";
import { useContentWords } from "./words";
import styles from "./EditorPhone.module.css";

/*
 * One language at a time on a phone. A bilingual field is two inputs side by
 * side on a desktop; stacked on a phone they double the form. Here the
 * editor holds one choice (English or Hebrew) and every `TextField` shows
 * only that input. The context is `null` on a desktop, which keeps both.
 *
 * The value of each field is untouched by the choice, so the payload is the
 * same bytes either way.
 */

export type EditLang = "en" | "he";
type Ctx = { lang: EditLang; set: (l: EditLang) => void } | null;

const EditLangContext = createContext<Ctx>(null);

/** An event a link to a Hebrew field sends, so the editor shows Hebrew first. */
export const SHOW_LANG_EVENT = "a-edit-lang";

export function EditLangProvider({ children }: { children: ReactNode }) {
  const phone = usePhone();
  const [lang, set] = useState<EditLang>("en");
  useEffect(() => {
    const on = (e: Event) => set((e as CustomEvent<EditLang>).detail);
    document.addEventListener(SHOW_LANG_EVENT, on);
    return () => document.removeEventListener(SHOW_LANG_EVENT, on);
  }, []);
  const value = useMemo<Ctx>(() => (phone ? { lang, set } : null), [phone, lang]);
  return <EditLangContext.Provider value={value}>{children}</EditLangContext.Provider>;
}

/** The language being edited on a phone, or null when both are shown. */
export function useEditLang(): Ctx {
  return useContext(EditLangContext);
}

/** The English | Hebrew control: a radio group, in view at the top of the form. */
export function LangSwitch() {
  const ctx = useEditLang();
  const w = useContentWords();
  if (!ctx) return null;
  const options: Array<{ value: EditLang; label: string }> = [
    { value: "en", label: w.lang.en },
    { value: "he", label: w.lang.he },
  ];
  return (
    <div className={styles.switchBar}>
      <div role="radiogroup" aria-label={w.lang.label} className={styles.switch}>
        {options.map((o) => (
          <label key={o.value} className={styles.option} data-checked={ctx.lang === o.value}>
            <input
              type="radio"
              name="edit-lang"
              className={styles.radio}
              value={o.value}
              checked={ctx.lang === o.value}
              onChange={() => ctx.set(o.value)}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
