import { renderBasicTemplate } from "./basic.js";

describe("renderBasicTemplate", () => {
  it("escapes markup in the body, title, button text and link", () => {
    const { html } = renderBasicTemplate({
      title: "<b>t</b>",
      body: `<img src=x onerror="1"> & more`,
      ctaText: "<i>go</i>",
      ctaHref: `https://example.invalid/?a="x"&b=<y>`,
    });
    expect(html).not.toMatch(/<img|<b>|<i>|"x"/);
    expect(html).toContain("&lt;img");
    expect(html).toContain("&amp; more");
    expect(html).toContain("&quot;x&quot;");
  });
});
