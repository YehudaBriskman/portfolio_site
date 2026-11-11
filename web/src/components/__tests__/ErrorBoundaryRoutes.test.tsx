import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RoutesErrorBoundary from "@/components/ErrorBoundaryRoutes";

function Boom(): never {
  throw new Error("chunk failed");
}

describe("RoutesErrorBoundary", () => {
  it("shows a reload prompt instead of unmounting the app", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <MemoryRouter>
        <RoutesErrorBoundary>
          <Boom />
        </RoutesErrorBoundary>
      </MemoryRouter>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
  });
});
