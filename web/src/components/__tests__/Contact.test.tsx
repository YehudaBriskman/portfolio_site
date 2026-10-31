import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Contact from "@/components/Contact";
import { sendContactMessage } from "@/services/contact";

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
 * What is worth testing here is not the markup — it is the four promises the
 * close makes, each of which has a specific way of being broken silently.
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

  it("has both live regions in the DOM before anything is submitted", () => {
    render(<Contact />);

    /* The whole point of the two regions: a screen reader subscribes to what
       was there when the page loaded. Creating either of them along with its
       first message loses the announcement in exactly the case it exists for. */
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("puts the confirmation inside the live region, not merely on the page", async () => {
    send.mockResolvedValue(true);
    render(<Contact />);
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

  it("leaves every word in the fields when the send fails", async () => {
    send.mockRejectedValue(new Error("the mail host refused the connection"));
    render(<Contact />);
    await fillIn();

    await userEvent.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Nothing was sent"));
    /* The one thing a reader cannot recover is the paragraph they just wrote. */
    expect(screen.getByLabelText("Name")).toHaveValue("Dana Levi");
    expect(screen.getByLabelText("Email")).toHaveValue("dana@example.com");
    expect(screen.getByLabelText("Message")).toHaveValue(
      "I read the note on sticky timelines and have a question about it."
    );
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("names the field that is wrong, in text, and sends nothing", async () => {
    render(<Contact />);

    await userEvent.type(screen.getByLabelText("Name"), "D");
    await userEvent.type(screen.getByLabelText("Email"), "not-an-address");
    await userEvent.click(screen.getByRole("button", { name: /send message/i }));

    expect(send).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Nothing was sent");

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
});
