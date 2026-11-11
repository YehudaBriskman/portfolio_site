import { useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, ImageDown, Link2, Mail, MessageCircle, Share2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLang } from "@/components/dashboard/i18n";
import { useShareWords } from "@/i18n/share";
import { useSiteSettings } from "@/settings/store";
import { buildShare, copyText, shareLink, type ShareChannel, type ShareEntity, type ShareKind, type ShareResult } from "@/lib/share";
import ShareToaster, { armShareToaster } from "./ShareToaster";
import styles from "./ShareMenu.module.css";

/*
 * The one share control (#470), on every surface that can be shared.
 *
 * On a touch device with the system share sheet, a press opens that sheet,
 * with the card image attached when the browser accepts files. Everywhere
 * else it is a menu. Nothing is requested from anyone until a click: the
 * card is fetched on the press that wants it, and the links are plain
 * anchors the browser follows itself.
 *
 * What the settings decide: the whole menu (`enabled`), the surfaces it
 * mounts on and which channels it lists. A surface or channel that is off is
 * not rendered, so nothing hidden is left in the tab order.
 *
 * LinkedIn's dialog takes only an address and no text, so its item copies
 * the caption first; the person pastes it into the dialog.
 */

type Surface = Exclude<ShareKind, "release">;

type Props = {
  kind: Surface;
  entity: ShareEntity;
  /** `icon` is the bare button; `text` adds the word. */
  variant?: "icon" | "text";
  /** Replaces the trigger's own look, for a host that already styles its buttons. */
  className?: string;
  /** The trigger's accessible name; defaults to "Share" plus the title. */
  label?: string;
};

const ORDER: ShareChannel[] = ["copy", "linkedin", "email", "gmail", "x", "whatsapp", "instagram"];

/** Sonner loads on first use, with the toaster, not with every page that has a menu. */
async function toast(message: string): Promise<void> {
  (await import("@/components/ui/sonner")).toast(message);
}

function coarsePointer(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
}

function canShareNatively(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

/** The card as a file, or null: any failure just means the sheet gets no image. */
async function cardFile(image: string | undefined): Promise<File | null> {
  if (!image) return null;
  try {
    const res = await fetch(image, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    return new File([await res.blob()], "card.png", { type: "image/png" });
  } catch {
    return null;
  }
}

async function downloadImage(url: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const href = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = href;
    a.download = "share-card.png";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 10_000);
    return true;
  } catch {
    return false;
  }
}

export default function ShareMenu({ kind, entity, variant = "icon", className, label }: Props) {
  const w = useShareWords();
  const lang = useLang();
  const { sharing } = useSiteSettings();
  const [open, setOpen] = useState(false);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  const channels = ORDER.filter((c) => sharing.channels.includes(c));
  const native = sharing.channels.includes("native");
  if (!sharing.enabled || !sharing.surfaces.includes(kind)) return null;
  if (channels.length === 0 && !(native && canShareNatively())) return null;

  const make = (channel: ShareChannel): ShareResult =>
    buildShare({ kind, entity, locale: lang, channel, audience: "visitor", origin: window.location.origin, settings: sharing });

  async function shareNatively(): Promise<boolean> {
    if (!native || !canShareNatively() || !coarsePointer()) return false;
    const base = make("native");
    const file = sharing.channels.includes("instagram") ? await cardFile(make("instagram").image) : null;
    const data = { url: base.url, title: entity.title, text: base.text };
    const withFile = file && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] }) ? { ...data, files: [file] } : data;
    return (await shareLink(withFile)) !== "fallback";
  }

  function onOpenChange(next: boolean) {
    if (!next) return setOpen(false);
    armShareToaster();
    // A menu opened from inside a modal dialog has to live in it (see the ui file).
    setContainer(trigger.current?.closest("dialog") ?? null);
    void shareNatively().then((done) => {
      if (!done) setOpen(true);
    });
  }

  async function copyWith(text: string, ok: string) {
    toast((await copyText(text)) ? ok : w.copyFailed);
  }

  // Menu rows are built only once it is open: a list can carry a menu per row.
  const rows = open ? channels.map(make) : [];
  const name = (c: ShareChannel) => ({ linkedin: "LinkedIn", gmail: "Gmail", x: "X", whatsapp: "WhatsApp", instagram: "Instagram", email: w.email, copy: w.copyLink, native: "" })[c];

  function link(r: ShareResult, icon: ReactNode, external: boolean, onSelect?: () => void) {
    return (
      <DropdownMenuItem key={r.channel} asChild className={styles.item} onSelect={onSelect}>
        <a href={r.href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
          {icon}
          <span translate={r.channel === "email" ? undefined : "no"}>{name(r.channel)}</span>
          {external && <span className="sr-only">{` (${w.newTab})`}</span>}
        </a>
      </DropdownMenuItem>
    );
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={onOpenChange} dir={lang === "he" ? "rtl" : "ltr"}>
        <DropdownMenuTrigger
          ref={trigger}
          className={className ?? (variant === "text" ? styles.text : styles.icon)}
          aria-label={label ?? w.shareNamed(entity.title)}
          title={variant === "icon" ? w.share : undefined}
        >
          <Share2 size={variant === "text" ? 15 : undefined} aria-hidden="true" />
          {variant === "text" && <span>{w.share}</span>}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          container={container}
          align={variant === "text" ? "start" : "end"}
          className={styles.content}
          data-share-menu=""
        >
          {rows.map((r) => {
            switch (r.channel) {
              case "copy":
                return (
                  <DropdownMenuItem key="copy" className={styles.item} onSelect={() => void copyWith(r.url, w.linkCopied)}>
                    <Link2 aria-hidden="true" />
                    <span>{w.copyLink}</span>
                  </DropdownMenuItem>
                );
              case "linkedin":
                // Started inside the click, before the dialog opens: the dialog cannot take the text.
                return link(r, <ArrowUpRight aria-hidden="true" />, true, () => void copyWith(r.text, w.captionCopied));
              case "email":
                return link(r, <Mail aria-hidden="true" />, false);
              case "gmail":
                return link(r, <ArrowUpRight aria-hidden="true" />, true);
              case "x":
                return link(r, <ArrowUpRight aria-hidden="true" />, true);
              case "whatsapp":
                return link(r, <MessageCircle aria-hidden="true" />, true);
              case "instagram": {
                // No card, no kit: kinds without one (area, story, home) have nothing to save.
                if (!r.image) return null;
                const image = r.image;
                return (
                  <DropdownMenuItem
                    key="instagram"
                    className={styles.item}
                    onSelect={() => {
                      void (async () => {
                        const copied = copyText(r.text);
                        const saved = await downloadImage(image);
                        toast(saved && (await copied) ? w.imageSaved : saved ? w.copyFailed : w.saveFailed);
                      })();
                    }}
                  >
                    <ImageDown aria-hidden="true" />
                    <span>
                      {w.saveImage} <span className={styles.for}>({w.saveImageFor} <bdi translate="no">{name("instagram")}</bdi>)</span>
                    </span>
                  </DropdownMenuItem>
                );
              }
              default:
                return null;
            }
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      <ShareToaster />
    </>
  );
}
