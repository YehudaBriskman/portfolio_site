import { useAudienceWords } from "./words";

/* The red line under a sheet's actions: what failed, and the one thing to do next. */
export default function ActionError({ text, onRetry, busy }: { text: string; onRetry: () => void; busy?: boolean }) {
  const w = useAudienceWords();
  return (
    <div className="a-error flex flex-wrap items-center gap-2" role="alert">
      <p className="min-w-0 flex-1">{text}</p>
      <button type="button" className="a-btn min-h-[44px]" disabled={busy} onClick={onRetry}>{w.retry}</button>
    </div>
  );
}
