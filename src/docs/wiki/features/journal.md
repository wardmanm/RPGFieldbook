# Journal

The Journal tab is the player's own record of the campaign: pages for sessions, people met,
quests and places. Each page has an optional tag that groups it, the dates it was written and
edited, and the same markdown grammar as the section notes. The Section Notes card below it is
covered by [Story & notes](story-and-notes.md).

**Code:** `jnlPages()`, `tagLabel()`, `tagKey()`, `groupByTag()`, `attrSel()`, `jnlSort()`,
`jnlMatch()`, `jnlSnippet()`, `jnlSavePage()`, `jnlDeletePage()`, `jnlTagList()`,
`jnlGroupOpen()`, `jnlStampText()`, `insertLine()`, `renderJournal()`, `jnlOpen()`, `jnlBack()`,
`jnlNewPage()`, `jnlEdit()`, `jnlDone()`, `jnlInput()`, `jnlDelete()`, `insertJournalStamp()`,
`toggleJnlGroup()` in `87-journal.js` · markup `src/html/60-journal.html` · `47-journal.css` ·
`renderAll()` in `66-coins-hp.js`, `refreshRulesUI()` in `88-settings.js` · `repairIds()`,
`migrate()` in `71-char-io.js` · **Tests:** `sheet.js`, `rules-data.js` · **See also:**
[Story & notes](story-and-notes.md), [Rich text](../architecture/rich-text.md),
[Character model](../architecture/character-model.md)

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

**The card.** `#journalCard` is the first card on the Journal tab, with **+ Page** (`#jnlNew`) in
its heading. `renderJournal()` draws `#jnlBody` in one of three views, held in the session-only
`jnlUI` (`{who, open, editing, draft}`, keyed on the character id, so a switch starts at the
list and clears the search):

- **the list** (`journalListHTML()`): the search box (`#jnlSearch`), then the tag groups. Each
  page is a button (`data-jnlopen`). A group header is a `role="button"` toggle, stored in
  `journalCollapse`. While a search is typed, every group is open and its header is plain text;
- **a page** (`journalPageHTML()`): ← All pages, the title as a focusable heading (`#jnlHead`,
  focused on open), the tag, the dates (`noteWhen()`), Edit, Delete, and the text through
  `noteHTML()`. The search row is hidden;
- **the editor** (`journalEditorHTML()`): title, tag with the tags in use as suggestions, the
  text, **Insert timestamp**, the formatting key (`NOTE_FMT_HINT`) and Done. Every keystroke calls
  `jnlInput()`, which writes through `jnlSavePage()` and schedules a save. There is no live
  preview.

**The editor is built once.** Starting an edit empties `#jnlBody`, and `renderJournal()` builds a
fresh editor only into an empty box. `renderAll()` and `refreshRulesUI()` both call
`renderJournal()`, and either can run while the player types (a rules fetch landing, a Settings
change); a rebuild would take the text, the caret and the focus. Starting an edit puts the caret
at the end of the text, so **Insert timestamp** (`insertJournalStamp()`) lands at the end until
the player clicks elsewhere in the page, then at the caret. It fires an `input` event, which saves
it.

**Delete** asks, naming the page, and returns to the list. **Back** returns focus to the page's
entry in the list.

## Rules that must hold

- **A blank page is never saved.** Every write goes through `jnlSavePage()`. No clean-up pass
  exists, and none is needed.
- **Search never lower-cases to find.** A match found in a lower-cased copy sits at the wrong index
  in the original.
- **Tags group by `tagKey()`, and a selector built from one goes through `attrSel()`.** A tag can
  hold a quote, and that makes `querySelector` throw.
- **`renderJournal()` never rebuilds an open editor.** It checks for a `[data-jnlfield]` in
  `#jnlBody` first. Anything that must replace the editor empties the box first, as starting an
  edit does.

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| How pages are organised | An optional free-text tag, grouped | Fixed categories: a player can't add their own. A flat list: no structure for a long campaign |
| What "timestamp" means | Created and edited dates, plus Insert timestamp (a bold line) | Dates only: no way to mark entries in a session log. A heading stamp: too heavy for a line per entry |
| Page order | Newest created first | Last edited first: the list reshuffles while you tidy. Alphabetical: a session log needs numbered titles |
| Where a blank page goes | Never saved: a page exists only while it has a title or text | Discard on leave: a tab switch, a character switch or a reload each need their own hook, and one would be missed |
| Editing | Inline, built once | The section notes' modal: too small for a session's worth of writing |

## History

- 2026-09-29 — Journal pages: tags, search, timestamps, the page rule; the card and its editor. → ledger L4793, #40
