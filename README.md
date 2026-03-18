# Notes Markdown Highlighter

Visual Studio Code (VSCode) extension for Notes Markdown, a custom file type which can be used for daily notes.

## Concept

When I write daily notes, I was using OneNote, but found that it's not exactly portable, nor is it Git friendly like Markdown is.

I decided that it would be best to utilize Markdown, but I wanted to keep the same coloring I used for each line.

## Syntax

The following keywords are recognized, along with their symbol (as a description, for now).

| Keyword  |       Color       |            Symbol             | Description                                                |
| :------: | :---------------: | :---------------------------: | :--------------------------------------------------------- |
|  ISSUE   |        red        | Exclamation point in a circle | Critical or important things that need immediate attention |
|   TASK   |       amber       |        Lightning Bolt         | Goal, task, to-do item, etc.                               |
|   BUG    |       amber       |        Lightning Bolt         | Issue to fix.                                              |
|   FIX    |       blue        |       Checkmark (blue)        | Issue or bug was fixed                                     |
|   DONE   |       green       |       Checkmark (green)       | Marks that something was finished.                         |
| VERIFIED | green (highlight) |         star (green)          | Marks that something was tested as working as intended.    |

1. ISSUE
