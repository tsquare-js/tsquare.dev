# tsquare.dev

The website for [tsquare](https://github.com/tsquare-js/tsquare): the landing page, the hosted playground, the docs, and render URLs. Deployed on Vercel.

The language, the renderer, the playground and the docs' Markdown live in the [tsquare repo](https://github.com/tsquare-js/tsquare). This repo only hosts them, using a pinned version of the `tsquare` package, so rendering on the site changes only when that version is bumped.

## Routes

| Path | What it is |
|---|---|
| `/` | landing page (`src/landing.html`), with the examples in `examples/` rendered live |
| `/playground` | the playground page shipped in the `tsquare` package |
| `/docs/…` | the tsquare repo's `docs/`, as HTML |
| `/svg/<data>`, `/png/<data>?scale=2` | render URLs (`api/image.ts`) |
| `/api/reference`, `/api/render`, … | the playground's endpoints (`api/playground.ts`, the package's handler) |

## Render URLs

`<data>` is the wireframe text, deflated and base64url-encoded, with a `z` in front: `"z" + base64url(deflateRaw(text))`. The prefix names the encoding, so a new format can use another letter without breaking links people have already embedded. Don't change what an existing prefix means.

Invalid wireframes return an SVG listing the problems, so a broken embed says why.

## Developing

```bash
npm install
npm run build                          # build public/ (fetches the docs from GitHub)
DOCS_DIR=../tsquare npm run build      # or use the docs in a local checkout of the tsquare repo
npm run dev                            # http://localhost:3000, same routes as vercel.json
```

The docs are fetched from the tsquare repo at the commit npm recorded for the installed version (`gitHead`), so the docs always match the renderer.

## Updating tsquare

1. Publish a new `tsquare` version from the tsquare repo.
2. Here: `npm install --save-exact tsquare@<version>`, `npm run build`, check `npm run dev`.
3. Push. Every render URL and the docs move to the new version together.

## License

MIT.
