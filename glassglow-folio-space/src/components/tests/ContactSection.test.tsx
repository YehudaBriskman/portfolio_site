import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { ContactSection } from "../ContactSection";
import { sendContactMessage } from "@/services/contact";

vi.mock("@/services/contact", () => ({
  sendContactMessage: vi
    .fn()
    .mockResolvedValue({ ok: true, messageId: "test-123" }),
}));

vi.mock("@/data/paragraphs", () => ({
  paragraphs: {
    contactUs: {
      title: "Contact Me",
      description: "Let’s talk about your project.",
      secondTitle: "Details",
      email: "yehuda@example.com",
      location: "Petah Tikva, Israel",
      current: "Available for freelance",
      explain: "I usually respond within 24 hours.",
    },
  },
}));

vi.mock("@/data/links", () => ({
  links: [
    { name: "GitHub", url: "https://github.com/yehuda", icon: "Github" },
    {
      name: "LinkedIn",
      url: "https://linkedin.com/in/yehuda",
      icon: "Linkedin",
    },
    { name: "X", url: "https://x.com/yehuda", icon: "Twitter" },
  ],
}));

describe("ContactSection", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders headings and description from paragraphs", () => {
    render(<ContactSection />);

    expect(
      screen.getByRole("heading", { name: /contact me/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/let’s talk about your project\./i)
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /details/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/yehuda@example\.com/i)).toBeInTheDocument();
    expect(screen.getByText(/petah tikva, israel/i)).toBeInTheDocument();

    expect(screen.getByText(/available for freelance/i)).toBeInTheDocument();
    expect(
      screen.getByText(/usually respond within 24 hours/i)
    ).toBeInTheDocument();
  });

  it("renders social links with correct hrefs", () => {
    render(<ContactSection />);

    const links = screen.getAllByRole("link");
    const github = links.find(
      (a) => a.getAttribute("href") === "https://github.com/yehuda"
    );
    const linkedin = links.find(
      (a) => a.getAttribute("href") === "https://linkedin.com/in/yehuda"
    );
    const x = links.find(
      (a) => a.getAttribute("href") === "https://x.com/yehuda"
    );

    expect(github).toBeTruthy();
    expect(linkedin).toBeTruthy();
    expect(x).toBeTruthy();

    [github!, linkedin!, x!].forEach((a) => {
      const svg = a.querySelector("svg");
      expect(svg).toBeTruthy();
    });
  });

  it("updates form fields on change", () => {
    render(<ContactSection />);

    const name = screen.getByLabelText(/name/i) as HTMLInputElement;
    const email = screen.getByLabelText(/email/i) as HTMLInputElement;
    const message = screen.getByLabelText(/message/i) as HTMLTextAreaElement;

    fireEvent.change(name, { target: { value: "Yehuda" } });
    fireEvent.change(email, { target: { value: "yehuda@example.com" } });
    fireEvent.change(message, { target: { value: "Build me a rocket." } });

    expect(name.value).toBe("Yehuda");
    expect(email.value).toBe("yehuda@example.com");
    expect(message.value).toBe("Build me a rocket.");
  });

  it("submits via service, shows success, and resets fields", async () => {
    render(<ContactSection />);

    const name = screen.getByLabelText(/name/i) as HTMLInputElement;
    const email = screen.getByLabelText(/email/i) as HTMLInputElement;
    const message = screen.getByLabelText(/message/i) as HTMLTextAreaElement;
    const submit = screen.getByRole("button", { name: /send message/i });

    fireEvent.change(name, { target: { value: "Yehuda" } });
    fireEvent.change(email, { target: { value: "yehuda@example.com" } });
    fireEvent.change(message, { target: { value: "Build me a rocket." } });

    fireEvent.click(submit);

    await waitFor(() =>
      expect(sendContactMessage).toHaveBeenCalledWith({
        name: "Yehuda",
        email: "yehuda@example.com",
        message: "Build me a rocket.",
      })
    );

    await screen.findByText(/Send! we'll responed later!/i);

    expect(name.value).toBe("");
    expect(email.value).toBe("");
    expect(message.value).toBe("");
  });

  it("shows error when service rejects and does not reset fields", async () => {
    (
      sendContactMessage as jest.MockedFunction<typeof sendContactMessage>
    ).mockRejectedValueOnce(new Error("Send failed: boom"));

    render(<ContactSection />);

    const name = screen.getByLabelText(/name/i) as HTMLInputElement;
    const email = screen.getByLabelText(/email/i) as HTMLInputElement;
    const message = screen.getByLabelText(/message/i) as HTMLTextAreaElement;
    const submit = screen.getByRole("button", { name: /send message/i });

    fireEvent.change(name, { target: { value: "Yehuda" } });
    fireEvent.change(email, { target: { value: "yehuda@example.com" } });
    fireEvent.change(message, { target: { value: "Build me a rocket." } });

    fireEvent.click(submit);

    await screen.findByText(/Send failed: boom|Error with sending Email/i);

    expect(name.value).toBe("Yehuda");
    expect(email.value).toBe("yehuda@example.com");
    expect(message.value).toBe("Build me a rocket.");
  });

  it("marks inputs as required", () => {
    render(<ContactSection />);

    expect(screen.getByLabelText(/name/i)).toBeRequired();
    expect(screen.getByLabelText(/email/i)).toBeRequired();
    expect(screen.getByLabelText(/message/i)).toBeRequired();
  });

  it("does not crash if an icon name is wrong (defensive)", async () => {
    vi.resetModules();

    vi.doMock("@/data/links", () => ({
      links: [
        { name: "Weird", url: "https://example.com", icon: "NotExistIcon" },
      ],
    }));

    const { ContactSection: SectionWithWeirdIcon } = await import(
      "../ContactSection"
    );

    expect(() => render(<SectionWithWeirdIcon />)).not.toThrow();
  });
});
