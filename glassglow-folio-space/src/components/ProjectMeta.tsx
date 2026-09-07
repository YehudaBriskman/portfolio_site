import type { Collection } from "@/services/blog";

/* Repository facts, fetched server-side on a schedule and stored — never read
   from GitHub during a page load. A number here is a number he stands behind. */
export default function ProjectMeta({ c }: { c: Collection }) {
  const s = c.stats;
  if (!s && !c.repoUrl) return null;
  const items: [string, string][] = [];
  if (s?.language) items.push(["language", s.language]);
  if (s?.license) items.push(["licence", s.license]);
  if (typeof s?.stars === "number") items.push(["stars", String(s.stars)]);
  if (s?.latestRelease) items.push(["release", s.latestRelease.tag]);
  if (s?.pushedAt) items.push(["last push", new Date(s.pushedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })]);

  return (
    <dl className="mono mt-8 flex flex-wrap gap-x-10 gap-y-4 border-y border-edge py-6 text-xs">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="text-[0.625rem] uppercase tracking-[0.22em] text-bone/35">{k}</dt>
          <dd className="mt-1 text-bone/85 tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
