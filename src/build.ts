/**
 * Builds the static part of tsquare.dev into public/:
 *   index.html          landing page, with the installed package's examples as render URLs
 *   playground.html     the playground page and its script from the installed tsquare package
 *   docs/**             the library repo's docs/, as HTML, at the commit npm
 *                       recorded for the installed tsquare version, plus the site's
 *                       own pages from src/docs/ (other tsquare products, e.g. VS Code)
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
import { compileWireframe, encodeWireframe, formatIssues, theme } from "tsquare";

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
const EXAMPLES = ["sign-in", "dashboard", "checkout", "sign-up-flow", "states"];
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
  ["VS Code", "vscode.md"],
  ["Obsidian", "obsidian.md"],
  ["React", "react/README.md"],
  ["Docs sites", "docs-sites.md"],
];

/**
 * Pages the site owns, merged into /docs: they're about other tsquare products (the VS Code
 * extension, the Obsidian plugin), not the library, so they go live with the site instead of
 * waiting for a tsquare release.
 */
const SITE_DOCS = "src/docs";

type Page = readonly [label: string, rel: string];

/**
 * A docs section's reading order (a folder with a README.md overview and pages): the overview,
 * then the pages in the order the overview links to them after its intro (the intro may mention
 * a page in passing), then any it doesn't link, alphabetically. Pages are titled by their
 * headings, so pages added to a section show up without a site change. Used for the nav's
 * sub-pages and the previous/next links.
 */
function sectionPages(from: string, section: string, label: string): Page[] {
  const dir = path.join(from, section);
  const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
  const readme = readFileSync(path.join(dir, "README.md"), "utf8");
  const linked = [...readme.slice(readme.indexOf("\n## ")).matchAll(/\]\(([\w-]+\.md)/g)].map((m) => m[1]);
  const title = (f: string) => readFileSync(path.join(dir, f), "utf8").match(/^# (.+)$/m)![1].replace(/`/g, "");
  const pages = [...new Set([...linked, ...files.sort()])].filter((f) => f !== "README.md" && files.includes(f));
  return [[label, `${section}/README.md`], ...pages.map((f): Page => [title(f), `${section}/${f}`])];
}

/** Previous / next links for a page in a section's reading order. */
function pagerFor(pages: Page[], rel: string) {
  const i = pages.findIndex(([, target]) => target === rel);
  return i < 0 ? "" : pager(pages[i - 1], pages[i + 1]);
}

const COMPONENT_PAGES = sectionPages(docsIn, "components", "Components");

/** A section's groups for the nav: each "## " heading on its overview, with the pages listed under it. */
function sectionGroups(from: string, section: string, pages: Page[]) {
  const readme = readFileSync(path.join(from, section, "README.md"), "utf8");
  return readme.split(/\n## /).slice(1).map((chunk) => ({
    group: chunk.slice(0, chunk.indexOf("\n")).trim(),
    pages: [...chunk.matchAll(/\]\(([\w-]+\.md)/g)].map((m) => pages.find(([, t]) => t === `${section}/${m[1]}`)).filter((p): p is Page => !!p),
  })).filter((g) => g.pages.length);
}
const COMPONENT_GROUPS = sectionGroups(docsIn, "components", COMPONENT_PAGES);

/**
 * The React package's docs (@tsquare-js/react, pinned in package.json): its docs/ folder becomes
 * /docs/react (README.md) and /docs/react/<page>. They're copied into a react/ folder so links
 * between them resolve like the library's. Inside the section, its pages are listed under
 * "React" in the nav.
 */
const REACT_PKG = "node_modules/@tsquare-js/react";
const REACT_VERSION: string = JSON.parse(readFileSync(path.join(REACT_PKG, "package.json"), "utf8")).version;
const reactDocs = mkdtempSync(path.join(tmpdir(), "tsquare-react-docs-"));
mkdirSync(path.join(reactDocs, "react"));
const reactFiles = readdirSync(path.join(REACT_PKG, "docs")).filter((f) => f.endsWith(".md"));
for (const f of reactFiles) copyFileSync(path.join(REACT_PKG, "docs", f), path.join(reactDocs, "react", f));
const REACT_PAGES = sectionPages(reactDocs, "react", "React");
const REACT_NAV = REACT_PAGES.slice(1);

/**
 * A docs snippet as a whole wireframe, for its playground link. Fragments are indented as they'd
 * sit in a board: 2 spaces for screens and notes, 4 for a screen's content.
 */
function asWireframe(snippet: string) {
  const indent = snippet.match(/^ */)![0].length;
  return indent === 0 ? snippet : indent === 2 ? `board\n${snippet}` : `board\n  screen phone\n${snippet}`;
}

/** Text color for a hex background: white when it reads at 4.5:1, otherwise dark (the site's navy). */
function inkOn(hex: string) {
  const lum = (h: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  return 1.05 / (lum(hex) + 0.05) >= 4.5 ? "#ffffff" : "#032d7b";
}

function renderDoc(rel: string, from = docsIn, source = `${REPO}/blob/${ref}/docs/${rel}`, extra: { pager?: string; edition?: string } = {}) {
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
  // Colors page: color names show on their color too, per section (`blue` the accent is not `blue` the note).
  // Accents come from the page's own table rows (`blue` | `#2563eb`), note colors from the renderer's theme.
  const md0 = readFileSync(path.join(from, rel), "utf8");
  const namedColors: Record<string, Record<string, string>> =
    rel === "colors.md"
      ? { accent: Object.fromEntries([...md0.matchAll(/^\| `(\w+)` \| `(#[0-9a-f]{6})` \|$/gim)].map((m) => [m[1], m[2].toLowerCase()])), notes: { ...theme.notes } }
      : {};
  let section = "";
  const marked = new Marked({
    renderer: {
      heading({ tokens, depth }) {
        const html = this.parser.parseInline(tokens);
        if (depth === 2) section = slugify(html);
        return depth === 1 ? `<h1>${html}</h1>\n` : `<h${depth} id="${slugify(html)}">${html}</h${depth}>\n`;
      },
      link({ href, title, tokens }) {
        return `<a href="${escapeHtml(resolve(href, false))}"${title ? ` title="${escapeHtml(title)}"` : ""}>${this.parser.parseInline(tokens)}</a>`;
      },
      image({ href, text }) {
        return `<img src="${escapeHtml(resolve(href, true))}" alt="${escapeHtml(text)}" loading="lazy">`;
      },
      // Inline code that is exactly a hex color (`#2563eb`) shows on that color, so the Colors page shows its colors.
      codespan({ text }) {
        const hex = /^#[0-9a-f]{6}$/i.test(text) ? text.toLowerCase() : namedColors[section]?.[text];
        return hex ? `<code class="hex" style="background:${hex};color:${inkOn(hex)}">${text}</code>` : false; // false: marked's own (escaping) renderer
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
  const md = md0.replace(/src="([^"]+)"/g, (_, src) => `src="${resolve(src, true)}"`);
  const body = marked.parse(md) as string;
  const title = md.match(/^# (.+)$/m)?.[1] ?? "Docs";
  const subLinks = (pages: readonly Page[], cls: string) =>
    pages.map(([sub, t]) => `<a class="${cls}" href="${pageUrl(t)}"${url === pageUrl(t) ? ' aria-current="page"' : ""}>${escapeHtml(sub)}</a>`).join("");
  const nav = NAV.map(([label, target]) => {
    const href = pageUrl(target);
    const link = `<a href="${href}"${url === href ? ' aria-current="page"' : ""}>${label}</a>`;
    // Inside a section, its pages are listed under it: React's, and the components grouped as on the
    // Components page (desktop only: on phones the nav wraps above the page, and 37 more would bury it)
    if (url !== href && !url.startsWith(href + "/")) return link;
    if (href === "/docs/react") return link + subLinks(REACT_NAV, "sub");
    if (href === "/docs/components") return link + COMPONENT_GROUPS.map((g) => `<div class="sub-label">${escapeHtml(g.group)}</div>${subLinks(g.pages, "sub comp")}`).join("");
    return link;
  }).join("");
  return readFileSync("src/docs.html", "utf8")
    .replaceAll("{{TITLE}}", escapeHtml(title.replace(/`/g, "")))
    .replace("{{NAV}}", nav)
    .replace("{{BODY}}", body)
    .replace("{{PAGER}}", extra.pager ?? "")
    .replace("{{EDITION}}", escapeHtml(extra.edition ?? `tsquare ${VERSION}`))
    .replace("{{SOURCE}}", source)
    .replaceAll("{{VERSION}}", VERSION);
}

/** Previous / next links at the bottom of a page in a section (Components, React): see sectionPages. */
function pager(prev?: readonly [string, string], next?: readonly [string, string]) {
  const link = (kind: "prev" | "next", [label, target]: readonly [string, string]) =>
    `<a class="${kind}" href="${pageUrl(target)}"><span>${kind === "prev" ? "Previous" : "Next"}</span>${escapeHtml(label)}</a>`;
  return prev || next ? `<nav class="pager" aria-label="More in this section">${prev ? link("prev", prev) : ""}${next ? link("next", next) : ""}</nav>` : "";
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
    // the component pages get previous/next links, in the order the Components page lists them
    writeFileSync(out, renderDoc(rel, docsIn, undefined, { pager: rel.startsWith("components/") ? pagerFor(COMPONENT_PAGES, rel) : undefined }));
    pages++;
  } else if (rel.endsWith(".png")) {
    mkdirSync(path.join(OUT, "docs", path.dirname(rel)), { recursive: true });
    copyFileSync(path.join(docsIn, rel), path.join(OUT, "docs", rel));
  }
}
if (!existsSync(path.join(OUT, "docs/index.html"))) throw new Error("docs/README.md missing from the docs source");
for (const rel of readdirSync(SITE_DOCS).filter((f) => f.endsWith(".md"))) {
  const out = path.join(OUT, pageUrl(rel).slice(1) + ".html");
  // The library's page for this route may be a file (vscode.md → vscode.html) or a folder (vscode/README.md → vscode/index.html).
  if (existsSync(out) || existsSync(path.join(OUT, pageUrl(rel).slice(1), "index.html")))
    throw new Error(`${SITE_DOCS}/${rel} and a library docs page are both ${pageUrl(rel)}; rename one`);
  writeFileSync(out, renderDoc(rel, SITE_DOCS, `https://github.com/tsquare-js/tsquare.dev/blob/main/${SITE_DOCS}/${rel}`));
  pages++;
}
if (existsSync(path.join(OUT, "docs/react"))) throw new Error("the library's docs have a react/ folder, and so does @tsquare-js/react; rename one");
for (const f of reactFiles) {
  const rel = `react/${f}`;
  const out = path.join(OUT, pageUrl(rel).slice(1) + (f === "README.md" ? "/index.html" : ".html"));
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, renderDoc(rel, reactDocs, `https://github.com/tsquare-js/react/blob/v${REACT_VERSION}/docs/${f}`, {
    pager: pagerFor(REACT_PAGES, rel),
    edition: `@tsquare-js/react ${REACT_VERSION}`,
  }));
  pages++;
}
for (const [label, target] of NAV) {
  if (!existsSync(path.join(OUT, pageUrl(target).slice(1) + (target.endsWith("README.md") ? "/index.html" : ".html")))) throw new Error(`docs nav: "${label}" → ${target} has no page`);
}

console.log(`built ${OUT}/: landing (${examples.length} examples), playground, ${pages} docs pages (tsquare ${VERSION}, docs at ${ref.slice(0, 7)}; @tsquare-js/react ${REACT_VERSION})`);
