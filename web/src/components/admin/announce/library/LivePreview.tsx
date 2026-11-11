import type { AnnounceChannel, AnnounceLang } from "@/services/adminAnnounce";
import { channelLimit, countChars } from "@/lib/share";
import { InstagramPreview, LinkedInPreview, XPreview } from "../previews";
import { Lines } from "../previews/parts";
import { useAnnounceWords } from "../words";
import type { Sample } from "./useSample";
import { fill, tidy } from "./variables";
import { useLibraryWords } from "./words";

/*
 * The template as the channel will show it, filled from the sample. The
 * platform components are the shared preview ones, so what is drawn here is
 * what the inbox draws. Email and Gmail have no platform frame: a subject
 * line and a body, from the template's first line and the rest, as the kit
 * splits them.
 */
export default function LivePreview({ text, channel, lang, sample }: { text: string; channel: AnnounceChannel; lang: AnnounceLang; sample: Sample }) {
  const w = useLibraryWords();
  const a = useAnnounceWords();
  const body = tidy(fill(text, sample.vars));
  const limit = channelLimit(channel);
  const n = countChars(body, channel === "email" || channel === "gmail" ? undefined : channel);
  const over = limit !== null && n > limit;
  const [subject, ...rest] = body.split("\n");

  return (
    <div className="space-y-3" data-testid="live-preview">
      <p className="a-hint !mt-0 tabular-nums" role="status" data-over={over}>
        <span className={over ? "font-bold text-[rgb(var(--destructive-ink))]" : ""}>{w.counter(n, limit)}</span>
        {over && <span className="font-bold text-[rgb(var(--destructive-ink))]">{` · ${w.over(n - (limit ?? 0))}`}</span>}
      </p>
      {channel === "linkedin" && <LinkedInPreview text={body} {...sample.meta} locale={lang} />}
      {channel === "x" && <XPreview text={body} {...sample.meta} locale={lang} />}
      {channel === "instagram" && <InstagramPreview text={body} image={sample.meta.image} />}
      {(channel === "email" || channel === "gmail") && (
        <section className="a-box p-3" aria-label={a.channels[channel]} dir={lang === "he" ? "rtl" : "ltr"} lang={lang}>
          <p className="a-label !mb-1">{w.mailSubject}</p>
          <p className="mb-3 text-sm" dir="auto">{subject}</p>
          <p className="a-label !mb-1">{w.mailBody}</p>
          <div className="text-sm"><Lines text={rest.join("\n").replace(/^\n+/, "")} /></div>
        </section>
      )}
    </div>
  );
}
