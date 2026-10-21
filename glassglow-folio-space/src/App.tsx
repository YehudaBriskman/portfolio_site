import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
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
