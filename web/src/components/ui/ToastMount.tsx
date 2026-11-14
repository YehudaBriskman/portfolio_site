import { lazy, Suspense, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { toast, useToastVersion } from "@/lib/toast";

/*
 * Where the toast host is mounted, once for the whole app (App.tsx).
 *
 * The renderer (sonner) is a chunk of its own. A visitor who never sees a
 * toast never loads it: on the public site it mounts when the first toast is
 * raised. The admin mounts it from the first paint, because an Undo needs a
 * host already there to be able to show itself (see `toast.undoable`).
 */
const ToastHost = lazy(() => import("@/components/ui/ToastHost"));

export default function ToastMount() {
  useToastVersion();
  const { pathname } = useLocation();
  const admin = /^(\/he)?\/admin(\/|$)/.test(pathname);
  /* An Undo raised before the lazy host has loaded waits for it instead of committing at once. */
  useEffect(() => {
    toast.expectHost(admin);
    return () => toast.expectHost(false);
  }, [admin]);
  if (!admin && !toast.raised()) return null;
  return (
    <Suspense fallback={null}>
      <ToastHost />
    </Suspense>
  );
}
