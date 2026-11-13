import { useEffect, useState } from "react";
import { adminAudience, type SweepState } from "@/services/adminAudience";
import { useSweepWords } from "./sweepWords";
import { useWhen } from "./useWhen";

/* How many unconfirmed signups the scheduled sweep has deleted. Counts only; renders nothing until known. */
export default function SweepNote() {
  const w = useSweepWords();
  const when = useWhen();
  const [s, setS] = useState<SweepState | null>(null);
  useEffect(() => void adminAudience.sweep().then(setS, () => setS(null)), []);
  if (!s) return null;
  const r = s.report;
  return (
    <div className="a-box p-3" data-testid="sweep-note">
      <p className="font-bold">{w.title}</p>
      <p className="a-hint tabular-nums">{r ? w.body(s.pendingTtlDays, r.lastPurged, r.totalPurged, when(r.since)) : w.none(s.pendingTtlDays)}</p>
      {r && <p className="a-hint tabular-nums">{w.lastRun(when(r.at))}</p>}
    </div>
  );
}
