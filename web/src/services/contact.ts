import { z } from "zod";

/*
 * Exported so the form can ask the same question this function will ask.
 *
 * Not a second copy of the rules in the component: a field-level error needs
 * `flatten().fieldErrors`, which only the schema can produce, and the
 * alternative — re-stating "at least two characters, at least a sentence" in
 * Contact.tsx — is two validators that drift apart and then disagree with each
 * other in front of the reader. `sendContactMessage` still parses what it is
 * handed; the form's parse is for the message, not for the trust.
 */
export const ContactSchema = z.object({
  name: z.string().min(2, "Add your name"),
  /* The shape is spelled out, not only rejected (WCAG 3.3.3, #99 audit): when
     the fix is known the message has to say what it is, and "doesn't look
     right" alone left the reader guessing which part was wrong. */
  email: z.string().email("That email address doesn't look right. It should look like name@example.com"),
  message: z.string().min(10, "Tell me a little more, at least a sentence"),
});

export type ContactPayload = z.infer<typeof ContactSchema>;

/** `website` is the honeypot field's value: empty for a person, the server drops the message otherwise. */
export async function sendContactMessage(data: ContactPayload, website = "") {
  const parsed = ContactSchema.safeParse(data);
  if (!parsed.success) {
    const errs = parsed.error.flatten().fieldErrors;
    throw new Error(Object.values(errs).flat().join(" · ") || "Check the form");
  }

  const res = await fetch("/api/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subject: `Portfolio contact from ${data.name}`,
      replyTo: data.email,
      ...(website ? { website } : {}),
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
