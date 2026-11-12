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
  it("confirm calls the API once with the token and says it is done", async () => {
    respond(200, { ok: true, lang: "en" });
    at(<SubscribeConfirm />, "/subscribe/confirm?token=abc");
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/subscribed/i));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/subscribe/confirm?token=abc");
  });

  it("confirm with a bad token is an alert that says what to do, and prints no token", async () => {
    respond(400, { ok: false });
    at(<SubscribeConfirm />, "/subscribe/confirm?token=secret-token");
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
