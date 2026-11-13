import { describe, expect, it } from "vitest";
import { PENDING_TTL_DAYS_LIMIT, PENDING_TTL_DAYS_MIN, validateSenderPending } from "./schemas.js";

describe("validateSenderPending", () => {
  it("names the real minimum and maximum in its message", () => {
    const [issue] = validateSenderPending({ pendingTtlDays: 1 });
    expect(issue.message).toContain(`from ${PENDING_TTL_DAYS_MIN} to ${PENDING_TTL_DAYS_LIMIT}`);
  });
  it("accepts the bounds", () => {
    expect(validateSenderPending({ pendingTtlDays: PENDING_TTL_DAYS_MIN })).toEqual([]);
    expect(validateSenderPending({ pendingTtlDays: PENDING_TTL_DAYS_LIMIT })).toEqual([]);
  });
});
