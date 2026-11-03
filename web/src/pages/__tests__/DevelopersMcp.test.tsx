import fs from "fs";
import path from "path";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DevelopersMcp from "../DevelopersMcp";
import { OWNER_READ, OWNER_WRITE, PUBLIC } from "@/lib/mcpTools";

/*
 * The page lists the server's tools by hand; the server defines them in
 * mcp/src/tools.ts. This keeps the two in step (#263).
 */
const toolsTs = fs.readFileSync(path.resolve(__dirname, "../../../../mcp/src/tools.ts"), "utf8");
const listed = (name: string) => {
  const m = new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\]`).exec(toolsTs);
  return [...(m?.[1] ?? "").matchAll(/"([a-z_]+)"/g)].map((x) => x[1]).sort();
};

describe("the MCP server page", () => {
  it("lists exactly the server's tools", () => {
    expect(PUBLIC.map((t) => t.name).sort()).toEqual(listed("PUBLIC_TOOLS"));
    expect(OWNER_READ.map((t) => t.name).sort()).toEqual(listed("ADMIN_READ_TOOLS"));
    expect([...OWNER_READ, ...OWNER_WRITE].map((t) => t.name).sort()).toEqual(listed("ADMIN_TOOLS"));
  });

  it("says when the server is not switched on", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Not Found", { status: 404 })));
    render(
      <MemoryRouter>
        <DevelopersMcp />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText(/not switched on yet/)).toBeInTheDocument());
    expect(screen.getByText(/claude mcp add --transport http yehuda .*\/mcp$/)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("says live when the metadata answers", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ resource: "https://yehudabriskman.com/mcp" })));
    render(
      <MemoryRouter>
        <DevelopersMcp />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText("live")).toBeInTheDocument());
    vi.unstubAllGlobals();
  });
});
