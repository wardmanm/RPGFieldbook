# Hideable edit buttons — design

**Status:** approved 2026-10-19 · wave 1 of [1.9.0](../wiki/roadmap/1.9.0.md), item C
**Issue:** #97 (edit buttons should be hideable via section toggles). One branch, `issue/97-edit-toggle`.
Read [Sections & layout](../wiki/ui/sections-and-layout.md) and [Shell](../wiki/ui/shell.md) first.

---

## 1. What it is

Every card that lists things with edit and delete buttons gets a pencil toggle in its header. Tap it
and that card's edit, delete and remove buttons disappear; tap it again and they come back. Play
controls stay. The choice is per card and per character, and every card starts with its buttons
shown.

Why: in play the pencils and bins are clutter, and a bin or a chip's Remove is one mis-tap from
losing a feature, an item or a class.

## 2. Decisions

Settled with Mike: the scope on 2026-10-16 (the 1.9.0 page), the cards and the mechanism on
2026-10-19 (this brainstorm).

| # | Question | Decision | Rejected, and why |
|---|---|---|---|
| 1 | What the toggle hides | **Edit, delete and remove only.** Stars, folds, Use, Fire, Throw, Cast, equip, On/Off, prepared pins, resource −/+/reset, the familiar's Summoned switch and + Add stay | Everything but play controls: adding mid-session means a flip first |
| 2 | How many switches | **One per card**, per character | One sheet-wide switch: can't lock Inventory and keep Features editable |
| 3 | Which cards | **Every card with edit or delete buttons** (§4): the seven the plan named plus Class, Ancestry & Background, Resources, Familiars and Section Notes | The plan's seven only: leaves the chips' Remove, the riskiest button on the sheet, always out |
| 4 | The Rules tab's glossary entries | **Not included.** They belong to the app's library, not to a character, and #99 rebuilds that tab | A per-character switch on app-wide data |
| 5 | Default | **Shown**, so nothing changes for an existing sheet | Hidden by default: a new player can't find how to edit |
| 6 | How it hides | **CSS.** Each edit/delete/remove button carries the class `ed`; a hidden card carries `ed-off`; `.ed-off .ed{display:none}` | Each renderer checking the flag: about ten more conditions that drift, and a re-render on every flip |

## 3. Data

`character.editHide`: an object, section key → `true` when that card's buttons are hidden. A key
that is absent or not `true` means shown.

- `blankChar()`: `editHide:{}`.
- `migrate()`: added to the object-shape guard in `71-char-io.js` beside `noteCollapse` and
  `trackerTotals` (a non-object, an array or null becomes `{}`). Values are read with `=== true`,
  so junk inside the map reads as shown; nothing else needs coercing.
- Keys are the `NOTE_SECTIONS` ids. The two cards outside that registry get their own:
  `journal` (the Journal card, `#journalCard`) and `secnotes` (the Section Notes card, which gains
  `id="notesCard"`).
- A key for a card that later leaves the app is harmless and left alone, as `secNotes` does.

## 4. The cards

| Card (key) | Buttons that get `ed` | Renderer |
|---|---|---|
| Features & Traits (`features`) | edit, delete | `featItemHTML()`, `20-lists.js` |
| Equipment & Inventory (`inventory`) | edit, delete | `invItemHTML()`, `40-sheet.js` |
| Statuses & Conditions (`statuses`) | edit, remove | `statusRowHTML()`, `40-sheet.js` |
| Familiars & Companions (`familiars`) | edit, delete | `renderFamiliars()`, `40-sheet.js` |
| Class (`class`) | each class chip's Remove | `classChipHTML()`, `50-classrace.js` |
| Ancestry & Background (`origin`) | the race and background chips' Remove | `renderClassRace()`, `50-classrace.js` |
| Attacks & Weapons (`attacks`) | edit, delete (a spell row's Cast stays) | `renderAttacks()`, `60-attacks.js` |
| Spells & Cantrips (`spells`) | edit, delete | `renderSpells()`, `60-attacks.js` |
| Resources (`resources`) | edit, delete on the player's own resources (auto ones have none) | `65-resources.js` |
| Trackers (`trackers`) | the pencil on each counter (delete lives in its form) | `trkEditHTML()`, `87-trackers.js` |
| Journal (`journal`) | a page's Edit and Delete | `journalPageHTML()`, `87-journal.js` |
| Section Notes (`secnotes`) | each note's edit pencil | `noteEntryHTML()`, `87-notes.js` |

The `ed` class is added beside the button's existing classes; nothing else about each button
changes. A card whose renderer rebuilds its rows keeps working, because the hiding lives on the card.

## 5. The toggle

- `editToggleHTML(k,hidden)` (pure) and `renderEditToggles()`, beside the combat toggles in
  `87-combat.js` or in `87-notes.js`, following `renderCombatToggles()`: idempotent, replaces only
  its own button, never `label.innerHTML +=` (that destroys `#starBtn`, `#encPill`, `#roundNum`).
- Order in the header: the pencil, then the combat swords, then the note icon, which keeps its
  place at the far right.
- Look: the `.notebtn` / `.cvbtn` language. Shown → a plain pencil, faint; hidden → the pencil with a
  slash, in the accent colour, so a card in "locked" state is the one that stands out.
- Text: the title is the action ("Hide edit buttons" / "Show edit buttons"); the aria-label adds the
  card ("Hide edit buttons — Features & Traits", with `noteTitle()` so the ancestry heading follows
  the skin); `aria-pressed="true"` when hidden.
- It sits in the `.label`, so headings stay ToC-clean ([Shell](../wiki/ui/shell.md)): the ToC reads the
  label's text, and the button has none.
- A tap flips `character.editHide[k]`, toggles `ed-off` on the card, repaints the button and
  `scheduleSave()`s. No list re-renders.
- `renderEditToggles()` also applies `ed-off` to every card from the map, and runs wherever
  `renderNoteIcons()` runs on load and on switching character.
- Cards that are moved into the combat view carry their class and their toggle with them.

## 6. Edge cases

- **A blank journal page** says "Nothing written yet — tap Edit." With the Journal's buttons hidden it
  says "Nothing written yet." instead.
- **Trackers:** the pencil is the only way into a counter's form, so hiding Trackers hides delete
  too. Intended.
- **Focus:** the tracker code that returns focus to a counter's pencil after a keyboard edit
  (`87-trackers.js`) finds a hidden button; `focus()` on a `display:none` button does nothing, so it
  falls through without error. The test checks it does not throw.
- **Print** is unaffected: it renders its own `#printArea` and hides the page (`50-modal.css`).
- **A hidden card's empty state** ("No features yet") is unchanged: + Add still works.

## 7. Testing

- **Round trip:** `editHide` survives save → load; `migrate()` turns a string, an array and null
  into `{}`; a sheet without the field loads with `{}`.
- **Markup (pure):** for each renderer in §4, every edit/delete/remove button carries `ed`, and no
  play control (Use, Fire, Throw, Cast, equip, the star, the fold, the prepared pin, −/+, reset)
  does.
- **The toggle:** `editToggleHTML()` in both states (title, aria-label, `aria-pressed`, the slash);
  every key in §3 maps to a card in the template.
- **The registry:** the cards in §4 are exactly the cards whose markup has an `ed` button.
- `./src/tests/run.sh` green.
- **Screenshots:** Sheet, Spells, Inventory and Journal, before and after, both skins; the toggle
  driven off and on for Features, Inventory, Class and Trackers; one card hidden inside the combat
  view.

## 8. Docs

- [Sections & layout](../wiki/ui/sections-and-layout.md): the toggle, the keys, the CSS rule.
- [Character model](../wiki/architecture/character-model.md): `editHide`.
- The feature pages whose rows gain `ed` only if their page lists the row's buttons.
- Ledger entry; `UNRELEASED.md`: "Every list card has a pencil in its header that hides its edit
  and delete buttons, so they stay out of the way in play."

## 9. Out of scope

- The Rules tab's glossary entries (decision 4).
- Hiding anything but edit, delete and remove (decision 1).
- An app-wide default for new characters.
