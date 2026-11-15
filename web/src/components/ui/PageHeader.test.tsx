import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Plus, Download } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageHeader as Reexport } from "@/components/admin/ui";

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("PageHeader", () => {
  it("is re-exported from the admin kit file", () => {
    expect(Reexport).toBe(PageHeader);
  });

  it("renders exactly one h1 with the title", () => {
    wrap(<PageHeader title="Posts" />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Posts");
  });

  it("draws the primary and the secondary by name, and puts the rest behind More", async () => {
    const onMore = vi.fn();
    wrap(
      <PageHeader
        title="Campaigns"
        actionsLabel="Page actions"
        moreLabel="More actions"
        primary={{ id: "new", label: "New campaign", icon: Plus, onSelect: vi.fn() }}
        secondary={{ id: "export", label: "Export", icon: Download, onSelect: vi.fn() }}
        more={[
          { id: "compile", label: "Compile issue", onSelect: onMore },
          { id: "pause", label: "Pause all sending", onSelect: vi.fn() },
        ]}
      />,
    );
    const bar = screen.getByRole("toolbar", { name: "Page actions" });
    expect(within(bar).getByRole("button", { name: "New campaign" })).toHaveTextContent("New campaign");
    expect(within(bar).getByRole("button", { name: "Export" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Compile issue" })).toBeNull();
    /* at most 3 buttons visible: primary, secondary, More */
    expect(within(bar).getAllByRole("button")).toHaveLength(3);
    await userEvent.click(within(bar).getByRole("button", { name: "More actions" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Compile issue" }));
    expect(onMore).toHaveBeenCalledTimes(1);
  });

  it("with only more actions draws nothing but the More button", () => {
    wrap(<PageHeader title="Areas" moreLabel="More" more={[{ id: "a", label: "Import", onSelect: vi.fn() }]} />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "More" })).toBeInTheDocument();
  });

  it("fires the primary", async () => {
    const onSelect = vi.fn();
    wrap(<PageHeader title="Posts" primary={{ id: "n", label: "New post", icon: Plus, onSelect }} />);
    await userEvent.click(screen.getByRole("button", { name: "New post" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("back is a link named by the caller and never repeats the title", () => {
    wrap(<PageHeader title="Edit post" back={{ label: "Posts", href: "/admin/posts" }} />);
    const link = screen.getByRole("link", { name: "Posts" });
    expect(link).toHaveAttribute("href", "/admin/posts");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Edit post");
  });

  it("back with a handler is a button", async () => {
    const onSelect = vi.fn();
    wrap(<PageHeader title="Edit" back={{ label: "Back", onSelect }} />);
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onSelect).toHaveBeenCalled();
  });

  it("keeps the description to one line and gives the long help its own info button", async () => {
    wrap(<PageHeader title="Media" description="Pictures and files." info="Up to 10 MB each; JPG, PNG, WebP." />);
    const d = screen.getByText("Pictures and files.");
    expect(d).toHaveAttribute("title", "Pictures and files.");
    await userEvent.click(screen.getByRole("button", { name: /Media/ }));
    expect(await screen.findByText("Up to 10 MB each; JPG, PNG, WebP.")).toBeInTheDocument();
  });

  it("shows one status line under the title", () => {
    wrap(<PageHeader title="Post" status={<span>Saved</span>} />);
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("still takes the legacy actions and meta of the old admin header", () => {
    wrap(<PageHeader title="Old" meta={<span>meta</span>} actions={<button type="button">Legacy</button>} />);
    expect(screen.getByText("meta")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Legacy" })).toBeInTheDocument();
  });

  it("works right to left", () => {
    render(
      <div dir="rtl">
        <MemoryRouter>
          <PageHeader title="פוסטים" back={{ label: "חזרה", href: "/he/admin" }} primary={{ id: "n", label: "פוסט חדש", icon: Plus, onSelect: vi.fn() }} />
        </MemoryRouter>
      </div>,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("פוסטים");
    expect(screen.getByRole("button", { name: "פוסט חדש" })).toBeInTheDocument();
  });
});
