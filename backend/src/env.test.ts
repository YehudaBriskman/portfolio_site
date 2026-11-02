/*
 * BUILD_SHA is echoed by /health, so what it may carry is decided here and
 * not by whatever a build happened to pass in (#200).
 */
describe("env.BUILD_SHA", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function load(value?: string) {
    if (value !== undefined) vi.stubEnv("BUILD_SHA", value);
    vi.resetModules();
    return (await import("./env")).env.BUILD_SHA;
  }

  it("is `dev` when no build passed one", async () => {
    expect(await load()).toBe("dev");
  });

  it("keeps a full commit sha as given", async () => {
    const sha = "0123456789abcdef0123456789abcdef01234567";
    expect(await load(sha)).toBe(sha);
  });

  it("reads anything that is not a hex sha as `dev`", async () => {
    expect(await load('"><script>alert(1)</script>')).toBe("dev");
    expect(await load("v1.2.0")).toBe("dev");
    expect(await load("")).toBe("dev");
  });
});
