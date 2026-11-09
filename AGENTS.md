# AGENTS.md — YT Playlist Series Gap

Read the collection rules first: [`../AGENTS.md`](../AGENTS.md). Documentation lives once in
`c:\ws\docs\okf\` — do not create an `okf/` copy here.

## What this repo is

One userscript, one job: find missing and duplicate episode numbers in a playlist by parsing
titles. Read-only.

## Non-negotiables

1. **Exactly one context-menu entry**, `Settings…`, calling `Ytk.openSettings`.
2. **No `innerHTML`.** Output uses `Ytk.kv`, `Ytk.note`, `Ytk.panel`.
3. **Shared toolbar and shared panel only.** No custom bar or second panel.
4. **Parsing lives in the core.** `Ytk.parseEpisode` decides what an episode number is. Do not
   add a second regex table here — a pattern added in one place and not the other is how the
   two answers start disagreeing.
5. **Never guess.** An unparseable title is skipped and counted, not assigned a number.
6. **Core is required, pinned:** `@require …/yt-core-lib-1.2.0.js`.

## Why the code looks the way it does

- **Grouping is explicit.** With *Group by season* on, `S2E5` is checked inside season 2;
  titles with no season go into a "Season unknown" pool. Without grouping, a season 2 restart
  looks like dozens of duplicates.
- **The range is observed, not assumed.** Missing numbers are computed between the lowest and
  highest number actually present, so a series starting at episode 2 does not report 1.
- **Duplicates show their titles.** A bare "duplicate 7" is not actionable; the panel lists the
  rows that share the number (capped at 12).
- **Loaded rows only.** Continuations render on scroll. The panel says so, because a gap
  computed from half a playlist is a false alarm — the one failure mode that makes this script
  untrustworthy.
- **Settings survive because of `onSave`.** Core 1.2.0's `openSettings` rebuilds
  `ytk.settings` from its own defaults and drops keys it does not know
  (`seriesGapMinTitles`, `seriesGapBySeason`, `seriesGapShowUnnumbered`). The `onSave` merge
  restores them.

## Verification before claiming a change works

```bash
node --check yt-playlist-series-gap.user.js
grep -c "GM_registerMenuCommand(" yt-playlist-series-gap.user.js   # must be 1
grep -c "innerHTML" yt-playlist-series-gap.user.js                 # must be 0
```

Then run it against a series playlist whose gaps you already know (one with a deleted episode,
one with a re-upload). Static checks alone are not a live test.
