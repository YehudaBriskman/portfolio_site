import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Chip, ChipRow } from "@/components/ui/Chip";
import { Disclosure } from "@/components/ui/Disclosure";
import {
  SegmentedControl,
  type SegmentOption,
} from "@/components/ui/SegmentedControl";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import Shot from "@/components/projects/Shot";
import {
  hrefCleared,
  hrefToggled,
  activeCount,
  type Selection,
} from "@/components/gallery/facets";
import type { FacetSpec } from "@/components/gallery/FilterControl";
import { useFilterWords } from "@/i18n/pages";
import { useFiltersWords } from "@/i18n/filters";
import styles from "@/components/gallery/PhoneBrowse.module.css";

/*
 * The phone's Browse sheet (#808): the page's own surface, opened from the one
 * Browse row at the top of the circle menu (`nav/LocalSection`). It is a
 * BottomSheet at its medium (half) height, so the menu stays what it is for
 * (the pages, the display switches, the links elsewhere) and the filters never
 * crowd it. One sheet at a time: the menu closes when this opens.
 *
 *   search            when the page has one
 *   sort / view       a SegmentedControl (a short either/or)
 *   facets            one chip each, with how many choices are on; a chip
 *                     opens a small popover of its options with counts. One
 *                     popover at a time.
 *   pinned            a row of cover thumbs
 *   More              one Disclosure for the rest (areas)
 *   footer, sticky    Clear (only with a filter on) and "Show N", which
 *                     closes the sheet on the result.
 *
 * Every choice is the URL, exactly as the rail's popovers are (`facets.ts`),
 * so a filter keeps the reader's place and the on-page tokens stay the way to
 * take one off. A choice applies at once; the count in the footer follows it.
 * The popover lists are plain toggle buttons (`aria-pressed`) in a labelled
 * group. A link that leaves the page (a pinned project, an area) closes the
 * sheet; search, sort, chips and Clear are in `data-filter-scope` and do not.
 */

export type PinThumb = {
  key: string;
  to: string;
  label: string;
  cover?: string | null;
  tone?: string;
};

export type PhoneSort = {
  label: string;
  options: SegmentOption<string>[];
  value: string;
  onChange: (value: string) => void;
};

export default function PhoneBrowse({
  open,
  onClose,
  title,
  facets,
  selection,
  path,
  shown,
  search,
  sort,
  pinned,
  moreLabel,
  more,
  withQuery = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  facets: FacetSpec[];
  selection: Selection;
  path: string;
  shown: number;
  search?: ReactNode;
  sort?: PhoneSort;
  pinned?: { title: string; items: PinThumb[] };
  moreLabel: string;
  /** What the More disclosure holds; omitted, there is no More. */
  more?: ReactNode;
  withQuery?: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const w = useFilterWords();
  const fw = useFiltersWords();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [scope, setScope] = useState<HTMLElement | null>(null);
  const offered = facets.filter((f) => f.options.length > 0);
  const on = activeCount(selection);
  const query = withQuery
    ? (new URLSearchParams(location.search).get("q") ?? "").trim()
    : "";
  const toggle = (facet: string, value: string) =>
    navigate(hrefToggled(path, location.search, facet, value), {
      preventScrollReset: true,
      viewTransition: true,
    });

  const footer = (
    <div className={styles.foot} data-browse-foot="" data-filter-scope="">
      {on > 0 || query ? (
        <Link
          to={hrefCleared(path, location.search, [
            ...facets.map((f) => f.key),
            ...(withQuery ? ["q"] : []),
          ])}
          preventScrollReset
          viewTransition
          className={styles.clear}
        >
          {w.clearAll}
        </Link>
      ) : (
        <span />
      )}
      {/* Always in the tree: the count is announced as a filter changes it. */}
      <button
        type="button"
        className={styles.show}
        disabled={shown === 0}
        aria-live="polite"
        onClick={onClose}
      >
        {fw.show(shown)}
      </button>
    </div>
  );

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      snaps={["half", "full"]}
      footer={footer}
    >
      <div
        className={styles.root}
        onClick={(e) => {
          const a = (e.target as HTMLElement).closest("a[href]");
          if (a && !a.closest("[data-filter-scope]")) onClose();
        }}
      >
        <div className={styles.top} data-filter-scope="" ref={setScope}>
          {search}
          {sort && (
            <SegmentedControl
              label={sort.label}
              options={sort.options}
              value={sort.value}
              onChange={sort.onChange}
              className={styles.sort}
            />
          )}
          {offered.length > 0 && (
            <ChipRow label={w.filter} className={styles.chips}>
              {offered.map((f) => {
                const chosen = selection[f.key] ?? [];
                return (
                  <Popover
                    key={f.key}
                    open={openKey === f.key}
                    onOpenChange={(o) => setOpenKey(o ? f.key : null)}
                  >
                    <PopoverTrigger asChild>
                      <Chip
                        selected={chosen.length > 0}
                        count={chosen.length > 0 ? chosen.length : undefined}
                        onClick={() => {}}
                      >
                        {f.label}
                      </Chip>
                    </PopoverTrigger>
                    <PopoverContent
                      container={scope}
                      align="start"
                      sideOffset={6}
                      collisionPadding={8}
                      className={styles.popover}
                      onEscapeKeyDown={(e) => {
                        /* One Escape, one layer: the menu's own handler skips a
                         key somebody has already used (`Nav.tsx`). */
                        e.preventDefault();
                        setOpenKey(null);
                      }}
                    >
                      <div
                        role="group"
                        aria-label={f.label}
                        className={styles.options}
                        translate={f.noTranslate ? "no" : undefined}
                      >
                        {f.options.map((o) => {
                          const isOn = chosen.includes(o.value);
                          return (
                            <button
                              key={o.value}
                              type="button"
                              className={styles.option}
                              aria-pressed={isOn}
                              data-empty={o.count === 0 || undefined}
                              onClick={() => toggle(f.key, o.value)}
                            >
                              <span className={styles.box} aria-hidden="true" />
                              <span className={styles.value} dir="auto">
                                {f.labelOf?.(o.value) ?? o.value}
                              </span>
                              <span className={styles.count}>{o.count}</span>
                            </button>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                );
              })}
            </ChipRow>
          )}
        </div>

        {pinned && pinned.items.length > 0 && (
          <nav className={styles.pins} aria-label={pinned.title}>
            <p className={styles.small}>{pinned.title}</p>
            <ul className={styles.thumbs}>
              {pinned.items.map((p) => (
                <li key={p.key}>
                  <Link to={p.to} className={styles.thumb}>
                    {p.cover ? (
                      <span className={styles.cover} data-cover="image">
                        <Shot
                          src={p.cover}
                          alt=""
                          className="h-full w-full"
                          sizes="72px"
                        />
                      </span>
                    ) : (
                      <span
                        className={styles.cover}
                        data-cover="glyph"
                        data-tone={p.tone}
                        aria-hidden="true"
                      >
                        <span dir="auto">
                          {p.label.trim().slice(0, 1).toUpperCase()}
                        </span>
                      </span>
                    )}
                    <span
                      className={styles.thumbLabel}
                      dir="auto"
                      translate="no"
                    >
                      {p.label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {more && (
          <Disclosure summary={moreLabel} className={styles.more}>
            {more}
          </Disclosure>
        )}
      </div>
    </BottomSheet>
  );
}
