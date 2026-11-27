import { describe, expect, it } from "vitest";
import { envWarnings } from "./envWarnings.js";

const SECRET = "s".repeat(32);
const ok = {
  NODE_ENV: "production",
  ADMIN_PROXY_SECRET: SECRET,
  COUCHDB_PASSWORD: "set",
  MCP_REMOTE: "on",
  ADMIN_GITHUB_ID: "1",
} as const;

describe("startup warnings", () => {
  it("says nothing about a complete production setup", () => {
    expect(envWarnings(ok)).toEqual([]);
  });

  it("names a short or missing admin proxy secret without printing it", () => {
    const short = envWarnings({ ...ok, ADMIN_PROXY_SECRET: "hunter2" });
    expect(short).toHaveLength(1);
    expect(short[0]).toContain("ADMIN_PROXY_SECRET");
    expect(short[0]).not.toContain("hunter2");
    expect(envWarnings({ ...ok, ADMIN_PROXY_SECRET: "" })[0]).toContain("ADMIN_PROXY_SECRET");
  });

  it("names an empty store password", () => {
    expect(envWarnings({ ...ok, COUCHDB_PASSWORD: "" })[0]).toContain("COUCHDB_PASSWORD");
  });

  it("names an unpinned owner id only while the remote MCP server is on", () => {
    expect(envWarnings({ ...ok, ADMIN_GITHUB_ID: undefined })[0]).toContain("ADMIN_GITHUB_ID");
    expect(envWarnings({ ...ok, ADMIN_GITHUB_ID: undefined, MCP_REMOTE: "off" })).toEqual([]);
  });

  it("is quiet about empty values outside production", () => {
    expect(envWarnings({ ...ok, NODE_ENV: "development", ADMIN_PROXY_SECRET: "", COUCHDB_PASSWORD: "", MCP_REMOTE: "off" })).toEqual([]);
  });
});
