# Journal

The Journal tab is the player's own record of the campaign: pages for sessions, people met,
quests and places. Beside the pages it holds **trackers**: counters, checklists and one-line tasks
the player makes up, grouped by tag. Each page has an optional tag that groups it, the dates it was written and
edited, and the same markdown grammar as the section notes. The Section Notes card below it is
covered by [Story & notes](story-and-notes.md).

**Code:** `jnlPages()`, `tagLabel()`, `tagKey()`, `groupByTag()`, `attrSel()`, `jnlSort()`,
`jnlMatch()`, `jnlSnippet()`, `jnlSavePage()`, `jnlDeletePage()`, `jnlTagList()`,
`jnlGroupOpen()`, `jnlStampText()`, `insertLine()`, `renderJournal()`, `jnlOpen()`, `jnlBack()`,
`jnlNewPage()`, `jnlEdit()`, `jnlDone()`, `jnlInput()`, `jnlDelete()`, `insertJournalStamp()`,
`toggleJnlGroup()` in `87-journal.js` · `TRK_TYPES`, `trkProgress()`, `trkApply()`, `trkStep()`,
`trkSetValue()`, `trkToggleItem()`, `trkToggleTask()`, `trkClose()`, `trkReopen()`, `trkSnapshot()`,
`trkRestore()`, `mergeChecklist()`, `trkFromForm()`, `trkSplit()`, `showTrackers()`, `renderTrackers()`,
`trkAct()`, `undoTrackerChange()`, `commitTrackerValue()`, `openTrackerForm()`, `reopenTracker()` in
`87-trackers.js` · `NOTE_SECTIONS` in `87-notes.js` ·
markup `src/html/60-journal.html` · `47-journal.css` ·
`renderAll()` in `66-coins-hp.js`, `refreshRulesUI()`, `openSettings()` in `88-settings.js` · `repairIds()`,
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

**Trackers.** `character.trackers` is a list of
`{id, name, type, tag, value, goal, items, done, autoClose, closed, closedAt, at}`, with
`trackerCollapse` (shut tag groups) and `showTrackers` (read as `!== false`). The type is one of:

| `type` | Progress (`trkProgress()`) | Complete when |
|---|---|---|
| `counter` | `value` of `goal` | it has a goal and `value ≥ goal`; with no goal (a kill count), never |
| `checklist` | ticked `items` of all | it has items and every one is ticked |
| `task` | — | `done` |

Counts are whole numbers and never below 0 (`trkInt()`), and they may pass the goal. Only a real
`true` ticks anything.

**The close rule** lives in `trkApply()` alone. A row control (`trkStep()`, `trkSetValue()`,
`trkToggleItem()`, `trkToggleTask()`) is applied. If that took the tracker from not done to done,
and `autoClose` is on (the default), it sets `closed` and `closedAt`. The form (`trkFromForm()`)
never closes anything, and neither does making a tracker. `trkReopen()` leaves the progress alone,
so a tracker reopened at 100% stays open until it drops below and comes back. `trkClose()` is the
manual close. Undo is `trkSnapshot()` before the tap and `trkRestore()` after it: the tick and the
close go back together.

**Checklist items** are typed one per line in the form. `mergeChecklist()` gives each line the
first unused old item with exactly its text, keeping its id and tick, so reordering keeps every
tick. A leading bullet is dropped. `migrate()` repairs item ids from one pool across every tracker.

**Layout.** `trkSplit()` groups the open trackers by tag (A to Z, Untagged last, in the order they
were made), and lists the closed ones newest-closed first.

**The Trackers card** (`#trackersCard`) sits between the Journal and Section Notes cards, with
**+ Tracker** (`#addTracker`) in its heading. `renderTrackers()` draws the open trackers in their
tag groups (collapsible, stored in `trackerCollapse`), then **Completed (n)**, shut by default and
session only. The rows:

- a counter is − · a count box · +, with "of N" and a bar (`role="progressbar"`) when it has a goal;
- a checklist is its items as `<button role="checkbox">` ticks;
- a task is one such tick, labelled with its name.

The count box commits on change or Enter through `commitTrackerValue()`, and anything but digits
puts the old count back. Every tap goes through `trkAct()`, which snapshots the tracker, applies the
tap, redraws and saves. If the tap closed the tracker, `trkAct()` shows a toast with **Undo**
(`undoTrackerChange()`, guarded by the character id). A tap from the keyboard moves focus to that
Undo — including Enter in the count box: `commitTrackerValue()` takes a `viaKey` flag from
`commitBox()` (90-boot.js) and threads it through to `trkAct()`, since a closed row leaves for
Completed and has nothing left for the ordinary focus-restore to find. The redraw puts focus back
on the same control by its first `data-*` hook otherwise, so holding Space on + keeps counting.

**The form** (`openTrackerForm()`) holds Name, Type, Tag (with the tags in use), Goal for a
counter, Items one per line for a checklist, and Close when complete. The last shows only for
something that can complete. An existing tracker also has **Close now** (or **Reopen**) and
**Delete**. Closed trackers show their result and closed date, with Reopen (`reopenTracker()`) —
from the keyboard, Reopen moves the row from the Completed markup back into the open one, which
carries no matching `data-*` hook either, so it lands focus on that tracker's own edit button
instead, the one hook both forms carry.

**Hidden and in combat.** Settings → This character → Trackers sets `showTrackers`, and
`renderTrackers()` hides the card with `display:none`, keeping it in the DOM, which the section
registry requires. Trackers is the 20th entry in `NOTE_SECTIONS` (tab `journal`), so it takes a
section note and can be added to the combat view like any registered card. Hidden, it is skipped
by the ☰ flyout and the combat view, as the Skills card is in the By ability layout.

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
- **Only `trkApply()` closes a tracker on its own**, and only on the transition to complete. A
  second path would re-close a tracker the player just reopened.

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| How pages are organised | An optional free-text tag, grouped | Fixed categories: a player can't add their own. A flat list: no structure for a long campaign |
| What "timestamp" means | Created and edited dates, plus Insert timestamp (a bold line) | Dates only: no way to mark entries in a session log. A heading stamp: too heavy for a line per entry |
| Page order | Newest created first | Last edited first: the list reshuffles while you tidy. Alphabetical: a session log needs numbered titles |
| Where a blank page goes | Never saved: a page exists only while it has a title or text | Discard on leave: a tab switch, a character switch or a reload each need their own hook, and one would be missed |
| Editing | Inline, built once | The section notes' modal: too small for a session's worth of writing |
| Tracker types | Counter (optional goal), checklist, task | Counter and checklist only: a one-line to-do becomes a one-item list. A separate Progress type: a counter with a goal already is one |
| Closing at 100% | Close when complete, on by default, only on the step to complete, with an Undo of the whole tap | Offer a Close button: a tap on every completion. Always automatic: no way to keep a finished checklist in view |
| Hiding the card | Per character, in Settings → This character | App-wide: the sheet's other display choices are per character |
| Trackers in the combat view | A registered section, so it also takes a section note | A combat-only list beside the registry: a second list of sections to keep in step |
| Tracker text | Plain, `esc()` only | The notes grammar: a glossary pass per tap, and a chip inside a checkbox button |

## Open

- Journal pages and trackers don't print. A long campaign journal could run to many pages.
- Trackers have no reset on a rest, and a tag group shows no total.

## History

- 2026-09-29 — Journal pages: tags, search, timestamps, the page rule; the card and its editor. → ledger L4793, #40
- 2026-09-29 — Trackers: counters, checklists and tasks that close themselves when done, with Undo; registered section 20, in the combat view; hideable per character. → ledger L4822, #41
