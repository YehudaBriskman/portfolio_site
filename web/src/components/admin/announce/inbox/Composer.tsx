import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Check, ChevronDown, CircleHelp, Copy, Download, ExternalLink, Mail, RotateCcw, X as XIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { ErrorState, RelTime } from "@/components/admin/ui";
import { CHANNELS, ChannelIcon } from "@/components/ui/ChannelIcon";
import { Disclosure } from "@/components/ui/Disclosure";
import { StatusGlyph } from "@/components/ui/StatusGlyph";
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
import { cardSrc, count, eventUrl, kitChannel, limitOf, links, releaseTag, siteOrigin, TABS, type Tab } from "../helpers";
import ChecksDrawer from "./ChecksDrawer";
import { IssueChips } from "./Chips";
import { sortIssues } from "./readiness";
import { rememberReadiness } from "./readiness";
import KeyHint from "./KeyHint";
import { useHotkeys } from "./useHotkeys";
import { kindWord } from "../kind";
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

const safeEventOrigin = (u: string) => {
  try {
    return new URL(u).origin;
  } catch {
    return "";
  }
};

const openTab = (href: string) => void window.open(href, "_blank", "noopener,noreferrer");

export default function Composer({
  event,
  onBack,
  onChange,
  embedded = false,
  footerHost = null,
  undo = null,
  notice,
  onMarkDone,
}: {
  event: AnnounceSummary;
  onBack: () => void;
  onChange: (next: AnnounceSummary | null) => void;
  /** Inside the phone's sheet: the sheet owns the title and Back, glyph tabs replace the numbered steps and the actions move to its footer. */
  embedded?: boolean;
  /** Where the embedded actions go (the sheet's sticky footer); inline when there is none. */
  footerHost?: HTMLElement | null;
  /** A "Mark done" still inside its Undo window: the channel it covers and how to take it back. */
  undo?: { channel: AnnounceChannel; onUndo: () => void } | null;
  /** Said when the Composer has nothing to say itself (the list owner's failed Mark done). */
  notice?: string;
  /** The sheet's owner saves it after the Undo window; without it the Composer saves at once. */
  onMarkDone?: (channel: AnnounceChannel) => void;
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
  const [keys, setKeys] = useState(false);
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
    if (onMarkDone) return onMarkDone(channel);
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
    /* Absolute, on the public site: a relative path would resolve against the admin host. */
    a.href = `${origin}${cardSrc(event, fmt)}`;
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

  /* Letter keys are for a keyboard; the sheet has its own Escape. */
  useHotkeys({ c: () => void copy(), o: primary, d: () => void (!doneOf(tab) && !busy && mark()), Escape: () => (keys ? setKeys(false) : void goBack()) }, !embedded);

  const onTabKey = (e: React.KeyboardEvent) => {
    const rtl = document.documentElement.dir === "rtl";
    const step = e.key === "ArrowRight" ? (rtl ? -1 : 1) : e.key === "ArrowLeft" ? (rtl ? 1 : -1) : 0;
    const order: readonly Tab[] = embedded ? CHANNELS : TABS;
    const to = e.key === "Home" ? 0 : e.key === "End" ? order.length - 1 : step ? (order.indexOf(tab) + step + order.length) % order.length : -1;
    if (to < 0) return;
    e.preventDefault();
    void choose(order[to]);
  };

  /* ---- preview */
  /* The site's own origin, never the event's address: a release's address is its GitHub page, where no card exists. */
  const origin = siteOrigin(detail?.siteOrigin);
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
        /* The link is the server's own address for the event (GitHub for a release); only the card must be on the site. */
        linkOrigins: [safeEventOrigin(event.url)],
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
  const tag = releaseTag(event);
  const title = tag ? w.releaseTitle(tag) : event.title;

  const head = embedded ? null : (
    <div className="mk-comp-head">
      <button type="button" className="a-btn mk-btn" onClick={() => void goBack()}>
        <ArrowLeft aria-hidden="true" className="rtl:rotate-180" />
        {w.back}
      </button>
      <h2 className="a-row-title mk-comp-title" dir="auto">
        {title}
      </h2>
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
  const sorted = sortIssues(issues);
  /* A release has no page tags to read (its link is on GitHub): nothing to fix there, and not an error. */
  const noPage = preview?.lang === lang && preview.data === null;
  const stepHead = (n: number, id: string, label: string) => (
    <h3 id={id} className="mk-step-h">
      <span className="mk-step-n" aria-hidden="true">
        {n}
      </span>
      {label}
    </h3>
  );
  const whoText = tab === "email" ? w.who.email : w.who[tab];
  const openLabel = tab === "linkedin" ? w.openLinkedIn : tab === "instagram" ? w.saveSquare : tab === "email" ? w.openGmail : w.openX;
  const OpenIcon = tab === "linkedin" ? ExternalLink : tab === "instagram" ? Download : tab === "email" ? Mail : XIcon;

  /* The caption box and what sits under it: shared by the desktop steps and the phone sheet. */
  const editor = (
    <>
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
                  <div className="mk-toolbar-row" role="group" aria-label={w.captionTools}>
                    <p id={`${uid}-count`} className={`mk-meta tabular-nums ${over ? "mk-over" : ""}`}>
                      <span>{w.count(used, limit)}</span>
                      {over && limit !== null && <span>{w.over(used - limit)}</span>}
                    </p>
                    <p className="mk-meta">
                      <span id={`${uid}-save`} role="status" aria-live="polite" data-state={save}>
                        {saveText}
                      </span>
                    </p>
                    {save === "error" && (
                      <button type="button" className="a-btn a-btn-ghost mk-btn" onClick={() => void flush()}>
                        {w.saveRetry}
                      </button>
                    )}
                    {isDraft && (
                      <button type="button" className="a-btn a-btn-ghost mk-btn" onClick={() => void reset()}>
                        <RotateCcw aria-hidden="true" />
                        {w.resetToTemplate}
                      </button>
                    )}
                  </div>
                </>
              )}
    </>
  );

  /* ---- the phone's sheet: glyph tabs, caption, a collapsed preview; the actions go to the sheet's footer */
  const markUndo = undo && undo.channel === tab ? undo : null;
  const actions = item ? (
    <>
      <p role="status" className="mk-emb-note">
        {markUndo ? w.markedUndo(w.channels[tab]) : note || notice}
      </p>
      <button type="button" className="a-btn a-btn-primary mk-btn mk-emb-main" disabled={tab === "x" && over} onClick={primary}>
        <OpenIcon aria-hidden="true" />
        {openLabel}
      </button>
      <button type="button" className="a-btn mk-btn mk-emb-half" onClick={() => void copy()}>
        <Copy aria-hidden="true" />
        {w.copy}
      </button>
      {markUndo ? (
        <button type="button" className="a-btn mk-btn mk-emb-half" onClick={markUndo.onUndo}>
          <RotateCcw aria-hidden="true" />
          {w.undo}
        </button>
      ) : doneOf(tab) ? (
        <span className="a-tag mk-emb-half mk-emb-done">
          <Check aria-hidden="true" className="h-3.5 w-3.5" />
          {w.doneAt} <RelTime iso={doneOf(tab)} />
        </span>
      ) : (
        <button type="button" className="a-btn mk-btn mk-emb-half" disabled={busy} onClick={() => void mark()}>
          <Check aria-hidden="true" />
          {w.markDone}
        </button>
      )}
    </>
  ) : null;

  if (embedded)
    return (
      <div className="mk-comp mk-emb">
        <div className="mk-emb-bar">
          <div role="tablist" aria-label={w.channelLabel} className="mk-emb-tabs" onKeyDown={onTabKey}>
            {CHANNELS.map((t) => (
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
                className="mk-emb-tab"
              >
                <ChannelIcon channel={t} done={Boolean(doneOf(t))} size={24} />
              </button>
            ))}
          </div>
          {langs.length > 1 && (
            <div role="group" aria-label={w.langHelp} className="a-seg">
              {langs.map((l) => (
                <button key={l} type="button" aria-pressed={lang === l} onClick={() => void chooseLang(l)} lang={l} className="mk-seg-btn">
                  {l === "en" ? "EN" : "עב"}
                  <span className="sr-only"> {w.langs[l]}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {meta && sorted.length > 0 && (
          <p className="mk-emb-issue" role="status">
            <StatusGlyph kind="attention" tone={sorted.some((i) => i.severity === "error") ? "danger" : "attention"} label={w.statusFix} size={16} />
            <span className="mk-fixline">
              {w.toFix}: {sorted.map((i) => w.chips[i.code]).join(", ")}
            </span>
            <a className="a-link mk-link" href={event.url} target="_blank" rel="noopener noreferrer">
              {event.kind === "release" ? w.openRelease : w.openPage}
            </a>
          </p>
        )}

        <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={`${uid}-tab-${tab}`} className="mk-emb-panel">
          <p className="mk-who" id={`${uid}-who`}>
            {w.channels[tab]}: {whoText}
            {tab === "email" && (
              <>
                {" "}
                <a className="a-link mk-link" href={links.mailto(subject, text)} onClick={() => setNote(w.opened)}>
                  {w.openMail}
                </a>
              </>
            )}
          </p>
          <div className="mk-edit">{editor}</div>
          <Disclosure summary={w.previewHeading}>
            {previewPane()}
            {noPage && event.kind !== "release" && <p className="pv-hint">{w.previewFailed}</p>}
          </Disclosure>
          <Disclosure summary={w.checksRow} open={checks} onOpenChange={setChecks}>
            {checks && <ChecksDrawer id={`${uid}-checks`} event={event} lang={lang} origin={origin} target={event.url} />}
          </Disclosure>
        </div>

        <div className="mk-quiet">
          <span className="a-hint !mt-0">{w.dismissSection}</span>
          <button type="button" className="a-link mk-link" disabled={busy} onClick={() => void dismiss()}>
            {w.dismiss}
          </button>
        </div>

        {footerHost ? createPortal(actions, footerHost) : <div className="mk-emb-inline">{actions}</div>}
      </div>
    );

  return (
    <div className="mk-comp">
      {head}

      <section className="mk-step" aria-labelledby={`${uid}-s1`}>
        {stepHead(1, `${uid}-s1`, w.step1)}
        <p className="mk-facts">
          <span className="a-tag">{kindWord(w.kinds, event.kind)}</span>
          <span>
            {w.added} <RelTime iso={event.createdAt} />
          </span>
          {(["linkedin", "instagram", "email", "x"] as const).map(
            (c) =>
              (c === "email" ? event.done.email ?? event.done.gmail : event.done[c]) && (
                <span key={c} className="a-tag">
                  <Check aria-hidden="true" className="h-3.5 w-3.5" />
                  {w.channels[c]}: {w.doneAt}
                </span>
              ),
          )}
        </p>
        <div className="mk-status" role="status">
          {!meta ? (
            noPage && event.kind === "release" ? (
              <IssueChips issues={[]} />
            ) : (
              <span className="mk-chip" data-tone="muted">
                {noPage ? w.checkFailed : w.statusChecking}
              </span>
            )
          ) : sorted.length === 0 ? (
            <IssueChips issues={[]} />
          ) : (
            <>
              <span className="mk-chip" data-tone="warn">
                {w.statusFix}
              </span>
              <span className="mk-fixline">
                {w.toFix}: {sorted.map((i) => w.chips[i.code]).join(", ")}
              </span>
            </>
          )}
          {meta && sorted.length > 0 && (
            <a className="a-link mk-link" href={event.url} target="_blank" rel="noopener noreferrer">
              {event.kind === "release" ? w.openRelease : w.openPage}
            </a>
          )}
        </div>
        <button type="button" className="mk-summary" aria-expanded={checks} aria-controls={`${uid}-checks`} onClick={() => setChecks((v) => !v)}>
          <ChevronDown aria-hidden="true" className="mk-chev" data-open={checks} />
          <span>{w.checksRow}</span>
          <span className="sr-only">{checks ? w.checksHide : w.checksShow}</span>
        </button>
        {checks && <ChecksDrawer id={`${uid}-checks`} event={event} lang={lang} origin={origin} target={event.url} />}
      </section>

      <section className="mk-step" aria-labelledby={`${uid}-s2`}>
        {stepHead(2, `${uid}-s2`, w.step2)}
        <div className="mk-pick">
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
          {langs.length > 1 && (
            <div role="group" aria-label={w.langHelp} className="a-seg">
              {langs.map((l) => (
                <button key={l} type="button" aria-pressed={lang === l} onClick={() => void chooseLang(l)} lang={l} className="mk-seg-btn">
                  {l === "en" ? "EN" : "עב"}
                  <span className="sr-only"> {w.langs[l]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="mk-who" id={`${uid}-who`}>
          {whoText}
          {tab === "email" && (
            <>
              {" "}
              {w.whoSubscribers}{" "}
              <Link className="a-link mk-link" to="?tab=campaigns">
                {w.campaignsLink}
              </Link>
            </>
          )}
        </p>
      </section>

      <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={`${uid}-tab-${tab}`}>
        <section className="mk-step" aria-labelledby={`${uid}-s3`}>
          {stepHead(3, `${uid}-s3`, w.step3)}
          <div className="mk-split">
            <div className="mk-edit">{editor}</div>

            <section className="mk-side" aria-labelledby={`${uid}-pv`}>
              <h4 id={`${uid}-pv`} className="a-row-title">
                {w.previewHeading}
              </h4>
              {previewPane()}
              {noPage && event.kind !== "release" && <p className="pv-hint">{w.previewFailed}</p>}
            </section>
          </div>
        </section>

        {item && (
          <section className="mk-step" aria-labelledby={`${uid}-s4`}>
            {stepHead(4, `${uid}-s4`, w.step4)}
            <div className="mk-actions">
              <button type="button" className="a-btn a-btn-primary mk-btn" disabled={tab === "x" && over} onClick={primary}>
                <OpenIcon aria-hidden="true" />
                {openLabel}
              </button>
              <button type="button" className="a-btn mk-btn" onClick={() => void copy()}>
                <Copy aria-hidden="true" />
                {w.copy}
              </button>
              {tab === "email" && (
                <a className="a-btn mk-btn" href={links.mailto(subject, text)} onClick={() => setNote(w.opened)}>
                  <Mail aria-hidden="true" />
                  {w.openMail}
                </a>
              )}
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
            <p className="a-hint !mt-0">{w.sendHint}</p>
            <p role="status" className="a-hint min-h-[1.25rem] !mt-0">
              {note}
            </p>
          </section>
        )}
      </div>

      <div className="mk-foot">
        <div className="mk-quiet">
          <span className="a-hint !mt-0">{w.dismissSection}</span>
          <button type="button" className="a-link mk-link" disabled={busy} onClick={() => void dismiss()}>
            {w.dismiss}
          </button>
          <span className="a-hint !mt-0">{w.dismissHint}</span>
        </div>
        <div className="mk-keys-wrap">
          <button type="button" className="a-btn a-btn-ghost mk-btn" aria-expanded={keys} aria-controls={`${uid}-keys`} onClick={() => setKeys((v) => !v)}>
            <CircleHelp aria-hidden="true" />
            {w.keysButton}
          </button>
          {keys && (
            <div id={`${uid}-keys`} className="mk-keys-pop">
              <KeyHint mode="composer" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
