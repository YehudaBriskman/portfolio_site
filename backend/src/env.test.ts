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

describe("env PORT and SMTP", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });
  async function load() {
    vi.resetModules();
    return (await import("./env")).env;
  }

  it("defaults PORT to 5000, the port the image and compose files use", async () => {
    vi.stubEnv("PORT", "");
    delete process.env.PORT;
    expect((await load()).PORT).toBe(5000);
  });

  it("defaults SMTP_PORT to 587 in the schema", async () => {
    delete process.env.SMTP_PORT;
    expect((await load()).SMTP_PORT).toBe(587);
  });

  it("rejects an SMTP_SECURE that is not true or false", async () => {
    vi.stubEnv("SMTP_SECURE", "TRUE");
    await expect(load()).rejects.toThrow();
  });
});
