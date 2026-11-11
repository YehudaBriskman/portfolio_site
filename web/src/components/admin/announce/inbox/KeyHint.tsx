import { useMarketingWords } from "./words";

/* The keys are the same in both languages (they are what is printed on the keyboard), so they live here and only their meaning is translated. */
export default function KeyHint({ id, mode }: { id?: string; mode: "list" | "composer" }) {
  const w = useMarketingWords();
  const keys: Array<[string[], string]> =
    mode === "list"
      ? [[["j", "k"], w.keyMove], [["c"], w.keyCopyLinkedIn], [["o"], w.keyOpen]]
      : [[["c"], w.keyCopy], [["o"], w.keyOpenChannel], [["d"], w.keyDone], [["Esc"], w.keyBack]];
  return (
    <p className="mk-keys a-hint" id={id}>
      <span className="font-bold">{w.hotkeys}</span>
      {keys.map(([ks, what]) => (
        <span key={ks.join()} className="mk-key-group">
          {ks.map((k) => (
            <kbd key={k} dir="ltr">
              {k}
            </kbd>
          ))}
          {what}
        </span>
      ))}
    </p>
  );
}
