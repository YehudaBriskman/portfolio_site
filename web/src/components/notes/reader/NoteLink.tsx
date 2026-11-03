import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { blog, type Collection, type PostSummary } from "@/services/blog";
import { useContent } from "@/content/store";
import { humanize, type WikiKind } from "./wikilinks";
import { useReaderWords } from "./words";
import styles from "./Reader.module.css";

/*
 * A link from one note to another note, an area or a project (#249).
 *
 * It stays a link in the sentence (an underline in the running text, which is
 * the whole signal there) and gains a preview: on hover or keyboard focus, a
 * small card with what is at the other end (its kind, title, area and
 * excerpt), so a reader can decide whether to leave the page without leaving
 * it. Bothy does this for documents; here the three kinds are notes (from the
 * public list), areas (the public collections) and projects (the content
 * store, already loaded with the page).
 *
 * WCAG 1.4.13: the card is dismissable (Escape), hoverable (the pointer can
 * move onto it, and it stays) and persistent (it goes only on leave, blur or
 * Escape). It is described by, not named by, the link: the link's name stays
 * its own text. It is portalled to <body>, so it never becomes a block inside
 * a paragraph and is never part of the pen's word count.
 *
 * Nothing animates; it is shown and hidden (`docs/motion-contract.md` §8).
 */

let notes: Promise<PostSummary[]> | null = null;
let areas: Promise<Collection[]> | null = null;

/* One request per page view, whichever link asks first; a failure is not kept. */
function loadNotes() {
  notes ??= blog.posts().catch(() => {
    notes = null;
    return [];
  });
  return notes;
}
function loadAreas() {
  areas ??= blog.collections().catch(() => {
    areas = null;
    return [];
  });
  return areas;
}

/** For tests: forget what was fetched. */
export function resetLinkCache() {
  notes = null;
  areas = null;
}

type Preview = { title: string; meta: string; excerpt: string } | "missing" | null;

function usePreview(kind: WikiKind, slug: string, wanted: boolean): Preview {
  const projects = useContent().projects;
  const [found, setFound] = useState<Preview>(null);

  useEffect(() => {
    if (!wanted || kind === "project") return;
    let alive = true;
    if (kind === "note") {
      void Promise.all([loadNotes(), loadAreas()]).then(([list, cols]) => {
        if (!alive) return;
        const n = list.find((p) => p.slug === slug);
        if (!n) return setFound("missing");
        const area = cols.find((c) => c.slug === n.collection)?.title ?? "";
        setFound({ title: n.title, meta: area, excerpt: n.excerpt });
      });
    } else {
      void loadAreas().then((cols) => {
        if (!alive) return;
        const a = cols.find((c) => c.slug === slug);
        setFound(a ? { title: a.title, meta: a.tagline, excerpt: a.description } : "missing");
      });
    }
    return () => {
      alive = false;
    };
  }, [kind, slug, wanted]);

  if (kind === "project") {
    const p = projects.find((x) => x.slug === slug);
    return p ? { title: p.title, meta: p.year ?? "", excerpt: p.fact ?? "" } : "missing";
  }
  return found;
}

function place(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const below = r.bottom + 200 < window.innerHeight;
  return { x: Math.min(Math.max(16, r.left), window.innerWidth - 336), y: below ? r.bottom + 8 : r.top - 8, below };
}

export default function NoteLink({
  to,
  kind,
  slug,
  wiki,
  children,
}: {
  to: string;
  kind: WikiKind;
  slug: string;
  wiki: boolean;
  children?: ReactNode;
}) {
  const [w] = useReaderWords();
  const id = useId();
  const anchor = useRef<HTMLAnchorElement>(null);
  const [shown, setShown] = useState(false);
  const [at, setAt] = useState<{ x: number; y: number; below: boolean } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const preview = usePreview(kind, slug, shown);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShown(false);
    };
    /* A pointer's preview goes with a scroll; a focused link's follows it. */
    const onScroll = () => {
      if (anchor.current && document.activeElement === anchor.current) setAt(place(anchor.current));
      else setShown(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
    };
  }, [shown]);

  function show(delay: number) {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (!anchor.current) return;
      setAt(place(anchor.current));
      setShown(true);
    }, delay);
  }
  function hide(delay: number) {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setShown(false), delay);
  }

  const kindWord = kind === "area" ? w.kindArea : kind === "project" ? w.kindProject : w.kindNote;
  const missing = preview === "missing";

  return (
    <>
      <Link
        ref={anchor}
        to={to}
        data-wikilink={wiki ? kind : undefined}
        data-missing={missing ? "" : undefined}
        aria-describedby={shown && preview ? id : undefined}
        onMouseEnter={() => show(350)}
        onMouseLeave={() => hide(150)}
        onFocus={() => show(0)}
        onBlur={() => hide(0)}
      >
        {children}
      </Link>
      {shown &&
        at &&
        preview &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            className={styles.preview}
            data-below={at.below ? "" : undefined}
            style={{ left: at.x, top: at.y }}
            onMouseEnter={() => window.clearTimeout(timer.current)}
            onMouseLeave={() => hide(150)}
          >
            <p className={styles.previewKind}>{kindWord}</p>
            {missing ? (
              <p className={styles.previewTitle}>{w.missingLink}: {humanize(slug)}</p>
            ) : (
              <>
                <p className={styles.previewTitle}>{preview.title}</p>
                {preview.meta && <p className={styles.previewMeta}>{preview.meta}</p>}
                {preview.excerpt && <p className={styles.previewExcerpt}>{preview.excerpt}</p>}
              </>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
