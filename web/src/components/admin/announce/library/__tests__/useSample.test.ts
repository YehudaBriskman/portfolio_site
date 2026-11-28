import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { adminAnnounce, type AnnounceDetail, type AnnounceSummary } from "@/services/adminAnnounce";
import { useSample } from "../useSample";

/*
 * #559: the preview's card is an address on the public site. The admin lives
 * on another, SSO-gated host, so a relative `/api/seo/og/...` points there.
 */
const ev: AnnounceSummary = { id: "e1", kind: "post", ref: "hello", title: "Real note", url: "https://s.test/blog/hello", langs: ["en"], createdAt: "", readAt: null, done: {}, dismissed: null };
const detail = (siteOrigin?: string) => ({ ok: true, siteOrigin, kit: {}, event: { ...ev, summary: "s", tags: [], version: null } }) as unknown as AnnounceDetail;
const events = [ev];
const hashtags: string[] = [];

const imageFor = async (siteOrigin?: string) => {
  vi.spyOn(adminAnnounce, "get").mockResolvedValue(detail(siteOrigin));
  const { result } = renderHook(() => useSample("e1", events, "en", hashtags));
  await waitFor(() => expect(result.current.state).toBe("ready"));
  return result.current.sample.meta.image;
};

afterEach(() => vi.restoreAllMocks());

describe("useSample card address", () => {
  it("is on the origin the server reports", async () => {
    expect(await imageFor("https://public.test")).toBe("https://public.test/api/seo/og/blog/hello.png");
  });

  it("falls back to the site's own origin, never the admin page's", async () => {
    expect(await imageFor()).toBe("https://yehudabriskman.com/api/seo/og/blog/hello.png");
  });
});
