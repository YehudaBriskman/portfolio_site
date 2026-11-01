import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import RouteAnnouncer from "./components/RouteAnnouncer";
import EntryShutter from "./components/motion/EntryShutter";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
// Lazy: react-markdown and remark-gfm are ~53 KB gzipped and are only needed on
// /notes. The home page must not pay for the blog renderer.
const Blog = lazy(() => import("./pages/Blog"));
const Projects = lazy(() => import("./pages/Projects"));
const Project = lazy(() => import("./pages/Project"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
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
      <Toaster />
      <Sonner />
      <BrowserRouter>
        {/*
          Above `<Routes>`, and both halves of that position are load-bearing.

          Outside the routes, so its live region is in the document from the
          first paint and survives every navigation — a region that mounts with
          the page it is announcing has not been subscribed to yet and loses the
          announcement. And *before* them in source order, so its effect runs
          before any page's: the index's one cross-route jump (Contact, which
          has no page of its own) is finished by an effect in Nav.tsx, and the
          heading focus set here is the floor that jump then overrides rather
          than a thing it has to race.
        */}
        <RouteAnnouncer />
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
          <Route path="/" element={<Index />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="/blog" element={<Suspense fallback={null}><Blog /></Suspense>} />
          <Route path="/projects" element={<Suspense fallback={null}><Projects /></Suspense>} />
          <Route path="/projects/:project" element={<Suspense fallback={null}><Project /></Suspense>} />
          {/* the short-lived /blog/c/ shape, kept so nothing dangles */}
          <Route path="/blog/c/:project" element={<LegacyCollectionRedirect />} />
          <Route path="/blog/:slug" element={<Suspense fallback={null}><BlogPost /></Suspense>} />
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
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
