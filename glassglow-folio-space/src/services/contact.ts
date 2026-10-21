import { z } from "zod";
import { contact } from "@/data/site";

const ContactSchema = z.object({
  name: z.string().min(2, "Add your name"),
  email: z.string().email("That email address doesn't look right"),
  message: z.string().min(10, "Tell me a little more, at least a sentence"),
});

export type ContactPayload = z.infer<typeof ContactSchema>;

/* Was process.env, which is undefined in the browser and threw before the
   request was ever made. Vite inlines import.meta.env; the fallback is the
   address published on this page anyway. */
const CONTACT_TO = import.meta.env.VITE_CONTACT_TO ?? contact.email;

export async function sendContactMessage(data: ContactPayload) {
  const parsed = ContactSchema.safeParse(data);
  if (!parsed.success) {
    const errs = parsed.error.flatten().fieldErrors;
    throw new Error(Object.values(errs).flat().join(" · ") || "Check the form");
  }

  const res = await fetch("/api/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "smtp",
      to: CONTACT_TO,
      subject: `Portfolio contact from ${data.name}`,
      replyTo: data.email,
      template: {
        name: "basic",
        params: {
          title: `New message from ${data.name}`,
          body: [`Name: ${data.name}`, `Email: ${data.email}`, "", data.message].join("\n"),
        },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.formErrors?.[0] ?? `Couldn't send that (HTTP ${res.status})`);
  }
  return true;
}
