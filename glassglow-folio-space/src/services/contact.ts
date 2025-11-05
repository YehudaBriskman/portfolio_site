// src/services/contact.ts
import { z } from "zod";

const ContactSchema = z.object({
  name: z.string().min(2, "שם קצר מדי"),
  email: z.string().email("אימייל לא תקין"),
  message: z.string().min(10, "תן קצת בשר, לא טלגרמה")
});

export type ContactPayload = z.infer<typeof ContactSchema>;

const API_BASE = "/api/email/"
export async function sendContactMessage(data: ContactPayload) {
  const parsed = ContactSchema.safeParse(data);
  if (!parsed.success) {
    const errs = parsed.error.flatten().fieldErrors;
    const msg = Object.values(errs).flat().join(" · ") || "Invalid form";
    throw new Error(msg);
  }

  const title = `New contact from ${data.name}`;
  const body  = [
    `Name: ${data.name}`,
    `Email: ${data.email}`,
    "",
    data.message
  ].join("\n");

  const payload = {
    provider: "smtp" as const,
    to: process.env.CONTACT_TO ?? "yehudabriskman@gmail.com",
    subject: `Portfolio contact – ${data.name}`,
    replyTo: data.email,
    template: {
      name: "basic" as const,
      params: {
        title,
        body
      }
    }
  };

  const res = await fetch(`${API_BASE}send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok || !json?.ok) {
    const err = json?.error ? String(json.error) : `HTTP ${res.status}`;
    throw new Error(`Send failed: ${err}`);
  }
  return json as { ok: true; messageId: string };
}
