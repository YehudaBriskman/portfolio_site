import { Link } from "react-router-dom";

/*
 * One tag, one treatment, everywhere.
 *
 * Tags used to be three different things in three places: inert grey spans in
 * the list, links that lit up in the old accent at the foot of a post, and
 * nothing at all on a project page. They are all the same navigation, so they
 * get the same shape — and the selected one inverts to bone on the ground
 * rather than filling with a colour.
 *
 * Lowercase rather than uppercase-tracked on purpose — tracked caps read as
 * system chrome, which is most of what made the old list feel like a spec
 * sheet. `.eyebrow` keeps the caps; tags do not need them.
 */
export default function TagPill({ tag, active = false }: { tag: string; active?: boolean }) {
  return (
    <Link
      to={active ? "/blog" : `/blog?tag=${encodeURIComponent(tag)}`}
      className={`tap tag-pill ${active ? "tag-pill--active" : ""}`}
      aria-label={active ? `Clear the ${tag} filter` : `Notes tagged ${tag}`}
    >
      <span aria-hidden="true">#{tag}</span>
      {active && (
        <span aria-hidden="true" className="ml-1.5 text-[0.875rem] leading-none">
          &times;
        </span>
      )}
    </Link>
  );
}
