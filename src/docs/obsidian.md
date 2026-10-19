# Obsidian

The tsquare plugin draws ```` ```tsquare ```` code blocks as wireframes in your notes, on desktop and mobile.

Install it from **Settings → Community plugins → Browse**: search for "tsquare", select **Install**, then **Enable**. It's listed at [community.obsidian.md/plugins/tsquare](https://community.obsidian.md/plugins/tsquare).

## Use it

Write a wireframe in a `tsquare` code block:

````markdown
```tsquare
board "Sign in"
  screen phone
    heading "Welcome back"
    input "Email"
    button primary "Sign in" fullWidth
```
````

- **In the note:** reading view and live preview show the board, sized to fit the note. In live preview the block shows its text while the cursor is inside it, like any code block: click outside it (or press Cmd/Ctrl+E for reading view) to see the board again.
- **Full size:** select the board, or the expand button at its bottom right. Zoom with the buttons, a pinch or Ctrl/Cmd + scroll, drag to pan, and select a screen's name to zoom to it. `+` and `-` zoom, `0` fits the board, Esc closes it.
- **Problems:** if the text has a mistake, the block lists each problem with its line number, with a "did you mean" when there's a close match.

The [language](language.md) and [components](components) pages cover what you can write; the [playground](/playground) has examples to start from.

## Privacy

Boards are drawn on your device by the tsquare library inside the plugin. It works offline, makes no network requests, and collects nothing.

The plugin's code and issues are at [tsquare-js/tsquare-obsidian-plugin](https://github.com/tsquare-js/tsquare-obsidian-plugin).
