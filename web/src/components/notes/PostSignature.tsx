import { useEffect, useState } from "react";
import type { Lang } from "@/components/dashboard/i18n";

type Asset = { src: string; alt: string; width: number; height: number };

/* Only our own rendered signature file, never a URL the response chose. */
const OWN = /^\/api\/signature\/(?:en|he)\/[0-9a-f]{16}\.(?:svg|png)$/;

/**
 * The owner's handwritten sign-off at the end of a post, when they have turned
 * "End of posts" on. It is a mask painted with the current text colour, so it
 * follows light and dark with no second file; its size is reserved (width and
 * aspect-ratio) so nothing shifts when it arrives. While the switch is off the
 * server answers 404 and this draws nothing: no words, no space.
 */
export default function PostSignature({ lang, className }: { lang: Lang; className?: string }) {
  const [a, setA] = useState<Asset | null>(null);
  useEffect(() => {
    const ctl = new AbortController();
    fetch(`/api/signature/${lang}/current`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Partial<Asset> | null) => {
        if (d && typeof d.src === "string" && OWN.test(d.src) && typeof d.alt === "string" && d.alt && Number(d.width) > 0 && Number(d.height) > 0) {
          setA({ src: d.src, alt: d.alt, width: Number(d.width), height: Number(d.height) });
        }
      })
      .catch(() => {});
    return () => ctl.abort();
  }, [lang]);
  if (!a) return null;
  const url = `url("${a.src}")`;
  return (
    <div className={className}>
      <span
        role="img"
        aria-label={a.alt}
        data-testid="post-signature"
        style={{
          display: "block",
          width: `${a.width}px`,
          maxWidth: "100%",
          aspectRatio: `${a.width} / ${a.height}`,
          backgroundColor: "currentColor",
          WebkitMaskImage: url,
          maskImage: url,
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskSize: "contain",
          maskSize: "contain",
        }}
      />
    </div>
  );
}
