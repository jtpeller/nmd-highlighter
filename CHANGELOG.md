# Change Log

This doc details the changes to the NMD Highlighter.

Mostly based on [Keep a Changelog](http://keepachangelog.com/) for structure and concepts.

## [0.0.4] - 2026.03.21

- New Markdown Preview.
- Refinements across the extension code.
- New commands!
- New keywords!

### Added in [0.0.4]

- VSCode Command (`Ctrl + Shift + T`) to add the timestamp and the category type in a format: `[HH:MM] ${KEYWORD}:`
- VSCode Command to generate an entire month of notes. It is very customizeable:
  - Can pick a particular month to generate.
  - Can choose to include or exclude weekends (Saturday & Sunday).
  - Can control the order of days (31st counting down or 1st counting up).
  - Can control the first day of the week (e.g., Monday or Sunday).
- New keyword category: Comment. This is great for things like Notes, Comments, documentation; anything that's not super important but enough to write down.
- Markdown preview, which enables visualizing the keywords and notes you take in VSCode's Markdown Preview.

## [0.0.3] - 2026.03.21

- Massive overhaul of extension.

### Added in [0.0.3]

- Settings, which are now configurable within the VSCode Settings GUI (mostly, some are not supported and must be edited inside the `settings.json` file.)
- New keywords, which allow more flexibility.
- Support for background color specification instead of hard-coding it.
- For each 'rule', keywords, foreground color, background color, icon size, and more are all configureable at various VSCode levels.
- A few optimizations of the code to make it a tiny bit faster (probably).

## [0.0.2] - 2026.03.18

- Fix repo link.
- Compressed extension size.

## [0.0.1] - 2026.03.18

- Initial release.

### Added in [0.0.1]

- Initial Extension setup, with 6 keywords: ISSUE, BUG, TASK, FIX, DONE, and VERIFIED.
