import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AdminLayout on the public host", () => {
  it("leaves for the gated host and asks the API nothing", () => {
    const replace = vi.fn();
    const asked = vi.fn();
    vi.stubGlobal("fetch", asked);
    vi.stubGlobal("location", { hostname: "yehudabriskman.com", pathname: "/admin/media", search: "?id=1", hash: "", replace });
    const { container } = render(
      <MemoryRouter>
        <AdminLayout />
      </MemoryRouter>,
    );
    expect(replace).toHaveBeenCalledWith("https://admin.yehudabriskman.com/admin/media?id=1");
    expect(container).toBeEmptyDOMElement();
    expect(asked).not.toHaveBeenCalled();
  });
});
