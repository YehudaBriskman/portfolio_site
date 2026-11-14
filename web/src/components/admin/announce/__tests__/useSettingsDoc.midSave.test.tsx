import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useSettingsDoc } from "../useSettingsDoc";
import { DEFAULT_NOTIFY } from "../notify/defaults";
import { DEFAULT_SENDER } from "../sender/defaults";

/* Text typed while the settings save is in flight must survive the response, and is not "saved". */

const doc = (signature: string) => ({
  enabled: true, email: { enabled: false, events: ["post"] }, hashtags: [], signature, channels: ["linkedin"], templates: { en: {}, he: {} }, snippets: [], library: [],
  advanced: { utm: { enabled: false, source: "announce", mediumByChannel: {} } }, sender: DEFAULT_SENDER, notify: DEFAULT_NOTIFY,
});
const mocks = vi.hoisted(() => ({ settings: vi.fn(), saveSettings: vi.fn() }));
vi.mock("@/services/adminAnnounce", async (orig) => {
  const real = await orig<typeof import("@/services/adminAnnounce")>();
  return { ...real, adminAnnounce: { ...real.adminAnnounce, settings: mocks.settings, saveSettings: mocks.saveSettings } };
});
afterEach(() => (cleanup(), vi.clearAllMocks()));

async function start() {
  mocks.settings.mockResolvedValue({ ok: true, exists: true, _rev: "1-a", updatedAt: null, settings: doc("") });
  let finish!: (v: unknown) => void;
  mocks.saveSettings.mockImplementation(() => new Promise((r) => (finish = r)));
  const { result } = renderHook(() => useSettingsDoc());
  await waitFor(() => expect(result.current.draft).not.toBeNull());
  act(() => result.current.edit((d) => void (d.signature = "one")));
  let saving!: Promise<void>;
  act(() => void (saving = result.current.save(result.current.draft!)));
  await waitFor(() => expect(result.current.status).toBe("saving"));
  return { result, finish, saving };
}

describe("useSettingsDoc save", () => {
  it("keeps what was typed during the save and does not say saved", async () => {
    const { result, finish, saving } = await start();
    act(() => result.current.edit((d) => void (d.signature = "one and more typed during the save")));
    await act(async () => {
      finish({ ok: true, exists: true, _rev: "2-b", updatedAt: null, settings: doc("one") });
      await saving;
    });
    expect(result.current.draft!.signature).toBe("one and more typed during the save");
    expect(result.current.view!._rev).toBe("2-b");
    expect(result.current.view!.settings.signature).toBe("one");
    expect(result.current.status).not.toBe("saved");
  });

  it("still says saved when nothing changed during the save", async () => {
    const { result, finish, saving } = await start();
    await act(async () => {
      finish({ ok: true, exists: true, _rev: "2-b", updatedAt: null, settings: doc("one") });
      await saving;
    });
    expect(result.current.draft!.signature).toBe("one");
    expect(result.current.status).toBe("saved");
  });
});
