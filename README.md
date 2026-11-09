# YT Playlist Series Gap

Reads episode numbers out of titles and reports missing and duplicate numbers in range. Read-only.

## Where it runs

playlist pages and the watch-page playlist panel

## Install

Read the [install guide](https://github.com/chirag127/userscript-install-guide), then:

```
https://github.com/chirag127/yt-playlist-series-gap-userscript/raw/main/yt-playlist-series-gap.user.js
```

Requires [`yt-core-lib`](https://github.com/chirag127/yt-core-lib), pulled in with `@require`.
You do not install the core yourself.

## Settings

Exactly one context-menu entry, called **Settings…**. It opens the shared in-page popup with:

- this script's own settings
- the shared AI section (the key is entered once and used by every script)
- buttons that run this script's actions

## What it does NOT do

- It never modifies your playlist.
- Videos without an episode number are ignored, so an unnumbered upload looks like a gap.

## License

MIT