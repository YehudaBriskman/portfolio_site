import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PostSignature from "../PostSignature";

const asset = { src: "/api/signature/en/0123456789abcdef.svg", alt: "Yehuda's mark", width: 120, height: 45, format: "svg" };
const reply = (status: number, body: unknown = {}) => vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

beforeEach(() => {
  document.documentElement.lang = "en";
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the signature at the end of a post", () => {
  it("draws nothing at all while the owner has it off (a 404)", async () => {
    const f = reply(404);
    vi.stubGlobal("fetch", f);
    const { container } = render(<PostSignature lang="en" />);
    await waitFor(() => expect(f).toHaveBeenCalledWith("/api/signature/en/current", expect.anything()));
    expect(container.firstChild).toBeNull();
  });

  it("draws nothing when the request fails", async () => {
    const f = vi.fn(async () => { throw new Error("offline"); });
    vi.stubGlobal("fetch", f);
    const { container } = render(<PostSignature lang="en" />);
    await waitFor(() => expect(f).toHaveBeenCalled());
    expect(container.firstChild).toBeNull();
  });

  it("shows the owner's alt text, reserves its size, and takes the text colour so dark mode follows", async () => {
    vi.stubGlobal("fetch", reply(200, asset));
    render(<PostSignature lang="en" />);
    const sig = await screen.findByRole("img", { name: "Yehuda's mark" });
    expect(sig.getAttribute("data-testid")).toBe("post-signature");
    expect(sig.style.width).toBe("120px");
    expect(sig.style.aspectRatio).toBe("120 / 45");
    expect(sig.style.backgroundColor).toBe("currentcolor");
    expect(sig.style.maskImage || sig.getAttribute("style")).toContain(asset.src);
  });

  it("refuses a src that is not our own signature route", async () => {
    vi.stubGlobal("fetch", reply(200, { ...asset, src: "https://evil.example/x.svg" }));
    const { container } = render(<PostSignature lang="en" />);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(container.firstChild).toBeNull();
  });
});
