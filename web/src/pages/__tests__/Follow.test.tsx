import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Follow from "@/pages/Follow";

afterEach(() => document.documentElement.removeAttribute("lang"));
const show = () =>
  render(
    <MemoryRouter initialEntries={["/follow"]}>
      <Follow />
    </MemoryRouter>,
  );

describe("/follow", () => {
  it("says the newsletter once: no intro paragraph, the card states the email newsletter", () => {
    show();
    expect(screen.queryByText(/no feed of followers/i)).toBeNull();
    const card = screen.getByRole("region", { name: "Follow along" });
    expect(card.textContent).toMatch(/newsletter by email/i);
    expect(card.querySelector("p")?.textContent).toMatch(/newsletter by email/i);
  });

  it("the card heading does not repeat the h1 on screen but stays in the outline", () => {
    show();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Follow");
    const h2 = screen.getByRole("heading", { level: 2, name: "Follow along" });
    expect(h2.className).toMatch(/sr-only/);
  });

  it("Hebrew: no intro, card says it is an email newsletter", () => {
    document.documentElement.lang = "he";
    show();
    expect(screen.queryByText(/אין עוקבים/)).toBeNull();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("מעקב");
    expect(screen.getByRole("region", { name: "להישאר מעודכנים" }).textContent).toMatch(/העלון שלי באימייל/);
  });
});
