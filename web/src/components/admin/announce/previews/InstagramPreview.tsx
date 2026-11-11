import { useState } from "react";
import { previewInstagram } from "@/lib/share/preview";
import { safeSrc } from "@/lib/share/preview";
import { Approx, Lines, Meter, Segmented, Surface } from "./parts";
import { usePreviewWords } from "./words";

type Frame = "square" | "story";

/** `image` is the square card; `storyImage` the story card (falls back to `image`, letterboxed). */
export default function InstagramPreview({
  text,
  image,
  storyImage,
  name,
}: {
  text: string;
  image?: string;
  storyImage?: string;
  name?: string;
}) {
  const w = usePreviewWords();
  const [frame, setFrame] = useState<Frame>("square");
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState<string>("");
  const p = previewInstagram(text);
  const src = safeSrc(frame === "story" ? (storyImage ?? image) : image);
  return (
    <div className="pv">
      <Approx />
      <Segmented
        label={w.frame}
        value={frame}
        onChange={setFrame}
        options={[
          { value: "square", label: w.frameSquare },
          { value: "story", label: w.frameStory },
        ]}
      />
      <Surface label={w.postOf(w.instagram)}>
        <div className="pv-head">
          <span className="pv-avatar" aria-hidden="true" />
          <span className="pv-name" dir="auto">{name || w.you}</span>
        </div>
        <div className="pv-ig-frame" data-frame={frame}>
          {src && broken !== src ? <img src={src} alt="" loading="lazy" onError={() => setBroken(src)} /> : <span className="pv-hint">{w.noImage}</span>}
        </div>
        <div className="pv-body" style={{ marginBlockStart: ".5rem" }}>
          {text.trim() === "" ? (
            <p className="pv-hint">{w.empty}</p>
          ) : (
            <>
              <Lines text={open || !p.folded ? text : p.visible} />
              {p.folded && (
                <button type="button" className="pv-link-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
                  {open ? w.less : w.more}
                </button>
              )}
            </>
          )}
        </div>
      </Surface>
      <Meter count={p.count} limit={p.limit} over={p.over} />
      <p className="pv-meter" data-over={p.hashtagsOver}>
        {w.hashtags(p.hashtags.length, p.hashtagLimit)}
        {p.hashtagsOver && <> · {w.hashtagsOver(p.hashtagLimit)}</>}
      </p>
      <p className="pv-hint">{p.folded ? w.foldedAt(p.visible.length) : w.noFold}</p>
    </div>
  );
}
