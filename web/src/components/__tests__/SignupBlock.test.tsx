import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import SignupBlock from "@/components/SignupBlock";

/* The network is the only thing replaced: the form, its words and the service
   that shapes the request are the real ones. */
const fetchMock = vi.fn();
afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

function setup(res: () => Response | Promise<Response>) {
  fetchMock.mockImplementation(async () => res());
  vi.stubGlobal("fetch", fetchMock);
  return render(
    <MemoryRouter>
      <SignupBlock />
    </MemoryRouter>,
  );
}
const ok = () => new Response(JSON.stringify({ ok: true }), { status: 202 });

describe("SignupBlock", () => {
  it("posts the address, the topics and an empty honeypot, and says to check the inbox", async () => {
    setup(ok);
    await userEvent.type(screen.getByLabelText(/^email/i), "  a@example.com ");
    await userEvent.click(screen.getByLabelText(/releases/i));
    await userEvent.click(screen.getByRole("button", { name: /subscribe/i }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/check your inbox/i));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/subscribe");
    expect(JSON.parse(init.body)).toEqual({ email: "a@example.com", lang: "en", topics: { blog: true, releases: true }, website: "" });
  });

  it("does not send a bad address, and names the field", async () => {
    setup(ok);
    await userEvent.type(screen.getByLabelText(/^email/i), "nope");
    await userEvent.click(screen.getByRole("button", { name: /subscribe/i }));
    expect(fetchMock).not.toHaveBeenCalled();
    const field = screen.getByLabelText(/^email/i);
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(document.getElementById(field.getAttribute("aria-describedby")!)!.textContent).toMatch(/doesn.t look right/i);
  });

  it("needs at least one topic", async () => {
    setup(ok);
    await userEvent.type(screen.getByLabelText(/^email/i), "a@example.com");
    await userEvent.click(screen.getByLabelText(/new notes/i));
    await userEvent.click(screen.getByRole("button", { name: /subscribe/i }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/choose at least one/i)).toBeInTheDocument();
  });

  it("keeps what was typed on a failure and says what to do", async () => {
    setup(() => new Response("{}", { status: 429 }));
    await userEvent.type(screen.getByLabelText(/^email/i), "a@example.com");
    await userEvent.click(screen.getByRole("button", { name: /subscribe/i }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/too many attempts/i));
    expect(screen.getByLabelText(/^email/i)).toHaveValue("a@example.com");
  });

  it("links the consent sentence to the privacy section, and has a hidden honeypot named website", () => {
    setup(ok);
    expect(screen.getByRole("link", { name: /how I handle your data/i })).toHaveAttribute("href", "/privacy");
    const trap = document.querySelector('input[name="website"]') as HTMLInputElement;
    expect(trap.tabIndex).toBe(-1);
    expect(trap.closest("[aria-hidden='true']")).not.toBeNull();
  });

  it("says plainly that this is a newsletter, in the lede and in the consent sentence", () => {
    setup(ok);
    expect(document.body.textContent).toMatch(/my newsletter by email: new notes and releases/i);
    expect(document.body.textContent).toMatch(/By subscribing you agree to receive my newsletter by email/);
  });

  it("renders its status region before anything has happened, so nothing moves later", () => {
    setup(ok);
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("");
  });
});

describe("SignupBlock: focus and announcements", () => {
  it("the topic error takes focus and is an alert", async () => {
    setup(ok);
    await userEvent.type(screen.getByLabelText(/^email/i), "a@example.com");
    await userEvent.click(screen.getByLabelText(/new notes/i));
    await userEvent.click(screen.getByRole("button", { name: /subscribe/i }));
    const err = screen.getByText(/choose at least one/i);
    expect(err).toHaveAttribute("role", "alert");
    expect(err).toHaveFocus();
  });

  it("the email error is an alert too, and the field keeps the focus", async () => {
    setup(ok);
    await userEvent.type(screen.getByLabelText(/^email/i), "nope");
    await userEvent.click(screen.getByRole("button", { name: /subscribe/i }));
    expect(screen.getByText(/doesn.t look right/i)).toHaveAttribute("role", "alert");
    expect(screen.getByLabelText(/^email/i)).toHaveFocus();
  });

  it("the alert slots exist before any error, so a live region is there to announce into", () => {
    setup(ok);
    expect(document.querySelectorAll("[data-signup] [role=alert]")).toHaveLength(2);
  });

  it("the Subscribe button keeps focus while sending and after the answer", async () => {
    setup(ok);
    await userEvent.type(screen.getByLabelText(/^email/i), "a@example.com");
    const btn = screen.getByRole("button", { name: /subscribe/i });
    await userEvent.click(btn);
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/check your inbox/i));
    expect(btn).toHaveFocus();
  });
});
