import { Suspense, lazy } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import RouteAnnouncer from "./components/RouteAnnouncer";
import ScrollManager from "./components/ScrollManager";
import EntryShutter from "./components/motion/EntryShutter";
import SiteChrome from "./components/SiteChrome";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
// Lazy: react-markdown and remark-gfm are ~53 KB gzipped and are only needed on
// /notes. The home page must not pay for the blog renderer.
const Blog = lazy(() => import("./pages/Blog"));
const Projects = lazy(() => import("./pages/Projects"));
const Project = lazy(() => import("./pages/Project"));
// The story (#46): lazy like every route but the home page, so the collection
// does not pay for a second route most first visits never open.
const Story = lazy(() => import("./pages/Story"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
// The accessibility statement: plain text, read rarely, so not on the
// home page's bill either.
const Accessibility = lazy(() => import("./pages/Accessibility"));
// Admin is edge-gated, but lazy anyway so the editor never reaches a reader.
const Admin = lazy(() => import("./pages/Admin"));
const AdminEditor = lazy(() => import("./pages/AdminEditor"));
const AdminCollection = lazy(() => import("./pages/AdminCollection"));
const AdminAreas = lazy(() => import("./pages/AdminAreas"));

const queryClient = new QueryClient();

function LegacyCollectionRedirect() {
  const { project } = useParams();
  return <Navigate to={`/projects/${project}`} replace />;
}

function LegacyAreaRedirect() {
  const { slug } = useParams();
  return <Navigate to={`/admin/areas/${slug}`} replace />;
}

function LegacyNoteRedirect() {
  const { slug } = useParams();
  return <Navigate to={`/blog/${slug}`} replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        {/*
          Above `<Routes>`, and both halves of that position are load-bearing.

          Outside the routes, so its live region is in the document from the
          first paint and survives every navigation — a region that mounts with
          the page it is announcing has not been subscribed to yet and loses the
          announcement. And *before* them in source order, so its effect runs
          before any page's *and before the chrome's*, which since #63 is a
          layout route inside `<Routes>` below. The heading focus set here is
          the floor that anything later overrides rather than a thing it has to
          race. The one effect that used to rely on that — the index's
          cross-route jump to Contact, finished in Nav.tsx — went with the
          object index in #56; the ordering is kept for the next one.
        */}
        <RouteAnnouncer />
        {/*
          Where the reader lands (#196): the top of a new page, the target of
          a hash once it exists, the old position on Back and Forward. Above
          `<Routes>` for the same reason as the announcer — it has to outlive
          every page it is scrolling — and it owns the scroll alone, which is
          why the announcer's focus move never scrolls.
        */}
        <ScrollManager />
        {/*
          The entry shutter: the window black behind a grid of lit squares,
          which leaves tile by tile from the centre once the page is actually
          ready. `motion/EntryShutter.tsx` carries the whole argument; three
          things about *this position* are load-bearing.

          Rendered by React, and absent from `index.html`. That is the no-JS
          requirement satisfied by construction rather than by code: with
          scripting off there is no overlay at all, where an opaque element in
          the served HTML that only JavaScript removes would be a feature that
          can hide the site completely.

          Inside `BrowserRouter` but outside `<Routes>`, so it mounts once for
          the visit rather than once per route. It is an *entry* loader; a
          client-side navigation is not an entry, and a shutter that came back
          down on every link would be the slowest thing on the site.

          And in the same commit as the first route, which is the half of this
          that the LCP number depends on. React 18 paints the shutter and the
          hero in one frame, so the photograph is painted — behind an opaque
          sheet, which Chrome's LCP does not check for — at the same moment it
          was before. Measured either side as an interleaved A/B against this
          same commit with the shutter removed: LCP 128ms → 128ms at 1440×900
          and 128ms → 124ms at 390×844, CLS 0.000 → 0.000 at both, with the
          hero portrait still the reported element. It is not free under
          throttling — see the ledger row in `docs/motion-contract.md`.
        */}
        <EntryShutter />
        <Routes>
          {/*
            The public chrome, as a pathless layout route (#63). Every page a
            reader can reach renders inside its `<Outlet />`, so the skip link
            and the bar are mounted once and survive every navigation between
            them, instead of being torn down with the page shell that used to
            render them. `SiteChrome.tsx` carries the argument and what it cost.

            The Suspense boundaries stay per route and *inside* this, which is
            the half of the move a reader can see: a lazy chunk on the wire now
            blanks the page, not the bar above it.

            Admin is outside, deliberately: it has its own shell and chrome.
          */}
          <Route element={<SiteChrome />}>
            <Route path="/" element={<Index />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="/blog" element={<Suspense fallback={null}><Blog /></Suspense>} />
            <Route path="/projects" element={<Suspense fallback={null}><Projects /></Suspense>} />
            <Route path="/projects/:project" element={<Suspense fallback={null}><Project /></Suspense>} />
            <Route path="/story" element={<Suspense fallback={null}><Story /></Suspense>} />
            {/* the short-lived /blog/c/ shape, kept so nothing dangles */}
            <Route path="/blog/c/:project" element={<LegacyCollectionRedirect />} />
            <Route path="/blog/:slug" element={<Suspense fallback={null}><BlogPost /></Suspense>} />
            <Route path="/accessibility" element={<Suspense fallback={null}><Accessibility /></Suspense>} />
            {/* The 404 is a reader's page too, and keeps the bar. */}
            <Route path="*" element={<NotFound />} />
          </Route>
          {/* Old path kept so anything already shared still resolves. */}
          <Route path="/notes" element={<Navigate to="/blog" replace />} />
          <Route path="/notes/:slug" element={<LegacyNoteRedirect />} />
          {/* URLs say what the tool says. /admin/collections/:slug is kept as a
              redirect because bookmarks to it exist. */}
          <Route path="/admin" element={<Navigate to="/admin/posts" replace />} />
          <Route path="/admin/posts" element={<Suspense fallback={null}><Admin /></Suspense>} />
          <Route path="/admin/posts/:slug" element={<Suspense fallback={null}><AdminEditor /></Suspense>} />
          <Route path="/admin/areas" element={<Suspense fallback={null}><AdminAreas /></Suspense>} />
          <Route path="/admin/areas/:slug" element={<Suspense fallback={null}><AdminCollection /></Suspense>} />
          <Route path="/admin/collections/:slug" element={<LegacyAreaRedirect />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
