import { describe, expect, it } from "vitest";
import { adminHostHref } from "@/lib/adminHost";

/* The public host has no sign-in: every /api/admin call there is a 401. /admin belongs on the gated host. */
describe("adminHostHref", () => {
  const at = (hostname: string, pathname = "/admin", search = "", hash = "") => ({ hostname, pathname, search, hash });

  it("sends the public site's admin to the gated host, keeping the page", () => {
    expect(adminHostHref(at("yehudabriskman.com"))).toBe("https://admin.yehudabriskman.com/admin");
    expect(adminHostHref(at("www.yehudabriskman.com", "/admin/posts/a", "?x=1", "#y"))).toBe("https://admin.yehudabriskman.com/admin/posts/a?x=1#y");
  });

  it("leaves every other host where it is", () => {
    for (const host of ["admin.yehudabriskman.com", "preprod.yehudabriskman.com", "localhost", "notyehudabriskman.com"]) {
      expect(adminHostHref(at(host))).toBeNull();
    }
  });
});
