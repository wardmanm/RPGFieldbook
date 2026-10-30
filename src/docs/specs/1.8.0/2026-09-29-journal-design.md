# Journal — design

**Status:** implemented on branch `issue/39-journal` · 2026-09-29 — see [As built](#as-built)
**Issues:** #39 (the feature), #40 (journal pages), #41 (trackers), #81 (autosave failures are silent).
All four land on one branch, `issue/39-journal`. #40 and #41 share a tab, a fragment of markup, the
character model and the same wiki pages, and #81 is what makes a long journal safe to write. Built in
four milestones, A–D (§10), each with its own commits.

---

## 1. What it is

The **Notes tab becomes the Journal tab**, holding three cards, top to bottom:

1. **Journal**: the player's own pages (a session log, an NPC, a quest, a place), each with an
   optional tag, created and edited dates, a button that stamps the current date and time, and the
   app's markdown grammar. The list is grouped by tag and searchable.
2. **Trackers**: counters, checklists and one-line tasks the player defines and groups by tag, such
   as kills by creature type, pages of a book, or the steps of a quest. A tracker with a goal can
   close itself when it's done and move to a Completed area. The card can be hidden, and it can be
   added to the combat view.
3. **Section Notes**: exactly as today.

The branch also closes #81. A failed autosave today only changes a small label in a title bar that
scrolls away, and the journal is the first unlimited long-form text a character carries.

Why: players keep a running record of the campaign somewhere, usually outside the app, and count
things (kills, gold spent, pages read) on scraps of paper.

## 2. Decisions

Settled with Mike on 2026-09-29. The rejected options are recorded so they are not re-proposed
without the reason they lost.

| # | Question | Decision | Rejected, and why |
|---|---|---|---|
| 1 | How pages are organised | An optional **free-text tag** per page. The list is grouped by tag, and existing tags are suggested as you type | Fixed categories (Session, Character, Quest…): tidy, but a player can't invent their own. A flat list: no structure for a long campaign |
| 2 | What "timestamp them" means | Automatic created and edited dates on each page, **plus** an **Insert timestamp** button that writes the current date and time as a **bold line** | Dates only: no way to mark entries in a running session log. An editable page date: more UI for what the stamp does better. A heading stamp: too heavy for a line per entry |
| 3 | Page order in a group | **Newest created first**. Groups A→Z, Untagged last | Last edited first: the list reshuffles as you edit. Alphabetical: a session log would need numbered titles. Drag to reorder: grips and keyboard moves for little gain |
| 4 | Tracker types | **Counter** (with an optional goal), **Checklist**, **Task** | Counter and Checklist only: a one-line to-do becomes a one-item checklist. A separate Progress type: a counter with a goal already is one |
| 5 | Closing at 100% | A per-tracker **Close when complete** option, **on** by default. It fires on the transition to complete, with an **Undo** toast. Close and Reopen by hand always work | Offer a Close button and move nothing: an extra tap on every completion. Always automatic: no way to keep a finished checklist in view |
| 6 | "Toggle-able" (#41) | The player can **hide the Trackers section**, per character, in Settings → This character. Shown by default | A tick on each checklist item: that is simply how checklists work. Pausing individual trackers: not asked for |
| 7 | The kill counter (#39) | **No special kill counter.** A kill counter is just a counter the player makes. #39 was reworded to say so | A preset: the tracker is the customisable component. A counter pre-seeded on every sheet: clutter for players who don't want it |
| 8 | Trackers in the combat view | **Yes.** Trackers becomes a registered section (`NOTE_SECTIONS` 19 → 20) | A follow-up issue: Mike wanted it now. Accepted consequence: like every registered card, Trackers takes a section note |
| 9 | Printing | **Neither pages nor trackers print** in this release | Both: a long campaign journal could run to many pages. Trackers only: not asked for yet |
| 10 | Autosave failures (#81) | **Loud app-wide**: a persistent warning with the reason until a save succeeds | The journal editor only: every tab loses edits the same way. A separate branch: the journal raises the stakes now |
| 11 | Tracker text | **Plain text**, escaped | The markdown grammar: a glossary pass on every +/− tap, and a tappable chip inside a checkbox button (the trap `notePreview()` documents) |
| 12 | Counter limits | Never below 0, may pass its goal, step 1, whole numbers | Clamping at the goal: a counted-past goal is real ("read it twice") |
| 13 | Tab id | Renamed to `journal` everywhere (`tab-journal`, `data-tab="journal"`, `60-journal.html`) | Keeping `notes` inside: code and UI disagreeing is the #17-style trap, and the active tab is never saved, so nothing migrates |

## 3. Data

Per character. Every field is optional and gets a default in `blankChar()`, so a sheet saved before
this feature loads unchanged. They are the player's own state: the rules-update tool
(`72-char-update.js`) never touches them.

| Field | Type | Default | Meaning |
|---|---|---|---|
| `journal` | `object[]` | `[]` | The pages: `{id, title, tag, text, at, editedAt}` |
| `journalCollapse` | `object` | `{}` | Page-list groups the player shut, by tag key → `true` |
| `trackers` | `object[]` | `[]` | `{id, name, type, tag, value, goal, items, done, autoClose, closed, closedAt, at}` |
| `trackerCollapse` | `object` | `{}` | Tracker groups the player shut, by tag key → `true` |
| `showTrackers` | `boolean` | `true` | Read as `!== false`, like `hpColor` and `coinWeight`, so a missing or `null` value shows the card |

**A page exists only while it has a title or text.** This is the `saveNote()` rule. **New page**
opens an in-memory draft with an id and a created time, and saves nothing. The first real input
adds the page to `journal`. Clearing both title and text removes it again, and the draft keeps its
created time if the player types again. So a blank page is never saved and nothing has to clean one
up, whether the player leaves by Back, a tab switch, a character switch or a reload.

**A page's times.** `at` is set once, when the page is first added. `editedAt` moves on every change
to its title, tag or text. Both are shown through `noteWhen()`.

**A tracker by type:**

| `type` | Uses | Progress | Complete when |
|---|---|---|---|
| `counter` | `value` (whole number ≥ 0), `goal` (whole number > 0, or absent) | `value` of `goal` | it has a goal and `value ≥ goal` |
| `checklist` | `items: [{id, text, done}]` | ticked of total | it has items and every one is ticked |
| `task` | `done` | — | `done` |

`autoClose` (default `true`) is Close when complete. `closed` and `closedAt` put a tracker in the
Completed area. `at` is when it was made.

**Tag keys.** A tag is trimmed and its runs of spaces collapsed when saved. It is grouped and
collapsed by its **lower-cased** form, so "Quests" and "quests" are one group, labelled by the
first spelling met. Untagged is the key `""`, which no real tag can produce. Pages and trackers
share one suggestion list.

**`migrate()`** (`71-char-io.js`):
- `journal` and `trackers` join the list guard (objects only).
- `journalCollapse` and `trackerCollapse` join the map guard.
- Pages, trackers and checklist items get their ids repaired the way glossary entries already are:
  a number becomes a string, and a missing or repeated id gets a fresh `uid()`.
- It stays idempotent: running it twice gives the same result.

The guards reach only the top level, so every reader still coerces each field (a string where a
number belongs, `items` that isn't a list). This is the `noteMap()`/`getNote()` rule.

**Session only, never saved:** which page is open, whether it is being edited, the search text, and
whether Completed is expanded. All of it is keyed on the character's id and resets when the
character changes.

## 4. Code layout

**Two new fragments**, listed in `src/manifest.json` after `87-combat.js`. Each keeps a **pure half**
(no DOM; asserted in the harness) above a **DOM half**, as `87-combat.js` does. Neither has a
top-level statement that reads another fragment's `const`/`let`, so load order cannot trip the TDZ
rule in ADR-001. Anything `blankChar()` reads stays in `00-constants.js`.

**`src/js/87-journal.js`**

- **Pure:**

  | Function | Contract |
  |---|---|
  | `jnlPages(c)` | A clean view of `c.journal` |
  | `tagLabel(s)`, `tagKey(s)` | The display form and the grouping key |
  | `groupByTag(list, tagOf)` | `[{key, label, items}]`, A→Z, Untagged last |
  | `jnlSort(pages)` | Newest created first, stable |
  | `jnlMatch(p, q)` | A case-insensitive substring match over title, tag and text |
  | `jnlSnippet(text, q, r)` | An escaped excerpt with the match in `<mark>`, safe when lower-casing changes a string's length |
  | `jnlSavePage(c, draft, fields, now)` | Applies the rule in §3 |
  | `jnlDeletePage(c, id)` | Removes the page |
  | `jnlTagList(c)` | Tags from pages and trackers |
  | `jnlGroupOpen(c, key)` | Collapse state |
  | `jnlStampText(date)` | The stamp line |
  | `insertLine(text, start, end, line, atEnd)` | `{text, caret}` |
  | `journalListHTML`, `journalPageHTML`, `journalEditorHTML` | The markup builders |

- **DOM:** `renderJournal()`, open, back, new, edit, done and delete, `insertJournalStamp()`,
  `toggleJnlGroup()`.

**`src/js/87-trackers.js`**

- **Pure:**

  | Function | Contract |
  |---|---|
  | `trkList(c)`, `trkType(t)`, `trkItems(t)` | Clean views |
  | `trkProgress(t)` | `{done, total, pct, complete}` |
  | `trkApply(t, change, now)` | The only place the close rule (§6) lives |
  | `trkStep`, `trkSetValue`, `trkToggleItem`, `trkToggleTask` | The row controls, all through `trkApply` |
  | `trkClose`, `trkReopen` | Close and reopen by hand |
  | `trkSnapshot`, `trkRestore` | For Undo |
  | `mergeChecklist(items, text)` | §6 |
  | `trkSplit(c)` | Open trackers grouped by tag in creation order; closed ones newest first |
  | `trkGroupOpen(c, key)` | Collapse state |
  | `showTrackers(c)` | The visibility switch |
  | `trackerRowHTML`, `trackersHTML`, `trackerFormHTML` | The markup builders |

- **DOM:** `renderTrackers()`, `openTrackerForm()`, the row handlers, and `undoTrackerChange()`.

**One new CSS fragment**, `src/css/47-journal.css`, after `45-combat.css`, built only from existing
theme tokens.

**Existing code touched:**

| Where | Change |
|---|---|
| `src/html/60-notes.html` → `60-journal.html` | Renamed, with id `tab-journal`. The Journal card, the Trackers card (`<div class="card" data-note="trackers" id="trackersCard">`), then Section Notes as it is |
| `src/fieldbook.template.html` | The tab button: `data-tab="journal"`, "Journal", a new line icon (Story already uses a book and Rules a bookmark, so a ringed notebook or a quill on a page). The save warning strip (§8) |
| `00-constants.js` · `blankChar()` | The five fields |
| `71-char-io.js` · `migrate()` | Guards and id repair. `printSheet()`: the notes heading reads "Section notes" |
| `87-notes.js` | `NOTE_TABS` gains `journal:"Journal"`; `NOTE_SECTIONS` gains `{k:"trackers", tab:"journal", title:"Trackers"}` |
| `66-coins-hp.js` · `renderAll()` | `renderJournal()`, `renderTrackers()` |
| `88-settings.js` | `refreshRulesUI()` gets `renderJournal()`, since glossary chips change how a page reads. Trackers are plain text and don't need it. `#swTrackers` in the This character group |
| `90-boot.js` · `wire()` | `data-jnl-*` and `data-trk-*` branches in the delegated click handler; input and keydown branches; `on()` for `#jnlSearch` and `#jnlNew` |
| `70-persistence.js`, `71-char-io.js`, `75-home-theme.js` | #81, §8 |
| `CLAUDE.md`, `src/docs/ADR-001-source-split.md` | Fragment counts: JS 28 → 30, CSS 8 → 9 |

## 5. The Journal card

**The list** (the default view):
- A heading with **New page**, then a search box (`.searchbox`, `#jnlSearch`), then the groups.
- Each group is a `.fgroup` with a `role="button"` header, a caret and a count. Collapse is saved
  per character in `journalCollapse`.
- Each page is a `<button>` showing its title ("Untitled" when it has none) and its dates.
- Empty state: "No pages yet — tap New page to start one."

**Searching** filters as you type over title, tag and text. Groups open while a search is active,
so a shut group can't hide a match. A text match shows a short snippet with the match marked. No
matches reads "No pages match."

**A page** replaces the list inside the same card:
- ← All pages, the title as a heading, the tag, the dates, Edit and Delete, and the body rendered
  by `noteHTML()`.
- Opening a page focuses its title heading. Back returns focus to that page's entry in the list and
  scrolls the card into view.

**Editing** is inline:
- A title input, a tag input with a `<datalist>` of existing tags, a textarea, **Insert timestamp**,
  the one-line formatting key, and **Done**.
- Every keystroke writes the page (§3) and schedules a save. There is no live preview. Done shows
  the rendered page.
- **The editor is built once, when Edit is pressed.** `renderJournal()` leaves it alone while the
  same page is being edited, because `renderAll()` and `refreshRulesUI()` can run mid-typing (a
  rules fetch finishing, a settings change) and rebuilding would drop the text, caret and focus.

**Insert timestamp** writes `**Tue 29 Sep 2026, 7:42 PM**` in the player's locale, on a line of its
own, with the caret on the next line:
- If the textarea has not been focused during this edit, the stamp goes at the **end**, because a
  textarea built from markup starts with its caret at 0.
- Otherwise it goes **at the caret**.

The textarea is then refocused and an `input` event fires, so the change saves.

**Delete** asks "Delete the page "Session 3"? This can't be undone." and returns to the list.

**The ☰ flyout** lists Journal, Trackers and Section Notes, as it does any card.

## 6. The Trackers card

**The card**: `+ Tracker` in its heading, then the open trackers grouped by tag, collapsible,
saved in `trackerCollapse`, and **Completed (n)** at the bottom, collapsed.

**A row** by type:
- **Counter:** its name, then − · a value box · +. The value box commits on change or Enter,
  through `commitBox`, so typing 120 is one change. With a goal, the row also shows "`value` / `goal`"
  and a bar (`role="progressbar"` with its value, maximum and a label).
- **Checklist:** its name and "3 / 5", then one line per item. Each item is a
  `<button role="checkbox" aria-checked>`, styled like the sheet's tick boxes.
- **Task:** one such checkbox, labelled with its name.

Every row has an Edit button, which opens the form; Delete is inside the form.

Why buttons rather than inputs: a native checkbox inside a `<label>` fires the page-wide click
handler twice, and the sheet's `.equip` tick spans have no keyboard access.

**The form** (a modal, patterned on `openResourceForm()`):
- Name, Type, Tag (with the same suggestions), then by type: Goal for a counter, or Items (one per
  line) for a checklist.
- Close when complete, shown for anything that can complete, and on by default.
- **Close now** on an open tracker (any type, a goal-less counter included, for "that campaign's
  over") or **Reopen** on a closed one. This is the manual close, and it needs no Undo because it
  was deliberate.
- Delete, confirmed.

**`mergeChecklist(items, text)`** turns the lines back into items. Each non-blank line takes the
first unused old item with exactly the same text, keeping its id and tick. A new or reworded line
is a new, unticked item. Reordering keeps every tick.

**The close rule** lives only in `trkApply()`:
- A row control (−/+, a typed value, a tick) is applied.
- If the tracker went from **incomplete to complete** and `autoClose` is on, it closes: `closed`
  and `closedAt` are set.
- The form never closes anything, and neither does creating a tracker.
- **Reopen** clears `closed` and `closedAt` and leaves progress alone, so a reopened tracker at 100%
  stays open until it drops below and comes back.
- A counter without a goal, or a checklist without items, is never complete.

**Undo.** When a tap closes a tracker, a toast says "“Read the Codex” complete" with **Undo**.
- Undo restores the snapshot taken **before the tap**: the tick or step and the close together.
- It carries the character's id, as `undoCombatRemove()` does, so an old toast can't act on another
  character.
- A close made from the keyboard moves focus to Undo. Tab or Esc returns focus to the next tracker.

**Completed** lists closed trackers, newest first, each with its closed date, **Reopen** and Edit.
Whether it is expanded is session only.

**Focus.** Re-rendering the card after a tap puts focus back on the same control, found by its
unique `data-*`. So holding Enter on + keeps counting. (A button clicks once on Space, at key-up,
so a held Space does not repeat.)

**Hidden.** With `showTrackers` off, the card is `display:none` and stays in the DOM, as the section
registry requires. The ☰ flyout and the combat view skip it, as they skip the Skills card in the By
ability layout. The data is untouched.

**In the combat view** the card behaves as any other registered section: the crossed-swords toggle
in its heading adds it, the real card moves in, and every control works there. It is not one of the
six defaults.

## 7. Section Notes

Unchanged, except:
- The Trackers card takes a note like every registered section, so notes gain a **Journal** group
  after Story.
- The card count in the registry test goes from 19 to 20.
- The printed heading reads "Section notes".

## 8. Save failures (#81)

**`saveNow()`** is the body of `scheduleSave()`, lifted out so the harness, which never runs a
`setTimeout`, can call it. It writes the character, then the library index, and returns `""` or
the reason from `storageWhy()`. **`libSave()`** returns its reason instead of swallowing it.

**When a write fails:**
- A warning strip appears directly under the sticky tab bar, so it stays in view while scrolling:
  "Changes aren't being saved — your browser's storage is full."
- The strip has **Save to file** (`exportChar()`) and **Try again** (an immediate `saveNow()`).
- It stays until a write succeeds, and the `#savestate` chip shows the same state.
- It sits on every tab.

**The other character writes:**
- `finishImport()` and `newCharacter()` report a refused write the same way. The character is open
  in memory and nothing more is stored, so the strip says so.
- `migrateOldChar()` deletes the legacy key only after the copy has landed.
- The boot-time `lsOK` check, which could never fire, goes.

## 9. Edge cases

- **Character switch** with a page open, being edited, or with a search typed: the Journal returns
  to its list, the search clears, and Completed collapses. A tracker toast's Undo does nothing.
- **Redraws while typing**: see §5. A driven check calls `refreshRulesUI()` mid-typing.
- **Hostile data** (an imported file): every title, tag, name and item goes through `esc()` or a
  renderer, and every attribute value is `esc()`'d (the tokenizer in `rules-data.js` checks the new
  fragments automatically).
- **Size.** A heavy campaign journal is on the order of 150 KB a year, against a quota of about
  5 MiB shared by every character. #81 is what makes running out visible.
- **Rules update** ignores all five fields. **Export and import** carry them, because they are part
  of the character.

## 10. Milestones

| | What | Closes |
|---|---|---|
| A | Rename Notes → Journal (tab, id, fragment, icon, print heading, tests, docs) | part of #39 |
| B | Loud save failures (§8) | #81 |
| C | Journal pages (§5) | #40 |
| D | Trackers and their combat registration (§6) | #41, and with A and C, #39 |

## 11. Testing

**Unit tests** go in the existing suites, so "seven suites" stays true.

**`sheet.js`:**
- **Model:** defaults; a save → load round trip; `migrate()` keeps pages and trackers, drops
  non-objects, repairs ids (items too) and is idempotent; the junk-list block gains `journal` and
  `trackers`.
- **Journal:**
  - the `jnlSavePage` rule: blank adds nothing, the first input adds, clearing removes, created
    time kept;
  - grouping, order and collapse; search opens groups; snippet escaping and Unicode;
  - `insertLine` at the start, middle and end, and on an empty text;
  - `jnlStampText`; the empty and no-match states.
- **Trackers:**
  - `trkProgress` per type, with junk values;
  - the close rule: it closes on the transition, not when already complete, and not with the option
    off; a reopened tracker stays open; the form never closes;
  - Undo restores the whole tap;
  - `mergeChecklist`: repeats, blank lines, reordering, and a reworded line losing its tick;
  - `trkSplit` order; `showTrackers` default and junk; `combatSectionsOf()` accepting `trackers`.
- **Hostile character:** pages and trackers through every new builder, added to the renderer list.

**`rules-data.js`:**
- The registry is 20 entries and 20 cards.
- The Journal panel holds exactly one registered card (`trackers`), in the order Journal, Trackers,
  `#notesList`.
- No `tab-notes` or `data-tab="notes"` remains.
- `boxed(html,'jnlSearch')`.
- `#swTrackers` is rendered and wired.

**`char-update.js` or `sheet.js`** (#81), with the harness's `quotaFull` switch:
- `saveNow()` succeeds and fails, and the warning is set and cleared;
- a new character, an import and an old-save migration under a full quota.

**Driven in Playwright**:
- **A:** the tab bar at 1280 (labels), 800 (icons) and 360; ☰; a note jump from Vitals; the combat
  view's ✕ returning to Journal.
- **B:** a full quota forced through evaluate → the strip with its reason; Save to file; free the
  space and Try again clears it; a new character and an import under a full quota.
- **C:**
  - New page → title, tag, text → Insert timestamp (untouched → at the end; after a click → at the
    caret) → Done;
  - groups and collapse; search with snippets; a page with a heading, list, quote and glossary chip;
  - Delete; `refreshRulesUI()` mid-typing keeps the text, caret and focus;
  - an abandoned blank page leaves nothing; a reload keeps pages; a character switch resets.
- **D:**
  - each type through the form; −/+ and a typed value; the bar at 0, 50 and 100%;
  - a checklist ticked to done → toast → Completed (1) → Reopen stays open; Undo; the option off
    stays open;
  - Enter held on + keeps counting and keeps focus; a keyboard completion focuses Undo;
  - the Settings switch hides the card and its ☰ entry, and the data survives a reload;
  - Trackers in the combat view, +1 mid-fight;
  - a character switch with the toast up.

**Screenshots** at 1280 and 390: the Journal tab (list, page, editor, search), the Trackers card
(each type, Completed open), the save warning, and the tab bar before and after. Both skins, light
and dark.

**Left for Mike:** real phones and touch, browsers other than Chrome, his own characters.

## 12. Out of scope

- Printing journal pages or trackers (known-issues).
- Manual ordering of pages or trackers.
- Links in markdown (deliberately unsupported; see the rich-text page).
- A total per tracker group.
- Search across section notes.
- Trackers that reset on a rest.

## 13. Release note

For `src/docs/UNRELEASED.md`:

> - The Notes tab is now the Journal. Keep a running campaign journal in pages — sessions,
>   characters, quests, anything — each with an optional tag to group it by, created and edited
>   dates, a button that stamps the current date and time, and the same formatting as your notes.
>   Search finds any page by its title, tag or text. Your section notes are still there, further
>   down.
> - New trackers on the Journal tab: counters (with or without a goal), checklists and one-line
>   tasks, grouped by a tag you choose — kills by creature type, pages of a book, steps of a quest.
>   Anything with a goal can close itself when it's done and move to Completed, with an Undo. Add
>   the Trackers card to the combat view to count mid-fight, or hide it in Settings → This
>   character.
> - If your browser refuses to save a change, the sheet now says so plainly — and keeps saying so
>   until a save goes through — with a button to save the character to a file instead.

## As built

Where the code differs from the text above, and why:

- **The save warning is fixed to the foot of the window** (§8 said under the tab bar). Under the
  tab bar it sat where the combat tab's own sticky header sits.
- **`insertLine()` takes no `atEnd` flag** (§4). Starting an edit puts the caret at the end of
  the text, so "untouched → at the end" is simply "at the caret".
- **Helpers not listed in §4:**
  - `attrSel()`, `jnlStr()`, `jnlTime()`, `jnlTitle()`, `jnlQuery()`, `jnlFind()`, `jnlFlat()`, `jnlWhen()`, `jnlEntryHTML()`;
  - `trkInt()`, `trkName()`, `trkParse()`, `trkFromForm()`, `trkSummary()`, `trackerClosedHTML()`, `trkById()`, `trkAct()`, `commitTrackerValue()`, `reopenTracker()`, `toggleTrkCompleted()`;
  - `repairIds()`, and #81's `saveNow()`, `showSaveResult()`, `saveWarnText()`, `saveError()`, `retrySave()`.
- **`migrateOldChar()` returns why it failed and `boot()` alerts**, since no character is open for
  the strip to be about.
- **A keyboard completion also includes typing a counter's goal into its count box and pressing
  Enter.** The Enter keydown path threads a keyboard flag through `commitBox(t,viaKey)` →
  `commitTrackerValue(inp,viaKey)` → `trkAct()`, so focus lands on the toast's Undo; the Enter
  handler now calls `preventDefault()` *before* `commitBox()` for `[data-coin],[data-hp],[data-trkval]`
  targets, because otherwise the same Enter press "clicked" the newly focused Undo and silently
  undid the completion.
- **A keyboard Reopen (`reopenTracker(id,viaKey)`) puts focus on the reopened tracker's edit
  button**, since its Reopen button disappears.
- **The print heading reads "Section notes"**; the Notes-tab wording was also swept from code
  comments and test labels.
- **The count box's change path patches its row in place** (`trkPatchRow()`, `trkAct()`'s
  `inPlace` flag), and does not redraw the card. `change` fires as the box loses focus, at the
  mousedown on + or at a Tab. A redraw there replaced the + under the pointer, so its click never
  arrived, and it dropped a Tab's focus to the page. Enter, and a change that closes the tracker,
  still redraw.
- **Tab or Esc from a closing tap's Undo goes to the next tracker** (§6): the first control of the
  next open row on screen (`trkAfter()`, `trkNextControl()`), or + Tracker when none is left.
- **Leaving a character whose changes can't be saved asks first** (§8). `loadCharById()`,
  `newCharacter()` and `finishImport()` call `leaveCharacterOk()`, which flushes the pending save
  and, if it is refused, confirms before leaving. No changes nothing and shows the sheet with its
  Save to file. A switch that goes ahead clears the strip. `deleteCharacter()` and `setAutoload()`
  alert a refused index write.
- **Session state and Undo key on the character object** (`jnlUI.who`, `trkWho`, the Undo's `who`),
  not the id (§3 and §6 said "the character's id"). Import → Replace keeps the id and swaps the sheet.
- **More helpers:** `trkAfter()`, `trkPatchRow()`, `trkNextControl()` (87-trackers.js) and
  `leaveCharacterOk()` (70-persistence.js).
