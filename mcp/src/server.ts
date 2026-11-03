import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PortfolioApi, type FetchLike } from "./api.js";
import type { Config } from "./config.js";
import { instructionsFor, registerTools, VERSION } from "./tools.js";

export { ADMIN_READ_TOOLS, ADMIN_TOOLS, PUBLIC_TOOLS, VERSION } from "./tools.js";

/*
 * The stdio server: the shared tools (tools.ts) over the site's HTTP API.
 * With PORTFOLIO_ADMIN_TOKEN it registers every admin tool and lets the API
 * judge the token's scope; without one, only the public reads.
 */
export function createServer(config: Config, fetchImpl?: FetchLike) {
  const api = new PortfolioApi(config.apiUrl, config.adminToken, fetchImpl);
  const access = config.adminToken ? "write" : "public";
  const server = new McpServer({ name: "portfolio-site", version: VERSION }, { instructions: instructionsFor(access) });
  registerTools(server, api, access);
  return server;
}
