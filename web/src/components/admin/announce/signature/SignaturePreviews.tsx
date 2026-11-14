import { useSignatureWords } from "./words";

/*
 * What the signature will look like in each place it can be used. These are
 * mock-ups for the owner, not the real pages: an email in a light and a dark
 * client (which is why a dark-mode signature has its own light ink), the end
 * of a post (the site's own ink, so it follows the theme), and a share card.
 */

export type PreviewArt = {
  /** The picture as the email shows it (the ink colour the owner chose). */
  src: string;
  /** The light-ink version for dark clients; null when there is none. */
  lightSrc: string | null;
  /** Shown width and height in CSS px: half the 2x email picture. */
  width: number;
  height: number;
  /** One ink, so the site can paint it in its own colour; a coloured picture is shown as it is. */
  themeable: boolean;
};

const MAX_W = 240;
const fit = (a: PreviewArt, max = MAX_W) => {
  const k = Math.min(1, max / a.width);
  return { width: Math.round(a.width * k), height: Math.round(a.height * k) };
};

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <figure className="m-0 min-w-0">
      <figcaption className="mb-1 text-sm text-clay">{title}</figcaption>
      {children}
    </figure>
  );
}

/* The image keeps its width and height so nothing shifts when it loads. */
function Img({ art, alt, dark, max }: { art: PreviewArt; alt: string; dark?: boolean; max?: number }) {
  const s = fit(art, max);
  return <img src={dark && art.lightSrc ? art.lightSrc : art.src} alt={alt} width={s.width} height={s.height} style={{ display: "block", maxWidth: "100%", height: "auto" }} />;
}

function Themed({ art, alt, max }: { art: PreviewArt; alt: string; max?: number }) {
  const s = fit(art, max);
  if (!art.themeable) return <Img art={art} alt={alt} max={max} />;
  return <span role="img" aria-label={alt} style={{ display: "block", width: s.width, height: s.height, maxWidth: "100%", background: "rgb(var(--ink))", WebkitMask: `url("${art.src}") center / contain no-repeat`, mask: `url("${art.src}") center / contain no-repeat` }} />;
}

export default function SignaturePreviews({ art, alt }: { art: PreviewArt; alt: string }) {
  const w = useSignatureWords();
  const mail = (dark: boolean) => (
    <div className="rounded-[var(--a-r-ctl,12px)] border border-[rgb(var(--rule-firm)/0.5)] p-3" style={{ background: dark ? "#1b1b1a" : "#ffffff", color: dark ? "#ecebe6" : "#222222" }} data-testid={dark ? "preview-email-dark" : "preview-email-light"}>
      <p className="m-0 text-sm">{w.sampleSignoff}</p>
      <div className="my-1"><Img art={art} alt={alt} dark={dark} /></div>
      <p className="m-0 text-sm">{w.sampleName}</p>
    </div>
  );
  return (
    <section aria-label={w.previewHeading} className="grid gap-3 sm:grid-cols-2" data-testid="signature-previews">
      <Frame title={w.previewEmailLight}>{mail(false)}</Frame>
      <Frame title={w.previewEmailDark}>{mail(true)}</Frame>
      <Frame title={w.previewPost}>
        <div className="rounded-[var(--a-r-ctl,12px)] border border-[rgb(var(--rule-firm)/0.5)] p-3" data-testid="preview-post">
          <p className="m-0 text-sm text-clay">{w.sampleLine}</p>
          <hr className="my-2 border-[rgb(var(--rule))]" />
          <Themed art={art} alt={alt} />
        </div>
      </Frame>
      <Frame title={w.previewCard}>
        <div className="relative overflow-hidden rounded-[var(--a-r-ctl,12px)] border border-[rgb(var(--rule-firm)/0.5)] p-3" style={{ aspectRatio: "1200 / 630", background: "rgb(var(--paper))" }} data-testid="preview-card">
          <p className="m-0 text-base font-bold">{w.sampleTitle}</p>
          <div className="absolute" style={{ insetInlineEnd: 12, insetBlockEnd: 10 }}>
            <Themed art={art} alt={alt} max={120} />
          </div>
        </div>
      </Frame>
    </section>
  );
}
