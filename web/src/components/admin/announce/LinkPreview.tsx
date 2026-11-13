import { useEffect, useId, useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import {
  adminAnnounce,
  type AnnounceLang,
  type AnnouncePreview,
  type PreviewIssue,
} from "@/services/adminAnnounce";
import { domainOf } from "./helpers";
import { useAnnounceWords } from "./words";
import { useMarketingWords } from "./inbox/words";

/*
 * How the link will look on LinkedIn, X and WhatsApp, drawn from the tags the
 * server reads off the event's own page. These are mock-ups: each platform
 * crops a little differently and none of them is contacted. Every string is
 * page text rendered as text. The card's content takes the page's language
 * (dir), the chrome around it takes the admin's.
 */

type State =
  | { kind: "loading" }
  | {
      kind: "error";
      message: "failed" | "no-page" | "not-published" | "no-hebrew";
    }
  | { kind: "ready"; data: AnnouncePreview };

function issueText(
  w: ReturnType<typeof useAnnounceWords>,
  m: ReturnType<typeof useMarketingWords>,
  i: PreviewIssue,
): string {
  const n = i.length ?? 0;
  const max = i.limit ?? 0;
  switch (i.code) {
    case "title-missing":
      return w.issueTitleMissing;
    case "title-long":
      return w.issueTitleLong(n, max);
    case "description-missing":
      return w.issueDescriptionMissing;
    case "description-long":
      return w.issueDescriptionLong(n, max);
    case "image-missing":
      return w.issueImageMissing;
    case "image-size":
      return w.issueImageSize;
    case "no-hebrew-translation":
      return m.issueNoHebrew;
  }
}

const PLATFORMS = ["linkedin", "x", "whatsapp"] as const;
type Platform = (typeof PLATFORMS)[number];

/** An image URL from the page's tags; only http(s) is ever put in an <img>. */
const safeImage = (src: string) => (/^https?:\/\//i.test(src) ? src : "");

function Card({
  platform,
  label,
  data,
}: {
  platform: Platform;
  label: string;
  data: AnnouncePreview;
}) {
  const w = useAnnounceWords();
  const [broken, setBroken] = useState(false);
  const src = safeImage(data.image);
  const domain = domainOf(data.url || data.image);
  const showDescription = platform !== "linkedin";
  const frame =
    platform === "whatsapp"
      ? "rounded-lg bg-[rgb(var(--paper))] p-1 shadow-sm"
      : platform === "x"
        ? "overflow-hidden rounded-xl"
        : "overflow-hidden rounded-md";

  return (
    <figure
      className={`m-0 min-w-0 border border-[rgb(var(--rule-firm)/0.5)] bg-[rgb(var(--paper-2))] ${frame}`}
      aria-label={w.previewOf(label)}
    >
      <div className="aspect-[1200/630] w-full overflow-hidden bg-[rgb(var(--paper-3,var(--paper-2)))]">
        {src && !broken ? (
          <img
            src={src}
            alt={w.previewImage(label)}
            loading="lazy"
            onError={() => setBroken(true)}
            className="block h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-sm text-clay">
            {w.previewNoImage}
          </span>
        )}
      </div>
      <figcaption
        className="min-w-0 space-y-0.5 p-2.5 text-start"
        dir={data.lang === "he" ? "rtl" : "ltr"}
      >
        {platform === "x" && (
          <span className="block truncate text-sm text-clay" title={domain}>{domain}</span>
        )}
        <span
          className="line-clamp-2 text-sm font-semibold leading-snug break-words"
          dir="auto"
          title={data.title || undefined}
        >
          {data.title || w.previewNoTitle}
        </span>
        {showDescription && (
          <span
            className="line-clamp-2 text-sm leading-snug text-clay break-words"
            dir="auto"
            title={data.description || undefined}
          >
            {data.description || w.previewNoDescription}
          </span>
        )}
        {platform !== "x" && (
          <span className="block truncate text-sm text-clay" dir="ltr" title={domain}>
            {domain}
          </span>
        )}
      </figcaption>
    </figure>
  );
}

export default function LinkPreview({
  eventId,
  lang,
  target,
}: {
  eventId: string;
  lang: AnnounceLang;
  /** For an event whose link leaves the site (a release): where it goes, shown instead of "no page". */
  target?: string;
}) {
  const w = useAnnounceWords();
  const m = useMarketingWords();
  const uid = useId();
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${eventId}:${lang}:${attempt}`;
  /* Tagged with the request it answers, so a stale answer reads as loading. */
  const [result, setResult] = useState<{ key: string; state: State } | null>(
    null,
  );
  const state: State =
    result?.key === requestKey ? result.state : { kind: "loading" };

  useEffect(() => {
    let live = true;
    adminAnnounce.preview(eventId, lang).then(
      (data) =>
        live && setResult({ key: requestKey, state: { kind: "ready", data } }),
      (e: unknown) => {
        if (!live) return;
        const s = e instanceof Error ? e.message : "";
        const message: Extract<State, { kind: "error" }>["message"] =
          s === "status-422"
            ? "no-page"
            : s === "status-404"
              ? lang === "he"
                ? "no-hebrew"
                : "not-published"
              : "failed";
        setResult({ key: requestKey, state: { kind: "error", message } });
      },
    );
    return () => {
      live = false;
    };
  }, [eventId, lang, requestKey]);

  const errorText = (
    m: "failed" | "no-page" | "not-published" | "no-hebrew",
  ) =>
    m === "no-page"
      ? w.previewNoPage
      : m === "not-published"
        ? w.previewNotPublished
        : m === "no-hebrew"
          ? w.previewNoHebrew
          : w.previewFailed;

  return (
    <section
      className="border-t border-[rgb(var(--rule-firm)/0.5)] p-4"
      aria-labelledby={`${uid}-h`}
      aria-busy={state.kind === "loading"}
    >
      <h4 id={`${uid}-h`} className="a-row-title">
        {w.linkPreview}
      </h4>
      <p className="a-hint">{w.linkPreviewHint}</p>

      {state.kind === "loading" && (
        <p role="status" className="a-hint">
          {w.previewLoading}
        </p>
      )}

      {state.kind === "error" && state.message === "no-page" && target && (
        <p className="mt-2 text-sm">
          <span className="text-clay">{m.linkGoesTo} </span>
          <a href={target} className="a-link break-all" dir="ltr" target="_blank" rel="noopener noreferrer">
            {target}
          </a>
          <span className="a-hint">{m.linkExternal(domainOf(target))}</span>
        </p>
      )}

      {state.kind === "error" && !(state.message === "no-page" && target) && (
        <div role="alert" className="mt-2 flex flex-wrap items-center gap-3">
          <span className="text-sm">{errorText(state.message)}</span>
          {state.message === "failed" && (
            <button
              type="button"
              className="a-btn min-h-[44px]"
              onClick={() => setAttempt((n) => n + 1)}
            >
              {w.previewRetry}
            </button>
          )}
        </div>
      )}

      {state.kind === "ready" && (
        <>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {PLATFORMS.map((p) => (
              <div key={p} className="min-w-0 space-y-1.5">
                <p className="a-hint !mt-0 font-semibold">{w.platforms[p]}</p>
                <Card platform={p} label={w.platforms[p]} data={state.data} />
              </div>
            ))}
          </div>
          <div className="mt-3">
            <p className="a-hint !mt-0 font-semibold">{w.previewIssues}</p>
            {state.data.issues.length === 0 ? (
              <p className="mt-1 flex items-start gap-2 text-sm">
                <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{" "}
                <span>{w.previewClean}</span>
              </p>
            ) : (
              <ul className="mt-1 space-y-1 text-sm">
                {state.data.issues.map((i) => (
                  <li key={i.code} className="flex items-start gap-2">
                    <AlertTriangle
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0"
                    />
                    <span>{issueText(w, m, i)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
