# The Sheet tab makeover — design

**Status:** approved 2026-10-23 and built on branch `issue/103-sheet-makeover` (eight tasks), awaiting Mike's device pass — see [As built](#as-built) · wave 2 of [1.9.0](../wiki/roadmap/1.9.0.md)
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
| 16 | Where the XP thresholds come from | **The character's ruleset's `advancement` table, falling back to the SRD's**, hard-coded. No pack declares it yet: SRD 5.2 and the 2024 rules use identical thresholds, so the fallback is right for both; the converter can extract it in 2.0 | The converter extracting it now: every pack's digest moves and a data release follows, for numbers the fallback already has. A hard-coded table only: a homebrew or Humblewood world with other numbers could not say so |
| 17 | XP or milestones | **A per-character setting, `advancement`: XP (today's behaviour, the default) or Milestone** (no XP; the DM grants levels, taken with Level up) | XP only: tables that use milestones keep an empty field. App-wide: two tables on one device can't differ |
| 18 | Calculation rules in general | **Deferred to 2.0** (Mike, 2026-10-23): rules that drive calculations (spell slots, proficiency, advancement) coming from the loaded packs, with a chooser when two loaded rulesets conflict. 2.0 rewrites the app for fully customisable systems; until then the advancement table is the one ruleset-specific calculation | Building the conflict chooser in 1.9.0: a subsystem the rewrite would replace |

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
| `advancement` | `"xp"` \| `"milestone"` | `"xp"` | read through `advancementOf(c)`; anything else reads as `"xp"` |

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

## 4a. The advancement table

- A system pack may declare `advancement`: a list of `[xp, level]` pairs, ascending (new optional
  field, `docs/rules-schema.md`). Merged per pack label like `defaultLanguages`, in #88's `packMap()`.
- `advancementFor(c)`: the declaration of the pack whose `system` is the character's, if it is a
  valid ascending list of whole numbers starting at level 1; else `SRD_ADVANCEMENT`, the SRD's table
  (0 → 1, 300 → 2, 900 → 3, 2700 → 4, 6500 → 5, 14000 → 6, 23000 → 7, 34000 → 8, 48000 → 9,
  64000 → 10, 85000 → 11, 100000 → 12, 120000 → 13, 140000 → 14, 165000 → 15, 195000 → 16,
  225000 → 17, 265000 → 18, 305000 → 19, 355000 → 20), a top-level literal in `00-constants.js`.
- `xpProgress(c)`: from the character's XP (a number, or a string of digits and commas) and total
  level, `{xp, next, levelFor}` — the threshold of the next level and the level the XP earns —
  or `null` when XP is not a number. At level 20, no next.

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
- **Level badge and XP**: the total level in a ring.
  - **XP mode** (`advancement` "xp"): XP as an editable number beside it, and a bar toward the next
    level's threshold (§4a). When XP reaches it, the bar is full and the badge reads "Level up ready";
    tapping the badge opens the class flyout. XP not a number: shown as typed, no bar.
  - **Milestone mode**: the badge only; levels come from Level up in the class flyout.
- **Settings → This character**: "Advancement: XP / Milestone".
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
- **XP not a number**: shown as typed, no bar. **A pack's `advancement` that is malformed** (not
  ascending, not numbers): the SRD fallback is used.
- **Switching to Milestone**: XP is kept in the data, only hidden, so switching back restores it.

## 12. Testing

- Round trip and junk for `resists`, `immunes`, `senses`, `languages`, `showFamiliars`.
- Each migration twice (idempotent): note merges (`class`, `origin` → `portrait`; `rest` → `vitals`),
  the Languages lift, `rest` → `vitals` in combat sections, default languages added once.
- Grants: a species with `languages` adds chips with provenance; removing it removes them; a name
  also added by hand stays.
- `defaultLanguagesFor()`: a pack's declaration, the fallback, a label of `__proto__` (with #88).
- `advancementFor()` and `xpProgress()`: a pack's table, the SRD fallback, a malformed table, XP as
  "183,000", XP past the next threshold, level 20, XP not a number; `advancementOf()` junk.
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
[Rules packs](../wiki/architecture/rules-packs.md) (`defaultLanguages`, `advancement`),
`docs/rules-schema.md` (ships), [2.0](../wiki/roadmap/2.0.md) (decision 18 added to what 2.0 must
carry), the ledger, and `UNRELEASED.md`: "The Sheet tab is redesigned: a header with your class,
level and rest buttons, a portrait rail with AC, HP and hit dice, abilities with their saves across
the top, and a new Defences card for resistances and immunities. Spend a hit die by rolling in the
app or entering your own roll. Attacks move to Inventory; the Story tab is now Bio, with alignment,
languages and senses."

## 14. Out of scope

- A cross-category Favorites panel (decision 15).
- Filling resistances, immunities or senses from pack prose (decisions 10, 13).
- Armor and weapon proficiency chips (the reference shows them; not asked).
- Any change to the combat view's own layout beyond what the rail brings.
- Calculation rules from packs in general, and a chooser for conflicting rulesets (decision 18, 2.0).
- The converter extracting the advancement table (decision 16).

## As built

Built 2026-10-23 in eight tasks (base `603c4e7`): chips, advancement and default languages; the
migration; language grants; the chip cards and Bio; the hit-dice bar and spend box; the header;
the grid; QA, tuning and docs. Ledger: "The hit-dice bar and the spend box" (L6580) and "The Sheet
makeover" (L6633); the final review's fixes are "The Sheet makeover: final review fixes" (L6729).
What differs from the sections above, and why:

**Deviations**

- **§4, a system change replacing `system` chips: not needed** — a character's system never changes
  (ruled at plan time). Settings → Skin does still rewrite the open character's `system`, which
  leaves its `system` chips; inert today, because every ruleset falls back to Common, and recorded in
  [Known issues](../wiki/roadmap/known-issues.md).
- **§4, a new character before a cold rules cache** gets the fallback Common even where a pack would
  declare other defaults (parked in Task 2; inert, no pack declares `defaultLanguages`; known issues).
- **§5, the Languages lift runs once**, flagged by `langLifted` (set by `newCharacter()`, never in
  `blankChar()`), so a "Languages:" line the player types later stays text. "Once" in §5 read as
  "on every load, a no-op when there is no line", which would lift the player's later line.
- **§6.1, the empty species reads "+ Race" / "+ Ancestry"** by skin (`raceTerm()`), as the rest of
  the sheet words it, not "+ Species". "Level up ready" runs Level up directly (`doLevelUp()`, which
  asks which class when there are several) rather than opening the class menu.
- **§6.1, the header's Remove buttons carry `ed`** though no pencil reaches them (they sit outside
  any `EDIT_CARDS` card); kept, commented, so every `data-del-*` button carries it (#97's guard).
- **§6.1, adding the first familiar turns `showFamiliars` on** (decision 5's default, applied at the
  moment it changes).
- **§6.2, the rail and the strip keep a small `.label`** ("Vitals", "Ability Scores & Saves"): the
  note button, the combat toggle, the ☰ entry and the registry-title test all need one.
- **§6.2, `#maxNote` shows only when an effect moves Max HP**; its standing placeholder went (no room
  in the rail, none in the mockup).
- **§6.2, the death saves read ✓ ○○○ ☠ ○○○ ✗** with the success set reversed so both fill outward
  (the old row was failures first).
- **§6.6, `pawHTML()` builds the paw only** (it was `sheetHeadHTML()`, renamed in the final review);
  the rest of the header is static markup, because boot wires its ids once.
- **§6.6, the paw's menu also holds Combat view and Note** (final review I-3), the controls the
  hidden Familiars card's heading carried; `familiars` leaves #97's `EDIT_CARDS`, since its pencil
  was out of reach and Edit / Delete now live in the familiar's window.
- **§6.7, the phone rail** puts the small portrait at the left with the rest beside it and the AC
  shield over the portrait's bottom edge, not beside it (the mockup was schematic; Mike's device pass).
- **§7, the header is not combat-addable** (Task 8 ruling): `portrait` is marked `nocv`, and a saved
  `portrait` in the combat view becomes `vitals`, like `rest`. Its rests are not a fight action and
  the portrait rides in with Vitals. The view gains its own Inspiration ✦ instead (Task 6 ruling).
- **§7, Familiars** stays combat-capable: the view shows its card, and the paw's menu adds or
  removes it (final review I-3).
- **§8, print** puts the chips in their own box; the Proficiencies prose was never printed and still
  is not.
- **§10, removing `.stack{display:contents}`** (it only existed to sink the Sheet's Familiars on a
  phone, and reached every tab) restores the 12px gap between cards on Spells, Journal and
  Inventory at ≤820px; they touched before. A separate release-note bullet says so.
- **The no-packs hint** the old Class card showed is back in the Add class window (`NO_RULES_HINT`),
  the way into a sheet with no class (Task 8 ruling).
- **Dark mode**: the rail is tinted rather than darker (forest green with a gold edge in Humblewood,
  slate in Classic), because the dark page ground is already near-black and a darker rail read as one
  more card. Light mode is the mockup's dark rail.
- **The phone header** (≤480px) tightens its gaps and the XP box so the icons and the level badge
  share one row under the name: two rows in all, not the three the first build had.
- **Final review fixes** (L6729): with no hit-dice pool (a custom class, or no pack) the auto/manual
  pill and the dice field sit inline under the hint, one copy at a time with the spend box's (I-1); a
  class's menu levels that class, `doLevelUp(idx)` / `doLevelDown(idx)` (I-2); the short rest points
  at the hit-dice bar and offers Spend a hit die (M-1); an unknown language `src` reads as the
  player's (M-3); the species button names the subrace (M-7); an open spend box follows a dice edit
  or the mode switch (M-8); **§6.1's XP bar fills within the level**, `(xp − cur) / (next − cur)`,
  clamped (Mike's ruling, M-9); Summon / Dismiss is a button and keeps the keyboard (M-14).
- `statStyle` and `hdStyle` stay in `blankChar()` and saved sheets, unread; `classChipHTML()`,
  `statStyle()` and the grouped builders are deleted.

**Checked in QA** (Playwright, 1280 / 900 / 390, both skins, light and dark): a level-15 "88/153"
fits its boxes (28px of text in a 35px box in Classic's Cinzel) at 390 and 1280; the sense chip
reads "TREMORSENSE · 60 FT" (the chip is uppercase) as §8 asks.

**What Mike still has to check on his devices**

- Touch: the header's class line, the paw and its menu, the hit-dice bar and the spend box, the HP
  bar's boxes (tap to type) and ± buttons, the death-save circles, the chip × and + Add.
- The phone rail: the shield over the small portrait, and whether two header rows read well.
- The dark rail tints in both skins on a real screen.
- Print: the new Resistances, Immunities, Senses and Languages box.
- His own characters: an old sheet's Class / Ancestry / Rest notes merged into Character and
  Vitals, its "Languages:" line become chips, and its combat view (a saved Portrait becomes Vitals).
- The paw menu's Combat view and Note items, and the inline hit-dice field on a custom class.
