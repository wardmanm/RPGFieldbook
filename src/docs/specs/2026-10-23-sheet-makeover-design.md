# The Sheet tab makeover — design

**Status:** approved in conversation 2026-10-23, awaiting written-spec review · wave 2 of [1.9.0](../wiki/roadmap/1.9.0.md)
**Issue:** #103 (Sheet tab makeover). One branch, `issue/103-sheet-makeover`, after #88 merges.
Mockups: `.superpowers/brainstorm/59468-1792760354/content/` (`layout-v2.html`, `rail-v2.html`,
`widths.html`). Read [Sections & layout](../wiki/ui/sections-and-layout.md),
[Vitals & rest](../wiki/features/vitals-and-rest.md),
[Abilities & skills](../wiki/features/abilities-and-skills.md),
[Combat view](../wiki/features/combat-view.md) and [Story & notes](../wiki/features/story-and-notes.md) first.

---

## 1. What it is

The Sheet tab becomes one condensed page in three columns, after Foundry VTT's sheet: a header band
(name, class, species, background, rest and inspiration icons, level and XP, a familiar icon), a dark
left rail (portrait, AC, death saves, initiative / speed / proficiency, HP, hit dice), the six
abilities as a strip with their saves, and below it Skills beside a new Defences card
(resistances and immunities), Statuses and Resources, with Features full width at the bottom.
Columns condense to two, then one, by width.

Around it: Attacks moves to the Inventory tab; alignment, languages and a new Senses list move to
the Story tab, which is renamed **Bio**; spending a hit die lets the player roll in the app or enter
their own roll; familiars open from the header instead of a card.

Why: the Sheet takes a lot of scrolling, and the things checked most in play (HP, AC, saves, what
resists what) are scattered.

## 2. Decisions

Settled with Mike on 2026-10-16 (the 1.9.0 page) and 2026-10-23 (this brainstorm, with mockups).

| # | Question | Decision | Rejected, and why |
|---|---|---|---|
| 1 | What leaves the Sheet | **Attacks → Inventory**; **alignment and languages → Bio**; species and background shown in brief in the header | Attacks only: the issue asked for the bio moves |
| 2 | Layout settings | **One new layout, no setting**: three columns, two, one by width | A classic fallback: twice the CSS and screenshots until 2.0 |
| 3 | The arrangement | **Foundry's header band over a left rail**: header; rail (portrait + vitals) down the left; the ability strip over the other two columns; Skills · Defences/Statuses/Resources; Features full width | Abilities as a strip under the header across all three: the rail would start below the fold. Three true columns: abilities lose prominence |
| 4 | Familiars | **A paw icon in the header** → a flyout listing each familiar with an abbreviated status (● summoned, ○ dismissed) → tapping a name opens a modal with that familiar's stat card and Summon / Dismiss | A chip with the name: long names and several familiars don't fit. A side drawer: heavier than needed |
| 5 | A character with no familiar | **A per-character setting shows or hides the paw.** Shown with none: the paw is faint and its flyout offers **+ Add familiar**. Default: on if the character has a familiar, off otherwise | Always shown: clutter for most characters. Add only from Settings: two places for one thing |
| 6 | The rail | **Foundry-style**: AC as a shield below the portrait, overlapping its edge; death saves `✓ ○○○ 💀 ○○○ ✗` with the skull between; Init / Speed / Prof badges; HP and hit dice as bars | Tiles and a big HP number: less like the reference, more height |
| 7 | Spending a hit die | **Tap the hit-dice bar → a box**: pick the die (one row per die type when multiclassed, each with "used − / +"), then **🎲 Roll for me** or **I rolled [ ] → Apply**, showing "5 + CON 5 = 10 HP" before applying | A setting for roll vs manual: Mike wants the choice in the moment. Both: more than needed |
| 8 | Class and species controls | **The header text opens them**: the class opens a flyout (info, subclass, Level up / down, + Add class, Remove); species and background open their info window with Change and Remove | Keep the cards in the rail: the clutter the issue is about. Move them to Bio: changing class becomes a Bio-tab job |
| 9 | Old display settings | **Retire "Hit dice display" and "Skills display"**: the bar replaces the hit-dice styles; the strip and Skills column replace "By ability". Saved values stay in old sheets, ignored | Keep By ability: a second layout of the middle column. Adapt both: more to design and shoot |
| 10 | Resistances and immunities | **Simple chips on the Sheet** (the Defences card), **player-added** through a chooser: the 13 damage types, the conditions (immunities), or free text. Packs do not fill them — they carry resistances only in trait prose, and effects stay numeric-only ([effects](../wiki/architecture/computed-stats-and-effects.md)) | Parse trait prose: a guess that fails silently |
| 11 | Languages | **Chips on Bio.** A species or background that lists `languages` grants chips stamped with their source; removing the source removes them. Existing "Languages: …" lines in Proficiencies move into chips once | Player-entered only: grants keep writing prose. Leave old text: two places for one list |
| 12 | A default language | **A ruleset's `defaultLanguages`, falling back to `["Common"]`**: every character has them as chips stamped `system` | Hard-coded Common: Humblewood or a homebrew world may differ |
| 13 | Senses | **Chips on Bio with an optional range** ("Darkvision · 60 ft"), player-added: Blindsight, Darkvision, Tremorsense, Truesight or free text. Passive Perception stays in the rail | On the Sheet: the issue moves descriptive lists to Bio; senses are rarely changed in play |
| 14 | The Story tab | **Renamed Bio.** Its id stays `story` (saved state keys on it) | Renaming the id too: every saved Section Notes fold state would reset |
| 15 | Favorites | **No cross-category Favorites panel** (Foundry's mixed list under the portrait): each card already has ★ favourites at its top | A second favourites system |

## 3. Data

All new fields are optional, get a default in `blankChar()`, are shape-guarded in `migrate()`, and
survive a save → load round trip ([Character model](../wiki/architecture/character-model.md)).

| Field | Shape | Default | Notes |
|---|---|---|---|
| `resists` | `[{id, name}]` | `[]` | player-added; `name` a damage type or free text |
| `immunes` | `[{id, name}]` | `[]` | player-added; a damage type, a condition, or free text |
| `senses` | `[{id, name, range}]` | `[]` | `range` a number of feet or `""` |
| `languages` | `[{id, name, src}]` | the ruleset's defaults (§4) | `src`: `""` (the player's), `"race:…"`, `"bg:…"` (grants, the existing provenance form), or `"system"` (§4) |
| `showFamiliars` | boolean | see below | the header paw. `migrate()` sets it once when absent: `true` if `familiars` has an entry, else `false` |

- Every list is read through one guard (`chipList(c, key)`): a non-array reads as `[]`, an entry
  that is not an object or has no string `name` is dropped, names are trimmed, and duplicates by
  name (case-blind) keep the first.
- `alignment` (already on the character) moves on screen only.
- `statStyle` and `hdStyle` stay in saved sheets and are no longer read.

## 4. Default languages

- A system pack may declare `defaultLanguages: ["…"]` (new optional field, `docs/rules-schema.md`,
  which ships). Merged per pack label exactly like `requires` and `credits`, in the map #88 makes safe
  (`packMap()`).
- `defaultLanguagesFor(c)`: the declaration of the pack whose `system` is the character's, else
  `["Common"]`.
- A new character gets them as chips with `src:"system"`. `migrate()` adds any that are missing to an
  existing character (case-blind against what it already has, so a migrated "Common" is not doubled).
  When the character's system changes, `system` chips are replaced with the new system's.
- A `system` chip shows its source ("Common · rules") and has no ×, like a grant.
- No pack declares the field yet, so no pack's digest moves; Common is the fallback everywhere.

## 5. Languages from species and backgrounds

- Today `52-race.js` and `54-background.js` append "Languages: …" to `character.proficiencies`.
  Instead they parse the definition's `languages` (a string: split on commas and " and ", trimmed, an
  entry that names a choice — "one of your choice", "any" — skipped) into chips stamped with the
  grant's source, and append nothing.
- Removing or changing the species or background removes its chips (the grants rule:
  [Grants & provenance](../wiki/architecture/grants-and-provenance.md)). A name the player also added
  by hand stays, owned by the player.
- **Migration, once:** `migrate()` finds each line of `proficiencies` that starts with `Languages:`
  (case-blind), splits it the same way into chips with `src:""`, adds those not already present, and
  removes the line (and a blank line it leaves). A sheet without such a line is unchanged, so running
  it again does nothing.

## 6. The Sheet

### 6.1 Header

A band across the top (the reference's red, as theme tokens, so both skins follow):

- **Name**, editable in place (the existing `character.name` input, restyled).
- **The class line** — "Cleric 15", or "Cleric 12 · Fighter 3" — each class tappable: a flyout with
  its info window, its subclass (or Choose), **Level up**, **Level down**, **+ Add class** and
  **Remove** (with the existing confirm). These are the Class card's controls, moved.
- **Species · Background**, each tappable: its info window, with **Change** and **Remove** (confirm)
  added to the window. With none chosen, the word is "+ Species" / "+ Background", opening the
  existing pickers.
- **Icons**, right side: Short rest, Long rest, Inspiration (★, the existing toggle) — the existing
  handlers, as icon buttons with titles.
- **The paw** (§6.6), when `showFamiliars` is on.
- **Level badge and XP**: the total level in a ring; XP as an editable number; a bar toward the next
  level from the SRD advancement table, shown only when XP is a number.
- **The section-note button** for `portrait`, titled "Character" (§7).

### 6.2 The rail (left column; card `vitals`)

Top to bottom: portrait; the AC shield below it, overlapping its bottom edge; death saves with the
skull between; Init / Speed / Prof badges; HP; hit dice; Size and Passive Perception in small text
(Size keeps its picker).

- **HP**: a bar coloured by `hpBand()` when Colour current HP is on, "88 / 153" inside, "+temp"
  at its right; − and + either side (the existing `adjustHP()`); tapping the numbers edits them (the
  existing `data-hp` inputs); the max-HP padlock beside the label (the existing lock).
- **Hit dice**: a bar "d8 · 12 / 15", "CON +5" beside the label; tap → §6.3.
- Every id `recompute()`, `renderHP()` and the death-save code paint today keeps its id, moved.
  `#starBtn`, `#encPill` and `#roundNum` move only by DOM move, never `label.innerHTML +=`
  ([Sections & layout](../wiki/ui/sections-and-layout.md)).

### 6.3 Spending a hit die

Tapping the hit-dice bar opens a modal, "Spend a hit die":

- One row per die type in the pool (`hitDicePool()`), "d8 · Cleric · 12 / 15", each with
  "used − / +" (un-spend / spend without healing — today's put-it-back, kept). The first die with any
  left is selected.
- **🎲 Roll for me**: rolls the selected die, adds CON, applies — today's `rollHitDie()` maths
  (`abilFinal("con")`, `max(0, roll + CON)`).
- **I rolled [ ] → Apply**: a whole number 1 to the die's size; shows "5 + CON 5 = 10 HP → 98 / 153"
  as the player types; Apply uses the same maths with that roll. Out of range or empty: Apply is
  disabled and the line says why.
- Either way: the die is marked used, HP is applied through `adjustHP()`, and the existing rest
  summary reports it. A die type with none left is shown but cannot be spent.

### 6.4 The ability strip (`abilities`)

Six boxes over the middle and right columns: ability, modifier (large), score (small, editable as
today), and the save beneath with its proficiency dot. Two columns: a 3 × 2 grid. Saves stay attached
to their ability; there is no Saving Throws card. Every `mod-` / `save-` id keeps its id.

### 6.5 The middle and right columns

- **Skills** (`skills`): one condensed row per skill — proficiency mark, ability, name, bonus — the
  existing ids, legend and expertise marks.
- **Defences** (`defences`, new): "Resistances" and "Immunities", each a row of chips (§8) with
  + Add. Empty: "None" in soft text.
- **Statuses**, **Resources**: as today.
- **Features & Traits**: full width under the middle and right columns, as today.

### 6.6 Familiars

- The paw icon in the header; faint when the character has none. Tapping it opens a flyout: each
  familiar's name with ● (summoned) or ○ (dismissed), and **+ Add familiar** at the foot.
- Tapping a name opens a modal: that familiar's stat card (the content one row of today's Familiars
  card shows: kind, AC, HP with its ± and temp, speed, notes) with **Summon / Dismiss**, **Edit** and
  **Delete** (the existing form and confirm).
- The Familiars card (`familiars`, `#familiarCard`) stays in the DOM, hidden on the Sheet, so the
  combat view can still take it and its note keeps its key; jumping to its note opens the paw's
  flyout.
- **Settings → This character**: "Familiars & companions icon", the `showFamiliars` switch.

### 6.7 Widths

- **Three columns** above 1000px: rail · middle · right; header and ability strip as §6.4.
- **Two columns** from 1000px down to 700px: rail · one column holding the 3 × 2 abilities, Skills,
  Defences, Statuses, Resources; Features full width.
- **One column** at 700px and under: header (wraps: name and class, then icons and level), rail
  (smaller portrait, AC beside it), abilities 3 × 2, Defences, Statuses, Skills, Resources, Features.
- The exact breakpoints are tuned in screenshot QA; the tab bar stays sticky and the title bar scrolls
  away ([Shell](../wiki/ui/shell.md)).

## 7. Section notes, the combat view and #97

The section registry (`NOTE_SECTIONS`) is what notes, the combat view and #97's pencil key on.

| Key | Today | After | Existing data |
|---|---|---|---|
| `portrait` | Portrait card | the header, titled "Character" | note kept |
| `class` | Class card | removed; controls in the header (§6.1) | its note **merges into `portrait`** once, under a "**Class:**" line |
| `origin` | Ancestry & Background card | removed; controls in the header | its note merges into `portrait` under "**Ancestry & Background:**" |
| `rest` | Rest card | removed; rest icons in the header, hit dice in the rail | its note merges into `vitals`; a saved combat-view `rest` becomes `vitals` (no duplicate) |
| `vitals` | Vitals card | the rail | kept |
| `attacks` | Sheet | **Inventory tab**, above Equipment | note, combat view and #97 follow it |
| `defences` | — | new, Sheet | combat-addable; on #97's list |
| `familiars` | Familiars card | hidden on the Sheet; opened from the paw | combat view keeps it; note kept |
| `proficiencies` | Story: "Proficiencies & Languages" | Bio: "Proficiencies, Senses & Languages", holding Alignment, Languages, Senses and the prose | kept |

- **The merges** run once in `migrate()`: a note for a removed key is appended to its target's note
  (the target created if absent), separated by a blank line and the heading above, then deleted. A
  sheet without such a note is unchanged, so running it again does nothing. `at` keeps the earlier of
  the two; `editedAt` the later.
- **#97**: `EDIT_CARDS` loses `class` and `origin` (their Remove now sits behind the header's flyout
  and window, with a confirm) and gains `defences` and `proficiencies` (the chips' ×). Stored
  `editHide.class` / `.origin` are left and ignored.
- **The combat view**: `COMBAT_DEFAULTS` is unchanged (`vitals`, `statuses`, `attacks`, `resources`,
  `slots`, `activespells`); the rail is what `vitals` brings.
- **Print** builds from data and gains resistances, immunities, senses and languages.

## 8. The chip component

One component for Defences, Languages and Senses:

- A chip: the name in capitals; a range when it has one ("DARKVISION · 60 FT"); its source in small
  text when granted ("· species", "· background", "· rules"); a × when the player owns it.
  The × carries #97's `ed` class.
- **+ Add** opens a chooser modal: the list's suggestions as tappable pills (damage types; for
  immunities also the conditions; for senses the four senses; for languages the languages the loaded
  packs name, if any), a free-text box, and for senses a range box. A name already present is shown
  as added and cannot be added twice.
- Markup is pure strings (`chipsHTML(list, opts)`), so the harness can assert it; every name is
  `esc()`'d.

## 9. Bio

- The tab's label, its ☰ title and the Section Notes card's group heading read **Bio**. The id stays
  `story`.
- The left column's card becomes "Proficiencies, Senses & Languages": **Alignment** (the existing
  field, moved), **Languages** chips, **Senses** chips, then the Proficiencies prose.

## 10. Inventory

The Attacks & Weapons card moves, unchanged, to the top of the Inventory tab, above Equipment &
Inventory. Its renderer, ids and wiring do not change.

## 11. Edge cases

- **An old sheet**: no new fields → defaults; notes merge; languages lift; `rest` in combat sections
  becomes `vitals`; nothing it had is lost.
- **Hostile or malformed data** (a pack's `languages` that is not a string, a chip list that is not a
  list, a sense range that is not a number): the guards drop or blank it; nothing throws. The hostile
  character and pack render tests run through the new markup.
- **A familiar marked summoned with no stat block**: the modal shows its name, kind and the Summon /
  Dismiss button.
- **A character with no class**: the class line reads "+ Class".
- **XP not a number**: shown as typed, no bar.

## 12. Testing

- Round trip and junk for `resists`, `immunes`, `senses`, `languages`, `showFamiliars`.
- Each migration twice (idempotent): note merges (`class`, `origin` → `portrait`; `rest` → `vitals`),
  the Languages lift, `rest` → `vitals` in combat sections, default languages added once.
- Grants: a species with `languages` adds chips with provenance; removing it removes them; a name
  also added by hand stays.
- `defaultLanguagesFor()`: a pack's declaration, the fallback, a label of `__proto__` (with #88).
- The spend box's maths: roll and manual, CON negative, a total below 0, out-of-range input, the
  last die, a multiclass pool.
- The registry against the template (both ways), the new counts, `EDIT_CARDS`, `COMBAT_DEFAULTS`.
- The layout tests rewritten for the new grid and breakpoints; the Vitals / Rest ownership tests
  rewritten for the rail and header.
- `chipsHTML()` and the chooser's markup, escaped; the paw's flyout and modal markup.
- `./src/tests/run.sh` green.
- **Screenshots**: Sheet, Inventory, Bio, and the combat view, at about 1280, 900 and 390px wide,
  both skins, before and after. **Driven**: spend a hit die both ways; the paw (flyout, modal,
  Summon / Dismiss, + Add); the class flyout's Level up and Level down; changing species (its language
  chips swap); adding and removing each kind of chip; an old character (with class, origin and rest
  notes, and a "Languages:" line) migrating; #97's pencil on Defences and Bio's card.

## 13. Docs

[Sections & layout](../wiki/ui/sections-and-layout.md), [Vitals & rest](../wiki/features/vitals-and-rest.md),
[Abilities & skills](../wiki/features/abilities-and-skills.md), [Story & notes](../wiki/features/story-and-notes.md),
[Combat view](../wiki/features/combat-view.md), [Character model](../wiki/architecture/character-model.md),
[Grants & provenance](../wiki/architecture/grants-and-provenance.md), [Shell](../wiki/ui/shell.md),
[Rules packs](../wiki/architecture/rules-packs.md) (`defaultLanguages`), `docs/rules-schema.md`
(ships), the ledger, and `UNRELEASED.md`: "The Sheet tab is redesigned: a header with your class,
level and rest buttons, a portrait rail with AC, HP and hit dice, abilities with their saves across
the top, and a new Defences card for resistances and immunities. Spend a hit die by rolling in the
app or entering your own roll. Attacks move to Inventory; the Story tab is now Bio, with alignment,
languages and senses."

## 14. Out of scope

- A cross-category Favorites panel (decision 15).
- Filling resistances, immunities or senses from pack prose (decisions 10, 13).
- Armor and weapon proficiency chips (the reference shows them; not asked).
- Any change to the combat view's own layout beyond what the rail brings.
