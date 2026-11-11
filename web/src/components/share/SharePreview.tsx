import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useShareWords } from "@/i18n/share";
import { copyText, countChars, downloadImage, sendHref, type ShareResult } from "@/lib/share";
import { shareToast } from "./toast";
import styles from "./SharePreview.module.css";

/*
 * The preview before a send (#503): the card, the caption in a plain
 * textarea and a count against the channel's limit.
 *
 * A native modal `<dialog>`, like the site's other sheets: focus trap, an
 * inert page and Escape come from the platform. It is mounted only for the
 * channel the person chose, so the card is requested by that choice and not
 * before. Nothing leaves the page until Send: that is a real link (so a popup
 * blocker sees the user's own click) or, for Instagram, a save-and-copy button.
 *
 * The caption is text only: it goes into the textarea's value, into the
 * address as an encoded parameter, and onto the clipboard, never into HTML.
 */

type Props = {
  result: ShareResult;
  /** The channel's display name (a brand, or the translated word for email). */
  name: string;
  brand: boolean;
  title: string;
  lang: "en" | "he";
  onClose: () => void;
};

export default function SharePreview({ result, name, brand, title, lang, onClose }: Props) {
  const w = useShareWords();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const countId = useId();
  const hintId = useId();
  const [caption, setCaption] = useState(result.text);
  const [imageOk, setImageOk] = useState(true);

  useEffect(() => {
    const d = dialog.current;
    if (!d || d.open) return;
    if (typeof d.showModal === "function") d.showModal();
    else d.setAttribute("open", "");
  }, []);

  const nf = new Intl.NumberFormat(lang);
  const count = countChars(caption, result.channel);
  const { max } = result.limits;
  const over = max !== null && count > max;
  const href = sendHref(result, caption);
  const instagram = result.channel === "instagram";
  const hint = instagram ? w.saveHint : result.textPrefilled ? null : w.pasteHint;
  const external = href !== undefined && !href.startsWith("mailto:");

  function close() {
    const d = dialog.current;
    if (d && typeof d.close === "function") d.close();
    else onClose();
  }

  async function copy() {
    close();
    shareToast((await copyText(caption)) ? w.captionCopied : w.copyFailed);
  }

  async function saveAndCopy() {
    if (!result.image) return;
    const copied = copyText(caption);
    const saved = await downloadImage(result.image);
    close();
    shareToast(saved && (await copied) ? w.imageSaved : saved ? w.copyFailed : w.saveFailed);
  }

  const label: ReactNode = brand ? <bdi translate="no">{name}</bdi> : name;

  return (
    <dialog
      ref={dialog}
      dir={lang === "he" ? "rtl" : "ltr"}
      lang={lang}
      className={`${styles.dialog} pop-dialog`}
      aria-labelledby={titleId}
      data-share-preview=""
      onClose={onClose}
      onClick={(e) => {
        // A press on the backdrop is a press on the dialog itself.
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className={styles.head}>
        <h2 id={titleId} className={styles.title}>
          {w.share}: {label}
        </h2>
      </div>

      <div className={styles.body}>
        {result.image && imageOk && (
          <img
            className={`${styles.card} ${instagram ? styles.square : styles.og}`}
            src={result.image}
            alt={w.cardAlt(title)}
            onError={() => setImageOk(false)}
          />
        )}

        {result.subject !== undefined && (
          <p className={styles.subject}>
            <span className={styles.fieldLabel}>{w.subject}</span>
            <span dir="auto">{result.subject}</span>
          </p>
        )}

        <label className={styles.fieldLabel} htmlFor={`${titleId}-caption`}>
          {w.caption}
        </label>
        <textarea
          id={`${titleId}-caption`}
          className={styles.caption}
          dir="auto"
          rows={7}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          aria-describedby={`${countId} ${hint ? hintId : ""}`.trim()}
          aria-invalid={over || undefined}
          spellCheck
        />
        <p id={countId} className={styles.count} data-over={over || undefined}>
          <span>{max !== null ? w.count(nf.format(count), nf.format(max)) : w.countOnly(nf.format(count))}</span>
          {over && (
            <span role="status" className={styles.warn}>
              {w.overBy(nf.format(count - (max ?? 0)))}
            </span>
          )}
        </p>
        {hint && (
          <p id={hintId} className={styles.hint}>
            {hint}
          </p>
        )}
      </div>

      <div className={styles.foot}>
        <button type="button" className={styles.btn} onClick={close}>
          {w.cancel}
        </button>
        {!instagram && (
          <button type="button" className={styles.btn} onClick={() => void copy()}>
            {w.copyCaption}
          </button>
        )}
        {instagram ? (
          <button type="button" className={`${styles.btn} ${styles.primary}`} onClick={() => void saveAndCopy()} disabled={!result.image}>
            {w.saveAndCopy}
          </button>
        ) : (
          <a
            className={`${styles.btn} ${styles.primary}`}
            href={href}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            onClick={() => {
              // The dialog takes no text: copy it in the same click that follows the link.
              if (!result.textPrefilled) void copyText(caption).then((ok) => shareToast(ok ? w.captionCopied : w.copyFailed));
              close();
            }}
          >
            {w.send}
            {external && <span className="sr-only">{` (${w.newTab})`}</span>}
          </a>
        )}
      </div>
    </dialog>
  );
}
