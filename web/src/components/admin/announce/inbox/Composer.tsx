import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Copy, Download, ExternalLink, Mail, SlidersHorizontal, X as XIcon } from "lucide-react";
import { ErrorState, RelTime } from "@/components/admin/ui";
import { copyText } from "@/lib/share";
import { buildRichEmail } from "@/lib/share/richEmail";
import { EmailPreview, InstagramPreview, LinkedInPreview, XPreview } from "@/components/admin/announce/previews";
import {
  adminAnnounce,
  type AnnounceChannel,
  type AnnounceDetail,
  type AnnounceLang,
  type AnnouncePreview,
  type AnnounceSummary,
} from "@/services/adminAnnounce";
import { cardSrc, count, eventUrl, kitChannel, limitOf, links, TABS, type Tab } from "../helpers";
import ChecksDrawer from "./ChecksDrawer";
import { IssueChips } from "./Chips";
import { rememberReadiness } from "./readiness";
import KeyHint from "./KeyHint";
import { useHotkeys } from "./useHotkeys";
import { useMarketingWords } from "./words";

/*
 * One event, one channel at a time. The caption autosaves as the owner's own
 * draft (a short pause after typing, and at once when leaving), so closing the
 * page never loses an edit; "Reset to template" clears it. Every caption is a
 * textarea value or text in the page, never markup, and nothing leaves the
 * page until a button is pressed.
 */

type Save = "idle" | "saving" | "saved" | "error";
const PAUSE = 700;

const openTab = (href: string) => void window.open(href, "_blank", "noopener,noreferrer");

export default function Composer({
  event,
  onBack,
  onChange,
}: {
  event: AnnounceSummary;
  onBack: () => void;
  onChange: (next: AnnounceSummary | null) => void;
}) {
  const w = useMarketingWords();
  const uid = useId();
  const [detail, setDetail] = useState<AnnounceDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [lang, setLang] = useState<AnnounceLang>("en");
  const [tab, setTab] = useState<Tab>("linkedin");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [save, setSave] = useState<Save>("idle");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [checks, setChecks] = useState(false);
  const [preview, setPreview] = useState<{ lang: AnnounceLang; data: AnnouncePreview | null } | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ key: string; lang: AnnounceLang; channel: AnnounceChannel; text: string } | null>(null);
  /* The template's own text per caption, learned from the server while no draft covers it. */
  const [base, setBase] = useState<Record<string, string>>({});
  const unread = useRef(!event.readAt);
  const alive = useRef(true);

  const applyDetail = useCallback((d: AnnounceDetail) => {
    setDetail(d);
    setBase((prev) => {
      const next = { ...prev };
      for (const l of ["en", "he"] as const)
        for (const [c, it] of Object.entries(d.kit[l])) if (it && !it.draft) next[`${l}:${c}`] = it.text;
      return next;
    });
  }, []);

  /* ---- load */
  useEffect(() => {
    let live = true;
    adminAnnounce.get(event.id).then(
      (d) => live && applyDetail(d),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [event.id, attempt, applyDetail]);

  /* Opening is reading, once. */
  useEffect(() => {
    if (!unread.current) return;
    unread.current = false;
    adminAnnounce.read(event.id).then((r) => r.event && onChange(r.event), () => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id]);

  useEffect(() => {
    let live = true;
    adminAnnounce.preview(event.id, lang).then(
      (data) => {
        if (!live) return;
        setPreview({ lang, data });
        if (lang === "en") rememberReadiness(event.id, data.issues);
      },
      () => live && setPreview({ lang, data: null }),
    );
    return () => {
      live = false;
    };
  }, [event.id, lang]);

  /* ---- what is on screen */
  const kit = detail?.kit[lang];
  const langs = detail ? (["en", "he"] as const).filter((l) => Object.keys(detail.kit[l]).length > 0) : [];
  const channel = kit ? kitChannel(tab, (c) => Boolean(kit[c])) : null;
  const item = channel && kit ? kit[channel] : undefined;
  const key = `${lang}:${channel}`;
  const text = edits[key] ?? item?.text ?? "";
  const isDraft = Boolean(item?.draft) || (key in edits && edits[key] !== base[key]);
  const subject = item?.subject ?? "";
  const limit = limitOf(tab);
  const used = count(text, tab);
  const over = limit !== null && used > limit;
  const url = eventUrl(event, lang);
  const dir = lang === "he" ? "rtl" : "ltr";
  const meta = preview?.lang === lang ? preview.data : null;
  const issues = useMemo(() => meta?.issues ?? [], [meta]);
  const doneOf = (t: Tab) => (t === "email" ? event.done.email ?? event.done.gmail : event.done[t]);

  /* ---- saving */
  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    /* An empty box is a person about to type, not a request to clear: Reset does that. */
    if (p.text.trim() === "") return alive.current && setSave("idle");
    if (alive.current) setSave("saving");
    try {
      const d = await adminAnnounce.saveDraft(event.id, { lang: p.lang, channel: p.channel, text: p.text });
      if (!alive.current) return;
      applyDetail(d);
      /* A newer edit may have arrived while this one was on the wire. */
      setSave(pending.current ? "saving" : "saved");
    } catch {
      if (!alive.current) return;
      pending.current ??= p;
      setSave("error");
    }
  }, [event.id, applyDetail]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
      /* Leaving the composer still saves what was typed. */
      const p = pending.current;
      if (p && p.text.trim() !== "") void adminAnnounce.saveDraft(event.id, { lang: p.lang, channel: p.channel, text: p.text }).catch(() => undefined);
    };
  }, [event.id]);

  const edit = (value: string) => {
    if (!channel) return;
    setEdits((p) => ({ ...p, [key]: value }));
    setNote("");
    /* Typing the template back needs no draft. */
    pending.current = value === base[key] && !item?.draft ? null : { key, lang, channel, text: value };
    if (timer.current) clearTimeout(timer.current);
    if (!pending.current) return setSave("idle");
    setSave("saving");
    timer.current = setTimeout(() => void flush(), PAUSE);
  };

  const reset = async () => {
    if (!channel) return;
    if (timer.current) clearTimeout(timer.current);
    pending.current = null;
    setSave("saving");
    try {
      const d = await adminAnnounce.saveDraft(event.id, { lang, channel, text: null });
      applyDetail(d);
      setEdits(({ [key]: _gone, ...rest }) => rest);
      setSave("idle");
      setNote(w.resetDone);
    } catch {
      setSave("error");
    }
  };

  const goBack = async () => {
    await flush();
    onBack();
  };

  const choose = async (t: Tab) => {
    await flush();
    setTab(t);
    tabRefs.current[t]?.focus();
  };

  const chooseLang = async (l: AnnounceLang) => {
    await flush();
    setLang(l);
  };

  /* ---- actions */
  const copy = async (message = w.copiedCaption) => setNote((await copyText(text)) ? message : w.copyFailed);

  const mark = async () => {
    if (!channel) return;
    setBusy(true);
    try {
      const r = await adminAnnounce.done(event.id, channel);
      if (r.event) onChange(r.event);
    } catch {
      setNote(w.actionFailed);
    } finally {
      setBusy(false);
    }
  };

  const dismiss = async () => {
    setBusy(true);
    try {
      await flush();
      await adminAnnounce.dismiss(event.id);
      onChange(null);
    } catch {
      setNote(w.actionFailed);
      setBusy(false);
    }
  };

  const download = (fmt: "square" | "story") => {
    const a = document.createElement("a");
    a.href = cardSrc(event, fmt);
    a.download = `${event.ref}-${fmt}.png`;
    a.rel = "noopener";
    document.body.append(a);
    a.click();
    a.remove();
  };

  /* The one primary action for the channel, shared by the button and the `o` key. */
  const primary = () => {
    if (!item) return;
    if (tab === "linkedin") {
      openTab(links.linkedin(url));
      void copy(w.linkedInCopied);
    } else if (tab === "instagram") {
      download("square");
      void copy(w.instagramDone);
    } else if (tab === "email") {
      openTab(links.gmail(subject, text));
      setNote(w.opened);
    } else if (tab === "x" && !over) {
      openTab(links.x(url, text));
      setNote(w.opened);
    }
  };

  useHotkeys({ c: () => void copy(), o: primary, d: () => void (!doneOf(tab) && !busy && mark()), Escape: () => void goBack() });

  const onTabKey = (e: React.KeyboardEvent) => {
    const rtl = document.documentElement.dir === "rtl";
    const step = e.key === "ArrowRight" ? (rtl ? -1 : 1) : e.key === "ArrowLeft" ? (rtl ? 1 : -1) : 0;
    const to = e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : step ? (TABS.indexOf(tab) + step + TABS.length) % TABS.length : -1;
    if (to < 0) return;
    e.preventDefault();
    void choose(TABS[to]);
  };

  /* ---- preview */
  const origin = (() => {
    try {
      return new URL(event.url).origin;
    } catch {
      return "";
    }
  })();
  const card = (fmt: "og" | "square" | "story") => (event.kind === "post" || event.kind === "note" || event.kind === "release" ? `${origin}${cardSrc(event, fmt)}` : "");
  const image = meta?.image || card("og");
  const linkMeta = { url, title: meta?.title || event.title, description: meta?.description, image, locale: lang };

  const email = (() => {
    if (tab !== "email") return null;
    try {
      return buildRichEmail({
        title: meta?.title || event.title,
        summary: meta?.description || detail?.event.summary,
        url: event.url,
        image: image || undefined,
        origin,
        buttonLabel: lang === "he" ? "לקריאה באתר" : "Read it on the site",
        dir,
      });
    } catch {
      return null;
    }
  })();

  const previewPane = () => {
    if (!item) return null;
    switch (tab) {
      case "linkedin":
        return <LinkedInPreview text={text} {...linkMeta} />;
      case "x":
        return <XPreview text={text} {...linkMeta} />;
      case "instagram":
        return <InstagramPreview text={text} image={card("square") || image} storyImage={card("story") || undefined} />;
      case "email":
        return email ? (
          <>
            <EmailPreview html={email.html} text={text} subject={subject} />
            <p className="pv-hint">{w.emailBuilt}</p>
          </>
        ) : (
          <p className="pv-hint">{w.emailNotBuilt}</p>
        );
    }
  };

  /* ---- render */
  const head = (
    <div className="mk-comp-head">
      <button type="button" className="a-btn mk-btn" onClick={() => void goBack()}>
        <ArrowLeft aria-hidden="true" className="rtl:rotate-180" />
        {w.back}
      </button>
      <div className="mk-comp-title">
        <span className="a-tag">{w.kinds[event.kind]}</span>
        <h2 className="a-row-title" dir="auto">
          {event.title}
        </h2>
      </div>
    </div>
  );

  if (failed)
    return (
      <div>
        {head}
        <ErrorState message={w.detailFailed} onRetry={() => (setFailed(false), setAttempt((n) => n + 1))} />
      </div>
    );
  if (!detail)
    return (
      <div>
        {head}
        <p className="a-box-row text-clay" role="status">
          {w.loading}
        </p>
      </div>
    );

  const saveText =
    save === "saving" ? w.saving : save === "error" ? w.saveFailed : save === "saved" ? w.saved : isDraft ? w.savedOwn : w.templateText;

  return (
    <div className="mk-comp">
      {head}

      <div className="mk-comp-bar">
        <div className="mk-chips">
          {issues.length > 0 && <IssueChips issues={issues} max={4} />}
          {meta && issues.length === 0 && <IssueChips issues={[]} />}
        </div>
        {langs.length > 1 && (
          <div role="group" aria-label={w.language} className="a-seg">
            {langs.map((l) => (
              <button key={l} type="button" aria-pressed={lang === l} onClick={() => void chooseLang(l)} lang={l} className="mk-seg-btn">
                {l === "en" ? "EN" : "עב"}
                <span className="sr-only"> {w.langs[l]}</span>
              </button>
            ))}
          </div>
        )}
        <button type="button" className="a-btn mk-btn" aria-expanded={checks} aria-controls={`${uid}-checks`} onClick={() => setChecks((v) => !v)}>
          <SlidersHorizontal aria-hidden="true" />
          {w.checksButton}
        </button>
      </div>

      {checks && (
        <ChecksDrawer
          id={`${uid}-checks`}
          event={event}
          lang={lang}
          origin={origin}
          busy={busy}
          onDismiss={() => void dismiss()}
          onClose={() => setChecks(false)}
        />
      )}

      <div role="tablist" aria-label={w.channelLabel} className="a-tabs" onKeyDown={onTabKey}>
        {TABS.map((t) => (
          <button
            key={t}
            ref={(el) => void (tabRefs.current[t] = el)}
            id={`${uid}-tab-${t}`}
            type="button"
            role="tab"
            aria-selected={t === tab}
            aria-controls={`${uid}-panel`}
            tabIndex={t === tab ? 0 : -1}
            onClick={() => void choose(t)}
            className="a-tab mk-tab"
          >
            {w.channels[t]}
            {doneOf(t) && (
              <>
                <Check aria-hidden="true" />
                <span className="sr-only">{w.markedDone}</span>
              </>
            )}
          </button>
        ))}
      </div>

      <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={`${uid}-tab-${tab}`} className="mk-split">
        <div className="mk-edit">
          {!item ? (
            <p className="a-hint">{w.noCaption}</p>
          ) : (
            <>
              {tab === "email" && (
                <p className="text-sm">
                  <span className="text-clay">{w.subject}: </span>
                  <span dir={dir} lang={lang}>
                    {subject}
                  </span>
                </p>
              )}
              <label htmlFor={`${uid}-caption`} className="sr-only">
                {w.caption(w.channels[tab], w.langs[lang])}
              </label>
              <textarea
                id={`${uid}-caption`}
                className="a-textarea mk-caption"
                rows={10}
                dir={dir}
                lang={lang}
                value={text}
                aria-describedby={`${uid}-count ${uid}-save`}
                onChange={(e) => edit(e.target.value)}
              />
              <p id={`${uid}-count`} className={`mk-meta tabular-nums ${over ? "mk-over" : ""}`}>
                <span>{w.count(used, limit)}</span>
                {over && limit !== null && <span>{w.over(used - limit)}</span>}
              </p>
              <p className="mk-meta">
                <span id={`${uid}-save`} role="status" aria-live="polite" data-state={save}>
                  {saveText}
                </span>
                {save === "error" && (
                  <button type="button" className="a-link mk-link" onClick={() => void flush()}>
                    {w.saveRetry}
                  </button>
                )}
                {isDraft && (
                  <button type="button" className="a-link mk-link" onClick={() => void reset()}>
                    {w.resetToTemplate}
                  </button>
                )}
              </p>

              <div className="mk-actions">
                {tab === "linkedin" && (
                  <button type="button" className="a-btn a-btn-primary mk-btn" onClick={primary}>
                    <ExternalLink aria-hidden="true" />
                    {w.openLinkedIn}
                  </button>
                )}
                {tab === "instagram" && (
                  <button type="button" className="a-btn a-btn-primary mk-btn" onClick={primary}>
                    <Download aria-hidden="true" />
                    {w.saveSquare}
                  </button>
                )}
                {tab === "email" && (
                  <>
                    <button type="button" className="a-btn a-btn-primary mk-btn" onClick={primary}>
                      <Mail aria-hidden="true" />
                      {w.openGmail}
                    </button>
                    <a className="a-btn mk-btn" href={links.mailto(subject, text)} onClick={() => setNote(w.opened)}>
                      <Mail aria-hidden="true" />
                      {w.openMail}
                    </a>
                  </>
                )}
                {tab === "x" && (
                  <button type="button" className="a-btn a-btn-primary mk-btn" disabled={over} onClick={primary}>
                    <XIcon aria-hidden="true" />
                    {w.openX}
                  </button>
                )}
                <button type="button" className="a-btn mk-btn" onClick={() => void copy()}>
                  <Copy aria-hidden="true" />
                  {w.copy}
                </button>
                {doneOf(tab) ? (
                  <span className="a-tag">
                    <Check aria-hidden="true" className="h-3.5 w-3.5" />
                    {w.doneAt} <RelTime iso={doneOf(tab)} />
                  </span>
                ) : (
                  <button type="button" className="a-btn mk-btn" disabled={busy} onClick={() => void mark()} title={w.undoneHint}>
                    <Check aria-hidden="true" />
                    {w.markDone}
                  </button>
                )}
              </div>
            </>
          )}
          <p role="status" className="a-hint min-h-[1.25rem]">
            {note}
          </p>
          <KeyHint mode="composer" />
        </div>

        <div className="mk-side" aria-label={w.previewHeading}>
          {previewPane()}
          {preview?.data === null && <p className="pv-hint">{w.previewFailed}</p>}
        </div>
      </div>
    </div>
  );
}
