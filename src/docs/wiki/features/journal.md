# Journal

The Journal tab is the player's own record of the campaign: pages for sessions, people met,
quests and places. A page can hold checklists: a line that starts `[ ]` or `[x]` is a tickable
checkbox. Beside the pages it holds **trackers**: counters the player makes up, grouped by tag.
Each page has an optional tag that groups it, the dates it was written and
edited, and the same markdown grammar as the section notes. The Section Notes card below it is
covered by [Story & notes](story-and-notes.md).

**Code:** `jnlPages()`, `tagLabel()`, `tagKey()`, `groupByTag()`, `attrSel()`, `jnlSort()`,
`jnlMatch()`, `jnlSnippet()`, `jnlSavePage()`, `jnlDeletePage()`, `jnlTagList()`,
`jnlGroupOpen()`, `jnlStampText()`, `insertLine()`, `insertMarker()`, `insertCheckboxInto()`,
`insertJournalCheckbox()`, `jnlTogglePage()`, `jnlToggleCheckbox()`, `jnlToggleAfterCombat()`, `renderJournal()`, `jnlOpen()`, `jnlBack()`,
`jnlNewPage()`, `jnlEdit()`, `jnlDone()`, `jnlInput()`, `jnlDelete()`, `insertJournalStamp()`,
`toggleJnlGroup()` in `87-journal.js` · `groupFieldHTML()` in `80-modal-forms.js` · `TRK_TYPES`, `trkProgress()`, `trkApply()`, `trkStep()`,
`trkSetValue()`, `trkClose()`, `trkReopen()`, `trkSnapshot()`,
`trkRestore()`, `trkFromForm()`, `trackerRowHTML()`, `trkSplit()`, `trkAfter()`, `showTrackers()`, `migrateTrackerPages()`,
`trkTotalOn()`, `trkGroupTotal()`, `toggleTrkTotal()`,
`renderTrackers()`, `trkPatchRow()`, `trkAct()`, `trkNextControl()`, `undoTrackerChange()`,
`commitTrackerValue()`, `openTrackerForm()`, `reopenTracker()` in `87-trackers.js` ·
`endFightAfterLists()`, `endFightAfterSection()`, `endFightPaintTrackers()`, `endFightTick()` in
`87-combat-end.js` ·
`NOTE_SECTIONS`, `noteCheckboxes()`, `toggleCheckbox()`, `noteProgress()`, `noteToggleCheckbox()` in
`87-notes.js` · `openerSelector()` in `80-modal-forms.js` · `commitBox()` in
`90-boot.js` ·
markup `src/html/60-journal.html` · `47-journal.css` ·
`renderAll()` in `66-coins-hp.js`, `refreshRulesUI()`, `openSettings()` in `88-settings.js` · `repairIds()`,
`migrate()` in `71-char-io.js` · **Tests:** `sheet.js`, `rules-data.js` · **See also:**
[Story & notes](story-and-notes.md), [Rich text](../architecture/rich-text.md),
[Character model](../architecture/character-model.md)

## How it works

**Pages.** `character.journal` is a list of `{id, title, tag, text, at, editedAt}`, plus
`afterCombat:true` on a page flagged "Show after combat" (#105; absent when off). A page exists
only while its title or its text has something in it, which is the section notes' rule.
`jnlSavePage()` applies it. Given the draft being edited (`{id, at}`) and the three fields, it:

- adds the page on the first real input;
- updates it after that;
- removes it once title and text are both cleared.

`at` is set once, when the page is first added, and the draft keeps it. So a page cleared and typed
again keeps its date. `editedAt` moves only when a field changed. A tag on its own is not content.

**Tags.** `tagLabel()` trims a tag and collapses its runs of spaces, and reads a reserved name
(`GROUP_RESERVED`: `constructor`, `__proto__` and the other `Object.prototype` names) as no tag, so
the box refuses one and a file's reads as Untagged — see
[Sections & layout](../ui/sections-and-layout.md). `tagKey()` lower-cases that, so
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

**Checklists (#95).** A line in a page's text that starts `[ ]`/`[]` (unchecked) or `[x]`/`[X]`
(checked), a leading bullet allowed and dropped, with words after it, is a checkbox — the same
grammar as the section notes ([Rich text](../architecture/rich-text.md) §3). `noteCheckboxes(text)`
lists them in order; `toggleCheckbox(text,n)` flips the `n`th (0-based, counted over the checkbox
lines of the whole text) and leaves every other byte alone; `noteProgress(text)` is `{done,total}`
over them. A tap on `[data-ck]` in the page's read view calls `jnlToggleCheckbox(n)`, which goes
through `jnlTogglePage(id, n)` (#105): it rewrites that line, stamps `editedAt`, saves and redraws,
and `jnlToggleCheckbox()` puts focus back on the same box. It is refused while the page is being
edited — the text is in a textarea then, and no box is on screen — and when the page the tap
belonged to is gone (another tab switched, an import). `jnlTogglePage()` is the one writer for a
page by id, so the End of combat window ticks through it too (below); it refuses while **that** page
is open in the editor, whose next keystroke (`jnlInput()`) would write the textarea's old text back
over the tick. Section notes and
the Bio tab's rich-text fields tick the same way ([Story & notes](story-and-notes.md)); a box in
a pack's description is drawn and does nothing. Each box is named by its item in plain words
(`noteCkLabel()`), its state left to `aria-checked`. The page list
(`jnlEntryHTML()`) and the page's own meta line (`journalPageHTML()`) show `done/total` next to the
title whenever a page has any checkboxes; a page with none shows nothing. **Insert checkbox**
(`data-jnlck` → `insertJournalCheckbox()` → `insertCheckboxInto("jnlText")`) puts `[ ] ` on its own
line at the caret and leaves the caret right after the marker, since the next thing typed is the
item; the section-note editor offers the same button on `#noteText`. Both share one pure helper,
`insertMarker()`, which differs from `insertLine()` (the timestamp's helper) only in where the
caret lands.

**Trackers.** `character.trackers` is a list of
`{id, name, type, tag, value, goal, autoClose, closed, closedAt, at}`, plus `afterCombat:true` when
flagged (#105), with
`trackerCollapse` (shut tag groups), `trackerTotals` (per-tag group totals, #93) and `showTrackers`
(read as `!== false`). Every tracker is a counter:

| `type` | Progress (`trkProgress()`) | Complete when |
|---|---|---|
| `counter` | `value` of `goal` | it has a goal and `value ≥ goal`; with no goal (a kill count), never |

Counts are whole numbers and never below 0 (`trkInt()`), and they may pass the goal. Only a real
`true` ticks anything.

**Sheets from before #95.** `migrateTrackerPages()` runs inside `migrate()`, after the list guards
and `repairIds()` and before the collapse-map repair, and takes every tracker whose **raw** `type`
is `checklist` or `task` out of `trackers` and turns it into a journal page (spec §5): a checklist
becomes one page, its name as the title, its items as `[ ]`/`[x]` lines in order; tasks become one
"Tasks" page per tag (including the untagged), one line per task. A closed checklist keeps each
item's own tick and gains a trailing "Closed `<date>`" line; a closed task is ticked (a task's only
state is done) and its date is appended to its own line instead ("— closed `<date>`"). Dates are
written with `Date`'s `toLocaleDateString`, not `fmtWhen()`'s relative "3h ago", which would freeze wrong
on a page once read; a `closedAt` no calendar holds writes no date at all, never "Invalid Date". The pages get fresh `uid()`s. Nothing a player recorded is dropped — only
`autoClose` and `goal`, which mean nothing on a page, don't carry over. It is idempotent by
construction: afterwards no tracker has either raw type, so a second run (and a stale export
imported later) finds nothing to migrate, with no pass counter or flag to keep in step.

**Tiles and totals (#93, #94).** An open tag group lays its trackers out as `.trk` tiles in a
wrapping `.trk-group` row — two across on a phone, more on a wider screen, a lone tile never
stretching the full width. Completed stays a list of rows: a record, not a dashboard. The group
header carries a Σ button (`data-trktotal`, `toggleTrkTotal()`), always named "Total for `<tag>`",
whether it is on read from `aria-pressed`; on, it shows the tag's total after
the group's tracker count ("Kills (3) · 42"), read from `trkGroupTotal()`, which sums **every** counter with that tag — open or
closed — so completing one never drops the total. The switch itself is stored in
`character.trackerTotals[tagKey]`, read through `trkTotalOn()`: absent or anything but a literal
`true` is off, the same convention as the collapse maps.

**The close rule** lives in `trkApply()` alone. A row control (`trkStep()`, `trkSetValue()`)
is applied. If that took the tracker from not done to done,
and `autoClose` is on (the default), it sets `closed` and `closedAt`. The form (`trkFromForm()`)
never closes anything, and neither does making a tracker. `trkReopen()` leaves the progress alone,
so a tracker reopened at 100% stays open until it drops below and comes back. `trkClose()` is the
manual close. Undo is `trkSnapshot()` before the tap and `trkRestore()` after it: the tick and the
close go back together.

**Layout.** `trkSplit()` groups the open trackers by tag (A to Z, Untagged last, in the order they
were made), and lists the closed ones newest-closed first.

**The Trackers card** (`#trackersCard`) sits between the Journal and Section Notes cards, with
**+ Tracker** (`#addTracker`) in its heading. `renderTrackers()` draws the open trackers in their
tag groups (collapsible, stored in `trackerCollapse`), then **Completed (n)**, shut by default and
session only. A row is − · a count box · +, with "of N" and a bar (`role="progressbar"`) when it
has a goal.

Every tap goes through `trkAct()`, which snapshots the tracker, applies the tap, schedules the save,
then redraws. The save comes first, so nothing a redraw throws can cost the tap. The redraw puts
focus back on the same control by its first `data-*` hook (`openerSelector()`). A button clicks
again on each repeat of a held Enter, so holding Enter on + keeps counting. Space clicks once, on
key-up.

The count box commits on change or Enter through `commitTrackerValue()`, and anything but digits
puts the stored count back. The two differ:

- **change** fires as the box loses focus, which happens at the mousedown on + or on a Tab. So it
  does not redraw. `trkAct()`'s `inPlace` flag has `trkPatchRow()` write the new count into the row
  where it stands: the box, the bar's `aria-valuenow` and width, and the group header's total
  (`.trk-total`) when the group shows one, so the total never lags a typed count. A non-number is put back in
  place too. A redraw there used to replace the + under the pointer, so its click never arrived
  (5, type 9, click + gave 9), and it dropped a Tab's focus to the page.
- **Enter** redraws, and `commitBox()` (`90-boot.js`) selects the new box. A change that closes the
  tracker redraws as well, because its row has to leave for Completed.

If the tap closed the tracker, `trkAct()` shows a toast with **Undo** (`undoTrackerChange()`). Its
`who` is the character **object** the toast was shown for, so it can't act on another sheet, not
even one imported over this one under the same id. A tap from the keyboard moves focus to that Undo,
Enter in the count box included: `commitTrackerValue()` takes a `viaKey` flag from `commitBox()` and
threads it through to `trkAct()`. Tab or Esc from the Undo goes on to the next tracker. `trkAfter()`
lists the open trackers drawn after this one, taken before the tap while it still has its place,
skipping shut groups. `trkNextControl()` returns the first control of the first of them still open
and on screen, for the toast to focus. With none left, it returns + Tracker.

**The form** (`openTrackerForm()`) holds Name, Tag (the group field with the tags in use), Goal,
Close when complete — which shows only once there is a goal to complete — and **Show after combat**
(`#tkAfter`, #105), saved through `trkFromForm()` as `afterCombat:true` or no field at all. An existing tracker
also has **Close now** (or **Reopen**) and
**Delete**. The toast sits outside the modal's inert, so its Undo can land while the form is open
and swap the stored tracker for its snapshot. So Save, Close now and Delete act on the tracker as
stored **now** (`trkById()`), and a new one's Save adds the form's own object. Close now and Reopen
keep what was typed, and do what the button said when the form opened.

Closed trackers show their result and closed date, with Reopen (`reopenTracker()`). From the
keyboard, Reopen moves the row from the Completed markup back into the open one, which carries no
matching `data-*` hook either, so it lands focus on that tracker's own edit button instead, the
one hook both forms carry.

**Hidden and in combat.** Settings → Sheet display → Trackers card sets `showTrackers`, and
`renderTrackers()` hides the card with `display:none`, keeping it in the DOM, which the section
registry requires. Trackers is an entry in `NOTE_SECTIONS` (tab `journal`), so it takes a
section note and can be added to the combat view like any registered card. Hidden, it is skipped
by the combat view.

**Show after combat (#105).** A page or an open tracker with `afterCombat:true` appears in the
[End of combat window](combat-view.md)'s After combat row when a fight ends — unless the Journal tab
is hidden (#52), and trackers only while the sheet shows them (`showTrackers`).
- **Tiles without the pen.** The window draws `trackerRowHTML(t, {noEdit:true})`: the tracker form
  would replace the window (the modal has one layer) and lose what it holds. `trackersHTML()` maps
  with `t=>trackerRowHTML(t)`, so the index never arrives as `opts`.
- **Every copy patched.** `trkPatchRow()` writes into every `[data-trk]` tile with that id, and
  `renderTrackers()` redraws the window's copy (`#ecTrkList`, through `endFightPaintTrackers()`)
  beside the tab's, putting focus back inside whichever list held it. `commitTrackerValue()` notes
  which list the typed box sat in and returns to the box in that same list, since both lists carry
  the same hooks. So + in the window moves the Journal tab's tile too.
- **Pages tick there.** A page shows its title and `noteHTML()` text, scrolling inside its box when
  long. The `[data-ck]` dispatcher (`90-boot.js`) sends a box inside `[data-ecpage]` to
  `endFightTick()`, which writes through `jnlTogglePage()` (so the tab redraws too) and redraws that
  page's body, focus back on the same box.
- **Nothing changes on its own.** Ending a fight never bumps a tracker or ticks a box.

**The card.** `#journalCard` is the first card on the Journal tab, with **+ Page** (`#jnlNew`) in
its heading. `renderJournal()` draws `#jnlBody` in one of three views, held in the session-only
`jnlUI` (`{who, open, editing, draft}`). It is keyed on the character **object**, so a switch
starts at the list and clears the search. That includes Import → Replace, which keeps the id but
swaps the sheet: keyed on the id, an editor open at the time survived the replace, and its next
keystroke wrote the old text over the imported page. `trkWho` (Completed's open state) is keyed
the same way. The three views:

- **the list** (`journalListHTML()`): the search box (`#jnlSearch`), then the tag groups. Each
  page is a button (`data-jnlopen`). A group header is a `role="button"` toggle, stored in
  `journalCollapse`. While a search is typed, every group is open and its header is plain text;
- **a page** (`journalPageHTML()`): ← All pages, the title as a focusable heading (`#jnlHead`,
  focused on open), the tag, the dates (`noteWhen()`), Edit, Delete, and the text through
  `noteHTML()`. The search row is hidden. A page with no text yet shows "Nothing written yet — tap
  Edit." in place of the body — or just "Nothing written yet." when the Journal card's edit buttons
  are hidden (`editHidden(character,"journal")`, #97), since naming a button that isn't there would
  confuse. Edit and Delete carry `ed`, so hiding the card hides them with everything else on it
  ([Sections & layout](../ui/sections-and-layout.md));
- **the editor** (`journalEditorHTML()`): title, tag with the tags in use as suggestions (the group
  field, `groupFieldHTML()`, which the feature form's Source and the item form's Category share), the
  text, **Insert timestamp**, **Insert checkbox**, a **Show after combat** switch (`[data-jnlac]`,
  #105), the formatting key (`NOTE_FMT_HINT`) and Done. The switch (`jnlToggleAfterCombat()`) is
  patched in place, never rebuilding the editor. A saved page takes it at once and keeps its
  `editedAt` (a flag is not content); a draft that is not a page yet holds it until its first
  keystroke makes the page (`jnlSavePage()` carries `draft.afterCombat` over). Every keystroke calls
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
  hold a quote, and an id from a file a newline. Either makes `querySelector` throw. `attrSel()` and
  `openerSelector()` backslash a quote or backslash, and write a newline, return or form feed as its
  CSS hex code and a space.
- **`renderJournal()` never rebuilds an open editor.** It checks for a `[data-jnlfield]` in
  `#jnlBody` first. Anything that must replace the editor empties the box first, as starting an
  edit does.
- **Only `trkApply()` closes a tracker on its own**, and only on the transition to complete. A
  second path would re-close a tracker the player just reopened.
- **The count box's change never redraws a row that stays.** `change` fires at the mousedown on +
  or at a Tab, and a redraw there eats the click or the focus. Only Enter and a closing change
  redraw.
- **The Enter handler calls `e.preventDefault()` before `commitBox()`** for `[data-coin]`,
  `[data-hp]` and `[data-trkval]` (`90-boot.js`). A browser fires Enter's default action, a
  synthetic click, at whatever has focus once the handler returns. A completion moves focus to the
  toast's Undo, so without the early `e.preventDefault()` the same Enter clicked Undo and silently
  reverted the completion it had just made.
- **Session state keys on the character object, not its id** (`jnlUI.who`, `trkWho`, the Undo's
  `who`). Every switch puts a new object in `character`, and Import → Replace keeps the id.
- **Only `migrateTrackerPages()` reads a tracker's raw `type`; everything else reads `trkType()`,
  which is `counter`.** A hand-edited `"type":"checklist"` added after #95 shipped still migrates on
  its next load, and anything else — junk included — reads as a counter, as it always did.
- **A page's tick goes through `jnlTogglePage()`, from either surface (#105),** and is refused while
  that page is open in the editor.
- **Every copy of a tracker tile is patched (#105).** A selector that finds the first tile only would
  leave the Journal tab's or the End of combat window's copy stale.
- **A tap on a checkbox rewrites one line and nothing else; `toggleCheckbox()` is the only
  writer.** It flips the `n`th checkbox line and leaves every other byte — bullet, indent, the rest
  of the text — exactly as it was.
- **The Σ is a button inside the header: both the click and the keydown fold handlers ignore
  it.** A tap on it must switch the total, not fold or unfold the group it sits in.

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| How pages are organised | An optional free-text tag, grouped | Fixed categories: a player can't add their own. A flat list: no structure for a long campaign |
| What "timestamp" means | Created and edited dates, plus Insert timestamp (a bold line) | Dates only: no way to mark entries in a session log. A heading stamp: too heavy for a line per entry |
| Page order | Newest created first | Last edited first: the list reshuffles while you tidy. Alphabetical: a session log needs numbered titles |
| Where a blank page goes | Never saved: a page exists only while it has a title or text | Discard on leave: a tab switch, a character switch or a reload each need their own hook, and one would be missed |
| Editing | Inline, built once | The section notes' modal: too small for a session's worth of writing |
| Existing checklist and task trackers (#95) | Migrated into journal pages by `migrate()`: a checklist becomes a page, its items as `[ ]`/`[x]` lines; the tasks of one tag merge into one page. Trackers becomes counters only | Read-only in Completed: two homes for one idea until 2.0. Migrate and keep a copy: every list twice |
| A checkbox in a rendered page (#95) | Tickable in the read view: a tap flips it and rewrites that line to `[x]` | Read-only until Edit: three taps a tick. A second task syntax with a cross-page roll-up: a second grammar to learn |
| Closed checklists and tasks (#95) | Migrated too: a closed checklist keeps each item's real tick and gains a "Closed `<date>`" line; a closed task is ticked with its date on its line | Every item of a closed checklist ticked (the first choice, changed at the final review): it loses the real ticks for good. Dropping them: deletes a record a player may be keeping. A "Completed" tag: hides them from the tag they were filed under |
| Progress in the page list (#95) | A "3/5" count on the row of a page that has checkboxes; nothing on one that hasn't | No count: the tracker-at-a-glance feel is lost. A bar as well: row height on a phone |
| Section notes, Story fields and checkboxes (#95) | Same grammar, tickable in all three: a tap in the Section Notes card writes back to `secNotes`, and one in a Story rich-text field's read view to that field | Render but not tick: one mark, two behaviours. Journal only: `[ ]` in a section note would look broken |
| The checkbox editor (#95) | An Insert checkbox button beside Insert timestamp, and `[]` accepted as unchecked | Syntax only: `[` is two taps away on a phone keyboard. Enter continuing the list: Enter-magic in a textarea surprises, and needs an escape |
| Tasks on migration (#95) | One page per tag, titled "Tasks", one line per task; a closed task's date on its line | One page per task: a page for every one-liner |
| Tracker types | ~~Counter (optional goal), checklist, task~~ — **counter only since #95**, checklist and task migrated to journal pages | Counter and checklist only: a one-line to-do becomes a one-item list. A separate Progress type: a counter with a goal already is one |
| Closing at 100% | Close when complete, on by default, only on the step to complete, with an Undo of the whole tap | Offer a Close button: a tap on every completion. Always automatic: no way to keep a finished checklist in view |
| Hiding the card | Per character, in Settings → Sheet display | App-wide: the sheet's other display choices are per character |
| Trackers in the combat view | A registered section, so it also takes a section note | A combat-only list beside the registry: a second list of sections to keep in step |
| The post-combat flag (#105) | **A per-tracker and per-page switch, "Show after combat"**: flagged open counters appear in the End of combat window as their tiles, flagged pages as their text with tickable boxes; nothing changes automatically | Prompting a value per tracker: the tile's + already does it. Titles as links: closes the window to act |
| Tracker text | Plain, `esc()` only | The notes grammar: a glossary pass per tap, and a chip inside a checkbox button |
| Tracker layout (#93, #94) | Compact tiles in a wrapping row per tag group; Completed stays a list of rows | A total tile: looks tappable. A sideways scroller: hides tiles on a phone. Tiles for Completed too: it's a record, not a dashboard |
| What a group total counts (#93) | Every counter with that tag, open or closed, so completing one never drops the total; shown as the bare total in the group header, switched by a Σ button, stored in `trackerTotals[tagKey]` | Open only: closing a counter subtracts it. "42 of 60" when all have goals: the form changes as counters are added |

## Open

- Journal pages and trackers don't print. A long campaign journal could run to many pages.
- Trackers have no reset on a rest.
- The Σ is a `<button>` nested in the `role="button"` group header, so assistive tech may flatten
  the header and never reach it. Restructuring the header pattern, which the journal's, the
  section notes' and the trackers' groups share, is likely 2.0's ([Known issues](../roadmap/known-issues.md)).

## History

- 2026-09-29 — Journal pages: tags, search, timestamps, the page rule; the card and its editor. → ledger L4793, #40
- 2026-09-29 — Trackers: counters, checklists and tasks that close themselves when done, with Undo; registered section 20, in the combat view; hideable per character. → ledger L4822, #41
- 2026-09-29 — Review fixes: a typed count patches its row, so the + click and Tab survive; Tab from Undo goes to the next tracker; newline-safe selectors; session state and Undo keyed on the character object; the form survives an Undo and keeps what was typed. → ledger L4856, #41, #40
- 2026-10-16 — The tag box is the shared group field, unchanged on screen; features and items use it too. → ledger L5823, #98
- 2026-10-16 — A tag named for an `Object.prototype` property is refused, and reads as Untagged from a file; Done waits until it is changed. → ledger L5872, #98
- 2026-10-17 — Checklists and tasks leave trackers for journal pages: a [ ]/[x] line is a tickable checkbox in a page and a section note, the list shows progress, existing checklist and task trackers migrate into pages; Trackers keeps counters only (#95). Groups show an optional total (#93) and lay out as tiles (#94). → ledger L6047, #95, #93, #94
- 2026-10-17 — Final review: a typed count moves the group total; the Σ is always "Total for <tag>"; a box is named by its item; Story fields tick too; a closed checklist keeps its real ticks; a junk date writes none. → ledger L6057, #95, #93
- 2026-10-19 — The Journal card's pencil hides a page's Edit and Delete; a blank page's empty line drops "— tap Edit" while they're hidden. → ledger L6248, #97
- 2026-10-23 — The Story tab is Bio; By ability's hidden Skills card is gone. → ledger L6633, #103
- 2026-10-24 — The ☰ section flyout is retired; a hidden Trackers card is skipped by the combat view only. → ledger L6804, #103
- 2026-10-29 — "Show after combat" on trackers and pages (`afterCombat`); the End of combat window shows the flagged tiles without the pen and the flagged pages, tickable through `jnlTogglePage()`; every copy of a tile is patched. → ledger L7921, #105
