import type { ProjectEntry } from "@/hooks/useProjects";

/*
 * Outbound actions, as 44px pills, above the fold rather than buried under the
 * notes feed where they used to sit as 11px text.
 *
 * Exactly one solid pill per page: the live product if there is one, otherwise
 * the repository. Two competing primaries is the same as none.
 */
export default function ProjectActions({ entry, className = "" }: { entry: ProjectEntry; className?: string }) {
  const { collection: c, primaryLink, otherLinks } = entry;
  const release = c.stats?.latestRelease;
  const repoIsPrimary = !primaryLink && Boolean(c.repoUrl);

  if (!primaryLink && !c.repoUrl && otherLinks.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      {primaryLink && (
        <a className="btn btn-solid" href={primaryLink.url} target="_blank" rel="noreferrer noopener">
          {primaryLink.label} <span aria-hidden="true">↗</span>
        </a>
      )}
      {c.repoUrl && (
        <a
          className={`btn ${repoIsPrimary ? "btn-solid" : "btn-quiet"}`}
          href={c.repoUrl}
          target="_blank"
          rel="noreferrer noopener"
        >
          Source <span aria-hidden="true">↗</span>
        </a>
      )}
      {release && (
        <a className="btn btn-quiet" href={release.url} target="_blank" rel="noreferrer noopener">
          {release.tag} <span aria-hidden="true">↗</span>
        </a>
      )}
      {otherLinks.map((l) => (
        <a className="btn btn-quiet" key={l.url} href={l.url} target="_blank" rel="noreferrer noopener">
          {l.label} <span aria-hidden="true">↗</span>
        </a>
      ))}
    </div>
  );
}
