import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, SiteSettingsSchema } from "./site-settings.js";

describe("SiteSettingsSchema sharing group", () => {
  it("reads a stored document without `sharing` as the defaults", () => {
    const { sharing: _s, ...old } = DEFAULT_SETTINGS;
    const parsed = SiteSettingsSchema.safeParse(old);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.sharing).toEqual(DEFAULT_SETTINGS.sharing);
  });

  it("rejects duplicates, long templates and markup", () => {
    const at = (patch: object) => SiteSettingsSchema.safeParse({ ...DEFAULT_SETTINGS, sharing: { ...DEFAULT_SETTINGS.sharing, ...patch } }).success;
    expect(at({ channels: ["copy", "copy"] })).toBe(false);
    expect(at({ templates: { en: { x: "a".repeat(1001) }, he: {} } })).toBe(false);
    expect(at({ templates: { en: {}, he: { gmail: "<img src=x>" } } })).toBe(false);
    expect(at({ templates: { en: { x: "{title} {url}" }, he: {} } })).toBe(true);
  });
});
