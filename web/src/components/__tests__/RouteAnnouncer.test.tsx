import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import RouteAnnouncer from "@/components/RouteAnnouncer";
import { HOME_TITLE } from "@/lib/pageTitle";

/*
 * What is worth testing here is the three promises, not the markup.
 *
 * A route change has to say what the page now is, say it once out loud, and
 * put the keyboard on it — and the measured failure was all three at once:
 * `/` → `/projects` left `document.activeElement` on `<body>`, the title
 * unchanged, and nothing announced.
 *
 * The pages below are deliberately nothing like the real ones. The real ones
 * are code-split and arrive behind `<Suspense fallback={null}>`, which the
 * component handles by looking for the heading across frames rather than once;
 * that path has a test of its own at the foot of this file, and the rest of
 * them want a heading that is simply there.
 */

function Page({ heading }: { heading: string }) {
  return (
    <main>
      <h1>{heading}</h1>
      <Link to="/projects">Work</Link>
      <Link to="/blog">Blogs</Link>
      <Link to="/projects/icaros">Icaros</Link>
      <Link to="/nothing-is-here">Nowhere</Link>
    </main>
  );
}

function site(start = "/") {
  return render(
    <MemoryRouter initialEntries={[start]}>
      <RouteAnnouncer />
      <Routes>
        <Route path="/" element={<Page heading="Yehuda Briskman" />} />
        <Route path="/projects" element={<Page heading="What I'm building" />} />
        <Route path="/projects/:project" element={<Page heading="Icaros" />} />
        <Route path="/blog" element={<Page heading="Writing" />} />
        <Route path="*" element={<Page heading="Not here" />} />
      </Routes>
    </MemoryRouter>
  );
}

/** The one live region on the site, found the way a screen reader finds it. */
const region = () => screen.getByRole("status");

/** The h1 the announcement names, found the way the component finds it. */
const heading = () => screen.getByRole("heading", { level: 1 });

beforeEach(() => {
  /* The shell's title, as `index.html` ships it. Set explicitly because jsdom
     starts with an empty one and the component's first-render guard is a
     comparison against this exact string — a test that left it empty would be
     describing a document that cannot exist. */
  document.title = HOME_TITLE;
});

afterEach(() => {
  document.title = "";
});

describe("announcing a route change", () => {
  it("has its live region in the document before anything is announced", () => {
    site();
    /*
     * The whole reason this component sits above `<Routes>`. A region created
     * in the same commit as its first content has not been subscribed to yet
     * and loses the announcement in exactly the case it was written for — the
     * finding that shaped the two regions in Contact.tsx. So: present, polite,
     * atomic, and empty.
     */
    expect(region()).toBeInTheDocument();
    expect(region()).toHaveAttribute("aria-live", "polite");
    expect(region()).toHaveAttribute("aria-atomic", "true");
    expect(region()).toHaveTextContent("");
  });

  it("says nothing and moves nothing on the first load", () => {
    site("/projects");
    /* Moving focus on initial page load is its own bug: nobody asked to go
       anywhere, and it skips everything above the heading including the skip
       link, which is the one control that exists for the reader who would
       have wanted it. */
    expect(document.activeElement).toBe(document.body);
    expect(region()).toHaveTextContent("");
    /* The title is still corrected, because a title is not an interruption. */
    expect(document.title).toBe("Work · Yehuda Briskman");
  });

  it("leaves a title the server has already written for this URL alone", () => {
    /*
     * `backend/src/services/seo.ts` rewrites the head per URL before the HTML
     * is served, so on a cold load of a note the tab already holds the post's
     * real title — strictly better than anything derivable from the path.
     * Overwriting it until the page's own fetch lands would be a regression
     * caused by the fix.
     */
    document.title = "Why CI must fail · Yehuda Briskman";
    site("/blog/why-ci-must-fail");
    expect(document.title).toBe("Why CI must fail · Yehuda Briskman");
  });

  it("names the page, titles the tab and focuses the heading on a bar link", async () => {
    site();
    await userEvent.click(screen.getByRole("link", { name: "Work" }));

    await waitFor(() => expect(document.title).toBe("Work · Yehuda Briskman"));
    /* By name, not by count. `/projects` used to carry its own region reading
       "6 projects", which tells a reader how many objects are in a room
       without telling them which room they have walked into. */
    expect(region()).toHaveTextContent("Work");
    await waitFor(() => expect(document.activeElement).toBe(heading()));
    /* Borrowed focusability, and only while the reader is on it — the same
       `tabindex="-1"`-removed-on-blur pattern `scrollToAnchor` uses for
       in-page jumps, through the same exported function. */
    expect(document.activeElement).toHaveAttribute("tabindex", "-1");
  });

  it("never leaves focus on the body, which is where every route change left it", async () => {
    site();
    for (const name of ["Work", "Blogs", "Icaros"]) {
      await userEvent.click(screen.getByRole("link", { name }));
      await waitFor(() => expect(document.activeElement).toBe(heading()));
      expect(document.activeElement).not.toBe(document.body);
    }
  });

  it("gives up the borrowed tabindex when the reader leaves the heading", async () => {
    site();
    await userEvent.click(screen.getByRole("link", { name: "Work" }));
    await waitFor(() => expect(document.activeElement).toBe(heading()));
    const h1 = heading();
    h1.blur();
    /* Nothing is left programmatically focusable that a reader could not have
       reached before the jump. */
    expect(h1).not.toHaveAttribute("tabindex");
  });

  it("titles and announces the address that matches nothing", async () => {
    site();
    await userEvent.click(screen.getByRole("link", { name: "Nowhere" }));
    /* SC 2.4.2 on the page a visitor is most likely to meet by accident. It
       used to be titled as the home page, so a reader was told they had
       arrived somewhere precisely when they had arrived nowhere. */
    await waitFor(() => expect(document.title).toBe("Not found · Yehuda Briskman"));
    expect(region()).toHaveTextContent("Not found");
  });

  it("announces the destination of a redirect route, not a 404", async () => {
    /* `/notes` renders a `<Navigate replace>` and no page at all, so the
       reader is on it for one commit. The catch-all would have called it
       "Not found" — announcing a failure in the middle of a redirect that
       worked. */
    render(
      <MemoryRouter initialEntries={["/notes"]}>
        <RouteAnnouncer />
        <Routes>
          <Route path="/notes" element={<Page heading="Writing" />} />
        </Routes>
      </MemoryRouter>
    );
    expect(document.title).toBe("Blogs · Yehuda Briskman");
  });

  it("focuses the heading of the page it announced, not the one it left", async () => {
    /*
     * The bug this is the regression test for, and it was introduced by the
     * first version of this very component: focus the first heading the loop
     * finds and you focus the page the reader just *left*, because on a
     * navigation into an unloaded chunk that heading is still in the document.
     * React then commits the real page, removes that element, and focus falls
     * back to `<body>` — the exact failure the component exists to fix,
     * reintroduced by its own fix. It is also why `/` → `/projects` passed and
     * `/projects` → `/blog` did not.
     */
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <RouteAnnouncer />
        <Routes>
          <Route path="*" element={<StaleThenReplaced />} />
        </Routes>
      </MemoryRouter>
    );
    const leaving = within(container).getByRole("heading", { level: 1 });

    await userEvent.click(within(container).getByRole("link", { name: "Blogs" }));

    const arriving = await waitFor(() =>
      within(container).getByRole("heading", { level: 1, name: "Writing" })
    );
    /* The node really was replaced, which is what makes this test the thing it
       claims to be rather than a slower copy of the one below. */
    expect(arriving).not.toBe(leaving);
    expect(leaving.isConnected).toBe(false);
    await waitFor(() => expect(document.activeElement).toBe(arriving));
  });

  it("focuses a heading that was reconciled in place rather than replaced", async () => {
    /*
     * The case that stops the rule above from being "only ever focus a heading
     * that is new". Going from one project to another keeps `<Project>`
     * mounted, so React writes the new title into the `<h1>` that is already
     * there and no new element ever appears — a loop that waits for one would
     * wait out its whole budget and focus nothing.
     */
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <RouteAnnouncer />
        <Routes>
          <Route path="*" element={<ReconciledHeading />} />
        </Routes>
      </MemoryRouter>
    );
    const h1 = within(container).getByRole("heading", { level: 1 });

    await userEvent.click(within(container).getByRole("link", { name: "Blogs" }));

    await waitFor(() => expect(document.activeElement).toBe(h1), { timeout: 1500 });
    /* The same node throughout, carrying the new page's name. */
    expect(h1.textContent).toBe("Writing");
  });

  it("waits for a code-split page's heading instead of focusing nothing", async () => {
    /*
     * Every route but `/` and the 404 is lazy in App.tsx and renders behind
     * `<Suspense fallback={null}>`, so at the moment the effect runs the
     * committed tree for `/projects` is empty: no `<main>`, no `<h1>`, nothing
     * to focus. A version of this that looked once and gave up would put focus
     * on the heading on exactly the two routes that are not code-split. Here
     * the heading is withheld for a few frames and then appears, which is that
     * sequence with the network taken out of it.
     */
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <RouteAnnouncer />
        <Routes>
          <Route path="/" element={<Page heading="Yehuda Briskman" />} />
          <Route path="/projects" element={<LateHeading />} />
        </Routes>
      </MemoryRouter>
    );

    await userEvent.click(within(container).getByRole("link", { name: "Work" }));
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(container).getByRole("heading", { level: 1, name: "What I'm building" })
      )
    );
  });
});

/* A page whose heading arrives a few frames after its route does — the stand-in
   for a `React.lazy` chunk, which is the real reason the component looks for
   the heading across frames rather than once. Kept at the foot of the file
   because it is scaffolding for one test rather than part of the subject. */
function LateHeading() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setReady(true), 40);
    return () => clearTimeout(id);
  }, []);
  return ready ? <Page heading="What I'm building" /> : null;
}

/** What each path in the two harnesses below calls itself. */
const HEADINGS: Record<string, string> = { "/": "Yehuda Briskman", "/blog": "Writing" };

/*
 * A route change where the outgoing page's own heading element survives for a
 * while, and is then replaced.
 *
 * This is not a contrivance, it is what Chrome does. On a navigation into a
 * code-split chunk that is not loaded yet, `useLocation()` reports the new
 * pathname — so the announcer's effect runs — while the committed DOM is still
 * the *outgoing* page's, down to the same `<h1>` node, until the chunk arrives.
 * Measured against the built site: one frame after the effect for `/blog` ran,
 * `main h1` still read "What I'm building".
 *
 * jsdom will not produce that state on its own — a real `<Suspense
 * fallback={null}>` here clears the subtree immediately, which is the easy half
 * of the problem and is covered by `LateHeading` above. So the state is built
 * directly: `key={shown}` keeps one subtree mounted across the location change
 * and then swaps it for a new one, which is the same two commits in the same
 * order.
 */
function StaleThenReplaced() {
  const { pathname } = useLocation();
  const [shown, setShown] = useState(pathname);
  useEffect(() => {
    if (shown === pathname) return;
    const id = setTimeout(() => setShown(pathname), 90);
    return () => clearTimeout(id);
  }, [pathname, shown]);
  return <Page key={shown} heading={HEADINGS[shown] ?? shown} />;
}

/* One component serving two addresses, so React updates the text inside the
   heading it already has rather than mounting a new one. The real pair is
   `/projects/icaros` → `/projects/programming-with-yehuda`, where `<Project>` stays
   mounted; this is the same reconciliation with the page taken out of it. */
function ReconciledHeading() {
  const { pathname } = useLocation();
  return (
    <main>
      <h1>{HEADINGS[pathname] ?? pathname}</h1>
      <Link to="/blog">Blogs</Link>
      <Link to="/">Home</Link>
    </main>
  );
}
