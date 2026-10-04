/**
 * The hosted MCP server: https://tsquare.dev/mcp (Streamable HTTP, stateless).
 *
 * Tools: wireframe_guide, render_wireframe, share_wireframe. Their logic lives in the tsquare
 * package (plain functions, no SDK); this file only wires them to the MCP SDK, so a local
 * server can reuse the same functions.
 *
 * Privacy: wireframe text arrives in tool calls. Never log it (onerror logs the error name only).
 *
 * vercel.json rewrites /mcp here.
 */
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { MCP_INSTRUCTIONS, mcpTools, renderWireframeTool, shareWireframeTool, wireframeGuide } from "tsquare";
import pkg from "tsquare/package.json" with { type: "json" };

/** Links always point at the live site, not at a preview deploy (those are behind Vercel Authentication). */
const BASE = "https://tsquare.dev";

function server() {
  const s = new McpServer({ name: "tsquare", title: "tsquare wireframes", version: pkg.version, websiteUrl: BASE }, { instructions: MCP_INSTRUCTIONS });
  s.registerTool("wireframe_guide", mcpTools.wireframe_guide, async () => wireframeGuide());
  s.registerTool("render_wireframe", mcpTools.render_wireframe, async (args) => renderWireframeTool(args));
  s.registerTool("share_wireframe", mcpTools.share_wireframe, async (args) => shareWireframeTool(args, { base: BASE }));
  return s;
}

const mcp = createMcpHandler(server, {
  responseMode: "json", // no progress or logging to stream; one JSON body per call
  maxRequestBodySize: 256 * 1024, // a wireframe is capped at 64 KB of text
  onerror: (err) => console.error(`mcp: ${err.name}`),
});

/** A browser visiting /mcp gets a pointer to the docs instead of a protocol error. */
const forPeople = () =>
  new Response(`This is the tsquare MCP server. Add ${BASE}/mcp to your AI tool as a remote MCP server (Streamable HTTP).\nSetup: ${BASE}/docs/ai\n`, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });

export async function handleMcp(request: Request): Promise<Response> {
  if (request.method === "GET" && !request.headers.get("accept")?.includes("text/event-stream")) return forPeople();
  return mcp.fetch(request);
}

export default { fetch: handleMcp };
