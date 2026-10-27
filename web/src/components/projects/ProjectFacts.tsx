import { Fragment } from "react";
import { relativeTime, type Collection } from "@/services/blog";

/*
 * Repository facts, set as a line of type rather than as a row of capsules.
 *
 * These used to be five `.chip` pills, and they were five of the twelve 12px
 * mono capsules a single project page was carrying. Once everything on a page
 * is a pill, the pill stops meaning anything, and the two things a reader most
 * needs to tell apart — "this is a button" and "this is a number" — look
 * identical. The rule now is one role per shape: an action is a pill, a fact
 * is not. So the actions kept the capsule and the facts became what they
 * always were, a sentence of small type with the values picked out.
 *
 * Nothing here is invented. A seed project has no stats, so it shows none.
 */
export default function ProjectFacts({ c, className = "" }: { c: Collection; className?: string }) {
  const s = c.stats;
  if (!s) return null;

  const facts: { key: string; label: string; value: string }[] = [];
  if (s.language) facts.push({ key: "language", label: "", value: s.language });
  if (typeof s.stars === "number") facts.push({ key: "stars", label: "stars", value: String(s.stars) });
  if (s.latestRelease) facts.push({ key: "release", label: "", value: s.latestRelease.tag });
  if (s.license) facts.push({ key: "license", label: "", value: s.license });
  if (s.pushedAt) facts.push({ key: "pushed", label: "pushed", value: relativeTime(s.pushedAt) });
  if (facts.length === 0) return null;

  return (
    <p className={`mono flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-clay ${className}`}>
      {facts.map((f, i) => (
        <Fragment key={f.key}>
          {i > 0 && (
            <span aria-hidden="true" className="text-clay/50">
              ·
            </span>
          )}
          <span>
            <b className="font-medium tabular-nums text-bone">{f.value}</b>
            {f.label && ` ${f.label}`}
          </span>
        </Fragment>
      ))}
    </p>
  );
}
