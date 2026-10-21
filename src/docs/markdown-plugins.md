# Markdown plugins

Two plugins draw ```` ```tsquare ```` code blocks as wireframes when your docs site is built. Write a wireframe in a code block:

````markdown
```tsquare
board "Sign in"
  screen phone "Sign in"
    heading "Welcome back"
    input "Email"
    button "Sign in" primary fullWidth
```
````

and the page shows the board as an image. It's drawn on the machine that builds the site and placed inside the page, so nothing is sent anywhere and the page works offline.

| Your site | Plugin |
|---|---|
| Docusaurus, Astro, MDX, anything on unified | [`remark-tsquare`](#remark-tsquare) |
| VitePress, Eleventy, anything on markdown-it | [`markdown-it-tsquare`](#markdown-it-tsquare) |

Both make the same HTML and take the same options. They need Node 20 or newer. For a site without a build step, use [the script for any web page](embedding.md#pages-written-in-markdown) instead.

## remark-tsquare

For sites built on [unified](https://unifiedjs.com) (remark), MDX included: [`remark-tsquare` on npm](https://www.npmjs.com/package/remark-tsquare).

### Docusaurus

```bash
npm install remark-tsquare
```

In `docusaurus.config.js`, add it to the docs (and the blog or pages, if they have wireframes too):

```js
import remarkTsquare from "remark-tsquare";

export default {
  presets: [
    ["classic", {
      docs: { remarkPlugins: [remarkTsquare] },
      blog: { remarkPlugins: [remarkTsquare] },
    }],
  ],
};
```

That's all: `.md` and `.mdx` pages both work, and the [zoom viewer](#what-readers-get) comes with it.

### Astro

Astro 7 renders Markdown with Sätteri by default, which doesn't run remark plugins, so install Astro's remark processor too:

```bash
npm install remark-tsquare @astrojs/markdown-remark
```

In `astro.config.mjs`:

```js
import { defineConfig } from "astro/config";
import remarkTsquare from "remark-tsquare";

export default defineConfig({
  markdown: { remarkPlugins: [remarkTsquare] },
});
```

`@astrojs/mdx` uses the same plugins for `.mdx` pages. For the zoom viewer, load its script from the layout your Markdown pages use:

```astro
<script>
  import "remark-tsquare/client";
</script>
```

## markdown-it-tsquare

For sites built on [markdown-it](https://github.com/markdown-it/markdown-it): [`markdown-it-tsquare` on npm](https://www.npmjs.com/package/markdown-it-tsquare). markdown-it renders synchronously, so the plugin draws boards in a worker thread the build waits for: about 0.3 s to start, then 15–90 ms a board.

### VitePress

```bash
npm install markdown-it-tsquare
```

In `.vitepress/config.mjs`:

```js
import tsquare from "markdown-it-tsquare";

export default {
  markdown: {
    config: (md) => md.use(tsquare),
  },
};
```

For the zoom viewer, import its script in `.vitepress/theme/index.js` (create it if you use the default theme):

```js
import DefaultTheme from "vitepress/theme";
import "markdown-it-tsquare/client";

export default DefaultTheme;
```

### Eleventy

```bash
npm install markdown-it-tsquare
```

In `eleventy.config.js`:

```js
import tsquare from "markdown-it-tsquare";

export default function (eleventyConfig) {
  eleventyConfig.amendLibrary("md", (md) => md.use(tsquare));
  // the zoom viewer's script, with the viewer built in (Eleventy has no bundler)
  eleventyConfig.addPassthroughCopy({ "node_modules/markdown-it-tsquare/dist/client.standalone.js": "tsquare-zoom.js" });
}
```

and load it from your layout:

```html
<script type="module" src="/tsquare-zoom.js"></script>
```

In a CommonJS config, `const tsquare = require("markdown-it-tsquare").default;`.

## What readers get

- **The board, as an image in the page,** sized to fit the column, with alt text from the board's title.
- **Zoom:** a docs column shrinks a wide board (a three-screen flow shows at about a third of its size), so readers can click it to see it properly:
  - **with the zoom script** (3 KB compressed): a viewer where they zoom with a pinch, Ctrl/Cmd + scroll or the buttons, drag to pan, jump to a screen by its name, and close it with Esc;
  - **without it:** the board at full size over the page, to scroll around in, closed with Esc, Close or a click.
- **Problems, if the text has a mistake:** the block lists each one with its line number in place of the board, and the build log shows them with the file and line, so you can fix them before publishing.

## Options

Pass options with the plugin, for example `[remarkTsquare, { link: true }]` or `md.use(tsquare, { link: true })`:

| Option | Default | |
|---|---|---|
| `zoom` | `"auto"` | Which boards readers can open: `"auto"` for boards wider than 800px (the ones a docs column shrinks), `true` for all, `false` for none. |
| `link` | `false` | An "Open in playground" link under each board. `true` opens [the playground](/playground) on tsquare.dev, or give the address of a playground you host. |
| `flows` | `true` | Draw the flow arrows between screens. |
| `strict` | `false` | Fail the build when a wireframe has problems, instead of listing them on the page. Good for CI. |

## Privacy

Boards are drawn when the site is built, and the zoom script works with the image already on the page: neither sends anything anywhere. With `link`, the "Open in playground" link holds the wireframe's text after the `#`, so following it doesn't send the text anywhere by itself; the playground then sends it to tsquare.dev to draw it, as it does for anything typed there. See the [privacy page](/privacy).

The plugins' full documentation (the HTML they make, sizes, MDX and markdown-it details) is in their READMEs: [remark-tsquare](https://github.com/tsquare-js/markdown/tree/main/packages/remark-tsquare#readme) and [markdown-it-tsquare](https://github.com/tsquare-js/markdown/tree/main/packages/markdown-it-tsquare#readme). The code and issues are at [tsquare-js/markdown](https://github.com/tsquare-js/markdown).
