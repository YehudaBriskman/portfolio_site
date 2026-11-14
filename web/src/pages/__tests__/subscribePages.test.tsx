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
  document.documentElement.removeAttribute("lang");
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
    /* The done text says what is kept (a fingerprint, not the address) and gives the way to erase now. */
    const done = screen.getByRole("status").textContent ?? "";
    expect(done).toMatch(/one-way fingerprint/i);
    expect(done).toMatch(/deleted after 30 days/);
    expect(done).not.toMatch(/keep your address/i);
    expect(done).not.toContain("{email}");
    expect(screen.getByRole("link", { name: "yehuda@yehudabriskman.com" })).toHaveAttribute("dir", "ltr");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ token: "abc" });
  });

  it("the Hebrew done page names the fingerprint and the 30 days", async () => {
    document.documentElement.lang = "he";
    respond(200);
    at(<Unsubscribe />, "/unsubscribe?token=abc");
    await userEvent.click(screen.getByRole("button", { name: /הסירו אותי/ }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/טביעת אצבע/));
    expect(screen.getByRole("status").textContent).toMatch(/30 ימים/);
    document.documentElement.removeAttribute("lang");
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

describe("a transient failure is not an expired link", () => {
  const offline = () => {
    fetchMock.mockImplementation(async () => {
      throw new TypeError("Failed to fetch");
    });
    vi.stubGlobal("fetch", fetchMock);
  };
  const manageBody = { ok: true, email: "a***@e***.com", lang: "en", topics: { blog: true, releases: true }, status: "active" };

  it("B16 unsubscribe: a network failure says the server could not be reached, keeps a retry, and prints no token", async () => {
    offline();
    at(<Unsubscribe />, "/unsubscribe?token=secret-token");
    await userEvent.click(screen.getByRole("button", { name: /unsubscribe me/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("alert").textContent).toMatch(/could not reach the server/i);
    expect(screen.getByRole("alert").textContent).not.toMatch(/invalid or has expired/i);
    const retry = screen.getByRole("button", { name: /try again/i });
    expect(retry).toHaveFocus();
    expect(document.body.textContent).not.toContain("secret-token");
    respond(200);
    await userEvent.click(retry);
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/won.t get any more email/i));
  });

  it("B16 unsubscribe: a 4xx is still an invalid link, with no retry", async () => {
    respond(400, { ok: false });
    at(<Unsubscribe />, "/unsubscribe?token=abc");
    await userEvent.click(screen.getByRole("button", { name: /unsubscribe me/i }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/invalid or has expired/i));
    expect(screen.queryByRole("button", { name: /try again|unsubscribe me/i })).toBeNull();
  });

  it("B17 confirm: a 503 keeps a retry and does not claim the link expired", async () => {
    respond(503, { ok: false });
    at(<SubscribeConfirm />, "/subscribe/confirm?token=abc");
    await userEvent.click(screen.getByRole("button", { name: /confirm my subscription/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("alert").textContent).toMatch(/could not reach the server/i);
    expect(screen.getByRole("alert").textContent).not.toMatch(/invalid or has expired/i);
    expect(screen.getByRole("button", { name: /try again/i })).toHaveFocus();
    respond(200, { ok: true, lang: "en" });
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/subscribed/i));
  });

  it("B17 confirm: the Hebrew failure is Hebrew", async () => {
    document.documentElement.lang = "he";
    offline();
    at(<SubscribeConfirm />, "/subscribe/confirm?token=abc");
    await userEvent.click(screen.getByRole("button", { name: /אישור ההרשמה/ }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/לשרת/));
    expect(screen.getByRole("button", { name: /ניסיון נוסף/ })).toBeInTheDocument();
    document.documentElement.removeAttribute("lang");
  });

  it("B18 manage: a failed save keeps the form and the edits, and shows a save error", async () => {
    let puts = 0;
    fetchMock.mockImplementation(async (_u: string, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "GET") return new Response(JSON.stringify(manageBody), { status: 200 });
      puts++;
      return new Response(JSON.stringify({ ok: false }), { status: 503 });
    });
    vi.stubGlobal("fetch", fetchMock);
    at(<SubscribeManage />, "/subscribe/manage?token=abc");
    await screen.findByText("a***@e***.com");
    await userEvent.click(screen.getByLabelText(/releases/i));
    await userEvent.click(screen.getByRole("button", { name: /save preferences/i }));
    await waitFor(() => expect(puts).toBe(1));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/could not save/i));
    expect(screen.getByRole("alert").textContent).not.toMatch(/invalid or has expired/i);
    expect(screen.getByLabelText(/releases/i)).not.toBeChecked();
    expect(screen.getByRole("button", { name: /save preferences/i })).toBeEnabled();
  });

  it("B18 manage: a 4xx on save (the token went bad) is the invalid link", async () => {
    fetchMock.mockImplementation(async (_u: string, init?: RequestInit) =>
      (init?.method ?? "GET") === "GET" ? new Response(JSON.stringify(manageBody)) : new Response("{}", { status: 400 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    at(<SubscribeManage />, "/subscribe/manage?token=abc");
    await userEvent.click(await screen.findByRole("button", { name: /save preferences/i }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/invalid or has expired/i));
  });

  it("B18 manage: failing to load is retryable, not an expired link", async () => {
    offline();
    at(<SubscribeManage />, "/subscribe/manage?token=abc");
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/could not reach the server/i));
    fetchMock.mockImplementation(async () => new Response(JSON.stringify(manageBody)));
    await userEvent.click(screen.getByRole("button", { name: /try again/i }));
    await screen.findByText("a***@e***.com");
  });
});

describe("manage: topics", () => {
  const prefs = { ok: true, email: "d***@example.com", lang: "en", topics: { blog: true, releases: false }, status: "active" };
  const load = () => {
    fetchMock.mockImplementation(async (_u: string, init?: RequestInit) => new Response(JSON.stringify(init?.method === "PUT" ? { ok: true } : prefs), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  };

  it("refuses to save with both topics off, says why in an alert, and points at Unsubscribe", async () => {
    load();
    at(<SubscribeManage />, "/subscribe/manage?token=abcdefghijk");
    await userEvent.click(await screen.findByRole("checkbox", { name: /new notes/i }));
    await userEvent.click(screen.getByRole("button", { name: /save/i }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/choose at least one/i);
    expect(fetchMock.mock.calls.filter((c) => c[1]?.method === "PUT")).toHaveLength(0);
    expect(alert).toHaveFocus();
    expect(screen.getByRole("link", { name: /unsubscribe/i })).toBeInTheDocument();
  });

  it("saves once a topic is ticked again, and moves focus to the 'Saved.' status", async () => {
    load();
    at(<SubscribeManage />, "/subscribe/manage?token=abcdefghijk");
    await userEvent.click(await screen.findByRole("checkbox", { name: /new notes/i }));
    await userEvent.click(screen.getByRole("button", { name: /save/i }));
    await userEvent.click(screen.getByRole("checkbox", { name: /releases/i }));
    await userEvent.click(screen.getByRole("button", { name: /save/i }));
    const status = await screen.findByRole("status");
    await waitFor(() => expect(status.textContent).toMatch(/saved/i));
    expect(status).toHaveFocus();
    expect(fetchMock.mock.calls.filter((c) => c[1]?.method === "PUT")).toHaveLength(1);
  });
});

describe("focus after the action", () => {
  it("confirm: focus lands on the result when the button goes away", async () => {
    respond(200, { ok: true, lang: "en" });
    at(<SubscribeConfirm />, "/subscribe/confirm?token=abc");
    await userEvent.click(screen.getByRole("button", { name: /confirm my subscription/i }));
    const status = await screen.findByRole("status");
    await waitFor(() => expect(status.textContent).toMatch(/subscribed/i));
    expect(status).toHaveFocus();
  });

  it("unsubscribe: focus lands on the result when the button goes away", async () => {
    respond(200);
    at(<Unsubscribe />, "/unsubscribe?token=abc");
    await userEvent.click(screen.getByRole("button", { name: /unsubscribe me/i }));
    const status = await screen.findByRole("status");
    await waitFor(() => expect(status.textContent).toMatch(/won.t get any more email/i));
    expect(status).toHaveFocus();
  });

  it("a dead link after the click puts focus on the alert, not on body", async () => {
    respond(400, { ok: false });
    at(<Unsubscribe />, "/unsubscribe?token=abc");
    await userEvent.click(screen.getByRole("button", { name: /unsubscribe me/i }));
    expect(await screen.findByRole("alert")).toHaveFocus();
  });

  it("opening a page with no token does not steal focus", () => {
    respond(200);
    at(<Unsubscribe />, "/unsubscribe");
    expect(document.body).toHaveFocus();
  });
});
