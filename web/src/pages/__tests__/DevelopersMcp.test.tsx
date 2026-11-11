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
    for (const name of ["PUBLIC_TOOLS", "ADMIN_READ_TOOLS", "ADMIN_TOOLS"]) {
      expect(listed(name), `${name} not found in mcp/src/tools.ts`).not.toHaveLength(0);
    }
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

  // Visitors need no account: /mcp/public is the address for everyone, and the
  // sign-in endpoint is presented as the owner's. The page once told visitors that
  // anyone could connect at /mcp, which answers 401 without a token and gives a
  // GitHub account that is not the owner's nothing.
  it("leads with the address that needs no account and keeps the owner's apart", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ resource: "https://yehudabriskman.com/mcp" })));
    render(
      <MemoryRouter>
        <DevelopersMcp />
      </MemoryRouter>,
    );
    const everyone = screen.getByText(/claude mcp add --transport http yehuda-public .*\/mcp\/public$/);
    const owner = screen.getByText(/claude mcp add --transport http yehuda .*\/mcp$/);
    const ownerHead = screen.getByRole("heading", { name: "Owner access" });
    expect(everyone.compareDocumentPosition(ownerHead) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(ownerHead.compareDocumentPosition(owner) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText(/Anyone can connect: the public tools answer without an account/)).toBeNull();
    await waitFor(() => expect(screen.getByText("live")).toBeInTheDocument());
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
