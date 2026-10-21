import { Link } from "react-router-dom";

/*
 * Reachable only if the collections API is empty AND the seed table is empty,
 * which should never happen — but the old copy said "Create one from the admin
 * and it appears here", which explained a private CMS to the public and read as
 * a broken page. An empty shelf should still be a designed thing that offers
 * somewhere to go.
 */
export default function EmptyProjects() {
  return (
    <div className="card relative mt-10 overflow-hidden p-8 text-center sm:p-14">
      <div className="sun -z-10 left-1/2 top-0 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/3" aria-hidden="true" />
      <p className="eyebrow">Nothing on the shelf yet</p>
      <p className="display-tight mx-auto mt-4 max-w-[18ch] text-3xl text-bone sm:text-4xl">
        The work is still in the repo.
      </p>
      <p className="mx-auto mt-4 max-w-[42ch] text-base leading-relaxed text-bone/70">
        Project pages go up when there is something honest to put on them.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <a
          className="btn btn-solid"
          href="https://github.com/YehudaBriskman"
          target="_blank"
          rel="noreferrer noopener"
        >
          GitHub <span aria-hidden="true">↗</span>
        </a>
        <Link className="btn btn-quiet" to="/blog">
          Read the notes
        </Link>
      </div>
    </div>
  );
}
