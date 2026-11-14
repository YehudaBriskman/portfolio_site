import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { H2 } from "@/components/notes/headingAnchors";
import { __resetToasts, toast } from "@/lib/toast";
import ToastHost from "@/components/ui/ToastHost";

/*
 * Copying a link to a heading is a transient result of an action: it is a toast
 * (public words, he and en), and a failure says so with a way to the Sharing help.
 */
const copy = (ok: boolean) =>
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: ok ? vi.fn(async () => {}) : vi.fn(async () => Promise.reject(new Error("no"))) } });

beforeEach(() => {
  __resetToasts();
});
afterEach(() => {
  cleanup();
  __resetToasts();
  vi.unstubAllGlobals();
  document.documentElement.lang = "en";
});

const press = async () => {
  render(
    <>
      <H2 id="intro">Intro</H2>
      <ToastHost />
    </>,
  );
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /copy a link|העתקת קישור/i }));
  });
};

describe("copying a heading link", () => {
  it("raises a success toast in English", async () => {
    copy(true);
    await press();
    expect(toast.live().map((t) => [t.kind, t.title])).toEqual([["success", "Link copied"]]);
  });

  it("raises it in Hebrew", async () => {
    document.documentElement.lang = "he";
    copy(true);
    await press();
    expect(toast.live().map((t) => t.title)).toEqual(["הקישור הועתק"]);
  });

  it("a refused copy is an error toast with a Learn more to the Sharing help", async () => {
    copy(false);
    await press();
    const t = toast.live()[0];
    expect(t.kind).toBe("error");
    expect(t.title).toBe("Couldn’t copy the link");
    expect(t.help?.topic).toBe("sharing");
  });
});
