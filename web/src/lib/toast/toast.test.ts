import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast, toastDurations, __resetToasts } from "./index";

beforeEach(() => {
  __resetToasts();
});
afterEach(() => {
  vi.useRealTimers();
});

const live = () => toast.live();

describe("toast service", () => {
  it("raises each kind with its own duration, by importance", () => {
    toast.success("Saved");
    toast.info("FYI");
    toast.warning("Careful");
    toast.error("Failed");
    toast.error("Failed, retry", { action: { label: "Retry", onClick: () => {} } });
    toast.error("Failed, long", { details: "More" });
    const d = live().map((t) => t.duration);
    expect(d).toEqual([
      toastDurations.success,
      toastDurations.info,
      toastDurations.warning,
      toastDurations.error,
      toastDurations.errorWithAction,
      toastDurations.errorWithAction,
    ]);
    expect(toastDurations.success).toBeGreaterThanOrEqual(5000);
    expect(toastDurations.errorWithAction).toBeGreaterThanOrEqual(10000);
  });

  it("replaces a toast with the same id instead of stacking", () => {
    toast.loading("Saving", { id: "save" });
    toast.success("Saved", { id: "save" });
    toast.success("Saved", { id: "save" });
    expect(live()).toHaveLength(1);
    expect(live()[0]).toMatchObject({ id: "save", kind: "success", title: "Saved" });
    expect(toast.history()).toHaveLength(1);
  });

  it("loading never expires, persistent never expires", () => {
    toast.loading("Working");
    toast.info("Stays", { persistent: true });
    expect(live().map((t) => t.duration)).toEqual([Infinity, Infinity]);
  });

  it("opening Details keeps the toast and shows the long text; closing restores it", () => {
    const id = toast.error("Could not save", { description: "Try again.", details: "The server said no." });
    expect(live()[0].open).toBe(false);
    toast.toggleDetails(id);
    expect(live()[0]).toMatchObject({ open: true, duration: Infinity });
    toast.toggleDetails(id);
    expect(live()[0]).toMatchObject({ open: false, duration: toastDurations.errorWithAction });
  });

  it("dismiss removes it from the live list but keeps it in the history", () => {
    const id = toast.success("Copied");
    toast.dismiss(id);
    expect(live()).toHaveLength(0);
    expect(toast.history().map((h) => h.title)).toEqual(["Copied"]);
  });

  it("keeps the last 30 notifications, newest first, and never the details", () => {
    for (let i = 0; i < 35; i++) toast.info(`n${i}`, { details: "secret" });
    const h = toast.history();
    expect(h).toHaveLength(30);
    expect(h[0].title).toBe("n34");
    expect(JSON.stringify(h)).not.toContain("secret");
    toast.clearHistory();
    expect(toast.history()).toEqual([]);
  });

  it("announces once: status for good news, alert for errors", () => {
    toast.success("Saved");
    toast.error("Broke");
    expect(toast.announcement()).toMatchObject({ status: "Saved", alert: "Broke" });
  });

  it("promise resolves into success and rejects into error under one id", async () => {
    const ok = toast.promise(Promise.resolve(1), { loading: "Saving", success: "Saved", error: "Failed" });
    expect(live()[0]).toMatchObject({ kind: "loading", title: "Saving" });
    await ok;
    expect(live()).toHaveLength(1);
    expect(live()[0]).toMatchObject({ kind: "success", title: "Saved" });
    const bad = toast.promise(Promise.reject(new Error("x")), { loading: "Saving", success: "Saved", error: "Failed" });
    await bad.catch(() => {});
    expect(live().map((t) => t.kind)).toEqual(["success", "error"]);
  });
});

describe("toast.undoable", () => {
  const host = () => toast.hostMounted(true);

  it("holds the commit back, then runs it once when the toast goes away", () => {
    host();
    const commit = vi.fn();
    const id = toast.undoable({ title: "Archived 2", commit });
    expect(commit).not.toHaveBeenCalled();
    expect(live()[0].duration).toBeGreaterThanOrEqual(8000);
    toast.gone(id, "auto");
    toast.gone(id, "auto");
    toast.dismiss(id);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("Undo drops the commit and runs onUndo", () => {
    host();
    const commit = vi.fn();
    const onUndo = vi.fn();
    const id = toast.undoable({ title: "Archived", commit, onUndo });
    live()[0].action!.onClick();
    toast.gone(id, "dismiss");
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(commit).not.toHaveBeenCalled();
  });

  it("a second job commits the first", () => {
    host();
    const a = vi.fn();
    const b = vi.fn();
    toast.undoable({ title: "A", commit: a });
    toast.undoable({ title: "B", commit: b });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
  });

  it("commits on pagehide", () => {
    host();
    const commit = vi.fn();
    toast.undoable({ title: "A", commit });
    window.dispatchEvent(new Event("pagehide"));
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("with no host mounted, commits at once instead of losing the action", () => {
    const commit = vi.fn();
    toast.undoable({ title: "A", commit });
    expect(commit).toHaveBeenCalledTimes(1);
  });
});
