import { useEffect, useMemo, useState } from "react";
import { Outlet } from "react-router-dom";
import { ShellFrame, ShellSlotContext, type ShellProps } from "@/components/admin/AdminShell";
import { adminHostHref } from "@/lib/adminHost";

/*
 * The admin's layout route (#852): the sidebar, the top bar and the palette are mounted once and stay mounted
 * while the page inside <main> changes, so the sidebar keeps its scroll position, the groups the owner opened
 * and its focus. A page publishes its title, section and bottom bar through <AdminShell> (see there).
 */
const FIRST: ShellProps = { title: "", section: "overview" };

export default function AdminLayout() {
  const [props, setProps] = useState<ShellProps | null>(null);
  const slot = useMemo(() => ({ publish: setProps }), []);
  /* On the public site nothing here can load: leave for the gated host before a page asks the API. */
  const away = adminHostHref(window.location);
  useEffect(() => {
    if (away) window.location.replace(away);
  }, [away]);
  if (away) return null;
  return (
    <ShellSlotContext.Provider value={slot}>
      <ShellFrame {...(props ?? FIRST)}>
        <Outlet />
      </ShellFrame>
    </ShellSlotContext.Provider>
  );
}
