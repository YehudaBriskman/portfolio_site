import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import SubscribeFrame, { Result } from "@/components/SubscribeFrame";
import { useSubscribeWords } from "@/i18n/subscribe";
import { getPreferences, savePreferences, type Preferences } from "@/services/subscribe";

/* The preferences behind a link in every email. The address arrives masked
   from the API and is shown as it came, in its own direction. */
export default function SubscribeManage() {
  const w = useSubscribeWords();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "saving" | "saved" | "bad">(token ? "loading" : "bad");

  useEffect(() => {
    if (!token) return;
    let live = true;
    getPreferences(token).then(
      (p) => {
        if (!live) return;
        setPrefs(p);
        setState("ready");
      },
      () => live && setState("bad"),
    );
    return () => {
      live = false;
    };
  }, [token]);

  async function save() {
    if (!prefs) return;
    setState("saving");
    try {
      await savePreferences(token, { lang: prefs.lang, topics: prefs.topics });
      setState("saved");
    } catch {
      setState("bad");
    }
  }

  const edit = (next: Preferences) => {
    setPrefs(next);
    setState("ready");
  };

  return (
    <SubscribeFrame title={w.manageTitle}>
      {prefs && state !== "bad" && (
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <p>
            {w.manageFor} <bdi dir="ltr">{prefs.email}</bdi>
          </p>
          <fieldset className="space-y-1 border-0 p-0">
            <legend className="text-sm text-clay">{w.topics}</legend>
            <label className="flex min-h-[44px] items-center gap-3">
              <input type="checkbox" className="h-5 w-5" checked={prefs.topics.blog} onChange={(e) => edit({ ...prefs, topics: { ...prefs.topics, blog: e.target.checked } })} />
              {w.topicBlog}
            </label>
            <label className="flex min-h-[44px] items-center gap-3">
              <input type="checkbox" className="h-5 w-5" checked={prefs.topics.releases} onChange={(e) => edit({ ...prefs, topics: { ...prefs.topics, releases: e.target.checked } })} />
              {w.topicReleases}
            </label>
          </fieldset>
          <fieldset className="space-y-1 border-0 p-0">
            <legend className="text-sm text-clay">{w.language}</legend>
            {(["en", "he"] as const).map((l) => (
              <label key={l} className="flex min-h-[44px] items-center gap-3">
                <input type="radio" name="lang" className="h-5 w-5" checked={prefs.lang === l} onChange={() => edit({ ...prefs, lang: l })} />
                {l === "en" ? w.langEn : w.langHe}
              </label>
            ))}
          </fieldset>
          <button type="submit" className="btn btn-solid" disabled={state === "saving"}>
            {state === "saving" ? w.saving : w.save}
          </button>
        </form>
      )}
      <Result kind={state === "saved" ? "ok" : state === "bad" ? "error" : "idle"}>
        {state === "saved" ? w.saved : state === "bad" ? w.manageBad : state === "loading" ? w.working : ""}
      </Result>
      {prefs && state !== "bad" && (
        <p>
          {w.manageUnsub}{" "}
          <Link className="underline underline-offset-4" to={`/unsubscribe?token=${encodeURIComponent(token)}`}>
            {w.manageUnsubLink}
          </Link>
        </p>
      )}
    </SubscribeFrame>
  );
}
