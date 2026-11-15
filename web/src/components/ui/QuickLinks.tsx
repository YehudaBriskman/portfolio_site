import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@/components/ui/Icon";
import { ICON } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/IconButton";
import { Panel } from "@/components/ui/Panel";
import type { PanelSpan } from "@/components/ui/PanelGrid";
import { usePanelWords } from "@/i18n/panels";
import styles from "@/components/ui/QuickLinks.module.css";

/*
 * The quick-links panel: the screens and actions the owner reaches for, as
 * icon tiles. Which are pinned is the owner's choice and is remembered in this
 * browser (localStorage, one key). The catalogue is the caller's; a stored id
 * that is no longer in it is dropped, and a broken value falls back to the
 * defaults. Edit mode lists every link as a pin toggle.
 */

export interface QuickLink {
  id: string;
  label: string;
  to: string;
  icon: typeof ICON.note;
}

export interface QuickLinksProps {
  id: string;
  /** localStorage key for the pinned ids. */
  storageKey: string;
  links: QuickLink[];
  defaultPinned: string[];
  span?: PanelSpan;
}

function load(key: string, links: QuickLink[], fallback: string[]): string[] {
  const known = new Set(links.map((l) => l.id));
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? "null");
    if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === "string" && known.has(x));
  } catch {
    /* fall through to the defaults */
  }
  return fallback.filter((x) => known.has(x));
}

export function QuickLinks({ id, storageKey, links, defaultPinned, span = 4 }: QuickLinksProps) {
  const w = usePanelWords();
  const [pinned, setPinned] = useState(() => load(storageKey, links, defaultPinned));
  const [editing, setEditing] = useState(false);

  const save = (next: string[]) => {
    setPinned(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* the choice lasts for the visit */
    }
  };
  const flip = (linkId: string) => save(pinned.includes(linkId) ? pinned.filter((x) => x !== linkId) : [...pinned, linkId]);
  const byId = new Map(links.map((l) => [l.id, l]));
  const shown = pinned.map((p) => byId.get(p)).filter((l): l is QuickLink => !!l);

  return (
    <Panel
      id={id}
      title={w.quickLinks}
      icon={ICON.home}
      span={span}
      actions={
        <IconButton
          icon={editing ? ICON.markPosted : ICON.reorder}
          label={editing ? w.done : w.edit}
          size="sm"
          showLabel="never"
          onClick={() => setEditing((e) => !e)}
        />
      }
    >
      {editing ? (
        <ul className={styles.grid}>
          {links.map((l) => {
            const on = pinned.includes(l.id);
            return (
              <li key={l.id}>
                <button type="button" className={styles.tile} aria-pressed={on} aria-label={on ? w.unpin(l.label) : w.pin(l.label)} onClick={() => flip(l.id)}>
                  <Icon icon={l.icon} size={16} aria-hidden="true" />
                  <span className={styles.label}>{l.label}</span>
                  <Icon icon={on ? ICON.pin : ICON.unpin} size={16} aria-hidden="true" className={styles.pin} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : shown.length === 0 ? (
        <p className={styles.none}>{w.nothingPinned}</p>
      ) : (
        <ul className={styles.grid}>
          {shown.map((l) => (
            <li key={l.id}>
              <Link to={l.to} className={styles.tile}>
                <Icon icon={l.icon} size={16} aria-hidden="true" />
                <span className={styles.label}>{l.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
