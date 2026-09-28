# Story & notes

Two kinds of free text, easy to confuse. The **Story tab** holds the character's own writing: eight
bio cards (Appearance through a card called **Notes**) and Proficiencies & Languages. **Section
notes** are something else — a note pinned to any of 19 cards on the Sheet, Spells, Inventory and
Story tabs, opened from an icon in the card's heading and gathered on the **Notes tab**. Both render
the same markdown-on-top-of-glossary grammar.

**Code:** `BIO`, `buildBio()` in `00-constants.js` · `renderRT()`, `renderAllRT()` in
`10-compute.js` · `NOTE_SECTIONS`, `NOTE_TABS`, `noteTitle()`, `noteMap()`, `getNote()`,
`saveNote()`, `noteWhen()`, `noteBtnHTML()`, `notePreview()`, `renderNoteIcons()`, `notesHTML()`,
`noteEntryHTML()`, `renderNotes()`, `toggleNoteGroup()`, `jumpToNote()`, `openNoteEditor()` in
`87-notes.js` · `selectTab()`, `scrollToCard()` in `40-sheet.js` · markup `src/html/30-story.html`,
`src/html/60-notes.html` · **Tests:** `rules-data.js` (registry ↔ template, storage guards, the pure
renderers), `tables.js` (the markdown) · **See also:** [Rich text](../architecture/rich-text.md),
[Character model](../architecture/character-model.md),
[Sections & layout](../ui/sections-and-layout.md), [Shell](../ui/shell.md)

## How it works

**The bio cards.** `BIO` lists eight `[key, title]` pairs — `appearance`, `personality`, `ideals`,
`bonds`, `flaws`, `backstory`, `allies`, `notes` — each a string on the character. `buildBio()` builds
one card per entry into `#bioStack` at boot, each with an Edit button (`data-edit="<key>"`) and a
`#rt-<key>` host. `renderRT(key)` shows either a textarea that writes `character[key]` on every input
and schedules a save, or the rendered text (`richHTML()`, see [Rich text](../architecture/rich-text.md))
with an "Nothing yet — tap Edit." empty state. The button reads Edit / Done. `renderAllRT()` redraws
`proficiencies` and every bio key; it runs from `renderAll()` and `refreshRulesUI()`, because a
glossary change alters how the text reads.

**Proficiencies & Languages** (`character.proficiencies`) sits in its own card at the top of the
Story tab, uses the same `renderRT()`, and — unlike the bio cards — takes a section note.

**Section notes.** `NOTE_SECTIONS` is the registry: 19 entries of `{k, tab, title}` — twelve on the
Sheet, four on Spells, two on Inventory, one (Proficiencies) on Story. A card opts in with
`data-note="<k>"` on its `<div class="card">`. `renderNoteIcons()` puts a note button at the end of
each such card's `.label`, lit (`.on`) when a note exists, with a hover preview (`notePreview()`)
inside it. The button opens `openNoteEditor(k)`: a textarea, a one-line formatting key, the dates,
Save, Cancel and (for an existing note) Delete.

**Storage.** `character.secNotes` maps id → `{text, at, editedAt}`. `saveNote()` deletes the entry
when the text is blank, so "has a note" is one truth test and the Notes tab can never list an empty
one. `at` is set once; `editedAt` moves only when the text actually changed. Every read goes through
`noteMap()` / `getNote()`, which tolerate a hand-edited file putting a string where a note object
belongs — `migrate()` guards `secNotes` at the top level only.

**Titles.** `noteTitle(def)` quotes the registry, except for `origin`, whose heading depends on the
skin ("Race" or "Ancestry" & Background, via `raceTerm()`), so the Notes tab always agrees with the
card it links to.

**The Notes tab** (`#tab-notes`, whose own card deliberately has no `data-note`). `notesHTML()` groups
the notes by tab in registry order, lists only sections that have a note, and shows an empty state
otherwise. Each group header is a `role="button"` toggle (click, Enter or Space) stored per character
in `noteCollapse`; a closed group still renders its notes, hidden. Each entry has a jump link, the
added/edited dates, an edit button and the note rendered by `noteHTML()`. `jumpToNote(k)` calls
`selectTab()` — which never scrolls — then `scrollToCard()` and flashes the card; a card that is
hidden (`offsetParent === null`: an empty Familiars or Active Spells) scrolls to the top instead.

## Rules that must hold

- **`character.notes` and `character.secNotes` are different things.** `notes` is the Story tab's
  "Notes" bio card (`#rt-notes`); `secNotes` is the section-note map (`#tab-notes`). Merging or
  renaming either into the other breaks the Story tab silently.
- **Registry ids are stable and never derived from headings.** Headings get reworded; a note keyed to
  one would be orphaned. `rules-data.js` checks the registry against the template both ways and
  counts exactly 19 `<div class="card" data-note="` cards.
- **The note button is a `<button>` and its preview a `<span>` inside it.** `buildToc()` clones each
  `.label` and strips buttons before reading its text; a sibling preview would leak into the ☰ entry.
- **`renderNoteIcons()` replaces only its own button** — never `label.innerHTML +=`, which re-parses
  the label and destroys `#starBtn`, `#encPill` and `#roundNum`. The combat view's toggle follows the
  same rule and sits just before it.
- **The preview is phrasing content only**: `<strong>`, `<em>`, `<code>`, `<br>`, with block markers
  represented (• for a bullet, — for a divider) and glossary chips unwrapped to their words. A
  `<button>` may not contain blocks or interactive elements. Truncation cuts the source, never the
  rendered HTML.
- **`selectTab()` does not scroll**; the tab bar's click handler does. Otherwise a note jump fights
  its own tab switch.
- **Markup builders stay pure strings** (`notesHTML()`, `noteEntryHTML()`, `noteBtnHTML()`,
  `notePreview()`): the harness stubs the DOM, so that is what makes grouping, counts, collapse,
  escaping and the empty state testable.

## Traps

- **The name collision.** `character.notes` already existed when section notes were built; the new
  field had to be `secNotes`, and CLAUDE.md records it as an invariant because it will bite again.
  → L1491
- **A preview that flattened everything** showed a note reading `**bold**` / `- bullet` as plain
  "bold bulleted", with no sign either marker worked; the note card itself had rendered correctly all
  along. → L3035
- **The Story tab's "Notes" card formatted nothing** — no markup, not even line breaks — while the
  section notes rendered the whole grammar. One renderer for every field fixed it. → L3035

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| Do the eight bio cards take a section note? | No | Yes: a note attached to your Backstory box is a note about a note |
| What the new field is called | `secNotes` | Reusing or renaming `notes`: that is the Story tab's bio field, and merging them breaks it silently |
| How notes are keyed | A stable id per section in `NOTE_SECTIONS` | The heading text: headings get reworded and the note would be orphaned |
| What the hover preview renders | Phrasing markup only, block markers represented, chips unwrapped | The full `noteHTML()` output: blocks and `role="button"` chips are illegal in a button, and a chip on a hover card vanishes as you reach for it |

## Open

- In the "By ability" skills layout the Skills card is hidden, so its note button is too; a player
  who never wrote a Skills note cannot start one in that mode (existing notes stay listed). Shipped
  knowingly. → L106
- `**Hit** Points` loses its *Hit Points* chip: the asterisks break the glossary's `\b…\b` match.
  Inherent to escaping first.
- Markdown links, `_underscore_` emphasis, nested lists and pipe tables are deliberately unsupported —
  see [Rich text](../architecture/rich-text.md).
- More in [Known issues](../roadmap/known-issues.md).

## History

- 2026-08-11 — Section notes on 19 cards, stored as `secNotes`; the Notes tab; markdown over `highlight()`. → ledger L1491
- 2026-08-18 — One rich-text grammar: the bio cards render markdown; the note preview keeps bold, italics and code. → ledger L3035
- 2026-09-01 — The "By ability" layout hides the Skills card, and with it that card's note button. → ledger L106, #17
