# React

`@tsquare-js/react` draws tsquare wireframes in React apps: from wireframe text, or from the ```` ```tsquare ```` blocks in Markdown you render with react-markdown, such as a model's reply in a chat, including while the reply is still streaming in.

```bash
npm install @tsquare-js/react
```

## A wireframe from text

```jsx
import { Wireframe } from "@tsquare-js/react";

<Wireframe source={text} />
```

The board is an `<img>` of its SVG inside `<figure class="tsquare-board">`, at its own size and never wider than its container. If the text has mistakes, they're listed by line under the last version that worked.

## In react-markdown

```jsx
import Markdown from "react-markdown";
import { tsquareComponents } from "@tsquare-js/react";

<Markdown components={tsquareComponents}>{reply}</Markdown>
```

Every ```` ```tsquare ```` block becomes its board; other code blocks stay as they were. To combine it with your own components, spread it: `components={{ ...tsquareComponents, a: MyLink }}`.

## While a reply streams in

Wrap the reply in `<WireframeStreaming>` while text is still arriving (or pass `streaming` to `<Wireframe>`):

```jsx
import { WireframeStreaming, tsquareComponents } from "@tsquare-js/react";

<WireframeStreaming value={status === "streaming"}>
  <Markdown components={tsquareComponents}>{reply}</Markdown>
</WireframeStreaming>
```

While streaming, the board updates every 200 ms or so with the latest text that's valid so far, and problems wait until the reply is complete (half-written lines always look wrong). When it's done, any problems show under the last good board.

## Notes

- **Frameworks:** the components run in the browser and are marked `"use client"` for Next.js and other React Server Components setups. On the server they render an empty `<figure>`, filled in after the page loads.
- **Size:** the renderer adds about 1.7 MB minified (490 KB compressed) to your bundle. In a chat app, load it when it's first needed with `lazy()` or a dynamic `import()`.
- **Privacy:** boards are drawn on the reader's device; nothing is sent to tsquare.dev or anywhere else.

The package's code and issues are at [tsquare-js/react](https://github.com/tsquare-js/react).
