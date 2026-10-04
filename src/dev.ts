/**
 * Local server with the same routes as vercel.json, so the site can be tried
 * without the Vercel CLI. Serves public/ (run `npm run build` first) and calls
 * the same function files as production.
 *
 *   npm run dev            → http://localhost:3000
 *   PORT=4000 npm run dev
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import image from "../api/image.js";
import playground from "../api/playground.js";
import { handleMcp } from "../api/mcp.js";

const PORT = Number(process.env.PORT ?? 3000);
const PUBLIC = path.resolve("public");
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".js": "text/javascript; charset=utf-8",
  ".woff2": "font/woff2",
};

/** cleanUrls: /docs/language → language.html, /docs → docs/index.html */
async function staticFile(urlPath: string) {
  const base = path.join(PUBLIC, decodeURIComponent(urlPath));
  if (!base.startsWith(PUBLIC)) return null;
  for (const candidate of [base, base + ".html", path.join(base, "index.html")]) {
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch {}
  }
  return null;
}

/** Node request → web Request → handler → Node response, for the fetch-style functions (api/mcp.ts). */
async function viaFetch(req: IncomingMessage, res: ServerResponse, handle: (r: Request) => Promise<Response>) {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (v != null) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
  const body = req.method === "GET" || req.method === "HEAD" ? undefined : Buffer.concat(chunks);
  const response = await handle(new Request(`http://localhost:${PORT}${req.url}`, { method: req.method, headers, body }));
  res.writeHead(response.status, Object.fromEntries(response.headers));
  if (response.body) for await (const chunk of response.body) res.write(chunk);
  res.end();
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    const render = url.pathname.match(/^\/(svg|png)\/([^/]+)$/);
    if (render) {
      url.pathname = "/api/image";
      url.searchParams.set("fmt", render[1]);
      url.searchParams.set("data", render[2]);
      req.url = url.pathname + url.search;
      return await image(req, res);
    }
    if (url.pathname === "/mcp") return await viaFetch(req, res, handleMcp);
    const api = url.pathname.match(/^\/api\/(reference|examples|prompt|render|png|language)$/);
    if (api) {
      url.searchParams.set("route", url.pathname);
      req.url = "/api/playground" + url.search;
      return await playground(req, res);
    }
    const file = await staticFile(url.pathname);
    if (!file) {
      res.writeHead(404, { "content-type": "text/plain" });
      return res.end("not found");
    }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
    res.end(await readFile(file));
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.writeHead(500);
    res.end(String(err));
  }
}).listen(PORT, "127.0.0.1", () => console.log(`tsquare.dev → http://localhost:${PORT}`));
