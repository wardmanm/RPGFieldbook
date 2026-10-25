# Story & notes

Two kinds of free text, easy to confuse. The **Bio tab** (called Story until #103; its id is still
`story`) holds the character's own writing: eight bio cards (Appearance through a card called
**Notes**) and the "Proficiencies, Senses & Languages" card. **Section
notes** are something else — a note pinned to any of 18 cards on the Sheet, Spells, Inventory,
Bio and Journal tabs, opened from an icon in the card's heading and gathered in the **Section Notes** card on
the **Journal tab**, below the player's own journal pages ([Journal](journal.md)). Both render
the same markdown-on-top-of-glossary grammar.

**Code:** `BIO`, `buildBio()` in `00-constants.js` · `renderRT()`, `renderAllRT()`, `rtKeys()`,
`rtToggleCheckbox()` in `10-compute.js` · `NOTE_SECTIONS`, `NOTE_TABS`, `noteTitle()`, `noteMap()`, `getNote()`,
`saveNote()`, `noteWhen()`, `noteBtnHTML()`, `notePreview()`, `renderNoteIcons()`, `notesHTML()`,
`noteEntryHTML()`, `renderNotes()`, `toggleNoteGroup()`, `jumpToNote()` (#52), `openNoteEditor()` in
`87-notes.js` · `mergeNoteInto()`, `migrateSheet103()` in `71-char-io.js` · `chipsHTML()`,
`renderBioChips()` in `41-chips.js` · `selectTab()`, `scrollToCard()` in `40-sheet.js` · markup `src/html/30-story.html`,
`src/html/60-journal.html` · **Tests:** `rules-data.js` (registry ↔ template, storage guards, the pure
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
`proficiencies` and every bio key (`rtKeys()`); it runs from `renderAll()` and `refreshRulesUI()`, because a
glossary change alters how the text reads. A checkbox line (`[ ]`/`[x]`, the journal's grammar) in
any of these fields is tickable in its read view: `rtToggleCheckbox(key,n)` flips that line in
`character[key]`, redraws the field, saves and puts focus back on the same box. It is refused while
the field is being edited (the text is in the textarea then), for a key that is not one of these
fields, and when nothing would change.

**Proficiencies, Senses & Languages** (the `proficiencies` section) sits in its own card at the
top of the Bio tab, and — unlike the bio cards — takes a section note. It holds, top to bottom:
**Alignment** (`character.alignment`, moved here from the Sheet), **Languages** and **Senses** as
chip rows (`renderBioChips()`, `chipsHTML()`; a sense may carry a range, "DARKVISION · 60 FT"; a
granted language shows its source, "· species", and has no ×), and the Proficiencies prose
(`character.proficiencies`, the same `renderRT()`). The chips, their grants and the default
language are on [Character model](../architecture/character-model.md) and
[Grants & provenance](../architecture/grants-and-provenance.md). #97's pencil on this card hides
the chips' ×.

**The name.** The tab's label and the Section Notes card's group heading read **Bio**
(`NOTE_TABS.story`); the id stays `story`, because saved Section Notes fold state (`noteCollapse`)
keys on it.

**Section notes.** `NOTE_SECTIONS` is the registry: 18 entries of `{k, tab, title}` — nine on the
Sheet (the header, titled "Character", and the rail, strip, Skills, Defences, Statuses, Resources,
Features and the hidden Familiars), four on Spells, three on Inventory (Attacks, Equipment, Coins),
one (Proficiencies) on Bio, one (Trackers) on the Journal tab. A card opts in with
`data-note="<k>"` on its card element. `renderNoteIcons()` puts a note button at the end of
each such card's `.label`, lit (`.on`) when a note exists, with a hover preview (`notePreview()`)
inside it. The button opens `openNoteEditor(k)`: a textarea, a one-line formatting key, the dates,
Save, Cancel and (for an existing note) Delete.

**Storage.** `character.secNotes` maps id → `{text, at, editedAt}`. `saveNote()` deletes the entry
when the text is blank, so "has a note" is one truth test and the Section Notes card can never list
an empty one. `at` is set once; `editedAt` moves only when the text actually changed. Every read goes through
`noteMap()` / `getNote()`, which tolerate a hand-edited file putting a string where a note object
belongs — `migrate()` guards `secNotes` at the top level only.

**Titles.** `noteTitle(def)` quotes the registry, so the Section Notes card always agrees with the
card it links to.

**Notes from retired cards (#103).** The Class, Ancestry & Background and Rest & Recovery cards are
gone. `migrate()` (`migrateSheet103()`) moves their notes once, through `mergeNoteInto()`: `class`
and `origin` into `portrait` (the header) under "**Class:**" and "**Ancestry & Background:**", `rest`
into `vitals` under "**Rest & Recovery:**", each after a blank line, the target made if absent. The
merged note keeps the earlier `at` and the later `editedAt`; a junk value under a removed key is
dropped. A sheet without such notes is unchanged, so it runs safely on every load.

**The Section Notes card** (on `#tab-journal`; the card deliberately has no `data-note`). `notesHTML()`
groups the notes by tab in registry order, lists only sections that have a note, and shows an empty
state otherwise. Each group header is a `role="button"` toggle (click, Enter or Space) stored per
character in `noteCollapse`; a closed group still renders its notes, hidden. Each entry has a jump
link, the added/edited dates, an edit button and the note rendered by `noteHTML()`. `jumpToNote(k)`
first checks whether the note's own tab is hidden (#52, [Shell](../ui/shell.md)): if so it unhides
it (`setTabHidden(tab,false)`) and toasts "*Label* tab shown again; hide it in Settings → Sheet
display.", using the tab's own word (Bio, never `story`) — then carries on exactly as before. It
calls `selectTab()` — which never scrolls — then `scrollToCard()` and flashes the card; a card that
is hidden (`offsetParent === null`: an empty Active Spells) scrolls to the top instead.
Familiars' note opens the header paw's popover, hung from the header bar when the paw is hidden.
They print under the heading "Section notes". Its groups now include Journal, holding just
Trackers, since that card sits on the Journal tab too ([Journal](journal.md)). A checkbox in a note
(the same `[ ]`/`[x]` grammar as a journal page) is tickable right on the card
(`noteToggleCheckbox()`), writes back through `saveNote()`, and the note editor has an Insert
checkbox button beside its formatting key ([Journal](journal.md), [Rich text](../architecture/rich-text.md)).

## Rules that must hold

- **`character.notes` and `character.secNotes` are different things.** `notes` is the Bio tab's
  "Notes" bio card (`#rt-notes`); `secNotes` is the section-note map (the Journal tab's Section Notes
  card). Merging or renaming either into the other breaks the Bio tab silently.
- **Registry ids are stable and never derived from headings.** Headings get reworded; a note keyed to
  one would be orphaned. `rules-data.js` checks the registry against the template both ways and
  counts exactly 18 note-bearing card openings.
- **A retired section's notes are merged, never dropped**, and the merge is idempotent.
- **The note button is a `<button>` and its preview a `<span>` inside it**, so the button carries its
  own preview: `renderNoteIcons()` replaces one element, and a sibling preview would be left behind.
  (The retired ☰ flyout also read a `.label`'s text with buttons stripped, which a sibling would
  have leaked into.)
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
- **A jump into a hidden tab always gets there (#52).** Refusing it would leave the note's own link
  doing nothing; `jumpToNote()` unhides the tab first, so the jump never fails silently.

## Traps

- **The name collision.** `character.notes` already existed when section notes were built; the new
  field had to be `secNotes`, and CLAUDE.md records it as an invariant because it will bite again.
  → L1491
- **A preview that flattened everything** showed a note reading `**bold**` / `- bullet` as plain
  "bold bulleted", with no sign either marker worked; the note card itself had rendered correctly all
  along. → L3035
- **The Bio tab's "Notes" card formatted nothing** — no markup, not even line breaks — while the
  section notes rendered the whole grammar. One renderer for every field fixed it. → L3035

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| Do the eight bio cards take a section note? | No | Yes: a note attached to your Backstory box is a note about a note |
| What the new field is called | `secNotes` | Reusing or renaming `notes`: that is the Bio tab's bio field, and merging them breaks it silently |
| The Story tab's name (#103) | **Bio**, with the id kept as `story` | Renaming the id too: every saved Section Notes fold state would reset |
| Notes on a retired card (#103) | Merged once into the card that took its controls, under a heading | Dropping them: a player's words lost. Keeping the key: a note with no card to open it from |
| How notes are keyed | A stable id per section in `NOTE_SECTIONS` | The heading text: headings get reworded and the note would be orphaned |
| What the hover preview renders | Phrasing markup only, block markers represented, chips unwrapped | The full `noteHTML()` output: blocks and `role="button"` chips are illegal in a button, and a chip on a hover card vanishes as you reach for it |
| A jump into a hidden tab (#52) | Unhides the tab, saves, and toasts "*Label* tab shown again; hide it in Settings → Sheet display." before carrying on | Refusing the jump: the note's own link would do nothing |

## Open

- `**Hit** Points` loses its *Hit Points* chip: the asterisks break the glossary's `\b…\b` match.
  Inherent to escaping first.
- Markdown links, `_underscore_` emphasis, nested lists and pipe tables are deliberately unsupported —
  see [Rich text](../architecture/rich-text.md).
- More in [Known issues](../roadmap/known-issues.md).

## History

- 2026-08-11 — Section notes on 19 cards, stored as `secNotes`; the Notes tab; markdown over `highlight()`. → ledger L1491
- 2026-08-18 — One rich-text grammar: the bio cards render markdown; the note preview keeps bold, italics and code. → ledger L3035
- 2026-09-01 — The "By ability" layout hides the Skills card, and with it that card's note button. → ledger L106, #17
- 2026-09-29 — The Notes tab is the Journal tab (`tab-journal`); the notes print as "Section notes". → ledger L4756, #39
- 2026-09-29 — Journal pages: tags, search, timestamps, the page rule; the card and its editor. → ledger L4793, #40
- 2026-09-29 — Trackers: counters, checklists and tasks that close themselves when done, with Undo; registered section 20, in the combat view; hideable per character. → ledger L4822, #41
- 2026-10-17 — A checkbox in a section note is tickable on the Section Notes card, and the note editor gains an Insert checkbox button (#95). → ledger L6047, #95
- 2026-10-17 — A checkbox in a Story field (Proficiencies or a bio card) is tickable in its read view, refused while editing. → ledger L6057, #95
- 2026-10-23 — The Story tab is Bio; its first card holds Alignment, Languages and Senses chips and the prose; 18 sections; the Class, Ancestry & Background and Rest notes merge into Character and Vitals; By ability's hidden Skills note is gone with it. → ledger L6633, #103
- 2026-10-24 — The ☰ section flyout is retired: the Bio tab has no ☰ title, and the note preview's `<span>` rule rests on `renderNoteIcons()` alone. → ledger L6804, #103
- 2026-10-25 — `jumpToNote()` unhides the note's tab first when it is hidden, toasts the tab's own label, then jumps as before. → ledger L6989, #52
