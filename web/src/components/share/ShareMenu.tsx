import { useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, ClipboardCopy, ImageDown, Link2, Mail, MessageCircle, Share2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLang } from "@/components/dashboard/i18n";
import { useShareWords } from "@/i18n/share";
import { useSiteSettings } from "@/settings/store";
import { buildRichEmail, buildShare, copyRich, copyText, shareLink, type ShareChannel, type ShareEntity, type ShareKind, type ShareResult } from "@/lib/share";
import ShareToaster, { armShareToaster } from "./ShareToaster";
import { shareToast as toast } from "./toast";
import SharePreview from "./SharePreview";
import styles from "./ShareMenu.module.css";

/*
 * The one share control (#470), on every surface that can be shared.
 *
 * On a touch device with the system share sheet, a press opens that sheet,
 * with the card image attached when the browser accepts files. Everywhere
 * else it is a menu. Nothing is requested from anyone until a click: the
 * card is fetched on the press that wants it.
 *
 * What the settings decide: the whole menu (`enabled`), the surfaces it
 * mounts on and which channels it lists. A surface or channel that is off is
 * not rendered, so nothing hidden is left in the tab order.
 *
 * Every other channel opens a preview sheet first (SharePreview): the card,
 * an editable caption and a count. Only its Send button leaves the page.
 * LinkedIn's dialog takes only an address and no text, so its Send copies
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

export default function ShareMenu({ kind, entity, variant = "icon", className, label }: Props) {
  const w = useShareWords();
  const lang = useLang();
  const { sharing } = useSiteSettings();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<ShareChannel | null>(null);
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

  async function copyAsEmail(r: ShareResult) {
    const content = buildRichEmail({
      title: entity.title,
      summary: entity.summary,
      url: r.url,
      image: r.image,
      origin: window.location.origin,
      buttonLabel: w.emailButton,
      dir: lang === "he" ? "rtl" : "ltr",
    });
    const done = await copyRich(content);
    toast(done === "rich" ? w.richCopied : done === "plain" ? w.richPlain : w.copyFailed);
  }

  // Menu rows are built only once it is open: a list can carry a menu per row.
  const rows = open ? channels.map(make) : [];
  const name = (c: ShareChannel) => ({ linkedin: "LinkedIn", gmail: "Gmail", x: "X", whatsapp: "WhatsApp", instagram: "Instagram", email: w.email, copy: w.copyLink, native: "" })[c];

  /** A channel that needs the preview: choosing it opens the sheet, and nothing is sent yet. */
  function choose(c: ShareChannel, icon: ReactNode, text?: ReactNode) {
    return (
      <DropdownMenuItem key={c} className={styles.item} onSelect={() => setChosen(c)}>
        {icon}
        {text ?? <span translate={c === "email" ? undefined : "no"}>{name(c)}</span>}
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
          align="start"
          collisionPadding={8}
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
                return choose("linkedin", <ArrowUpRight aria-hidden="true" />);
              case "email":
                return [
                  choose("email", <Mail aria-hidden="true" />),
                  <DropdownMenuItem key="rich" className={styles.item} onSelect={() => void copyAsEmail(r)}>
                    <ClipboardCopy aria-hidden="true" />
                    <span>{w.copyEmail}</span>
                  </DropdownMenuItem>,
                ];
              case "gmail":
                return choose("gmail", <ArrowUpRight aria-hidden="true" />);
              case "x":
                return choose("x", <ArrowUpRight aria-hidden="true" />);
              case "whatsapp":
                return choose("whatsapp", <MessageCircle aria-hidden="true" />);
              case "instagram":
                // No card, no kit: kinds without one (area, story, home) have nothing to save.
                return r.image ? choose(
                      "instagram",
                      <ImageDown aria-hidden="true" />,
                      <span>
                        {w.saveImage} <span className={styles.for}>({w.saveImageFor} <bdi translate="no">{name("instagram")}</bdi>)</span>
                      </span>,
                    ) : null;
              default:
                return null;
            }
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      {chosen && (
        <SharePreview
          key={chosen}
          result={make(chosen)}
          name={name(chosen)}
          brand={chosen !== "email"}
          title={entity.title}
          lang={lang}
          onClose={() => {
            setChosen(null);
            trigger.current?.focus();
          }}
        />
      )}
      <ShareToaster />
    </>
  );
}
