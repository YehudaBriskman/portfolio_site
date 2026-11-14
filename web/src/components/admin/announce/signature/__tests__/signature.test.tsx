import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast, __resetToasts } from "@/lib/toast";
import { ContentInvalidError } from "@/services/adminContent";
import type { SigSlot, SigState } from "@/services/adminSignature";
import { allWordTables } from "@/i18n/words";
import SignatureSettings from "../SignatureSettings";
import { useSignatureWords } from "../words";

const svc = vi.hoisted(() => ({ get: vi.fn(), saveShow: vi.fn(), save: vi.fn(), remove: vi.fn() }));
vi.mock("@/services/adminSignature", async (orig) => ({ ...(await orig<typeof import("@/services/adminSignature")>()), adminSignature: svc }));

const slot = (over: Partial<SigSlot> = {}): SigSlot => ({
  lang: "en", mode: "drawn", format: "svg", alt: "Me", ink: "#14130f", light: true, hash: "0123456789abcdef", width: 120, height: 50, updatedAt: "2026-11-14T00:00:00Z",
  strokes: { w: 600, h: 240, pen: 4, strokes: [[[10, 10], [60, 40]]] },
  urls: { web: "/w", email: "/e", emailLight: "/l" },
  preview: { web: "/api/admin/signature/en/file/web", email: "/api/admin/signature/en/file/email", emailLight: "/api/admin/signature/en/file/email-light" },
  ...over,
});
const state = (over: Partial<SigState> = {}): SigState => ({ ok: true, show: { email: false, posts: false, cards: false }, slots: { en: null, he: null }, ...over });

const ctx = new Proxy({}, { get: (_t, k) => (k === "canvas" ? undefined : () => undefined), set: () => true });

beforeEach(() => {
  __resetToasts();
  document.documentElement.lang = "en";
  HTMLCanvasElement.prototype.getContext = (() => ctx) as never;
  Element.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, top: 0, left: 0, right: 300, bottom: 120, width: 300, height: 120, toJSON: () => ({}) });
  svc.get.mockResolvedValue(state());
  svc.saveShow.mockImplementation(async (show) => ({ ok: true, show }));
  svc.save.mockResolvedValue({ ok: true, slot: slot() });
  svc.remove.mockResolvedValue({ ok: true });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const open = async () => {
  render(<SignatureSettings defaultAlt="Yehuda" />);
  await screen.findByTestId("signature-slot-en");
};
const slotEn = () => within(screen.getByTestId("signature-slot-en"));

function scribble() {
  const pad = screen.getByTestId("signature-pad");
  Object.assign(pad, { setPointerCapture: () => {}, releasePointerCapture: () => {}, hasPointerCapture: () => false });
  const pt = (x: number, y: number) => ({ clientX: x, clientY: y, pointerId: 1, pointerType: "touch", pressure: 0.6, button: 0 });
  fireEvent.pointerDown(pad, pt(10, 10));
  fireEvent.pointerMove(pad, pt(60, 40));
  fireEvent.pointerMove(pad, pt(120, 20));
  fireEvent.pointerUp(pad, pt(120, 20));
}

describe("the Signature image settings", () => {
  it("says what to avoid and starts with every use off", async () => {
    await open();
    expect(screen.getByTestId("signature-bank-note").textContent).toBe("Use a stylised signature, not the one on your bank or ID: anything shown publicly can be copied.");
    for (const name of ["Email footer", "End of posts", "Share cards"]) expect(screen.getByRole("switch", { name })).not.toBeChecked();
    expect(slotEn().getByText("No signature yet")).toBeTruthy();
  });

  it("saves a switch at once with a toast, and puts it back with an error toast when that fails", async () => {
    await open();
    fireEvent.click(screen.getByRole("switch", { name: "End of posts" }));
    await waitFor(() => expect(svc.saveShow).toHaveBeenCalledWith({ email: false, posts: true, cards: false }));
    await waitFor(() => expect(toast.live().some((t) => t.kind === "success")).toBe(true));
    svc.saveShow.mockRejectedValueOnce(new Error("down"));
    fireEvent.click(screen.getByRole("switch", { name: "Share cards" }));
    await waitFor(() => expect(toast.live().some((t) => t.kind === "error")).toBe(true));
    expect(screen.getByRole("switch", { name: "Share cards" })).not.toBeChecked();
  });

  it("draws with a pointer, undoes, redoes, clears, and sends only strokes", async () => {
    await open();
    fireEvent.click(slotEn().getByRole("button", { name: "Draw" }));
    expect(screen.getByTestId("signature-pad").style.touchAction).toBe("none");
    expect(screen.getByText(/needs a finger, a pen or a mouse/)).toBeTruthy();
    const undo = screen.getByRole("button", { name: "Undo" });
    expect(undo).toBeDisabled();
    scribble();
    expect(undo).toBeEnabled();
    fireEvent.click(undo);
    expect(screen.getByRole("button", { name: "Redo" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    fireEvent.click(screen.getByRole("button", { name: "Save signature" }));
    await waitFor(() => expect(svc.save).toHaveBeenCalled());
    const [lang, body] = svc.save.mock.calls[0];
    expect(lang).toBe("en");
    expect(body).toMatchObject({ kind: "strokes", alt: "Yehuda", ink: "#14130f", strokes: { w: 600, h: 240 } });
    expect(Object.keys(body).sort()).toEqual(["alt", "ink", "kind", "light", "strokes"]);
    await waitFor(() => expect(toast.live().some((t) => t.kind === "success")).toBe(true));
  });

  it("will not save an empty pad or an empty alt text, inline", async () => {
    await open();
    fireEvent.click(slotEn().getByRole("button", { name: "Draw" }));
    fireEvent.click(screen.getByRole("button", { name: "Save signature" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Draw your signature first.");
    scribble();
    fireEvent.change(screen.getByLabelText("Alt text"), { target: { value: " " } });
    fireEvent.click(screen.getByRole("button", { name: "Save signature" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Alt text is required.");
    expect(svc.save).not.toHaveBeenCalled();
  });

  it("shows the previews once there is ink: email light and dark, a post ending and a card", async () => {
    await open();
    fireEvent.click(slotEn().getByRole("button", { name: "Draw" }));
    scribble();
    for (const id of ["preview-email-light", "preview-email-dark", "preview-post", "preview-card"]) expect(screen.getByTestId(id)).toBeTruthy();
    const img = within(screen.getByTestId("preview-email-light")).getByRole("img");
    expect(img.getAttribute("width")).toBeTruthy();
    expect(img.getAttribute("height")).toBeTruthy();
    expect(within(screen.getByTestId("preview-email-dark")).getByRole("img").getAttribute("src")).not.toBe(img.getAttribute("src"));
  });

  it("re-opens a drawn signature from its stored strokes", async () => {
    svc.get.mockResolvedValue(state({ slots: { en: slot(), he: null } }));
    await open();
    fireEvent.click(slotEn().getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
    expect(screen.getByTestId("preview-email-light")).toBeTruthy();
    expect((screen.getByLabelText("Alt text") as HTMLInputElement).value).toBe("Me");
  });

  it("uploads an SVG as text and shows the server's reason when it is refused", async () => {
    await open();
    fireEvent.click(slotEn().getByRole("button", { name: "Upload a file" }));
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File(['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><script>x</script></svg>'], "sig.svg", { type: "image/svg+xml" });
    svc.save.mockRejectedValueOnce(new ContentInvalidError("invalid", [{ path: "svg", message: "This SVG cannot be used: <script> is not allowed." }]));
    fireEvent.change(input, { target: { files: [file] } });
    await screen.findByTestId("checker-preview");
    fireEvent.click(screen.getByRole("button", { name: "Save signature" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/script/);
    expect(svc.save.mock.calls[0][1]).toMatchObject({ kind: "svg", recolor: true });
    expect(toast.live().some((t) => t.kind === "success")).toBe(false);
  });

  it("refuses a file over 5 MB before reading it", async () => {
    await open();
    fireEvent.click(slotEn().getByRole("button", { name: "Upload a file" }));
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png", { type: "image/png" });
    fireEvent.change(document.querySelector<HTMLInputElement>('input[type="file"]')!, { target: { files: [big] } });
    expect((await screen.findByRole("alert")).textContent).toBe("That file is larger than 5 MB.");
  });

  it("removes a slot after a confirming second press", async () => {
    svc.get.mockResolvedValue(state({ slots: { en: slot(), he: null } }));
    await open();
    fireEvent.click(slotEn().getByRole("button", { name: "Remove" }));
    expect(svc.remove).not.toHaveBeenCalled();
    fireEvent.click(slotEn().getByRole("button", { name: "Remove?" }));
    await waitFor(() => expect(svc.remove).toHaveBeenCalledWith("en"));
    await waitFor(() => expect(slotEn().getByText("No signature yet")).toBeTruthy());
  });

  it("gives a saved slot an image with width, height and the owner's alt text", async () => {
    svc.get.mockResolvedValue(state({ slots: { en: slot({ alt: "Yehuda's mark" }), he: null } }));
    await open();
    const img = slotEn().getByAltText("Yehuda's mark");
    expect(img.getAttribute("width")).toBe("120");
    expect(img.getAttribute("height")).toBe("50");
  });
});

describe("the words", () => {
  it("are registered in both languages, with the owner's note", () => {
    expect(allWordTables().some((t) => t.name === "adminSignature")).toBe(true);
    const he = useSignatureWords.of("he");
    expect(he.bankNote).toMatch(/[א-ת]/);
    expect(he.langName.he).toMatch(/[א-ת]/);
  });
});
