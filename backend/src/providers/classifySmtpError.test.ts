import { describe, expect, it } from "vitest";
import { classifySmtpError } from "./classifySmtpError.js";

/* The first four are captured from nodemailer 10 against a loopback server; the rest follow the same shape. */
const shape = (code: string, responseCode: number | undefined, response: string, command = "RCPT TO") => {
  const e = new Error(`Can't send mail: ${response}`) as Error & Record<string, unknown>;
  e.code = code;
  if (responseCode !== undefined) e.responseCode = responseCode;
  e.response = response;
  e.command = command;
  return e;
};
const net = (code: string) => Object.assign(new Error(`${code} smtp.example.com`), { code, command: "CONN" });

describe("classifySmtpError", () => {
  it.each([
    ["550 5.1.1 unknown user", shape("EENVELOPE", 550, "550 5.1.1 <a@b.c> no such user"), "hard", 550],
    ["452 4.2.2 mailbox full", shape("EENVELOPE", 452, "452 4.2.2 mailbox full"), "soft", 452],
    ["550 5.7.1 blocked is policy, not the address", shape("EENVELOPE", 550, "550 5.7.1 blocked"), "policy", 550],
    ["535 bad login", shape("EAUTH", 535, "535 5.7.8 bad creds", "AUTH PLAIN"), "auth", 535],
    ["553 mailbox name not allowed", shape("EENVELOPE", 553, "553 5.1.3 invalid address"), "hard", 553],
    ["551 user not local, no enhanced code", shape("EENVELOPE", 551, "551 user not local"), "hard", 551],
    ["550 without enhanced code naming the mailbox", shape("EENVELOPE", 550, "550 Requested action not taken: mailbox unavailable"), "hard", 550],
    ["550 without enhanced code, a spam block", shape("EENVELOPE", 550, "550 Message rejected as spam"), "policy", 550],
    ["5.1.8 bad sender is ours, not theirs", shape("EENVELOPE", 550, "550 5.1.8 Sender address rejected"), "policy", 550],
    ["5.2.1 account disabled", shape("EENVELOPE", 550, "550 5.2.1 The email account has been disabled"), "hard", 550],
    ["5.2.2 over quota", shape("EENVELOPE", 552, "552 5.2.2 Over quota"), "soft", 552],
    ["554 transaction failed", shape("EMESSAGE", 554, "554 Transaction failed"), "policy", 554],
    ["421 service not available", shape("ECONNECTION", 421, "421 4.7.0 Try again later", "CONN"), "transient", 421],
    ["451 greylisted", shape("EENVELOPE", 451, "451 4.7.1 Greylisted"), "transient", 451],
    ["450 mailbox busy", shape("EENVELOPE", 450, "450 4.3.2 busy"), "transient", 450],
    ["454 temporary auth failure is a login problem", shape("EAUTH", 454, "454 4.7.0 Temporary authentication failure", "AUTH PLAIN"), "auth", 454],
  ])("%s", (_n, err, kind, code) => {
    expect(classifySmtpError(err)).toEqual({ kind, code });
  });

  it.each(["ETIMEDOUT", "ECONNECTION", "ESOCKET", "ECONNRESET", "EDNS"])("%s is transient, with no code", (c) => {
    expect(classifySmtpError(net(c))).toEqual({ kind: "transient" });
  });

  it("reads a code out of the reply text when responseCode is missing", () => {
    expect(classifySmtpError({ response: "550 5.1.1 no such user" })).toEqual({ kind: "hard", code: 550 });
  });

  it("is unknown for anything else, and never throws", () => {
    for (const x of [new Error("boom"), "boom", null, undefined, 7, { code: "ETLS" }]) expect(classifySmtpError(x)).toEqual({ kind: "unknown" });
  });

  it("never returns the message or the address", () => {
    expect(JSON.stringify(classifySmtpError(shape("EENVELOPE", 550, "550 5.1.1 <someone@example.com> no such user")))).not.toContain("example.com");
  });
});
