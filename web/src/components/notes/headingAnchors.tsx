import { useEffect, useState, type ReactNode } from "react";
import { Check, Link2 } from "lucide-react";
import { copyText } from "@/components/dashboard/history";
import { useLang } from "@/components/dashboard/i18n";
import styles from "@/components/notes/headingAnchors.module.css";

/*
 * A link to any heading inside a note (#225).
 *
 * `headingIds.ts` gives every h2–h4 an id; these render the heading with a
 * small button beside it that copies `/blog/<slug>#<id>`.
 *
 * The button sits beside the heading, not inside it: inside, its label would
 * become part of the heading's accessible name and every heading in the
 * outline would read "Setup, copy a link to this section". The wrapper is a
 * plain block, so the heading's own margins still collapse through it and
 * the prose rhythm is the one it was.
 *
 * No motion: the icon swaps to a tick for two seconds and a live region says
 * so (`docs/motion-contract.md`, the area history row).
 */

const WORDS = {
  en: { copy: "Copy a link to this section", copied: "Link copied" },
  he: { copy: "העתקת קישור לסעיף הזה", copied: "הקישור הועתק" },
};

function AnchorButton({ id }: { id: string }) {
  const lang = useLang();
  const w = WORDS[lang];
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);

  return (
    <>
      <button
        type="button"
        className={styles.button}
        aria-label={w.copy}
        title={w.copy}
        onClick={async () => {
          const hash = `#${encodeURIComponent(id)}`;
          // The address bar says where the reader is, without a jump.
          window.history.replaceState(window.history.state, "", hash);
          setCopied(await copyText(`${window.location.origin}${window.location.pathname}${hash}`));
        }}
      >
        {copied ? <Check size={16} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
      </button>
      <span className="sr-only" role="status">
        {copied ? w.copied : ""}
      </span>
    </>
  );
}

type HeadingProps = { children?: ReactNode; id?: string };

function Anchored({ as: Tag, id, children }: HeadingProps & { as: "h2" | "h3" | "h4" }) {
  if (!id) return <Tag className="display-tight">{children}</Tag>;
  return (
    <div className={styles.wrap}>
      <Tag id={id} className="display-tight">
        {children}
      </Tag>
      <AnchorButton id={id} />
    </div>
  );
}

export function H2(p: HeadingProps) {
  return <Anchored as="h2" {...p} />;
}
export function H3(p: HeadingProps) {
  return <Anchored as="h3" {...p} />;
}
export function H4(p: HeadingProps) {
  return <Anchored as="h4" {...p} />;
}
