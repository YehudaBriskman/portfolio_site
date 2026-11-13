import { useId, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { DisclosureButton } from "@/components/ui/Disclosure";
import styles from "@/components/dashboard/Dashboard.module.css";
import { AUTHOR } from "@/components/notes/Byline";
import { useWords } from "@/components/dashboard/i18n";
import Arrive from "@/components/motion/Arrive";
import Ring from "@/components/motion/Ring";
import { typedDir } from "@/lib/typedDir";

/*
 * The dashboard's small parts (#224), shared by every page on the shell:
 * a card, a row, a chip, an area's glyph, and the rail's three blocks — who,
 * which view, and the top areas.
 *
 * Density is GitHub's and it is one decision held everywhere: 12px of card
 * padding, rows 12px tall in padding around a 14px title and 12px meta, a
 * hairline between rows and nothing else. Hierarchy is weight and ink, not
 * size: a title is 600 in full ink, meta is 400 in the soft ink, and the
 * only colour at rest is the link blue on "View all" and the area glyphs.
 */

/* ─────────────────────────────────────────────────────────────── card */

export function DashCard({
  title,
  action,
  children,
  className = "",
  flush = false,
  bare = false,
  busy,
}: {
  title: ReactNode;
  /** "View all", top right, GitHub's place for it. */
  action?: { to: string; label: string; describe?: string };
  children: ReactNode;
  className?: string;
  /** Rows run edge to edge rather than inside the card's padding. */
  flush?: boolean;
  /** No frame of its own: its children are cards already. */
  bare?: boolean;
  busy?: boolean;
}) {
  const id = useId();
  /* Every card on the shell arrives the one way the site has (#251): the
     block rises into place, and the ring by its title draws. A bare section
     does not rise itself — its children are cards that arrive one by one,
     and two rises stacked would be a slide. */
  const props = { className: `${styles.section} ${className}`, "aria-labelledby": id, "aria-busy": busy || undefined };
  const inner = (
    <>
      <div className={styles.sectionHead}>
        <h2 id={id} className={styles.sectionTitle}>
          <Ring size={10} />
          {title}
        </h2>
        {action && (
          <Link to={action.to} rel={facetRel(action.to)} className={styles.sectionAction}>
            {action.label}
            {action.describe && <span className="sr-only">{`: ${action.describe}`}</span>}
          </Link>
        )}
      </div>
      {bare ? (
        children
      ) : (
        <div className={styles.card} data-flush={flush ? "" : undefined}>
          {children}
        </div>
      )}
    </>
  );
  return bare ? (
    <section {...props}>{inner}</section>
  ) : (
    <Arrive as="section" {...props}>
      {inner}
    </Arrive>
  );
}

/* ─────────────────────────────────────────────────────────────── rows */

export function RowList({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ul className={styles.rows} aria-label={label}>
      {children}
    </ul>
  );
}

export function Row({
  icon,
  title,
  to,
  meta,
  chips,
  badge,
}: {
  icon: ReactNode;
  title: string;
  to: string;
  /** Already-formatted pieces, joined with a middle dot. */
  meta: ReactNode[];
  chips?: ReactNode;
  badge?: ReactNode;
}) {
  const parts = meta.filter((m) => m !== null && m !== undefined && m !== "");
  return (
    <li className={styles.row}>
      <span className={styles.rowIcon} aria-hidden="true">
        {icon}
      </span>
      <div className={styles.rowBody}>
        <div className={styles.rowTitleLine}>
          <Link to={to} className={styles.rowTitle}>
            {title}
          </Link>
          {badge}
        </div>
        <div className={styles.rowMeta}>
          {parts.map((m, i) => (
            <span key={i} className={styles.metaPart}>
              {m}
            </span>
          ))}
        </div>
        {chips}
      </div>
    </li>
  );
}

/**
 * A link whose target carries a query string is a facet of a page, not a page.
 * `nofollow` keeps a crawler from queueing it; people still get a real anchor
 * (ctrl-click, new tab, copy link) and the filtered URL still loads.
 */
function facetRel(to: string): "nofollow" | undefined {
  return to.includes("?") ? "nofollow" : undefined;
}

export function Chips({ children, label }: { children: ReactNode; label: string }) {
  return (
    <ul className={styles.chips} aria-label={label}>
      {children}
    </ul>
  );
}

export function Chip({ to, children, current }: { to: string; children: ReactNode; current?: boolean }) {
  return (
    <li>
      <Link to={to} rel="nofollow" className={styles.chip} aria-current={current ? "true" : undefined} translate="no">
        {children}
      </Link>
    </li>
  );
}

/* ─────────────────────────────────────────────────────────────── glyph */

const HUES = ["--hue-blue", "--hue-green", "--hue-yellow", "--hue-purple", "--hue-red"];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * An area's mark: GitHub's identicon in the site's own terms, and round
 * (#251). The circle is the site's motif, so the mark is a ring in one of
 * the brand hues holding a 3×3 field of dots, mirrored like an identicon.
 * Seeded by the slug, so an area is recognisable by its mark wherever it
 * appears; the pattern and the hue are the ones the square glyph had, so an
 * area kept its mark through the change.
 */
export function AreaGlyph({ seed, size = 16 }: { seed: string; size?: number }) {
  const h = hash(seed);
  const hue = HUES[h % HUES.length];
  const cells: [number, number][] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 2; col++) {
      if ((h >> (row * 2 + col + 3)) & 1) {
        cells.push([col, row]);
        if (col === 0) cells.push([2, row]);
      }
    }
  }
  if (cells.length === 0) cells.push([1, 1]);
  const ink = `rgb(var(${hue}))`;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={styles.glyph}
      aria-hidden="true"
      focusable="false"
      data-hue={hue.slice(6)}
    >
      <circle cx="12" cy="12" r="11" style={{ fill: `rgb(var(${hue}) / 0.14)`, stroke: ink }} strokeWidth="1.5" />
      {cells.map(([x, y]) => (
        <circle key={`${x}${y}`} cx={7 + x * 5} cy={7 + y * 5} r="2.1" style={{ fill: ink }} />
      ))}
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────── rail */

/** Whose dashboard this is. The role is the one the owner asked for. */
export function OwnerCard() {
  const [t] = useWords();
  return (
    <div className={styles.owner}>
      <span className={styles.avatar}>
        <img src="/img/yehuda-cut-sm.webp" alt="" width={365} height={560} decoding="async" />
      </span>
      <span className={styles.ownerText}>
        <span className={styles.ownerName} translate="no">
          {AUTHOR.name}
        </span>
        <span className={styles.ownerRole}>{t.role}</span>
      </span>
    </div>
  );
}

export type ViewLink = { key: string; label: string; to: string; icon: ReactNode; current: boolean };

/** Home and Feed: the two views, each a URL. */
export function ViewNav({ label, views }: { label: string; views: ViewLink[] }) {
  return (
    <nav aria-label={label} className={styles.views}>
      <ul>
        {views.map((v) => (
          <li key={v.key}>
            <Link to={v.to} rel={facetRel(v.to)} className={styles.view} aria-current={v.current ? "page" : undefined}>
              {/* The current view is circled, the living line's
                  circle-around at rail size (#251). Same box either way,
                  so moving between views shifts nothing. */}
              <span aria-hidden="true" className={styles.viewIcon}>
                {v.current ? (
                  <Ring size={26} draw={false}>
                    {v.icon}
                  </Ring>
                ) : (
                  v.icon
                )}
              </span>
              {v.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export type TopItem = { key: string; label: string; to: string; count?: number; icon?: ReactNode };

/**
 * A ranked list with a search and "Show more": GitHub's "Top repositories".
 * The search filters what is listed as it is typed; it is a convenience
 * over a short list, so it lives in this component and not in the URL.
 */
export function TopList({ title, items, limit = 7 }: { title: string; items: TopItem[]; limit?: number }) {
  const [t, lang] = useWords();
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  const headingId = useId();
  const inputId = useId();
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);

  const needle = q.trim().toLocaleLowerCase();
  const matched = needle
    ? items.filter((i) => i.label.toLocaleLowerCase().includes(needle) || i.key.includes(needle))
    : items;
  const shown = all || needle ? matched : matched.slice(0, limit);
  const nf = new Intl.NumberFormat(lang === "he" ? "he-IL" : "en-GB");

  return (
    <section className={styles.top} aria-labelledby={headingId}>
      <div className={styles.topHead}>
        <h2 id={headingId} className={styles.railTitle}>
          {title}
        </h2>
        <button
          type="button"
          className={styles.iconButton}
          aria-expanded={searching}
          aria-controls={inputId}
          aria-label={t.findArea}
          onClick={() => {
            const next = !searching;
            setSearching(next);
            if (!next) setQ("");
            else queueMicrotask(() => input.current?.focus());
          }}
        >
          <Search size={16} aria-hidden="true" />
        </button>
      </div>
      <div hidden={!searching}>
        <label htmlFor={inputId} className="sr-only">
          {t.findArea}
        </label>
        <input
          ref={input}
          id={inputId}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setQ("");
              setSearching(false);
            }
          }}
          placeholder={`${t.findArea}…`}
          autoComplete="off"
          spellCheck={false}
          dir={typedDir(q)}
          className={styles.topInput}
        />
      </div>
      {shown.length > 0 ? (
        <ul id={listId} className={styles.topList}>
          {shown.map((i) => (
            <li key={i.key}>
              <Link to={i.to} rel={facetRel(i.to)} className={styles.topItem}>
                {i.icon}
                <span className={styles.topLabel}>{i.label}</span>
                {i.count !== undefined && <span className={styles.topCount}>{nf.format(i.count)}</span>}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.topEmpty} role="status">
          {t.noAreaMatch}
        </div>
      )}
      {!needle && matched.length > limit && (
        <DisclosureButton className={styles.more} expanded={all} controls={listId} onToggle={() => setAll(!all)}>
          {all ? t.showLess : t.showMore}
        </DisclosureButton>
      )}
    </section>
  );
}
