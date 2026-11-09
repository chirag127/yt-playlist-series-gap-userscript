# YT Playlist Series Gap

Is this series actually complete? The **Series gaps** button reads episode numbers out of the
playlist titles and reports, per range:

- **missing** episode numbers
- **duplicate** episode numbers, with the titles that repeat
- titles it could not read an episode number from

Episode numbers come from `Ytk.parseEpisode` in the core: `S1E2`, `Episode 4`, `EP4`, `Part 2`,
`第3集`, `#7`, and titles that start with `3.` or `3)`.

## Where it runs

- `youtube.com/playlist?list=…`
- the playlist panel on a watch page

## Settings

One entry — **Settings…** — opens the shared settings popup.

| Field | Default | Purpose |
|---|---|---|
| Minimum numbered titles for a report | 3 | 2–50; below this a "no gaps" answer would be meaningless |
| Group by season when the title has one | on | `S2E5` is checked against season 2, not against everything |
| List titles with no episode number | off | shows what the parser skipped |

## Limits

- **Loaded rows only.** YouTube renders more rows as you scroll. Scroll to the end before
  trusting a gap; otherwise "missing" may just mean "not rendered yet".
- The range is the lowest to the highest episode number observed, so a series that starts at
  episode 2 is not reported as missing episode 1.
- Title parsing is deterministic and conservative. Unusual numbering (Roman numerals,
  "Episode IV", dates) is skipped rather than guessed — enable *List titles with no episode
  number* to see what was missed.
- Nothing is written anywhere.

## Install

Follow the [install guide](https://github.com/chirag127/userscript-install-guide). The script
`@require`s [yt-core-lib](https://github.com/chirag127/yt-core-lib), which is never installed
on its own.

## Docs

Collection documentation is single-sourced in the workspace bundle: `c:\ws\docs\okf\`.
