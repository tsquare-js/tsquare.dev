# VS Code

The tsquare extension edits `.tsq` files with a live preview beside the editor.

- **VS Code:** install [tsquare from the Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=tsquare-js.tsquare-vscode), or search for "tsquare" in the Extensions view.
- **Cursor, VSCodium, Windsurf and other VS Code forks:** install [tsquare from Open VSX](https://open-vsx.org/extension/tsquare-js/tsquare-vscode).

## What it does

- **Live preview:** open it with **Cmd+K V** (Ctrl+K V on Windows and Linux) or the preview button in the editor's title bar. It follows the `.tsq` file you're editing; zoom, pan, and click a screen's name to zoom to it.
- **Problems as you type:** each mistake is underlined on its line and listed in the Problems panel, with a "did you mean" when there's a close match.
- **Highlighting and autocomplete** for components, props, options, icon names and colors, and a color picker for `accent=#…` and flow `color=#…`.
- **Export and share** from the preview's `…` menu: **Export SVG…**, **Copy Image Link** (a tsquare.dev image link, as in [Embedding](embedding.md)), and **Open in Playground**.

## Privacy

The preview, problems and SVG export run on your machine; nothing is sent anywhere. Copy Image Link and Open in Playground make tsquare.dev links that contain your wireframe's text, and opening one sends that text to tsquare.dev to render it. See the [privacy page](/privacy).

The extension's code and issues are at [tsquare-js/tsquare-vscode](https://github.com/tsquare-js/tsquare-vscode).
