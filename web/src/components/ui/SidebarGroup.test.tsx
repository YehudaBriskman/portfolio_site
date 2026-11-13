import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Home, Inbox, Send, Settings as Cog, Users } from "lucide-react";
import { SidebarNav, currentNodeId, ancestorsOf, type NavNode } from "@/components/ui/SidebarGroup";

const TREE: NavNode[] = [
  { id: "overview", label: "Overview", icon: Home, to: "/admin" },
  {
    id: "marketing",
    label: "Marketing",
    icon: Send,
    to: "/admin/marketing",
    badge: 3,
    badgeLabel: "3 unread",
    children: [
      { id: "inbox", label: "Inbox", icon: Inbox, to: "/admin/marketing", badge: 3, badgeLabel: "3 unread" },
      { id: "audience", label: "Audience", icon: Users, to: "/admin/marketing?tab=audience" },
      {
        id: "mkt-settings",
        label: "Settings",
        icon: Cog,
        to: "/admin/marketing?tab=settings",
        children: [{ id: "sender", label: "Sender & delivery", to: "/admin/marketing?tab=settings&section=sender" }],
      },
    ],
  },
  {
    id: "content",
    label: "Content",
    icon: Home,
    children: [
      { id: "posts", label: "Posts", to: "/admin/posts" },
      { id: "areas", label: "Areas", to: "/admin/areas" },
    ],
  },
];

const show = (at = "/admin", key = "test-nav") =>
  render(
    <MemoryRouter initialEntries={[at]}>
      <SidebarNav nodes={TREE} label="Sections" storageKey={key} />
    </MemoryRouter>,
  );

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("lang");
  document.documentElement.removeAttribute("dir");
});

describe("which node is current", () => {
  it("is the node whose address the URL satisfies most closely", () => {
    expect(currentNodeId(TREE, "/admin/marketing", "")).toBe("inbox");
    expect(currentNodeId(TREE, "/admin/marketing", "?tab=audience")).toBe("audience");
    expect(currentNodeId(TREE, "/admin/marketing", "?tab=settings")).toBe("mkt-settings");
    expect(currentNodeId(TREE, "/admin/marketing", "?tab=settings&section=sender")).toBe("sender");
    expect(currentNodeId(TREE, "/admin/marketing", "?tab=bogus")).toBe("inbox");
    expect(currentNodeId(TREE, "/admin/posts/hello", "")).toBeUndefined();
  });
  it("lists the ancestors of a node, outermost first", () => {
    expect(ancestorsOf(TREE, "sender")).toEqual(["marketing", "mkt-settings"]);
    expect(ancestorsOf(TREE, "overview")).toEqual([]);
  });
});

describe("SidebarGroup", () => {
  it("a group with no address is one toggle: aria-expanded flips and the children appear", () => {
    show("/admin");
    const toggle = screen.getByRole("button", { name: /Content/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("link", { name: "Posts" })).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("link", { name: "Posts" })).toBeTruthy();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("aria-controls names the list it shows and hides", () => {
    show("/admin");
    const toggle = screen.getByRole("button", { name: /Content/ });
    const list = document.getElementById(toggle.getAttribute("aria-controls")!);
    expect(list).not.toBeNull();
    expect(list!.hasAttribute("hidden")).toBe(true);
    fireEvent.click(toggle);
    expect(list!.hasAttribute("hidden")).toBe(false);
  });

  it("a group with an address keeps the label as a link and the chevron as a separate toggle", () => {
    show("/admin");
    const link = screen.getByRole("link", { name: /Marketing/ });
    expect(link.getAttribute("href")).toBe("/admin/marketing");
    const toggle = screen.getByRole("button", { name: "Expand Marketing" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Collapse Marketing" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("link", { name: /Audience/ })).toBeTruthy();
  });

  it("collapsed children are out of the tab order and the accessibility tree", () => {
    show("/admin");
    expect(screen.queryByRole("link", { name: "Posts" })).toBeNull();
    expect(screen.queryByRole("link", { name: /Inbox/ })).toBeNull();
  });

  it("shows the badge, with its words for a screen reader", () => {
    show("/admin");
    expect(screen.getByRole("link", { name: /Marketing/ }).textContent).toContain("3 unread");
  });

  it("nests two levels: a group inside a group", () => {
    show("/admin/marketing?tab=settings&section=sender");
    expect(screen.getByRole("link", { name: "Sender & delivery" })).toBeTruthy();
  });
});

describe("current item and auto-open", () => {
  it("marks exactly one link aria-current=page, and tints its ancestors", () => {
    show("/admin/marketing?tab=settings&section=sender");
    const current = document.querySelectorAll('[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toContain("Sender & delivery");
    expect(document.querySelectorAll("[data-ancestor]").length).toBe(2);
  });

  it("opens the groups on the way to the current route and leaves the others shut", () => {
    show("/admin/marketing?tab=settings&section=sender");
    expect(screen.getByRole("button", { name: "Collapse Marketing" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Collapse Settings" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Content/ }).getAttribute("aria-expanded")).toBe("false");
  });

  it("opens the group of the route when the route changes", () => {
    function Go() {
      const go = useNavigate();
      return <button onClick={() => go("/admin/posts")}>go</button>;
    }
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Go />
        <SidebarNav nodes={TREE} label="Sections" storageKey="other" />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("link", { name: "Posts" })).toBeNull();
    fireEvent.click(screen.getByText("go"));
    expect(screen.getByRole("link", { name: "Posts" }).getAttribute("aria-current")).toBe("page");
  });
});

describe("remembered per viewer", () => {
  it("restores what the viewer opened, and survives a storage that throws", () => {
    const first = show("/admin", "mem");
    fireEvent.click(screen.getByRole("button", { name: /Content/ }));
    first.unmount();
    show("/admin", "mem");
    expect(screen.getByRole("link", { name: "Posts" })).toBeTruthy();
    cleanup();

    const boom = () => {
      throw new Error("blocked");
    };
    vi.stubGlobal("localStorage", { getItem: boom, setItem: boom, removeItem: boom });
    show("/admin", "mem2");
    fireEvent.click(screen.getByRole("button", { name: /Content/ }));
    expect(screen.getByRole("link", { name: "Posts" })).toBeTruthy();
  });
});

describe("keyboard", () => {
  it("ArrowDown, ArrowUp, Home and End move focus through the visible items", () => {
    show("/admin");
    const first = within(screen.getByRole("navigation", { name: "Sections" })).getAllByRole("link")[0];
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getByRole("link", { name: /Marketing/ }));
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /Content/ }));
    fireEvent.keyDown(document.activeElement!, { key: "ArrowUp" });
    expect(document.activeElement).toBe(screen.getByRole("link", { name: /Marketing/ }));
    fireEvent.keyDown(document.activeElement!, { key: "End" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /Content/ }));
    fireEvent.keyDown(document.activeElement!, { key: "Home" });
    expect(document.activeElement).toBe(first);
  });

  it("ArrowRight opens a closed group, then enters it; ArrowLeft goes back and closes", () => {
    show("/admin");
    const content = screen.getByRole("button", { name: /Content/ });
    content.focus();
    fireEvent.keyDown(content, { key: "ArrowRight" });
    expect(content.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(content, { key: "ArrowRight" });
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Posts" }));
    fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(content);
    fireEvent.keyDown(content, { key: "ArrowLeft" });
    expect(content.getAttribute("aria-expanded")).toBe("false");
  });

  it("flips the horizontal arrows in right-to-left", () => {
    document.documentElement.dir = "rtl";
    show("/admin");
    const content = screen.getByRole("button", { name: /Content/ });
    content.focus();
    fireEvent.keyDown(content, { key: "ArrowRight" });
    expect(content.getAttribute("aria-expanded")).toBe("false");
    fireEvent.keyDown(content, { key: "ArrowLeft" });
    expect(content.getAttribute("aria-expanded")).toBe("true");
  });

  it("skips what is collapsed", () => {
    show("/admin");
    const last = screen.getByRole("button", { name: /Content/ });
    last.focus();
    fireEvent.keyDown(last, { key: "ArrowDown" });
    expect(document.activeElement).toBe(last);
  });
});

describe("words and size", () => {
  it("names the toggle in Hebrew", () => {
    document.documentElement.lang = "he";
    document.documentElement.dir = "rtl";
    show("/admin");
    expect(screen.getByRole("button", { name: "הרחב Marketing" })).toBeTruthy();
  });

  it("every row is at least 44px tall and uses logical properties only", () => {
    const sheet = readFileSync(resolve(process.cwd(), "src/components/ui/SidebarGroup.module.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(sheet).toMatch(/min-block-size:\s*2\.75rem/);
    expect(sheet).not.toMatch(/\b(margin|padding)-(left|right)\b|\b(left|right):/);
    expect(sheet).not.toMatch(/transition:\s*all/);
  });
});
