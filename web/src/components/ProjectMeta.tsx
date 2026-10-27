import { relativeTime, type Collection } from "@/services/blog";

/* Repository facts, fetched server-side on a schedule and stored — never read
   from GitHub during a page load. A number here is a number he stands behind.

   Set as display type rather than 12px mono: these are the strongest evidence
   on the page and they were being whispered. The labels move from bone/35
   (~2.4:1, a failure) to --clay (7:1). */
export default function ProjectMeta({ c }: { c: Collection }) {
  const s = c.stats;
  if (!s) return null;

  const items: [string, string][] = [];
  if (s.language) items.push(["language", s.language]);
  if (typeof s.stars === "number") items.push(["stars", String(s.stars)]);
  if (s.latestRelease) items.push(["release", s.latestRelease.tag]);
  if (s.license) items.push(["licence", s.license]);
  if (s.pushedAt) items.push(["last push", relativeTime(s.pushedAt)]);
  if (items.length === 0) return null;

  return (
    <dl className="mt-section-sm grid grid-cols-2 gap-6 border-y border-edge py-6 sm:grid-cols-4 lg:grid-cols-5">
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="mono text-xs uppercase tracking-[0.18em] text-clay">{k}</dt>
          <dd className="display-tight mt-3 text-xl tabular-nums text-bone sm:text-2xl">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
