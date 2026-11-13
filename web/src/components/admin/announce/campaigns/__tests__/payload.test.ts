import { describe, expect, it } from "vitest";
import { createPayload, toInput, type Form } from "../helpers";

const form: Form = { name: "", subject: "Hello", preheader: "", bodyText: "Hi", useBlocks: false, blocks: [], groups: ["subscribers"], lang: "all", topic: "" };

/* The same literal is posted to the real routes in backend/src/campaigns/campaigns.test.ts ("the composer's payload with blocks off"). */
describe("the composer's payload with blocks off", () => {
  it("a create carries no null: the create schema only accepts an absent blocks/topic", () => {
    const p = createPayload(toInput(form));
    expect(p).toEqual({ name: "Hello", subject: "Hello", preheader: "", bodyText: "Hi", groups: ["subscribers"], lang: "all" });
    expect("blocks" in p).toBe(false);
    expect("topic" in p).toBe(false);
  });
  it("an update keeps null, which is how the server clears blocks and topic", () => {
    const p = toInput(form);
    expect(p.blocks).toBeNull();
    expect(p.topic).toBeNull();
  });
  it("blocks and topic are kept when set", () => {
    const p = createPayload(toInput({ ...form, useBlocks: true, blocks: [{ type: "p", text: "x" }], topic: "blog" }));
    expect(p.blocks).toEqual([{ type: "p", text: "x" }]);
    expect(p.topic).toBe("blog");
  });
});
