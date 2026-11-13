import { describe, expect, it } from "vitest";
import { defs } from "@/components/ui/filters.fixtures";
import { filterCount, parseFilters, writeFilters, type Filters } from "@/components/ui/filters";

const parse = (qs: string) => parseFilters(defs, new URLSearchParams(qs));

describe("filterCount", () => {
  it("counts one per active filter, a multi or a range as one, and never the sort", () => {
    const v: Filters = { status: "pending", group: ["a", "b"], created: { from: "2026-01-01" }, sort: "name" };
    expect(filterCount(defs, v)).toBe(3);
  });
  it("ignores empty values", () => {
    expect(filterCount(defs, { status: "", group: [], created: {} })).toBe(0);
  });
});

describe("parseFilters", () => {
  it("reads every kind from the query", () => {
    expect(parse("status=pending&group=a&group=c&createdFrom=2026-01-01&createdTo=2026-02-01&sort=name")).toEqual({
      status: "pending",
      group: ["a", "c"],
      created: { from: "2026-01-01", to: "2026-02-01" },
      sort: "name",
    });
  });
  it("drops what the definitions do not offer", () => {
    expect(parse("status=nope&group=zzz&createdFrom=yesterday&sort=weird&other=1")).toEqual({});
  });
  it("puts a swapped range the right way round", () => {
    expect(parse("createdFrom=2026-03-01&createdTo=2026-02-01").created).toEqual({ from: "2026-02-01", to: "2026-03-01" });
  });
});

describe("writeFilters", () => {
  it("leaves other params alone and never writes defaults", () => {
    const next = writeFilters(defs, new URLSearchParams("tab=audience&status=bounced"), { sort: "new", group: [] });
    expect(next.toString()).toBe("tab=audience");
  });
  it("writes a value, a multi as repeated params and a range as two", () => {
    const next = writeFilters(defs, new URLSearchParams("tab=x"), {
      status: "active",
      group: ["a", "b"],
      created: { from: "2026-01-01", to: "2026-02-01" },
      sort: "name",
    });
    expect(next.get("tab")).toBe("x");
    expect(next.getAll("group")).toEqual(["a", "b"]);
    expect(next.get("createdFrom")).toBe("2026-01-01");
    expect(next.get("createdTo")).toBe("2026-02-01");
    expect(next.get("sort")).toBe("name");
  });
  it("round-trips", () => {
    const v: Filters = { status: "active", group: ["b"], created: { from: "2026-01-01" }, sort: "name" };
    expect(parseFilters(defs, writeFilters(defs, new URLSearchParams(), v))).toEqual(v);
  });
});
