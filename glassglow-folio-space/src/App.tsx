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
const BlogCollection = lazy(() => import("./pages/BlogCollection"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
// Admin is edge-gated, but lazy anyway so the editor never reaches a reader.
const Admin = lazy(() => import("./pages/Admin"));
const AdminEditor = lazy(() => import("./pages/AdminEditor"));
const AdminCollection = lazy(() => import("./pages/AdminCollection"));

const queryClient = new QueryClient();

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
          <Route path="/blog/c/:collection" element={<Suspense fallback={null}><BlogCollection /></Suspense>} />
          <Route path="/blog/:slug" element={<Suspense fallback={null}><BlogPost /></Suspense>} />
          {/* Old path kept so anything already shared still resolves. */}
          <Route path="/notes" element={<Navigate to="/blog" replace />} />
          <Route path="/notes/:slug" element={<LegacyNoteRedirect />} />
          <Route path="/admin" element={<Suspense fallback={null}><Admin /></Suspense>} />
          <Route path="/admin/posts/:slug" element={<Suspense fallback={null}><AdminEditor /></Suspense>} />
          <Route path="/admin/collections/:slug" element={<Suspense fallback={null}><AdminCollection /></Suspense>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
