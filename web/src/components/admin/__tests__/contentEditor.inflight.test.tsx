import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { z } from "zod";
import { useContentEditor } from "@/components/admin/content/editor";

/* Regression: form state and validation parity. Each test passes once the bug is fixed. */

const mocks = vi.hoisted(() => ({ get: vi.fn(), saveDraft: vi.fn() }));
vi.mock("@/services/adminContent", async (orig) => {
  const real = await orig<typeof import("@/services/adminContent")>();
  return { ...real, adminContent: { ...real.adminContent, get: mocks.get, saveDraft: mocks.saveDraft } };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("content editor save cycle ", () => {
  /* B-h4-16 */
  it("text typed while 'Save draft' is in flight must survive the response", async () => {
    const schema = z.object({ title: z.string() });
    mocks.get.mockResolvedValue({ exists: true, _rev: "1-a", draft: null, published: { title: "v1" }, updatedAt: null, publishedAt: null });
    let finish!: (v: unknown) => void;
    mocks.saveDraft.mockImplementation(() => new Promise((r) => (finish = r)));
    const { result } = renderHook(() => useContentEditor("story" as never, schema as never));
    await waitFor(() => expect(result.current.value).toEqual({ title: "v1" }));
    act(() => result.current.edit((d: { title: string }) => void (d.title = "v2")));
    let saving!: Promise<void>;
    act(() => void (saving = result.current.saveDraft()));
    await waitFor(() => expect(result.current.state.kind).toBe("saving"));
    // The owner keeps typing while the request is on the wire.
    act(() => result.current.edit((d: { title: string }) => void (d.title = "v2 and more words typed during the save")));
    await act(async () => {
      finish({ exists: true, _rev: "2-b", draft: { title: "v2" }, published: { title: "v1" }, updatedAt: null, publishedAt: null });
      await saving;
    });
    expect((result.current.value as { title: string }).title).toBe("v2 and more words typed during the save");
    // and it must not be reported as saved while newer text is only in the browser
    expect(result.current.state.kind).not.toBe("saved");
  });
});

