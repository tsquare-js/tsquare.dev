/**
 * Render URLs: https://tsquare.dev/svg/<data> and /png/<data>[?scale=2]
 *
 * <data> is the wireframe text, encoded as "z" + base64url(deflate-raw(utf-8)).
 * The leading "z" names the encoding, so a future format can use another letter
 * without breaking links already pasted into docs. URLs are permanent: never
 * change what an existing prefix means.
 *
 * vercel.json rewrites /svg/:data and /png/:data here as ?fmt=…&data=….
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { inflateRawSync } from "node:zlib";
import { compileWireframe, renderWireframePng, renderWireframeSvg } from "tsquare";

const MAX_DATA = 16_000; // characters in the URL
const MAX_TEXT = 64_000; // bytes after inflating

export function decode(data: string): string {
  if (!data.startsWith("z")) throw new Error(`unknown encoding "${data.slice(0, 1)}" (expected a "z" prefix)`);
  if (data.length > MAX_DATA) throw new Error("wireframe is too long for a URL");
  const bytes = inflateRawSync(Buffer.from(data.slice(1), "base64url"), { maxOutputLength: MAX_TEXT });
  return bytes.toString("utf8");
}

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** A plain SVG listing the problems, so a broken embed says why instead of showing a broken image. */
function errorSvg(lines: string[]) {
  const shown = ["This wireframe has problems:", ...lines.slice(0, 12)];
  const width = 760;
  const height = 40 + shown.length * 22;
  const text = shown
    .map((l, i) => `<text x="20" y="${34 + i * 22}" font-weight="${i ? 400 : 600}">${escape(l.length > 110 ? l.slice(0, 107) + "…" : l)}</text>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" rx="8" fill="#fff4f2" stroke="#e8b4ac"/><g font-family="ui-sans-serif, system-ui, sans-serif" font-size="14" fill="#7a2418">${text}</g></svg>`;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://localhost");
  // Accept both the rewritten form (?fmt=svg&data=…) and the original path (/svg/…).
  const [, pathFmt, pathData] = url.pathname.match(/^\/(svg|png)\/(.+)$/) ?? [];
  const fmt = url.searchParams.get("fmt") ?? pathFmt;
  const data = url.searchParams.get("data") ?? pathData;

  const send = (status: number, type: string, body: string | Uint8Array, cache: string) => {
    res.writeHead(status, { "content-type": type, "cache-control": cache, "access-control-allow-origin": "*" });
    res.end(body);
  };
  const fail = (lines: string[]) => send(400, "image/svg+xml; charset=utf-8", errorSvg(lines), "public, max-age=300");

  if ((fmt !== "svg" && fmt !== "png") || !data) return fail(["Use /svg/<data> or /png/<data>."]);

  let source: string;
  try {
    source = decode(data);
  } catch (err) {
    return fail([`Couldn't read the URL: ${(err as Error).message}`]);
  }

  const { spec, issues } = compileWireframe(source);
  if (!spec || issues.length) return fail(issues.map((i) => `line ${i.line}: ${i.message}`));

  // The same URL always renders the same image for a given site deploy, so let the CDN keep it.
  const cache = "public, max-age=3600, s-maxage=31536000, stale-while-revalidate=86400";
  if (fmt === "svg") return send(200, "image/svg+xml; charset=utf-8", await renderWireframeSvg(spec, { skipValidation: true }), cache);
  const scale = Math.min(4, Math.max(1, Number(url.searchParams.get("scale") ?? 2) || 2));
  return send(200, "image/png", await renderWireframePng(spec, { skipValidation: true, scale }), cache);
}
