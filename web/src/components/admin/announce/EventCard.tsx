import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, Copy, Download, ExternalLink, Mail, X as XIcon } from "lucide-react";
import { ErrorState, RelTime } from "@/components/admin/ui";
import { copyText } from "@/lib/share";
import {
  adminAnnounce,
  type AnnounceChannel,
  type AnnounceDetail,
  type AnnounceLang,
  type AnnounceSummary,
} from "@/services/adminAnnounce";
import { cardSrc, count, eventUrl, kitChannel, limitOf, links, TABS, type Format, type Tab } from "./helpers";
import LinkPreview from "./LinkPreview";
import { useAnnounceWords } from "./words";

/*
 * One event in the inbox: a heading row that opens into the preview card and
 * the kit. Opening marks it read. Every caption is a textarea value or text
 * in the page, never markup, and nothing leaves the page until a button is
 * pressed: copying, downloading and opening a channel are all clicks.
 */

type Props = {
  event: AnnounceSummary;
  /** Called with the server's copy after any change, so the list and the badge follow. */
  onChange: (next: AnnounceSummary | null) => void;
  defaultOpen?: boolean;
};

const doneTab = (ev: AnnounceSummary, tab: Tab) =>
  tab === "email" ? ev.done.email ?? ev.done.gmail : ev.done[tab];

function openTab(href: string) {
  window.open(href, "_blank", "noopener,noreferrer");
}

export default function EventCard({ event, onChange, defaultOpen = false }: Props) {
  const w = useAnnounceWords();
  const uid = useId();
  const [open, setOpen] = useState(defaultOpen);
  const [detail, setDetail] = useState<AnnounceDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [lang, setLang] = useState<AnnounceLang>("en");
  const [tab, setTab] = useState<Tab>("linkedin");
  const [format, setFormat] = useState<Format>("og");
  /* Edits, keyed by language and channel. Untouched captions follow the server's kit. */
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const readSent = useRef(false);
  const [imgFailed, setImgFailed] = useState(false);

  const unread = !event.readAt;

  useEffect(() => {
    if (!open || detail || failed) return;
    let live = true;
    adminAnnounce.get(event.id).then(
      (d) => live && setDetail(d),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [open, detail, failed, event.id]);

  /* Opening is reading. Once, and only if it was unread. */
  useEffect(() => {
    if (!open || !unread || readSent.current) return;
    readSent.current = true;
    adminAnnounce.read(event.id).then((r) => r.event && onChange(r.event), () => undefined);
  }, [open, unread, event.id, onChange]);

  const kit = detail?.kit[lang];
  const langs = detail ? (["en", "he"] as const).filter((l) => Object.keys(detail.kit[l]).length > 0) : [];
  const channel = kit ? kitChannel(tab, (c) => Boolean(kit[c])) : null;
  const item = channel && kit ? kit[channel] : undefined;
  const key = `${lang}:${tab}`;
  const text = edits[key] ?? item?.text ?? "";
  const subject = item?.subject ?? "";
  const edited = key in edits && item !== undefined && edits[key] !== item.text;
  const limit = limitOf(tab);
  const used = count(text, tab);
  const over = limit !== null && used > limit;
  const url = eventUrl(event, lang);
  const dir = lang === "he" ? "rtl" : "ltr";

  const sentCount = TABS.filter((t) => doneTab(event, t)).length;
  const tabId = (t: string) => `${uid}-tab-${t}`;
  const panelId = `${uid}-panel`;

  const mark = async (ch: AnnounceChannel) => {
    setBusy(true);
    try {
      const r = await adminAnnounce.done(event.id, ch);
      if (r.event) onChange(r.event);
    } catch {
      setNote(w.actionFailed);
    } finally {
      setBusy(false);
    }
  };

  const copy = async (message: string) => {
    setNote((await copyText(text)) ? message : w.copyFailed);
  };

  const dismiss = async () => {
    setBusy(true);
    try {
      await adminAnnounce.dismiss(event.id);
      onChange(null);
    } catch {
      setNote(w.actionFailed);
      setBusy(false);
    }
  };

  const download = (fmt: Format) => {
    const a = document.createElement("a");
    a.href = cardSrc(event, fmt);
    a.download = `${event.ref}-${fmt}.png`;
    a.rel = "noopener";
    document.body.append(a);
    a.click();
    a.remove();
  };

  /* Arrow keys move between tabs, as in the ARIA tabs pattern. */
  const onTabKey = (e: React.KeyboardEvent) => {
    const rtl = document.documentElement.dir === "rtl";
    const step = e.key === "ArrowRight" ? (rtl ? -1 : 1) : e.key === "ArrowLeft" ? (rtl ? 1 : -1) : 0;
    const to = e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : step ? (TABS.indexOf(tab) + step + TABS.length) % TABS.length : -1;
    if (to < 0) return;
    e.preventDefault();
    setTab(TABS[to]);
    tabRefs.current[TABS[to]]?.focus();
  };

  const body = () => {
    if (failed) return <ErrorState message={w.detailFailed} onRetry={() => setFailed(false)} />;
    if (!detail) return <p className="a-box-row text-clay" role="status">{w.loading}</p>;
    const shown = detail.event;
    return (
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-2">
          {imgFailed ? (
            <p className="a-hint">{w.previewMissing}</p>
          ) : (
            <img
              src={cardSrc(event, format)}
              alt={w.preview(shown.title)}
              width={format === "og" ? 1200 : 1080}
              height={format === "og" ? 630 : format === "square" ? 1080 : 1920}
              loading="lazy"
              onError={() => setImgFailed(true)}
              className="block h-auto max-h-80 w-full rounded-md border border-[rgb(var(--rule-firm)/0.5)] bg-[rgb(var(--paper-2))] object-contain"
            />
          )}
          <div role="group" aria-label={w.cardFormat} className="a-seg">
            {(["og", "square", "story"] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={format === f}
                onClick={() => (setImgFailed(false), setFormat(f))}
                className="min-h-[44px] md:min-h-[1.75rem]"
              >
                {w.formats[f]}
              </button>
            ))}
          </div>
        </div>

        <div className="min-w-0 space-y-3">
          {langs.length > 1 && (
            <div role="group" aria-label={w.language} className="a-seg">
              {langs.map((l) => (
                <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)} lang={l} className="min-h-[44px] md:min-h-[1.75rem]">
                  {l === "en" ? "EN" : "עב"}
                  <span className="sr-only"> {w.langs[l]}</span>
                </button>
              ))}
            </div>
          )}

          <div role="tablist" aria-label={w.channelsLabel} className="a-tabs" onKeyDown={onTabKey}>
            {TABS.map((t) => {
              const on = t === tab;
              const isDone = Boolean(doneTab(event, t));
              return (
                <button
                  key={t}
                  ref={(el) => void (tabRefs.current[t] = el)}
                  id={tabId(t)}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  aria-controls={panelId}
                  tabIndex={on ? 0 : -1}
                  onClick={() => setTab(t)}
                  className="a-tab min-h-[44px]"
                >
                  {w.channels[t]}
                  {isDone && (
                    <>
                      <Check aria-hidden="true" />
                      <span className="sr-only">{w.markedDone}</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>

          <div id={panelId} role="tabpanel" aria-labelledby={tabId(tab)} className="space-y-3">
            {!item ? (
              <p className="a-hint">{w.noCaption}</p>
            ) : (
              <>
                {(tab === "email") && (
                  <p className="text-sm">
                    <span className="text-clay">{w.subject}: </span>
                    <span dir={dir} lang={lang}>{subject}</span>
                  </p>
                )}
                <div>
                  <label htmlFor={`${uid}-caption`} className="sr-only">
                    {w.caption(w.channels[tab])}
                  </label>
                  <textarea
                    id={`${uid}-caption`}
                    className="a-textarea"
                    rows={8}
                    dir={dir}
                    lang={lang}
                    value={text}
                    aria-describedby={`${uid}-count`}
                    onChange={(e) => setEdits((p) => ({ ...p, [key]: e.target.value }))}
                  />
                  <p id={`${uid}-count`} className={`a-hint flex flex-wrap items-center gap-x-3 tabular-nums ${over ? "!font-bold !text-[rgb(var(--destructive-ink))]" : ""}`}>
                    <span>{w.count(used, limit)}</span>
                    {over && limit !== null && <span>{w.over(used - limit)}</span>}
                    {edited && (
                      <button type="button" className="a-link min-h-[44px] md:min-h-0" onClick={() => setEdits(({ [key]: _gone, ...rest }) => rest)}>
                        {w.resetCaption}
                      </button>
                    )}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {tab === "linkedin" && (
                    <button
                      type="button"
                      className="a-btn a-btn-primary min-h-[44px]"
                      onClick={() => {
                        openTab(links.linkedin(url));
                        void copy(w.linkedInCopied);
                      }}
                    >
                      <ExternalLink aria-hidden="true" />
                      {w.openLinkedIn}
                    </button>
                  )}
                  {tab === "instagram" && (
                    <>
                      <button
                        type="button"
                        className="a-btn a-btn-primary min-h-[44px]"
                        onClick={() => {
                          download("square");
                          void copy(w.instagramDone);
                        }}
                      >
                        <Download aria-hidden="true" />
                        {w.saveSquare}
                      </button>
                      <button
                        type="button"
                        className="a-btn min-h-[44px]"
                        onClick={() => {
                          download("story");
                          void copy(w.instagramDone);
                        }}
                      >
                        <Download aria-hidden="true" />
                        {w.saveStory}
                      </button>
                    </>
                  )}
                  {tab === "email" && (
                    <>
                      <button
                        type="button"
                        className="a-btn a-btn-primary min-h-[44px]"
                        onClick={() => (openTab(links.gmail(subject, text)), setNote(w.opened))}
                      >
                        <Mail aria-hidden="true" />
                        {w.openGmail}
                      </button>
                      <a
                        className="a-btn min-h-[44px]"
                        href={links.mailto(subject, text)}
                        onClick={() => setNote(w.opened)}
                      >
                        <Mail aria-hidden="true" />
                        {w.openMail}
                      </a>
                    </>
                  )}
                  {tab === "x" && (
                    <button
                      type="button"
                      className="a-btn a-btn-primary min-h-[44px]"
                      disabled={over}
                      onClick={() => (openTab(links.x(url, text)), setNote(w.opened))}
                    >
                      <XIcon aria-hidden="true" />
                      {w.openX}
                    </button>
                  )}
                  <button type="button" className="a-btn min-h-[44px]" onClick={() => void copy(w.copied)}>
                    <Copy aria-hidden="true" />
                    {w.copy}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {doneTab(event, tab) ? (
                    <span className="a-tag">
                      <Check aria-hidden="true" className="h-3.5 w-3.5" />
                      {w.doneAt} <RelTime iso={doneTab(event, tab)} />
                    </span>
                  ) : (
                    <button type="button" className="a-btn min-h-[44px]" disabled={busy} onClick={() => void mark(channel!)} title={w.undoneHint}>
                      <Check aria-hidden="true" />
                      {w.markDone}
                    </button>
                  )}
                </div>
              </>
            )}
            <p role="status" className="a-hint min-h-[1.25rem]">{note}</p>
          </div>
        </div>
        <div className="lg:col-span-2">
          <LinkPreview eventId={event.id} lang={lang} />
        </div>
      </div>
    );
  };

  return (
    <article className="a-box" aria-labelledby={`${uid}-title`}>
      <div className="a-box-row items-start gap-3">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="a-tag">{w.kinds[event.kind]}</span>
            {unread && <span className="a-tag font-bold text-[rgb(var(--signal))]">{w.newBadge}</span>}
          </span>
          <span id={`${uid}-title`} className="a-row-title mt-1 block break-words" dir="auto">
            {event.title}
          </span>
          <span className="a-row-meta">
            <RelTime iso={event.createdAt} />
            <span className="tabular-nums">{w.doneCount(sentCount, TABS.length)}</span>
          </span>
        </span>
        <button
          type="button"
          className="a-btn a-btn-ghost min-h-[44px] shrink-0"
          aria-expanded={open}
          aria-controls={`${uid}-body`}
          aria-label={open ? w.close(event.title) : w.open(event.title)}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
          <span className="hidden sm:inline">{open ? w.closeShort : w.openShort}</span>
        </button>
      </div>
      <div id={`${uid}-body`} hidden={!open}>
        {open && body()}
        {open && (
          <div className="a-box-foot flex flex-wrap items-center gap-3">
            <button type="button" className="a-btn a-btn-danger min-h-[44px]" disabled={busy} onClick={() => void dismiss()}>
              {w.dismiss}
            </button>
            <span className="a-hint !mt-0">{w.dismissHint}</span>
          </div>
        )}
      </div>
    </article>
  );
}

