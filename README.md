# Hide Excluded Files MORE

An Obsidian plugin that hides files matched by the core **Excluded files** setting from the built-in Quick Switcher and editor link suggestions.

## Features

- Removes excluded files from Quick Switcher results.
- Removes excluded files from the link suggestion candidate list and results.
- Uses Obsidian's own excluded-file matcher, including its configured path patterns.
- Keeps Obsidian's global metadata index unchanged, so other features and plugins retain their existing behavior.

## Compatibility

Obsidian does not expose public APIs for filtering the built-in Quick Switcher or its core link suggester. This plugin therefore hooks into internal Obsidian APIs. Those internals may change without notice, and an Obsidian update may temporarily break compatibility.

Excluded files remain in Obsidian's global metadata index. The plugin filters them from the two requested candidate sources only; it does not change Search, Graph, backlinks, or other plugins.

## Installation

Install **Hide Excluded Files MORE** from Community plugins, or install it manually by placing `main.js`, `manifest.json`, and `styles.css` (if present) in `<vault>/.obsidian/plugins/hide-excluded-files-more/`.

## Development

This project uses pnpm and esbuild.

- `pnpm install --frozen-lockfile`
- `pnpm run dev`
- `pnpm run build`
- `pnpm run lint`

## Releasing

Update `version` in `manifest.json` and add the corresponding version-to-minimum-Obsidian-version entry to `versions.json`. Create a GitHub release whose tag exactly matches the manifest version, without a `v` prefix, and attach `main.js`, `manifest.json`, and `styles.css` when present.