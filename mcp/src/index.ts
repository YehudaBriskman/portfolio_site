#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { createServer } from "./server.js";

/*
 * stdio entry point. stdout is the protocol channel, so anything human goes
 * to stderr — and the token never goes anywhere.
 */
let config;
try {
  config = loadConfig(process.env);
} catch (e) {
  console.error(`portfolio-mcp: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}

const server = createServer(config);
await server.connect(new StdioServerTransport());
console.error(
  `portfolio-mcp: ${config.apiUrl} (${config.adminToken ? "read + admin write tools" : "read-only: no PORTFOLIO_ADMIN_TOKEN"})`,
);
