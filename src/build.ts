/**
 * Builds the static part of tsquare.dev into public/:
 *   index.html          landing page, with the installed package's examples as render URLs
 *   playground.html     the playground page and its script from the installed tsquare package
 *   docs/**             the library repo's docs/, as HTML, at the commit npm
 *                       recorded for the installed tsquare version
 *
 *   npm run build                         fetch the docs from GitHub
 *   DOCS_DIR=../wireframe npm run build   use a local checkout of the library instead
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { Script } from "node:vm";
import { Marked } from "marked";
import { compileWireframe, encodeWireframe, formatIssues } from "tsquare";

const require = createRequire(import.meta.url);
const OUT = "public";
const REPO = "https://github.com/tsquare-js/tsquare";
const tsquareDir = path.dirname(require.resolve("tsquare/package.json"));
const VERSION: string = JSON.parse(readFileSync(path.join(tsquareDir, "package.json"), "utf8")).version;

/** The render-URL and share-link encoding: the library's, so links carry the installed version's prefix. */
export const encode = encodeWireframe;

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const f of ["logo.png", "mark.png"]) copyFileSync(path.join("assets", f), path.join(OUT, f));
copyFileSync("src/site.css", path.join(OUT, "site.css"));
copyFileSync("src/analytics.js", path.join(OUT, "analytics.js"));
// Inter from @fontsource, served by the site itself so no visitor data goes to a font CDN.
mkdirSync(path.join(OUT, "fonts"), { recursive: true });
const fontsDir = path.join(path.dirname(require.resolve("@fontsource/inter/package.json")), "files");
for (const w of [400, 500, 600, 700, 800]) copyFileSync(path.join(fontsDir, `inter-latin-${w}-normal.woff2`), path.join(OUT, "fonts", `inter-latin-${w}-normal.woff2`));

// ── Landing page ────────────────────────────────────────────────────────

// The package's own examples, so they always match the installed version's language.
const EXAMPLES = ["sign-in", "dashboard", "checkout", "states"];
const examples = EXAMPLES
  .map((name) => {
    const f = `${name}.tsq`;
    const file = path.join(tsquareDir, "examples", f);
    if (!existsSync(file)) throw new Error(`tsquare ${VERSION} has no examples/${f}; update EXAMPLES in src/build.ts`);
    const source = readFileSync(file, "utf8").trimEnd();
    const { spec, issues } = compileWireframe(source);
    if (!spec || issues.length) throw new Error(`examples/${f}:\n${formatIssues(issues)}`);
    const title = (spec.elements[spec.root].props as { title?: string }).title ?? f;
    return { title, source, src: `/svg/${encode(source)}` };
  });

const landing = readFileSync("src/landing.html", "utf8")
  .replaceAll("{{VERSION}}", VERSION)
  .replace("{{EXAMPLES_JSON}}", JSON.stringify(examples).replace(/</g, "\\u003c"));
writeFileSync(path.join(OUT, "index.html"), landing);

// ── Privacy page ────────────────────────────────────────────────────────

writeFileSync(path.join(OUT, "privacy.html"), readFileSync("src/privacy.html", "utf8").replaceAll("{{VERSION}}", VERSION));

// ── Console easter egg: the picture of src/console.tsq, then its source ─

{
  const source = readFileSync("src/console.tsq", "utf8").trimEnd();
  const { issues } = compileWireframe(source);
  if (issues.length) throw new Error(`src/console.tsq:\n${formatIssues(issues)}`);
  const egg = `// Open the console. tsquare draws pictures from plain text, including this one.
(() => {
  const src = location.origin + ${JSON.stringify(`/svg/${encode(source)}`)};
  const source = ${JSON.stringify(source)};
  console.log("%c ", \`font-size: 1px; padding: 112px 276px; background: url(\${src}) no-repeat center / contain;\`);
  console.log(
    "%cYou found the console.%c\\n\\nThat picture is drawn from this tsquare text:\\n\\n" + source + "\\n\\nPaste it into " + location.origin + "/playground and change something.",
    "font: 700 16px Inter, system-ui, sans-serif; color: #032d7b;",
    "font: 13px ui-monospace, Menlo, monospace; color: inherit;",
  );
})();
`;
  new Script(egg); // fail the build on a syntax error rather than ship it
  writeFileSync(path.join(OUT, "console.js"), egg);
}

// ── Playground: the package's own page and script ─────────────────────

const playgroundDir = path.join(tsquareDir, "dist/playground");
const playground = readFileSync(path.join(playgroundDir, "index.html"), "utf8");
const themeButton = '<button class="btn quiet icon-only" id="theme"';
for (const marker of ["</head>", themeButton, "</body>"]) {
  if (!playground.includes(marker)) throw new Error(`playground page has no ${marker}; update the playground section of src/build.ts`);
}
writeFileSync(
  path.join(OUT, "playground.html"),
  playground
    // Share and image links point at whichever deploy serves the page (previews link to themselves),
    // and the logo goes home in the same tab.
    .replace("</head>", `<script>window.TSQUARE_BASE = location.origin;</script></head>`)
    // The playground sends text to the server to render, so link the privacy page from it.
    .replace(themeButton, `<a href="/privacy" style="font-size:13px;color:var(--muted);text-decoration:none;margin-right:8px">Privacy</a>${themeButton}`)
    .replace("</body>", `<script src="/console.js" defer></script><script src="/analytics.js" defer></script></body>`),
);
copyFileSync(path.join(playgroundDir, "playground.js"), path.join(OUT, "playground.js"));

// ── Docs ────────────────────────────────────────────────────────────────

/** A directory containing the library's docs/: a local checkout, or GitHub at the published commit. */
async function docsSource(): Promise<{ root: string; ref: string }> {
  if (process.env.DOCS_DIR) return { root: path.resolve(process.env.DOCS_DIR), ref: "main" };
  const meta = await (await fetch(`https://registry.npmjs.org/tsquare/${VERSION}`)).json();
  const ref: string | undefined = meta.gitHead;
  if (!ref) throw new Error(`npm has no gitHead for tsquare@${VERSION}; set DOCS_DIR`);
  const dir = mkdtempSync(path.join(tmpdir(), "tsquare-docs-"));
  const tarball = path.join(dir, "src.tar.gz");
  const res = await fetch(`https://codeload.github.com/tsquare-js/tsquare/tar.gz/${ref}`);
  if (!res.ok) throw new Error(`couldn't download the docs at ${ref}: HTTP ${res.status}`);
  writeFileSync(tarball, Buffer.from(await res.arrayBuffer()));
  execFileSync("tar", ["-xzf", tarball, "-C", dir, "--strip-components=1"]);
  return { root: dir, ref };
}

const { root, ref } = await docsSource();
const docsIn = path.join(root, "docs");

/** docs/README.md → /docs, docs/language.md → /docs/language, docs/components/README.md → /docs/components */
const pageUrl = (rel: string) => "/docs/" + rel.replace(/\.md$/, "").replace(/(^|\/)README$/, "").replace(/\/$/, "");
const slugify = (s: string) => s.toLowerCase().replace(/<[^>]+>/g, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "");

const NAV = [
  ["Getting started", "getting-started.md"],
  ["The language", "language.md"],
  ["Components", "components/README.md"],
  ["Icons", "icons.md"],
  ["Colors", "colors.md"],
  ["Embedding", "embedding.md"],
  ["Using it with AI", "ai.md"],
];

/**
 * A docs snippet as a whole wireframe, for its playground link. Fragments are indented as they'd
 * sit in a board: 2 spaces for screens and notes, 4 for a screen's content.
 */
function asWireframe(snippet: string) {
  const indent = snippet.match(/^ */)![0].length;
  return indent === 0 ? snippet : indent === 2 ? `board\n${snippet}` : `board\n  screen phone\n${snippet}`;
}

function renderDoc(rel: string) {
  const dir = path.posix.dirname(rel);
  const url = pageUrl(rel);
  // Resolve relative links: other docs become site pages; anything outside docs/ links to GitHub.
  const resolve = (href: string, isImage: boolean) => {
    if (/^(https?:|mailto:|#|\/)/.test(href)) return href;
    const [target, hash = ""] = href.split("#");
    const resolved = path.posix.normalize(path.posix.join(dir, target));
    if (resolved === "../assets/logo.png") return "/logo.png";
    if (resolved.startsWith("../")) return `${REPO}/blob/${ref}/${resolved.slice(3)}${hash ? "#" + hash : ""}`;
    if (!isImage && resolved.endsWith(".md")) return pageUrl(resolved) + (hash ? "#" + hash : "");
    return "/docs/" + resolved;
  };
  const marked = new Marked({
    renderer: {
      heading({ tokens, depth }) {
        const html = this.parser.parseInline(tokens);
        return depth === 1 ? `<h1>${html}</h1>\n` : `<h${depth} id="${slugify(html)}">${html}</h${depth}>\n`;
      },
      link({ href, title, tokens }) {
        return `<a href="${escapeHtml(resolve(href, false))}"${title ? ` title="${escapeHtml(title)}"` : ""}>${this.parser.parseInline(tokens)}</a>`;
      },
      image({ href, text }) {
        return `<img src="${escapeHtml(resolve(href, true))}" alt="${escapeHtml(text)}" loading="lazy">`;
      },
      // Every code block gets Copy; tsquare blocks also open in the playground (a share link made here).
      code({ text, lang }) {
        const open = lang === "tsquare"
          ? `<a class="code-open" href="/playground#${encode(asWireframe(text))}" data-track="docs_example_opened" data-track-label="${escapeHtml(url)}">Open in playground</a>`
          : "";
        return `<div class="code"><div class="code-bar">${open}<button type="button" class="code-copy">Copy</button></div><pre><code${lang ? ` class="language-${escapeHtml(lang)}"` : ""}>${escapeHtml(text)}</code></pre></div>\n`;
      },
    },
  });
  // Raw HTML in the docs (the centered logo) needs the same link rewriting.
  const md = readFileSync(path.join(docsIn, rel), "utf8").replace(/src="([^"]+)"/g, (_, src) => `src="${resolve(src, true)}"`);
  const body = marked.parse(md) as string;
  const title = md.match(/^# (.+)$/m)?.[1] ?? "Docs";
  const nav = NAV.map(([label, target]) => {
    const href = pageUrl(target);
    const current = url === href || (href === "/docs/components" && url.startsWith("/docs/components"));
    return `<a href="${href}"${current ? ' aria-current="page"' : ""}>${label}</a>`;
  }).join("");
  return readFileSync("src/docs.html", "utf8")
    .replaceAll("{{TITLE}}", escapeHtml(title.replace(/`/g, "")))
    .replace("{{NAV}}", nav)
    .replace("{{BODY}}", body)
    .replace("{{SOURCE}}", `${REPO}/blob/${ref}/docs/${rel}`)
    .replaceAll("{{VERSION}}", VERSION);
}

const walk = (dir: string): string[] =>
  readdirSync(path.join(docsIn, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.posix.join(dir, e.name)) : [path.posix.join(dir, e.name)],
  );

let pages = 0;
for (const rel of walk("")) {
  if (rel.endsWith(".md")) {
    const out = path.join(OUT, pageUrl(rel).slice(1) + (rel.endsWith("README.md") ? "/index.html" : ".html"));
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, renderDoc(rel));
    pages++;
  } else if (rel.endsWith(".png")) {
    mkdirSync(path.join(OUT, "docs", path.dirname(rel)), { recursive: true });
    copyFileSync(path.join(docsIn, rel), path.join(OUT, "docs", rel));
  }
}
if (!existsSync(path.join(OUT, "docs/index.html"))) throw new Error("docs/README.md missing from the docs source");

console.log(`built ${OUT}/: landing (${examples.length} examples), playground, ${pages} docs pages (tsquare ${VERSION}, docs at ${ref.slice(0, 7)})`);
