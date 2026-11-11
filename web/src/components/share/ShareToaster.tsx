import { lazy, Suspense, useEffect, useId, useSyncExternalStore } from "react";

/*
 * One toaster for every share menu on the page, loaded on first use.
 *
 * A history list mounts a menu per row, and sonner draws every toast once per
 * <Toaster>, so each menu rendering its own would show a copy per row. The
 * menus register here and the first one still mounted hosts the single
 * toaster; it is not loaded at all until someone opens a menu.
 */
const Toaster = lazy(() => import("@/components/ui/sonner").then((m) => ({ default: m.Toaster })));

const hosts: string[] = [];
let armed = false;
const listeners = new Set<() => void>();
let version = 0;

const emit = () => {
  version += 1;
  listeners.forEach((fn) => fn());
};
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

/** Called when a menu opens, so the toaster is there before the first toast. */
export function armShareToaster(): void {
  if (armed) return;
  armed = true;
  emit();
}

export default function ShareToaster() {
  const id = useId();
  useSyncExternalStore(subscribe, () => version);

  useEffect(() => {
    hosts.push(id);
    emit();
    return () => {
      hosts.splice(hosts.indexOf(id), 1);
      emit();
    };
  }, [id]);

  if (!armed || hosts[0] !== id) return null;
  return (
    <Suspense fallback={null}>
      <Toaster />
    </Suspense>
  );
}
