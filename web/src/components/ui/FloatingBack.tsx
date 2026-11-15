import { useState, type CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "@/components/ui/Icon";
import { NAV_GLYPH } from "@/components/ui/icons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLang } from "@/components/dashboard/i18n";
import { useFooterWords } from "@/i18n/chrome";
import { useMobileWords } from "@/i18n/mobile";
import { useShareWords } from "@/i18n/share";
import { useSiteSettings } from "@/settings/store";
import { copyText, shareLink } from "@/lib/share/browser";
import { shareToast } from "@/components/share/toast";
import styles from "@/components/ui/FloatingBack.module.css";

/*
 * The phone's way up from a detail page: ONE floating control, the same
 * height (`--float-h`), offset (`--float-top`, safe area included), layer
 * (`--float-z`), hairline and shadow as the menu circle, fixed to the
 * viewport at the inline-start edge, so it never scrolls away or is clipped.
 *
 * Tap the name: go to the logical parent (a real link, never history.back(),
 * so a deep link works). Tap the chevron: a small menu of the other ways on,
 * all in words the site already has: the parent, Home, Work, Blog, Share.
 * A destination that is the parent is listed once. The arrow mirrors in
 * Hebrew. Phones only: callers mount it under `usePublicPhone()`.
 *
 * It leaves a spacer in the flow with the height the old in-flow row had, so
 * the title below always has the control's room above it and never sits
 * under it.
 *
 * The label takes its own direction from its text (`dir="auto"`): an English
 * area name on a Hebrew page is left-to-right inside a right-to-left chip,
 * and without that it overflowed the wrong edge and was cut against the
 * border with no ellipsis. It is single-line, grows to the room beside the
 * menu circle and then ends in an ellipsis; the link's aria-label and the
 * title carry the whole name.
 */
export default function FloatingBack({ to, label, gap }: { to: string; label: string; gap?: string }) {
  const lang = useLang();
  const nav = useNavigate();
  const foot = useFooterWords();
  const mw = useMobileWords();
  const sw = useShareWords();
  const { sharing } = useSiteSettings();
  const [open, setOpen] = useState(false);

  const targets = [
    { to, label, icon: <Icon icon={NAV_GLYPH.parent} size={16} mirrorInRtl />, key: "parent" },
    { to: "/", label: foot.home, icon: <Icon icon={NAV_GLYPH.home} size={16} />, key: "home" },
    { to: "/projects", label: foot.work, icon: <Icon icon={NAV_GLYPH.work} size={16} />, key: "work" },
    { to: "/blog", label: foot.blogs, icon: <Icon icon={NAV_GLYPH.blog} size={16} />, key: "blog" },
  ].filter((t, i, all) => all.findIndex((o) => o.to === t.to) === i);

  async function share() {
    const url = window.location.href;
    const r = await shareLink({ url, title: document.title });
    if (r !== "fallback") return;
    const ok = await copyText(url);
    shareToast(ok ? sw.linkCopied : sw.copyFailed, ok);
  }

  return (
    <>
      <div className={styles.spacer} style={gap ? ({ "--back-row-gap": gap } as CSSProperties) : undefined} aria-hidden="true" />
      <div className={styles.float} data-floating-back="">
        <Link to={to} className={styles.link} aria-label={label} title={label} data-back-chip="">
          <span className={styles.arrow} aria-hidden="true">
            <Icon icon={NAV_GLYPH.back} size={20} className={styles.glyph} />
          </span>
          <span className={styles.name} dir="auto" data-back-pill="">
            {label}
          </span>
        </Link>
        <DropdownMenu open={open} onOpenChange={setOpen} dir={lang === "he" ? "rtl" : "ltr"}>
          <DropdownMenuTrigger className={styles.more} aria-label={mw.icons.more} data-back-menu="">
            <Icon icon={NAV_GLYPH.more} size={16} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={8} className={styles.menu}>
            {targets.map((t) => (
              <DropdownMenuItem key={t.key} className={styles.item} onSelect={() => nav(t.to)}>
                {t.icon}
                <bdi>{t.label}</bdi>
              </DropdownMenuItem>
            ))}
            {sharing.enabled && (
              <DropdownMenuItem className={styles.item} onSelect={() => void share()}>
                <Icon icon={NAV_GLYPH.share} size={16} />
                <span>{sw.share}</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}
