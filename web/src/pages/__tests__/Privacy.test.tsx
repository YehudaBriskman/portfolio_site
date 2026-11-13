import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Privacy from "@/pages/Privacy";

afterEach(() => document.documentElement.removeAttribute("lang"));

const show = (lang: "en" | "he") => {
  document.documentElement.lang = lang;
  return render(
    <MemoryRouter initialEntries={["/privacy"]}>
      <Privacy />
    </MemoryRouter>,
  );
};

describe("the privacy page (#586)", () => {
  it("names the three providers, in Latin letters, in both languages", () => {
    for (const lang of ["en", "he"] as const) {
      const { unmount } = show(lang);
      for (const name of ["Oracle Cloud", "Resend", "Cloudflare", "Google"]) expect(screen.getByText(name)).toBeInTheDocument();
      unmount();
    }
  });

  it("has one h1, a visible last-updated date and a way to ask, in English", () => {
    show("en");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText(/^Last updated \d{1,2} \w+ \d{4}$/)).toBeInTheDocument();
    expect(document.querySelector('a[href^="mailto:"]')).not.toBeNull();
    expect(screen.getByText(/No cookies/)).toBeInTheDocument();
  });

  it("is written in Hebrew with its date", () => {
    show("he");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/[֐-׿]/);
    expect(screen.getByText(/^עודכן לאחרונה ב/)).toBeInTheDocument();
    expect(screen.getAllByText(/אין עוגיות/).length).toBeGreaterThan(0);
  });

  it("the Leaving section says what is kept and for how long, in both languages", () => {
    for (const [lang, a, b, c] of [["en", /one-way fingerprint/, /30 days after you unsubscribe/, /14 more days/], ["he", /טביעת אצבע/, /30 ימים אחרי ההסרה/, /14 ימים נוספים/]] as const) {
      const { container, unmount } = show(lang);
      const text = container.textContent ?? "";
      for (const re of [a, b, c]) expect(text).toMatch(re);
      expect(text).not.toMatch(/I keep your address|אני שומר את הכתובת/);
      unmount();
    }
  });

  it("links back to the sign-up form", () => {
    show("en");
    expect(screen.getByRole("link", { name: /sign-up form/i })).toHaveAttribute("href", "/follow");
  });
});
