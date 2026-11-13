import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import SubscribeConfirm from "@/pages/SubscribeConfirm";
import Unsubscribe from "@/pages/Unsubscribe";
import SubscribeManage from "@/pages/SubscribeManage";

const fetchMock = vi.fn();
afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});
const at = (ui: ReactElement, url: string) => render(<MemoryRouter initialEntries={[url]}>{ui}</MemoryRouter>);
const respond = (status: number, body: unknown = { ok: true }) => {
  fetchMock.mockImplementation(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
};

describe("the pages an email links to", () => {
  it("confirm waits for a click, so a mail scanner opening the link subscribes no one", async () => {
    respond(200, { ok: true, lang: "en" });
    at(<SubscribeConfirm />, "/subscribe/confirm?token=abc");
    await new Promise((r) => setTimeout(r, 30));
    expect(fetchMock).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /confirm my subscription/i }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/subscribed/i));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // the token travels in a POST body, not in a URL that a log would keep
    expect(fetchMock.mock.calls[0][0]).toBe("/api/subscribe/confirm");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ token: "abc" });
  });

  it("confirm with a bad token is an alert that says what to do, and prints no token", async () => {
    respond(400, { ok: false });
    at(<SubscribeConfirm />, "/subscribe/confirm?token=secret-token");
    await userEvent.click(screen.getByRole("button", { name: /confirm my subscription/i }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/invalid or has expired/i));
    expect(document.body.textContent).not.toContain("secret-token");
  });

  it("confirm with no token never calls the API", () => {
    respond(200);
    at(<SubscribeConfirm />, "/subscribe/confirm");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("unsubscribe waits for a click, so a mail scanner opening the link changes nothing", async () => {
    respond(200);
    at(<Unsubscribe />, "/unsubscribe?token=abc");
    expect(fetchMock).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /unsubscribe me/i }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/won.t get any more email/i));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ token: "abc" });
  });

  it("unsubscribe with no token names the contact address as a mailto link, never a raw {email}", () => {
    respond(200);
    at(<Unsubscribe />, "/unsubscribe");
    const link = screen.getByRole("link", { name: "yehuda@yehudabriskman.com" });
    expect(link).toHaveAttribute("href", "mailto:yehuda@yehudabriskman.com");
    expect(link).toHaveAttribute("dir", "ltr");
    expect(document.body.textContent).not.toContain("{email}");
  });

  it("the confirm page says it is the newsletter being confirmed", () => {
    respond(200);
    at(<SubscribeConfirm />, "/subscribe/confirm?token=abc");
    expect(document.body.textContent).toMatch(/receive my newsletter/i);
  });

  it("manage loads the masked address, saves changed topics", async () => {
    respond(200, { email: "a***@example.com", lang: "en", topics: { blog: true, releases: false }, status: "active" });
    at(<SubscribeManage />, "/subscribe/manage?token=abc");
    await screen.findByText("a***@example.com");
    await userEvent.click(screen.getByLabelText(/releases/i));
    await userEvent.click(screen.getByRole("button", { name: /save preferences/i }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/saved/i));
    const put = fetchMock.mock.calls.find((c) => c[1]?.method === "PUT")!;
    expect(JSON.parse(put[1].body)).toEqual({ token: "abc", lang: "en", topics: { blog: true, releases: true } });
  });
});
