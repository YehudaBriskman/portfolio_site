import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { slugify } from "@/services/admin";
import { formatDate } from "@/services/blog";
import { useFocusField } from "@/components/admin/content/focusField";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe("slugify", () => {
  it("never leaves an edge hyphen or an underscore", () => {
    expect(slugify("Notes -")).toBe("notes");
    expect(slugify("- a_b c -")).toBe("ab-c");
    expect(slugify(`${"a".repeat(79)} b`)).toMatch(SLUG);
  });
  it("gives an empty string where nothing survives, rather than a bad slug", () => {
    expect(slugify("שלום עולם")).toBe("");
  });
});

describe("formatDate", () => {
  it("returns an empty string for an unparsable timestamp", () => {
    expect(formatDate("not a date")).toBe("");
  });
});

describe("useFocusField", () => {
  it("does not throw on a malformed %-escape in the hash", () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(MemoryRouter, { initialEntries: ["/x#field=%E0"] }, children);
    expect(() => renderHook(() => useFocusField({ a: 1 }), { wrapper })).not.toThrow();
  });
});
