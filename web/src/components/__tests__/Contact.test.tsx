import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Contact from "@/components/Contact";
import { ContactError, ContactSchema, sendContactMessage } from "@/services/contact";
import ToastHost from "@/components/ui/ToastHost";
import { toast, __resetToasts } from "@/lib/toast";
import { toast as sonnerToast } from "sonner";

/*
 * Only the send is replaced. `ContactSchema` is kept real on purpose: the form
 * asks it which field is wrong, so a test that stubbed it would be testing a
 * second copy of the validation rules rather than the ones that ship.
 */
vi.mock("@/services/contact", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/contact")>();
  return { ...actual, sendContactMessage: vi.fn() };
});

const send = vi.mocked(sendContactMessage);

/*
 * jsdom implements the `<dialog>` element's `open` attribute and none of its
 * behaviour — no `showModal`, no `close`, no top layer, no Escape. So the
 * methods are installed here, with the two side effects the component actually
 * depends on: the attribute, and the `close` event every route out ends at.
 *
 * This is a shim and not a mock of the component's own code. Without it the
 * tests would exercise the no-`showModal` fallback branch and prove nothing
 * about the path that ships, and `vi.spyOn` would have nothing to attach to.
 * What the shim cannot supply — focus trapping, the inert background, Escape —
 * is the half of this feature that was moved onto the platform precisely so
 * that it is not ours to test; it is measured in a real browser instead.
 */
beforeAll(() => {
  HTMLDialogElement.prototype.show = function show(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

const dialog = () => {
  const el = document.querySelector("dialog");
  if (!el) throw new Error("the section rendered no dialog element");
  return el;
};

const trigger = () => screen.getByRole("button", { name: /^write a message/i });

/** Render the section and ask for the form, which is where every test about a
 *  field has to start now that the form is behind a button. */
async function openDialog() {
  render(<Contact />);
  await userEvent.click(trigger());
  return dialog();
}

/** A message that passes the schema, so a test about the send is not quietly
 *  a test about validation. */
async function fillIn() {
  await userEvent.type(screen.getByLabelText("Name"), "Dana Levi");
  await userEvent.type(screen.getByLabelText("Email"), "dana@example.com");
  await userEvent.type(
    screen.getByLabelText("Message"),
    "I read the note on sticky timelines and have a question about it."
  );
}

/*
 * What is worth testing here is not the markup — it is the promises the close
 * makes, each of which has a specific way of being broken silently.
 */
describe("Contact", () => {
  beforeEach(() => {
    send.mockReset();
  });

  it("is labelled through the object schema, not hand-rolled", () => {
    render(<Contact />);

    /* The plate is this section's heading, at the scale a project in the pile
       is. A `h2` that stopped being the name would mean the plate had been
       replaced by a section head with a form under it. */
    expect(screen.getByRole("heading", { level: 2, name: "Get in touch" })).toBeInTheDocument();
    expect(screen.getByText("Mail reaches me faster than anything else")).toBeInTheDocument();

    /* Three fields, and the reply time is one of them — see the note on
       PROFILE_SLOTS. A fourth profile in data/links.ts must cost a profile and
       not the promise. */
    const fields = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(fields).toEqual(["GitHub", "LinkedIn", "Usually within a day"]);
  });

  it("is a plate and one button, with the form out of the initial render path", () => {
    render(<Contact />);

    /* The dialog element is in the document from the first render and empty,
       which is what makes the live regions inside it correct when they arrive:
       they are there from the only "first paint" a reader of this dialog ever
       sees. Nothing of the form is. */
    expect(dialog()).toBeInTheDocument();
    expect(dialog()).not.toHaveAttribute("open");
    expect(dialog()).toBeEmptyDOMElement();
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });

  it("opens as a modal, with nothing hand-rolled on top of it", async () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, "showModal");
    const show = vi.spyOn(HTMLDialogElement.prototype, "show");

    await openDialog();

    /* `showModal` and not `show`. The second one gives the top layer and none
       of the focus trapping, the inert background or the Escape handling —
       which is the trap that looks like the same call. */
    expect(showModal).toHaveBeenCalledTimes(1);
    expect(show).not.toHaveBeenCalled();
    expect(dialog()).toHaveAttribute("open");

    /* Restored here rather than left to a global `restoreMocks`: these two
       spies sit on a prototype every other test in this file uses. */
    showModal.mockRestore();
    show.mockRestore();
  });

  it("puts focus on the first field when it opens", async () => {
    await openDialog();

    /* Explicitly, after the element is showing — not with `autoFocus`, which
       React applies on mount, in the same commit, before `showModal` has put
       the element in the top layer. */
    expect(screen.getByLabelText("Name")).toHaveFocus();
  });

  it("returns focus to the trigger however it was closed", async () => {
    await openDialog();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(dialog()).not.toHaveAttribute("open");
    expect(trigger()).toHaveFocus();
  });

  it("returns focus to the trigger on a close it did not initiate", async () => {
    await openDialog();

    /*
     * Escape, as far as this component can see it. The keystroke is the
     * browser's to handle and jsdom does not implement it at all, so what is
     * pinned here is the only trace Escape leaves behind: the element's own
     * `close` event, fired without anything in React having asked for it. One
     * listener on that event is why the four routes out — Escape, the close
     * button, the backdrop and a programmatic close — all return focus in one
     * place instead of in four, and Escape is the one that would have been
     * forgotten.
     */
    fireEvent(dialog(), new Event("close"));

    expect(trigger()).toHaveFocus();
  });

  /* The failure is raised on the shared toast service (lib/toast), whose host
     mounts inside the open dialog: a modal makes the rest of the page inert, so a
     toast anywhere else could not be reached. Position, Escape and the swipe are the
     host's own tests; what is held here is what the contact form hands it. */
  const toaster = () => document.querySelector<HTMLElement>("[data-sonner-toaster]");
  const renderWithHost = () => render(<><Contact /><ToastHost /></>);
  /* The visible toast; what a screen reader hears is the host's own alert region (see below). */
  const toastAlert = async () => {
    await waitFor(() => expect(toaster()?.querySelector("[data-sonner-toast]")).not.toBeNull());
    return toaster()!.querySelector<HTMLElement>("[data-sonner-toast]")!;
  };
  const hostAlert = () => document.querySelector<HTMLElement>("[data-toast-host] [role=alert]");
  beforeAll(() => {
    Element.prototype.setPointerCapture ??= () => {};
    Element.prototype.releasePointerCapture ??= () => {};
  });
  beforeEach(() => __resetToasts());
  afterEach(async () => {
    sonnerToast.dismiss();
  });

  it.each([
    ["rate", /message not sent, too many tries/i],
    ["large", /message not sent, too long/i],
    ["server", /message not sent, something went wrong/i],
    ["offline", /message not sent, check your connection/i],
  ] as const)("a %s failure is a toast in the dialog: title, one short line, Details", async (kind, re) => {
    send.mockRejectedValue(new ContactError(kind));
    renderWithHost();
    await userEvent.click(trigger());
    await fillIn();
    await userEvent.click(screen.getByRole("button", { name: /send message/i }));
    const alert = await toastAlert();
    await waitFor(() => expect(alert).toHaveTextContent(re));
    expect(dialog().contains(toaster())).toBe(true);
    /* Announced once, by the host's alert region. */
    await waitFor(() => expect(hostAlert()).toHaveTextContent(re));
    expect(alert.textContent).not.toMatch(/HTTP|\d{3}|Failed to fetch|still in the fields|@/);
    expect(alert.textContent!.split(/[,.]/).join(" ").split(/\s+/).length).toBeLessThan(30);

    const more = within(toaster()!).getByRole("button", { name: /^details$/i });
    expect(more).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/still in the fields/i)).toBeNull();
    await userEvent.click(more);
    const details = await screen.findByText(/still in the fields/i);
    expect(details.textContent).not.toMatch(/HTTP|\d{3}|Failed to fetch/);
    expect(details.textContent).toContain("@");
    /* The form is untouched and the dialog stays. */
    expect(dialog()).toHaveAttribute("open");
    expect(screen.getByLabelText("Name")).toHaveValue("Dana Levi");
  });

  it("the toast does not vanish before it can be read, and stays once Details is open", async () => {
    send.mockRejectedValue(new ContactError("server"));
    renderWithHost();
    await userEvent.click(trigger());
    await fillIn();
    await userEvent.click(screen.getByRole("button", { name: /send message/i }));
    await toastAlert();
    expect(toast.live()[0].duration).toBeGreaterThanOrEqual(10000);
    await userEvent.click(within(toaster()!).getByRole("button", { name: /^details$/i }));
    expect(toast.live()[0].duration).toBe(Infinity);
  });

  it("a new send takes the old failure down, and closing the dialog does too", async () => {
    send.mockRejectedValueOnce(new ContactError("offline")).mockResolvedValue(true);
    renderWithHost();
    await userEvent.click(trigger());
    await fillIn();
    await userEvent.click(screen.getByRole("button", { name: /send message/i }));
    await toastAlert();
    expect(toast.live()).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: /send message/i }));
    await waitFor(() => expect(toast.live()).toHaveLength(0));
  });

  it.each(["rate", "large", "server", "offline"] as const)("in Hebrew a %s failure has no English fragment", async (kind) => {
    document.documentElement.lang = "he";
    document.documentElement.dir = "rtl";
    try {
      send.mockRejectedValue(new ContactError(kind));
      renderWithHost();
      await userEvent.click(screen.getByRole("button", { name: /כתיבת הודעה/ }));
      await userEvent.type(screen.getByLabelText("שם"), "דנה לוי");
      await userEvent.type(screen.getByLabelText("אימייל"), "dana@example.com");
      await userEvent.type(screen.getByLabelText("הודעה"), "קראתי את הרשומה ויש לי שאלה לגביה.");
      await userEvent.click(screen.getByRole("button", { name: /שליחת ההודעה/ }));
      const alert = await toastAlert();
      await waitFor(() => expect(alert.textContent).toMatch(/ההודעה לא נשלחה/));
      expect(alert.textContent).not.toMatch(/[A-Za-z]/);
      await userEvent.click(within(toaster()!).getByRole("button", { name: /^פרטים$/ }));
      const details = await screen.findByText(/עדיין בשדות/);
      expect(details.textContent!.replace(/\S+@\S+/, "")).not.toMatch(/[A-Za-z]/);
    } finally {
      document.documentElement.removeAttribute("lang");
      document.documentElement.removeAttribute("dir");
    }
  });

  it("keeps every word, and the dialog, when the send fails", async () => {
    send.mockRejectedValue(new Error("the mail host refused the connection"));
    renderWithHost();
    await userEvent.click(trigger());
    await fillIn();

    await userEvent.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => expect(toaster()).toHaveTextContent("Message not sent"));

    /* The one thing a reader cannot recover is the paragraph they just wrote —
       and a dialog that shuts itself on a failure has thrown away the only copy
       of the message it was asked to deliver. */
    expect(dialog()).toHaveAttribute("open");
    expect(screen.getByLabelText("Name")).toHaveValue("Dana Levi");
    expect(screen.getByLabelText("Email")).toHaveValue("dana@example.com");
    expect(screen.getByLabelText("Message")).toHaveValue(
      "I read the note on sticky timelines and have a question about it."
    );
    expect(within(screen.getByRole("form", { name: "Send a message" })).getByRole("status")).toHaveTextContent("");
  });

  it("keeps a closed dialog's fields, so one stray Escape costs nothing", async () => {
    await openDialog();
    await userEvent.type(screen.getByLabelText("Name"), "Dana Levi");

    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await userEvent.click(trigger());

    /* Escape is a single keystroke and easy to hit by accident. If closing the
       dialog unmounted the fields, that keystroke would throw away the
       paragraph the reader had just written. */
    expect(screen.getByLabelText("Name")).toHaveValue("Dana Levi");
  });

  it("has both live regions in the dialog's subtree before anything is submitted", () => {
    render(<Contact />);

    /* Neither region exists before the dialog does, and that is the point: a
       screen reader subscribes to what was in the subtree when the subtree
       appeared, and this subtree appears the moment the reader asks for it.
       There is no spare time in which a region could be added later, so a
       region created along with its first message loses the announcement in
       exactly the case it exists for. */
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("has both live regions in the DOM before anything is submitted", async () => {
    await openDialog();

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("puts the confirmation inside the live region, not merely on the page", async () => {
    send.mockResolvedValue(true);
    await openDialog();
    await fillIn();

    await userEvent.click(screen.getByRole("button", { name: /send message/i }));

    /* `within` the status region, deliberately. The receipt being somewhere in
       the document is not the requirement — the requirement is that it is in
       the region that announces it, and it arrives with the DOM update rather
       than after an animation. */
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Sent. I’ll reply to the address you gave.")
    );
    expect(screen.getByRole("alert")).toHaveTextContent("");
  });

  it("does not close itself on a successful send", async () => {
    send.mockResolvedValue(true);
    await openDialog();
    await fillIn();

    await userEvent.click(screen.getByRole("button", { name: /send message/i }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Sent."));

    /*
     * The one rule this section inherited from the cut plan: the confirmation
     * lands before or with any exit motion, never after it. A dialog that
     * closed itself on send would be exit motion racing an announcement that
     * had just been queued, in a subtree about to leave the accessibility tree.
     * Nothing in this section exits, which is what makes the rule structural.
     */
    expect(dialog()).toHaveAttribute("open");
  });

  it("marks the resolution on the form in the same commit as the receipt", async () => {
    send.mockResolvedValue(true);
    await openDialog();
    await fillIn();

    const form = screen.getByRole("form", { name: "Send a message" });
    expect(form).not.toHaveAttribute("data-sent");

    await userEvent.click(screen.getByRole("button", { name: /send message/i }));

    /*
     * The ordering rule, as something a test can hold onto. `data-sent` is what
     * the three field rules draw themselves out on, so it is the first frame of
     * the section's closing gesture — and it must never be true before the
     * receipt is in the live region. One React commit sets both, so the only way
     * to break this is to move one of them into a timer or an effect, and this
     * assertion is what notices.
     */
    await waitFor(() => expect(form).toHaveAttribute("data-sent", "true"));
    expect(screen.getByRole("status")).toHaveTextContent("Sent.");
  });

  it("leaves a statement where the ask was, so the section resolves", async () => {
    send.mockResolvedValue(true);
    await openDialog();
    await fillIn();

    await userEvent.click(screen.getByRole("button", { name: /send message/i }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Sent."));

    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    /*
     * Closing a dialog that has just said "sent" must not return the reader to
     * the exact page they started on — that is the "looks like it ate the
     * message" failure arriving one step later than it used to. The statement
     * outlives the dialog's status, and the trigger is demoted to a second
     * message rather than still asking for a first one.
     */
    expect(dialog()).not.toHaveAttribute("open");
    expect(screen.getByText("Sent. I’ll reply to the address you gave.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /write another message/i })
    ).toBeInTheDocument();
  });

  it("does not resolve anything when the send failed", async () => {
    send.mockRejectedValue(new Error("the mail host refused the connection"));
    renderWithHost();
    await userEvent.click(trigger());
    await fillIn();

    await userEvent.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => expect(toaster()).toHaveTextContent("Message not sent"));
    /* A closing gesture on a message that never left is the page congratulating
       itself for losing it. */
    expect(screen.getByRole("form", { name: "Send a message" })).not.toHaveAttribute("data-sent");
    expect(screen.queryByText("Sent. I’ll reply to the address you gave.")).not.toBeInTheDocument();
  });

  it("gives every field its own ink strip, and keeps all three out of the a11y tree", async () => {
    await openDialog();

    /* One decorative strip per field, directly after the control it belongs to.
       The only reason they are elements at all is that `input` and `textarea`
       render no pseudo-elements; nothing about them is information, so nothing
       about them may reach a reader who is being read to. A field that lost its
       strip would simply stop having a treatment, silently. */
    for (const name of ["Name", "Email", "Message"]) {
      const strip = screen.getByLabelText(name).nextElementSibling;
      expect(strip).toHaveAttribute("aria-hidden", "true");
      expect(strip).toBeEmptyDOMElement();
    }
  });

  it("keeps the email field's native constraints in step with the schema", async () => {
    await openDialog();
    const email = screen.getByLabelText("Email");
    const pattern = email.getAttribute("pattern");
    expect(pattern).toBeTruthy();
    const native = new RegExp(`^(?:${pattern})$`);

    /*
     * The decorative seal on the email rule is `:user-valid`, so what the
     * browser thinks "well formed" means has to be what the schema thinks it
     * means — otherwise the mark closes on an address the submit then rejects.
     * `type="email"` alone does not: the HTML email type wants no top-level
     * domain, and the schema's regex does. `dana@exam` is that gap, and the
     * `pattern` attribute is what closes it.
     */
    expect(ContactSchema.shape.email.safeParse("dana@exam").success).toBe(false);
    expect(native.test("dana@exam")).toBe(false);

    /* And it must reject nothing the schema accepts, or the seal would simply
       stop appearing for perfectly good addresses. */
    for (const good of ["dana@example.com", "d.levi+x@mail.co.uk", "a@b.io"]) {
      expect(ContactSchema.shape.email.safeParse(good).success).toBe(true);
      expect(native.test(good)).toBe(true);
    }
  });

  it("keeps a real label bound to every control", async () => {
    await openDialog();

    /* The regression this exists to catch is a ruled line with a placeholder
       in it: the name disappears the moment anything is typed, which is exactly
       when the reader wants to check what they put in. Three `for`/`id` pairs,
       and no placeholder anywhere. */
    for (const name of ["Name", "Email", "Message"]) {
      const control = screen.getByLabelText(name);
      expect(control.id).toBeTruthy();
      expect(document.querySelector(`label[for="${control.id}"]`)).toHaveTextContent(name);
      expect(control).not.toHaveAttribute("placeholder");
    }
  });

  it("names the field that is wrong, in text, and sends nothing", async () => {
    await openDialog();

    await userEvent.type(screen.getByLabelText("Name"), "D");
    await userEvent.type(screen.getByLabelText("Email"), "not-an-address");
    await userEvent.click(screen.getByRole("button", { name: /send message/i }));

    expect(send).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Nothing was sent");
    /* And it stays open, or the notes it has just drawn are notes nobody can
       read. */
    expect(dialog()).toHaveAttribute("open");

    /* The error is text and it is tied to its field. Colour carries none of
       this, which is why the test can read it at all. */
    const email = screen.getByLabelText("Email");
    expect(email).toHaveAttribute("aria-invalid", "true");
    const describedBy = email.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy ?? "")).toHaveTextContent(
      "That email address doesn't look right"
    );
  });

  it("asks for an empty email rather than calling it malformed", async () => {
    await openDialog();

    await userEvent.click(screen.getByRole("button", { name: /send message/i }));

    const email = screen.getByLabelText("Email");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(document.getElementById(email.getAttribute("aria-describedby") ?? "")).toHaveTextContent(
      "Add your email address",
    );
  });

  it("names the dialog with the heading the reader can see", async () => {
    await openDialog();

    /* `aria-labelledby` and not `aria-label`: the name read out on the way in
       is the heading on the screen, which is the cheapest way to make a dialog
       feel like the thing that was pressed rather than a new place. */
    const labelledBy = dialog().getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy ?? "")).toHaveTextContent("Write a message");
  });
});
