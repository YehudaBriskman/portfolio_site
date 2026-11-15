import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { EmptyState } from "@/components/ui/EmptyState";

describe("EmptyState", () => {
  it("first use teaches in one sentence and offers one action", () => {
    const onClick = vi.fn();
    render(<EmptyState variant="first-use" title="No posts yet" description="Posts you write show up here." action={{ label: "New post", onClick }} />);
    expect(screen.getByRole("heading", { name: "No posts yet" })).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "New post" }));
    expect(onClick).toHaveBeenCalled();
  });

  it("no results is neutral, names the active filters and has one Clear", () => {
    const onClear = vi.fn();
    render(<EmptyState variant="no-results" title="Nothing matches" filters={["Status: Draft", "Area: Notes"]} clear={{ label: "Clear filters", onClick: onClear }} />);
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText("Status: Draft")).toBeTruthy();
    expect(screen.getByText("Area: Notes")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onClear).toHaveBeenCalled();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("an error is an alert that says what failed and offers Retry", () => {
    const onClick = vi.fn();
    render(<EmptyState variant="error" title="Could not load" description="The server did not answer." action={{ label: "Retry", onClick }} />);
    expect(screen.getByRole("alert").textContent).toContain("Could not load");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onClick).toHaveBeenCalled();
  });

  it("never draws two buttons, whatever it is given", () => {
    render(<EmptyState variant="no-results" title="x" action={{ label: "A", onClick: () => {} }} clear={{ label: "B", onClick: () => {} }} />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});
