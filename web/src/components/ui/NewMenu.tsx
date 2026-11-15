import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ICON } from "@/components/ui/icons";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { IconButton, type ControlIcon } from "@/components/ui/IconButton";
import { usePhone } from "@/hooks/usePhone";
import { useAdminWords } from "@/i18n/admin";
import { useTableWords } from "@/i18n/tables";
import { useAudienceWords } from "@/components/admin/announce/audience/words";
import { useCampaignWords } from "@/components/admin/announce/campaigns/words";
import styles from "@/components/ui/NewMenu.module.css";

/*
 * "+ New" as one split button (principle 15, Stripe and Grafana do the same).
 *
 *  - The big half runs the page's own create (`primary`), so one click does the
 *    obvious thing.
 *  - The caret opens the menu: the page's own create first, then the common
 *    creates (post, area, media, campaign, contact), then the last three things
 *    made from here (Recent, kept in this browser). Ctrl/Cmd+K still reaches
 *    everything; the menu says so once, at its foot.
 *  - On a phone the same list is a bottom sheet, with 44px rows.
 *
 * `rememberCreated` adds to Recent; the menu records the creates it opens.
 */

export interface NewMenuPrimary {
  id: string;
  label: string;
  icon?: ControlIcon;
  onSelect: () => void;
}

export interface NewMenuItem {
  id: string;
  label: string;
  icon: ControlIcon;
  href: string;
}

export interface NewMenuProps {
  primary: NewMenuPrimary;
  /** Replaces the common creates. */
  items?: NewMenuItem[];
  className?: string;
}

/* ----------------------------------------------------------- recents */

const RECENT_KEY = "a-new-recent";
export const RECENT_MAX = 3;
interface Recent {
  id: string;
  label: string;
  href: string;
}

export function readRecents(): Recent[] {
  try {
    const v: unknown = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((r): r is Recent => !!r && typeof r.id === "string" && typeof r.label === "string" && typeof r.href === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

/** The newest first, one entry per id, three at most. Never throws. */
export function rememberCreated(r: Recent): void {
  try {
    const next = [r, ...readRecents().filter((x) => x.id !== r.id)].slice(0, RECENT_MAX);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: Recent just stays empty */
  }
}

/* ------------------------------------------------------ common creates */

const ICONS = { post: ICON.note, area: ICON.area, media: ICON.image, campaign: ICON.announcement, contact: ICON.contact };

export function useCommonCreates(): NewMenuItem[] {
  const a = useAdminWords();
  const c = useCampaignWords();
  const u = useAudienceWords();
  return [
    { id: "new-post", label: a.newNote, icon: ICONS.post, href: "/admin/posts/new" },
    { id: "new-area", label: a.newArea, icon: ICONS.area, href: "/admin/areas/new" },
    { id: "upload-media", label: a.upload, icon: ICONS.media, href: "/admin/media" },
    { id: "new-campaign", label: c.newCampaign, icon: ICONS.campaign, href: "/admin/marketing?tab=campaigns" },
    { id: "add-contact", label: u.addContact, icon: ICONS.contact, href: "/admin/marketing?tab=audience" },
  ];
}

/* ---------------------------------------------------------------- menu */

const SHORTCUT = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "\u2318K" : "Ctrl K";

export function NewMenu({ primary, items, className }: NewMenuProps) {
  const w = useTableWords().newMenu;
  const nav = useNavigate();
  const phone = usePhone();
  const common = useCommonCreates();
  const [sheet, setSheet] = useState(false);
  const [recents, setRecents] = useState<Recent[]>(() => readRecents());

  /* The page's own create is already first: do not list it twice. */
  const more = (items ?? common).filter((i) => i.label !== primary.label);
  const refresh = () => setRecents(readRecents());

  const go = (i: NewMenuItem | Recent) => {
    rememberCreated({ id: i.id, label: i.label, href: i.href });
    nav(i.href);
  };
  const Own = primary.icon ?? ICON.add;

  const list = (
    <>
      <Row onPick={() => (setSheet(false), primary.onSelect())} icon={Own} label={primary.label} phone={phone} />
      {more.map((i) => (
        <Row key={i.id} onPick={() => (setSheet(false), go(i))} icon={i.icon} label={i.label} phone={phone} />
      ))}
      {recents.length > 0 && (
        <>
          <Heading phone={phone}>{w.recent}</Heading>
          {recents.map((r) => (
            <Row key={`r-${r.id}`} onPick={() => (setSheet(false), go(r))} icon={ICON.when} label={r.label} phone={phone} />
          ))}
        </>
      )}
    </>
  );

  return (
    <div className={[styles.split, className].filter(Boolean).join(" ")} data-new-menu="" data-joined="">
      <IconButton icon={Own} label={primary.label} tone="primary" showLabel="always" className={styles.main} onClick={primary.onSelect} />
      {phone ? (
        <>
          <IconButton icon={ICON.expand} label={w.more} tone="primary" className={styles.caret} aria-haspopup="dialog" onClick={() => (refresh(), setSheet(true))} />
          <BottomSheet open={sheet} onClose={() => setSheet(false)} title={w.create}>
            <div role="menu" aria-label={w.create} className={styles.sheet}>
              {list}
            </div>
          </BottomSheet>
        </>
      ) : (
        <DropdownMenu onOpenChange={(o) => o && refresh()}>
          <DropdownMenuTrigger asChild>
            <IconButton icon={ICON.expand} label={w.more} tone="primary" className={styles.caret} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={styles.menu}>
            <DropdownMenuLabel className={styles.head}>{w.create}</DropdownMenuLabel>
            {list}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className={styles.foot}>
              <kbd className={styles.kbd} dir="ltr">
                {SHORTCUT}
              </kbd>{" "}
              {w.hint}
            </DropdownMenuLabel>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

function Row({ icon: I, label, onPick, phone }: { icon: ControlIcon; label: string; onPick: () => void; phone: boolean }) {
  if (phone)
    return (
      <button type="button" role="menuitem" className={styles.sheetRow} onClick={onPick}>
        <I className={styles.glyph} aria-hidden="true" />
        {label}
      </button>
    );
  return (
    <DropdownMenuItem onSelect={onPick}>
      <I className={styles.glyph} aria-hidden="true" />
      {label}
    </DropdownMenuItem>
  );
}

function Heading({ phone, children }: { phone: boolean; children: string }) {
  return phone ? (
    <div role="presentation" className={styles.sheetHead}>
      {children}
    </div>
  ) : (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className={styles.head}>{children}</DropdownMenuLabel>
    </>
  );
}
