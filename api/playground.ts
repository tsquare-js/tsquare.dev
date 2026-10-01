/**
 * The playground's endpoints (/api/reference, /api/examples, /api/prompt,
 * /api/render, /api/png), answered by the handler shipped in the tsquare
 * package, so the hosted playground runs the same code as `tsquare playground`.
 *
 * vercel.json rewrites those paths here as ?route=/api/…; the page itself and
 * /mark.png are static files.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { createPlaygroundHandler } from "tsquare/playground";

const handle = createPlaygroundHandler();

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const route = url.searchParams.get("route");
  if (route) {
    url.searchParams.delete("route");
    req.url = route + (url.search === "?" ? "" : url.search);
  }
  if (!(await handle(req, res))) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  }
}
