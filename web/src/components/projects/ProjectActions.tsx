import Action from "@/components/ui/Action";
import type { ProjectEntry } from "@/hooks/useProjects";
import { useProjectWords } from "@/i18n/pages";

/*
 * Outbound actions, above the fold rather than buried under the notes feed
 * where they used to sit as 11px text.
 *
 * Exactly one solid pill per page: the live product if there is one, otherwise
 * the repository. Two competing primaries is the same as none.
 */
export default function ProjectActions({ entry, className = "" }: { entry: ProjectEntry; className?: string }) {
  const { collection: c, primaryLink, otherLinks } = entry;
  const release = c.stats?.latestRelease;
  const repoIsPrimary = !primaryLink && Boolean(c.repoUrl);
  const w = useProjectWords();

  if (!primaryLink && !c.repoUrl && otherLinks.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-3 sm:gap-4 ${className}`}>
      {primaryLink && (
        <Action tone="solid" glyph="out" href={primaryLink.url}>
          {primaryLink.label}
        </Action>
      )}
      {c.repoUrl && (
        <Action tone={repoIsPrimary ? "solid" : "outline"} glyph="out" href={c.repoUrl}>
          {w.source}
        </Action>
      )}
      {release && (
        <Action tone="outline" glyph="out" href={release.url}>
          {release.tag}
        </Action>
      )}
      {otherLinks.map((l) => (
        <Action tone="outline" glyph="out" href={l.url} key={l.url}>
          {l.label}
        </Action>
      ))}
    </div>
  );
}
