# Journal checklists — design

**Status:** implemented on branch `issue/95-journal-checklists` · 2026-10-17 · wave 1 of [1.9.0](../wiki/roadmap/1.9.0.md)
**Issue:** #95 (checklists and tasks leave trackers and become journal features). Built on one
branch, `issue/95-journal-checklists`; #93 and #94 follow it in the same worktree, since all three
reshape `87-trackers.js`.

---

## 1. What it is

A journal page can hold a checklist: a line that starts `[ ]` or `[x]` renders as a real checkbox
in the page's read view, and a tap flips it and writes the mark back into the page's text. A task
is a one-line checklist. The page list shows a page's progress ("3/5") beside its title. The same
grammar works in every section note, since the two share one renderer.

Trackers keep only counters. Every checklist and task a player already has becomes a journal page
when the sheet next loads, with nothing lost: every tick, every date.

Why: a quest's steps belong beside the notes about the quest, not in a separate card; and the
Trackers card had grown three kinds of thing where one (a count) is what it is for. A checklist in
prose is also what a player writes anyway — "[] find the key" was the syntax asked for.

## 2. Decisions

Settled with Mike on 2026-10-17 (the first two on the 1.9.0 page, the rest in the #95 brainstorm).
The rejected options are recorded so they are not re-proposed without the reason they lost.

| # | Question | Decision | Rejected, and why |
|---|---|---|---|
| 1 | Existing checklist and task trackers | **Migrated into journal pages** on load; Trackers becomes counters only | Read-only in Completed: two homes for one idea until 2.0. Migrate and keep a copy: every list twice |
| 2 | A checkbox in a rendered page | **Tickable in the read view**; a tap rewrites the line in the text | Read-only until Edit: three taps a tick. A second task syntax with a cross-page roll-up: a second grammar to learn |
| 3 | Closed checklists and tasks | **Migrated too**, every item ticked, with the closed date kept (§5) | Dropping them: deletes a record a player may be keeping. A "Completed" tag: hides them from the tag they were filed under |
| 4 | Progress in the page list | **A "3/5" count** on the row of a page that has checkboxes; nothing on one that hasn't | No count: the tracker-at-a-glance feel is lost. A bar as well: row height on a phone |
| 5 | Section notes | **Same grammar, tickable in both**: a tap in the Section Notes card writes back to `secNotes` the same way | Render but not tick: one mark, two behaviours. Journal only: `[ ]` in a section note would look broken |
| 6 | The editor | **An Insert checkbox button** beside Insert timestamp, and `[]` accepted as unchecked | Syntax only: `[` is two taps away on a phone keyboard. Enter continuing the list: Enter-magic in a textarea surprises, and needs an escape |
| 7 | Tasks on migration | **One page per tag, titled "Tasks"**, one line per task; a closed task's date on its line | One page per task: a page for every one-liner |

## 3. Data

**Nothing new on the character.** No field is added. Two things narrow:

- `trackers[].type` is `counter` only. `checklist` and `task`, and the fields only they used
  (`items`, `done`), no longer exist after `migrate()` has run (§5). `trkType()` reads anything
  as `counter`.
- `journal[].text` gains one block in its grammar (§4.1). The page shape
  `{id, title, tag, text, at, editedAt}` is unchanged, and so is the page rule: a page exists
  while its title or text has something in it.

So the 2.0 port learns one grammar rule and loses two tracker types. That is the whole save-format
change.

## 4. The grammar

### 4.1 Reading

In `noteHTML()` (`87-notes.js`), tested **before** the bullet rule, since `- [ ]` begins like a
bullet:

```
^ {0,3}(?:[-*+] +)?\[( |x|X)?\] +(\S.*)$
```

- `[ ]` and `[]` are unchecked; `[x]` and `[X]` are checked. The space after the closing bracket is
  required: `[x]y` is text, and so is a `[x]` anywhere but the start of a line. A marker with
  nothing after it (`[ ]` alone, or followed only by spaces) is text too: a checkbox has words.
- A leading bullet is accepted and dropped, as `mergeChecklist()` dropped it from the tracker
  form: typing habit, not structure.
- Consecutive checkbox lines form one `<ul class="n-ck">`. Each item is
  `<li><button type="button" class="ck" role="checkbox" aria-checked="true|false" data-ck="n"></button><span class="ck-t">text</span></li>`,
  where `n` is the ordinal of that checkbox line **among the checkbox lines of the whole text**,
  0-based, and `text` goes through `noteInline()` like any block, so glossary and table chips in
  it stay tappable — they sit beside the button, never inside it (a `role="button"` inside a
  button is invalid, and the tracker row avoided exactly that).
- Like every block, one `noteInline()` call per list, not per item: the items are joined with
  `NOTE_LB` and split back on the `<br>` it becomes. (If that proves fragile against a chip that
  spans the break — it can't, chips never contain a newline — fall back to one call per item and
  say so in the ledger.)

`richHTML()` and `descHTML()` inherit the block, so a `[ ]` in an item description draws a box.
It does nothing there: `data-ck` is always emitted, and only the two surfaces in §4.3 answer it.
That is deliberate — one grammar everywhere, as [Rich text](../wiki/architecture/rich-text.md)
requires — and a pack has no business shipping checkboxes.

`notePreview()` (the hover card, phrasing only) represents a checkbox line as `☐ ` or `☑ `
before the text, as it does `• ` for a bullet.

### 4.2 Two pure helpers, beside `noteHTML()`

- `noteCheckboxes(text)` → `[{line, checked, text}]`, the checkbox lines in order, `line` the
  index into `text.split("\n")`. Reads exactly what §4.1 reads, from the same regex, so the two
  cannot disagree.
- `toggleCheckbox(text, n)` → the text with the `n`th checkbox line flipped — `[ ]` and `[]` to
  `[x]`, `[x]` and `[X]` to `[ ]` — and **every other byte unchanged**: the bullet, the indent,
  the text after, every other line. Out of range → the text as it was. Normalises nothing else.
- `noteProgress(text)` → `{done, total}` over `noteCheckboxes()`.

All three are DOM-free and asserted in `sheet.js`.

### 4.3 Writing back

One delegated `click` on `[data-ck]` in `wire()`, plus Enter and Space on it through the existing
delegated `keydown` (the `.kw` / `.tblref` pattern). The handler finds the owner:

- **inside `#jnlBody`** — the open page (`jnlUI.open`). `page.text = toggleCheckbox(page.text, n)`,
  `editedAt = now`, `scheduleSave()`, then `renderJournal()` and focus back on the same
  `[data-ck="n"]`. Only the page view can show a `[data-ck]`; while the editor is open the text is
  in a textarea, so a tick while editing cannot happen.
- **inside `#notesList`** — the Section Notes card. The entry's `data-noteedit` ancestor names the
  section `k`; `saveNote(k, toggleCheckbox(noteText(k), n))`, `scheduleSave()`, `renderNotes()`,
  `renderNoteIcons()` (the hover preview changes), focus back the same way.
- anywhere else — nothing.

A tap changes no derived number, so `recompute()` is never called. Undo is not offered: the tap
is its own undo.

## 5. Migration

In `migrate()` (`71-char-io.js`), after the list guards and `repairIds()` have run and before the
collapse-map repair, one call: `migrateTrackerPages(base, now)`, a pure function in
`87-trackers.js` (a function declaration, so it is hoisted whatever fragment order says). It takes
every tracker whose **raw** `type` is `checklist` or `task` out of `trackers` and pushes pages onto
`journal`:

**A checklist** → one page:

```
title    its name (trkName(): "Untitled" if blank)
tag      its tag, through tagLabel()
at       its `at`, else now
editedAt its closedAt, else its `at`, else now
text     one line per item, "[x] text" or "[ ] text", in item order;
         a closed one adds a blank line and "Closed <date>" (fmtWhen(closedAt));
         an empty checklist has no text, and is a page because its title is one
```

**Tasks** → one page **per tag** (`tagKey()`), including the untagged:

```
title    "Tasks"
tag      the tag (the first spelling met)
at       the oldest task's `at`, else now
editedAt the newest closedAt or `at` among them, else now
text     one line per task, in the order they were made:
         "[ ] name", or for a closed one "[x] name — closed <date>"
```

Rules:

- **Idempotent by construction.** After the pass no tracker has either type, so a second run finds
  nothing. There is no pass counter and no `init` flag to keep in step; an old export imported
  later migrates the same way. `trkType()` thereafter reads any other value as `counter`, so a
  hand-edited `"type":"checklist"` added *after* this ships still migrates (the raw value is read
  before `trkType()` coerces it), and junk reads as a counter as it always did.
- **Nothing a player recorded is dropped**: every tick, every closed date, the tag and the name.
  The only things that do not carry over are `autoClose` and `goal`, which have no meaning on a
  page.
- The pages get fresh `uid()`s; `repairIds()` has already run on `journal`, and a fresh id cannot
  collide with a repaired one.
- `migrate()`'s own repair of `t.items` goes with the field.

## 6. Trackers become counters

In `87-trackers.js`: `TRK_TYPES` is `[["counter","Counter"]]` — kept as a list so #93/#94 need not
touch the shape — and the form (`openTrackerForm()`) loses its Type select and Items textarea;
`trkProgress()`, `trkApply()`, `trackerRowHTML()` and `trkPatchRow()` keep only the counter
branch; `mergeChecklist()`, `trkToggleItem()`, `trkToggleTask()` and the `[data-trkitem]` /
`[data-trktask]` hooks in `wire()` go. Everything else — Completed, Undo, the count box's
`inPlace` patch, the combat-view card, `showTrackers`, the group field — is untouched. The card
keeps its name. The spec's §6 of the [journal design](2026-09-29-journal-design.md) is superseded
for the two types; counters are as it describes.

## 7. The editor

- **Insert checkbox** (`data-jnlck`) beside Insert timestamp in `journalEditorHTML()`: inserts
  `[ ] ` on its own line at the caret — a new helper beside `insertLine()` that leaves the caret
  **after** the marker, on the same line, since the next thing typed is the item. It fires `input`,
  so the page rule saves it, as the timestamp does.
- The section-note editor (`openNoteEditor()`) gets the same button in a tools row of its own, so
  the two editors of one grammar offer the same help.
- `NOTE_FMT_HINT` adds `[ ] checkbox` to its list. Both editors show it already.

## 8. On screen

- `.n-ck` lists have no bullet; `.ck` is a 1.1em square with the theme's `--line` border, filled
  with `--accent` and a check mark when `aria-checked="true"`, and the `.ck-t` text beside it reads
  struck-through and muted when checked. Themed, so both skins, light and dark, are shot.
- The journal list row (`jnlEntryHTML()`) adds `<span class="jnl-prog">3/5</span>` after the title
  when `noteProgress().total > 0`; the page view (`journalPageHTML()`) adds the same to its meta
  line. The Section Notes entry row shows none: its body is right there.
- Print: markdown markers print as typed today, so `[x]` prints as `[x]`. Unchanged.
- The ☰ flyout, the combat view and the section registry are untouched: no card is added or
  removed.

## 9. Edge cases

- **A page whose only content is checkboxes** has text, so it is a page; one whose text is cleared
  back to nothing follows the page rule and goes.
- **A tick on a page deleted meanwhile** (another tab, an import): `jnlUI.open` no longer matches a
  page, `renderJournal()` has already dropped to the list, and the handler finds no page → nothing.
- **Import → Replace while the page view shows**: `jnlUI` is keyed on the character object, so the
  view resets to the list first (existing rule); a stale tap finds no owner.
- **`[x] <script>`** in an item: the text goes through `noteInline()` → `highlight()` → `esc()`
  first, as every block does. `n` in `data-ck` is a number the renderer wrote, and is `esc()`'d
  anyway (the attribute rule is total).
- **A checkbox line inside a quote or after a bullet list**: the quote rule runs first, so
  `> [ ] x` is a quote containing text; a checkbox list ends a bullet list and starts its own
  block, as a heading would.
- **CRLF text** is normalised by `noteHTML()` already; `toggleCheckbox()` splits on `\n` after the
  same normalisation and joins with `\n`, so a page that held `\r\n` from a file comes back with
  `\n` after its first tick. `editedAt` moves, which is true.
- **A migrated checklist whose name is a reserved group name** cannot happen: the tag goes through
  `tagLabel()`, which reads a reserved name as no tag; the title is free text.

## 10. Testing

`sheet.js` (pure):

- grammar: each accepted form (`[ ]`, `[]`, `[x]`, `[X]`, with `- `, `* `, three spaces of
  indent) renders a `.n-ck` item with the right `aria-checked`; each rejected form (`[x]y`, a
  mid-line `[x]`, `[]` with nothing after, `[ ]` inside a quote) renders as text; two runs of
  checkboxes separated by a paragraph are two lists with ordinals continuing (0,1 then 2);
- `noteCheckboxes()` and `noteHTML()` agree on count and order for a mixed document;
- `toggleCheckbox()` flips exactly the named line, leaves every other byte alone (assert equality
  of the other lines), normalises `[]` and `[X]` on the way through, returns the input on an
  out-of-range `n`, and round-trips (toggle twice = the normalised original);
- `noteProgress()` on none, some, all ticked;
- the hostile item (`[x] <script>`, a `"` in the text) escaped; no sentinel leaks;
- `notePreview()` shows ☐/☑;
- migration: an open checklist, a closed one (ticks and the Closed line), an empty one, tasks across
  two tags and untagged (one page each, closed dates inline, `at` the oldest), a counter untouched,
  run twice equals run once, fresh ids, nothing left of either type, a `type:"checklist"` with
  junk items;
- the tracker form markup has no Type select; `trkType()` of `checklist` is `counter`.

`rules-data.js` (source guards): the `[data-ck]` click and keydown handlers exist in `wire()`;
`data-ck` is interpolated through `esc()` (the existing attribute scan covers it); the Insert
checkbox button exists in both editors; `.n-ck`/`.ck` rules exist in the CSS, in both skins'
token sets if a skin overrides them.

`docs.js`: the pages below, as always.

Playwright (`.claude/qa/95-*`): a page with three boxes, tick one (text updated, `3/5` → `1/3`
in the list), tick it back; the same in a section note (the hover preview changes); Insert
checkbox puts the caret after the marker; a sheet fixture with a checklist and two tasks loads as
pages; the Trackers form has no Type; both skins, light and dark, phone width.

## 11. Docs

[Journal](../wiki/features/journal.md) (pages, trackers, the migration),
[Rich text](../wiki/architecture/rich-text.md) (§3 blocks and the surfaces table),
[Story & notes](../wiki/features/story-and-notes.md) (ticking in a section note),
[Known issues](../wiki/roadmap/known-issues.md) (the deferred tracker line narrows to "no rest
reset"; group totals come with #93), the ledger, and the 1.9.0 page's History.

## 12. Out of scope

- Enter continuing a checklist in the editor (decision 6).
- A cross-page Tasks roll-up or a tasks view (decision 2).
- Checkboxes that act in item or feature descriptions (§4.1): they draw, and nothing more.
- A "Show after combat" flag on pages: #105, wave 4.
- Group totals and the tile layout: #93 and #94, next in this worktree.
- Printing journal pages at all (a known gap, unchanged).

## 13. Release note

For `UNRELEASED.md`, one bullet:

- Journal pages can hold checklists: a line starting `[ ]` or `[x]` is a checkbox you can tick in
  the page itself, and the page list shows how many are done. Section notes do the same. Checklist
  and task trackers you already had have moved into journal pages, ticks and dates included;
  Trackers now holds counters only.

## 14. As built

Departures from this spec, found while implementing and verified against the shipped code:

- **§4.1's fallback, not its primary plan.** Each checkbox item gets its own `noteInline()` call,
  not the whole list joined by `NOTE_LB` and split back: an emphasis opened on one item and closed
  on the next would otherwise carry a `<strong>` across two `<li>`s.
- **Migrated dates are `toLocaleDateString()`, not `fmtWhen()`** (§5's text says `fmtWhen()`): a
  relative "3h ago" would freeze wrong on a page read later.
- **`- [ ] x` inside a run of bullets ends the bullet list** (§9, made explicit in `noteHTML()`'s
  bullet loop): the checkbox rule is tested first, as a heading or quote would be.
- **No keydown handler was needed.** `.ck` is a real `<button>`, so a native click covers Enter and
  Space; only the `click` delegate in `wire()` answers `[data-ck]`.
- **"of N" sits on its own line in every tile, not only at narrow widths** (the #94 review fix):
  `.trk-of` is `flex-basis:100%` unconditionally, so it never counts toward the −/count/+ row's
  min-content on a phone-width tile. The tile is `flex:1 1 140px` (max `280px`), the count box
  `54px`, and the tile's −/+ buttons `30px` square.
- **The Σ is a real `<button>` inside the `role="button"` group header**, not a `<span>`: both the
  header's click and keydown fold handlers check for it explicitly and return before toggling the
  group, rather than relying on event bubbling alone to miss it.
