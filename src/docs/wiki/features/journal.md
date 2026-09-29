# Journal

The Journal tab is the player's own record of the campaign: pages for sessions, people met,
quests and places. Each page has an optional tag that groups it, the dates it was written and
edited, and the same markdown grammar as the section notes. The Section Notes card below it is
covered by [Story & notes](story-and-notes.md).

**Code:** `jnlPages()`, `tagLabel()`, `tagKey()`, `groupByTag()`, `attrSel()`, `jnlSort()`,
`jnlMatch()`, `jnlSnippet()`, `jnlSavePage()`, `jnlDeletePage()`, `jnlTagList()`,
`jnlGroupOpen()`, `jnlStampText()`, `insertLine()` in `87-journal.js` · `repairIds()`, `migrate()`
in `71-char-io.js` · **Tests:** `sheet.js` · **See also:** [Story & notes](story-and-notes.md),
[Rich text](../architecture/rich-text.md), [Character model](../architecture/character-model.md)

## How it works

**Pages.** `character.journal` is a list of `{id, title, tag, text, at, editedAt}`. A page exists
only while its title or its text has something in it, which is the section notes' rule.
`jnlSavePage()` applies it. Given the draft being edited (`{id, at}`) and the three fields, it:

- adds the page on the first real input;
- updates it after that;
- removes it once title and text are both cleared.

`at` is set once, when the page is first added, and the draft keeps it. So a page cleared and typed
again keeps its date. `editedAt` moves only when a field changed. A tag on its own is not content.

**Tags.** `tagLabel()` trims a tag and collapses its runs of spaces. `tagKey()` lower-cases that, so
"Quests" and "quests" are one group. Untagged is the key `""`. `groupByTag()` returns groups A to Z
with Untagged last. Each group is labelled by the first spelling met and keeps the order it was
given. `jnlTagList()` offers every tag in use on pages and trackers together.

**Order.** `jnlSort()` puts the newest created first. Created, not edited, so tidying an old page
does not move it.

**Search.** `jnlMatch()` is a case-blind substring match over title, tag and text, with runs of
whitespace counted as one space. It finds with an `i` RegExp (`jnlFind()`), never by lower-casing:
lower-casing can change a string's length ("İ" becomes two code units) and misplace the highlight.
`jnlSnippet()` returns an escaped excerpt around the first match in the text, with the match in
`<mark>`. It returns "" when only the title or tag matched.

**Timestamps.** `jnlStampText()` is the date and time in the player's locale, in bold.
`insertLine()` puts a line on a line of its own at a selection. It returns the new text and where
the caret goes: the start of the line after.

**Storage.** `migrate()` keeps only plain objects in `journal`, dropping arrays too, and runs
`repairIds()` over it: a number becomes text, and a missing or repeated id becomes a fresh `uid()`.
An array has to go explicitly because the shared list guard lets it through (arrays are objects),
and JSON drops an id set on one, so every load would give it a new id. `journalCollapse` maps a tag key
to `true` for a shut group. Readers still coerce every field (`jnlStr()`, `jnlTime()`), since the
guard reaches only the top level.

## Rules that must hold

- **A blank page is never saved.** Every write goes through `jnlSavePage()`. No clean-up pass
  exists, and none is needed.
- **Search never lower-cases to find.** A match found in a lower-cased copy sits at the wrong index
  in the original.
- **Tags group by `tagKey()`, and a selector built from one goes through `attrSel()`.** A tag can
  hold a quote, and that makes `querySelector` throw.
