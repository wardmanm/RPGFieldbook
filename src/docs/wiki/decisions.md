# Decisions

Every decision the wiki records, one line each, grouped by the page that argues it. The line gives
the question and what was decided; **the reason and the rejected alternatives are in that page's
Decisions table** — read them before reopening one, because most were settled after something went
wrong. Cross-cutting architecture also has an ADR: [ADR-001](../ADR-001-source-split.md), why the
source is split and still ships as one file.

**See also:** [2.0](roadmap/2.0.md) (what a refactor must carry), [Known issues](roadmap/known-issues.md)
(including the "verified NOT gaps")

When a page gains a Decisions row, add its line here under that page.

## Overview

### [Overview](overview.md)

- **Where dev docs live** — Split by reader: `src/docs/` for Mike's, `src/docs/_claude/` for agent context; ADR-001 stays with the human docs
- **How the reference is kept** — This wiki, compiled from the ledger and kept current by each change ([spec](../specs/2026-09-28-living-wiki-design.md))

## Architecture

### [Build & source split](architecture/build-and-source-split.md)

- **How to split the source** — Plain fragments concatenated into one file
- **What decides fragment order** — `src/manifest.json`, checked both ways
- **Where fragment boundaries fall** — Positional slices at the original banner comments
- **The CSS marker** — `/*@@CSS@@*/`
- **How staleness is detected** — Content hash: `--check`, `.buildstamp`, HEAD
- **Where the stale check runs** — CI and the pre-push hook
- **Whether `dist/fieldbook.html` is tracked** — Tracked
- **How the tests assemble the markup** — Re-implement the splice in the harness
- **Renaming `72-charupdate.js`** — `72-char-update.js`: every other multi-word fragment hyphenates, and its test is `char-update.js` (L1262)
- **Renaming `50-classrace.js` to `50-rules-lookup.js`** — Keep `50-classrace.js`
- **Renumbering prefixes after `50-tables.html` was deleted** — No

### [Storage](architecture/storage.md)

- **Where the rules pool lives** — IndexedDB, with `localStorage` as fallback and migration source
- **Whether to compress the IndexedDB copy** — No, only the fallback
- **How LZW codes are stored** — 15 bits per character, offset by 32
- **What happens when the LZW dictionary is full** — Stop growing
- **A hanging IndexedDB request** — Time out at 4 s and fall back
- **What a failed backup returns** — `{error, copy}`, so the caller can offer a download

### [Character model](architecture/character-model.md)

- **What `migrate()` does with fields it does not know** — Keep every field, then normalize the known structured ones
- **What `appVersion` means** — The version last *reconciled* against
- **Where a new character is stamped** — `newCharacter()`
- **Where the Max HP lock lives** — `hp.locked`, inside `hp`
- **The section-notes field** — `secNotes`
- **List items that are not objects** — Dropped: `null`, strings, numbers
- **A player's glossary entry with no term** — Kept, given an id if it lacks one, listed as "(no term)"
- **A player's glossary entry written `{name, description}`** — Read as its term and text, originals kept
- **Pre-equip-era weapons** — Equip them once, recorded by `wpnEquipInit`

### [Rules packs](architecture/rules-packs.md)

- **Which categories are filtered by system** — Species only, in the picker only
- **How a supplement keeps its species away from Humblewood** — `excludeSystems`, which says who the pack is *not* for
- **A same-named subclass from another pack** — Offer it beside the existing one, tagged with its pack
- **Where missing-dependency state lives** — The declaration in `rules.requires`; the verdict at render
- **How references are found** — Structural (`subclasses[].class`) plus declared `requires`
- **How precise the data version is** — Per system
- **A pack with no `dataVersion`** — `unknown`, no badge
- **Duplicates inside a folder** — Mirror `mergeRules()`, and report them
- **Where `overlay.json` and `class-resources.json` live** — The `data/` root
- **What Fetch all does to what is loaded** — Each source that arrives whole replaces only what it loaded last time (`_url`); nothing else changes
- **How a settings file's pool is loaded** — Rebuilt through `mergeRules()`, one run of same-provenance entries at a time (`poolFromExport()`)
- **An entry a pack has with no name** — Skip it, count it, and say so on the status line
- **Where a wholesale pool is made safe** — `tidyRules()`, run by `reindexRules()`
- **A keyword written `{name, description}`** — Read as its term and text
- **The Artificer and Mystic in the core pack** — Leave them, labelled `XPHB`

### [Grants & provenance](architecture/grants-and-provenance.md)

- **How grants are undone** — Provenance-tracked clean revert
- **How an origin's content is updated from a newer pack** — Per feature, spell and item
- **Which CON the level-1 HP seed reads** — `modOf()` of the score
- **Where the starting-equipment picker waits** — Passed with its window to its own Done, or on from its dismissal
- **Where Student of War's tool proficiency goes** — A feature
- **Which class grants saves, equipment and gold** — The first class only; a multiclass gets the pack's `multiclass` subset
- **Removing the first class while another remains** — The new first class takes its saving throws, under its own sid
- **Stripping extra grants from multiclass characters saved earlier** — No: `migrate()` is untouched

### [Computed stats & effects](architecture/computed-stats-and-effects.md)

- **What an effect can express** — Numeric modifiers only (`{target, value}`)
- **How `uses.max` scales** — A number, `byLevel`, or a `formula` re-resolved at render
- **Where encumbrance applies** — After the effects, outside the engine
- **A bonus scoped to one weapon (#74)** — The weapon's `atkMisc`/`dmgMisc`, or prose on an item with no weapon
- **A bonus that holds only in a moment (#76)** — Prose, like advantage and resistance
- **Where an item's spell attack and DC bonus goes (#77)** — Two numeric targets, `spell.attack` and `spell.dc`, read by `spellAtkBonus()`/`spellDC()`
- **A spell bonus the book limits to one class's spells (#77)** — Applied to the character's one spellcasting; the class stays in the description
- **A bonus to every ability check (#79)** — One `check` target, added to each skill, initiative and passive Perception
- **Where a plain ability check's bonus shows (#79)** — In the ability's breakdown, apart from the score; the modifier box stays the modifier

### [Rich text](architecture/rich-text.md)

- **Order of markdown and glossary** — Escape, then glossary chips, then markdown with the tags held aside
- **Placeholder style** — Indexed holds
- **How many `highlight()` calls** — One per block, lines joined by a sentinel
- **How sentinels appear in source** — `String.fromCharCode`/`\u` escapes
- **Italics in pack descriptions** — Allowed, with emphasis that cannot open on "`* `"
- **A one-paragraph rich field** — Unwrap the lone `<p>`
- **What a note preview can contain** — Phrasing markup, block markers represented, chips unwrapped
- **Markdown links** — Not supported
- **Extending the Gadgeteer's italic fix to every Humblewood extract** — Only the positional tagline rule
- **Which attribute values are escaped** — All of them, checked mechanically
- **Which image sources load** — data: URLs only, any media type
- **How the guard finds attribute values** — A tokenizer over `src/js`
- **How a match finds its glossary entry** — One map per call, keyed by the escaped, lower-cased term
- **A glossary entry with no usable term** — Never matched: `glossTerm()` gives "" for anything but a string

## Features

### [Home & characters](features/home-and-characters.md)

- **What `migrate()` carries across** — Every field by default, then normalizes the structured ones
- **A file whose id you already have** — Ask: Replace, Import as copy, or Cancel; a new id imports with no prompt
- **Where the home Import button gets its logic** — It clicks the existing hidden `#fileLoad`
- **How a card knows a sheet is behind** — `appVersion` rides on the library index
- **What a failed backup returns** — `{error, copy}`, so the caller can offer the snapshot as a download

### [Character building](features/character-building.md)

- **Where a block's "choose N" lives** — `data-choose` on the `.choice` wrapper
- **What unlocks a disabled option** — `data-fixed`
- **Options you already have** — Don't spend the budget, but cap it at what remains (`effectiveChoose()`)
- **Where the dismiss guard is checked** — `dismissModal()`, for ✕, backdrop and Escape only
- **Hit points on a level-up** — A synthesized `{type:"hp"}` block in the level's own modal
- **CON for a level-up's hit points** — `abilFinal()`, via `conModNow()`
- **A same-named subclass from another pack** — Offered alongside, keyed "Name (PACK)"
- **Species from the other system** — Filtered out of the picker only
- **An option already on the sheet** — Ticked and `data-fixed` in checkboxes; just disabled in radios
- **Where the equipment picker waits** — Passed to `runChoices()` and on to its own Done
- **When a picked subclass has choices of its own** — Its window opens first; feat skill choices and the equipment picker wait behind it
- **What a dismissed choice window does with the windows behind it** — Hands them on (`then`)
- **Student of War's tool** — An `option` that becomes a feature
- **What a multiclass add grants (#66)** — Level-1 features and non-skill choices, the pack's `multiclass` skills, an HP step; no saves, no equipment or gold
- **A class with no `multiclass` data, added as a second class** — No class skills, and a note that the pack does not list them
- **Removing the first class while another remains** — The class now first takes its own saving throws, with a toast
- **Hit points for a first class that starts above level 1** — Seed level 1, then an HP step for levels 2..N in the same window
- **What a choice window's title names (#69)** — The span of levels its choices and notes carry, an HP step's own span included; no level when nothing carries one

### [Abilities & skills](features/abilities-and-skills.md)

- **How the grouped layout is laid out** — Three across, two down; each ability a header row over its save and skills
- **Where the layout is rebuilt** — `renderAll()`, first statement
- **What grouped mode does to the Skills card** — Hides it and empties `#skills`
- **How the setting avoids a migration** — A resolver whose fallback equals the `blankChar()` default, as `hdStyle` does
- **How expertise is marked in grouped mode** — CSS off the dot's `data-lvl`
- **The Skills note button, hidden in grouped mode** — Shipped as a known gap
- **Where a bonus to plain ability checks shows (#79)** — The ability's breakdown, apart from the score; the modifier box is unchanged

### [Vitals & rest](features/vitals-and-rest.md)

- **Where HP's upper bound lives** — `clampHP()`, run by every HP-changing path
- **How HP boxes commit** — On `change`, outside `data-path`
- **Where the lock flag lives** — `hp.locked`, inside `hp`
- **Whether the padlock confirms** — No confirm
- **CON in the level-1 seed** — `modOf()` of the typed score
- **CON when spending a hit die** — `abilFinal()`
- **Tracking CON edits after the seed** — Stateless: recompute what the previous CON would have written and match it
- **Temp HP in the colour bands** — Excluded
- **The amber band's colour** — A new `--warn` token
- **Default Hit Dice look** — Full (owner's call): it speaks the same language as the Vitals strip and the HP panel, at the cost of height
- **Tapping a spent die in the dice look** — Puts back exactly one
- **Where the Hit Dice sit** — Rest & Recovery, under the rest buttons
- **Death saves filling outward** — CSS `row-reverse` off `data-kind="fail"`
- **Size on tap** — A chooser
- **A first class that starts above level 1** — Seed level 1, then the level-up HP step for levels 2..N (average by default)

### [Conditions & concentration](features/conditions-and-concentration.md)

- **Where concentration is recorded** — On the active spell; the status mirrors it by `concId`
- **How the two stay in step** — A reconcile, `syncConcStatus()`, run from every route that ends a spell and on load
- **How the linked row is found** — `concId`
- **A hand-typed "Concentrating" when you cast** — Adopted, keeping its notes
- **Clearing the condition** — Asks, then ends the spell
- **Effects on the Concentrating row** — None: its rules are prose, and effects are numeric only
- **The Spells-tab copy** — The same `statusRowHTML()`, redrawn from `renderStatuses()`
- **Where the copy sits** — Above Active Spells, where you look when casting the next spell — it tells you what you would drop

### [Attacks & damage](features/attacks-and-damage.md)

- **May a rules resync overwrite a player-edited attack?** — No — rebuild only when `updAtkEdited()` is `false` (owner's call)
- **Where does a spell's second damage type live?** — On the spell, copied onto its row
- **Do save spells without damage get a row?** — No; attack spells always do
- **Auto-detect a second damage type?** — No — leave the box blank
- **Heal old sheets' damage-free rows** — A targeted sweep, `dropDamagelessSpellRows()`
- **What happens to a weapon's attack on unequip?** — Hidden
- **Order of starred attacks** — Insertion order
- **Should `attackNumbers()` skip the effects of the item that owns the row? (#74)** — No: effects are global, a weapon's own bonus is its `atkMisc`/`dmgMisc`, and the packs are fixed

### [Class resources](features/class-resources.md)

- **How a pool shows its die size** — A separate `die`, resolved per level like `max`
- **An option's cost name** — Mapped to the tracker's name in the converter (`_CONSUMES_AS`), because the sheet spends from a pool matched by name
- **Where Battle Master's pool is declared** — A `"Fighter/Battle Master"` key in `class-resources.json`, read by both converter paths
- **Student of War** — Hand-listed in `_prose_choices()`, as the source carries no data for it; keyed by class, subclass and source so another printing is never touched
- **What the 2024 options library contains** — XPHB printings only

### [Features & traits](features/features-and-traits.md)

- **What starring a feature does** — Moves it into a pinned "★ Favorites" group — the same partition the inventory uses, so most of it came for free
- **How groups sort** — Favourites by name, like the inventory's; origin groups keep grant order, which for a class is level order
- **Favourites in the ☰ menu** — Not listed (`buildToc()` collects `.inv-sec-head`, not `.fghead`)
- **A starred granted feature on a grant rebuild** — Loses the star, left as-is: in most of those paths the feature genuinely changes
- **Feats and traits in one picker** — Each wrapped as `{k, e, id}`
- **The origin of a picked feature** — `null`, so it lands in "Other"
- **Where a feat's kind and prerequisite are read** — The first line of the description only

### [Spells](features/spells.md)

- **Warlock slots replacing lower levels on level-up** — Left alone — it is Pact Magic
- **How the browser's level badges update** — Repainted in place from `foot()` (`paintGroupBadges()`)
- **Carrying a count to a group heading** — A `groupKey` / `groupBadge` hook on `openBrowse()`
- **Fixing the off-screen Add button** — `width:auto` on `.br-origin`, shared by both finders
- **Saying what the prepared tick means** — A visible `Prep` caption, `aria-pressed` and a title
- **An item's bonus to one class's spells, such as a Moon Sickle's (#77)** — Applied to the one spellcasting the sheet has; the class stays in the description

### [Inventory](features/inventory.md)

- **Where a custom item's section is stored** — `sectionOverride`
- **Starred items** — Shown only in `★ Favorites`
- **Encumbrance default** — `"none"`
- **Encumbrance as an effect** — No — applied in `recompute()` after the effects
- **Weight on the copy** — A numeric field; `itemMetaLine()` untouched
- **`category`/`type` in `UPD_FIELDS.item`** — Left out
- **Auto-detecting charges ("7 charges")** — No
- **Coins: inline entry and Adjust** — Both
- **Reading `"1 2"` in a coin box** — Rejected

### [Armor & AC](features/armor-and-ac.md)

- **Structured field or description when both exist** — The field wins — explicit over prose, as `weapon` already behaves
- **How a custom item becomes armor** — An Armor toggle writing the structured field
- **What the shield kind shows** — A bonus box instead of Base AC and Max Dex
- **A pack item's AC bonus that holds only sometimes (#76)** — Prose in the description, no `ac` effect

### [Story & notes](features/story-and-notes.md)

- **Do the eight bio cards take a section note?** — No
- **What the new field is called** — `secNotes`
- **How notes are keyed** — A stable id per section in `NOTE_SECTIONS`
- **What the hover preview renders** — Phrasing markup only, block markers represented, chips unwrapped

### [Journal](features/journal.md)

- **How pages are organised** — An optional free-text tag, grouped
- **What "timestamp" means** — Created and edited dates, plus Insert timestamp (a bold line)
- **Page order** — Newest created first
- **Where a blank page goes** — Never saved: a page exists only while it has a title or text
- **Editing** — Inline, built once

### [Rules & tables](features/rules-and-tables.md)

- **Where the fold state lives** — `settings`, as a collapse map
- **Default fold state** — Both shut; an absent key means untouched
- **An anchor whose table is not loaded** — The words "the *Name* table"
- **An anchor with no table sink active (converter)** — Keep the old silent drop
- **Spell-slot columns in class tables** — Skipped
- **Where tables are browsed** — A card under the glossary on the Rules tab (#32)
- **Where a table's footnotes render (#73)** — Under the table, outside its scroll box, escaped like a cell

### [Combat view](features/combat-view.md)

- **How it opens** — **As built:** a tab (`#tab-combat`) reached from the swords, with no word tab (owner's call after play)
- **Where the button lives** — The sticky tab bar, before ☰
- **What a round changes** — Active spells only, through `advanceRound()`
- **Start and End** — Start sets round 1; End is its own button and asks; leaving never ends combat
- **Which sections** — Any of the 19, six by default, drag to reorder, saved per character
- **Mechanism** — Move the real cards
- **"In combat"** — `combatActive`, its own flag
- **Dragging** — Pointer events; neighbours hop, the dragged card stays
- **Esc** — Not handled

### [Rules-update tool](features/rules-update-tool.md)

- **How a copy finds its entry** — A stamp at copy time; resolve by pack + name
- **How many fingerprints** — Two: the def's (`fp`) and the copy's (`cfp`)
- **Fingerprint granularity** — A per-field map
- **What the diff compares against** — The def projected through the copy's recorded shape
- **Legacy, loose and ambiguous matches** — Offered unticked, or not actionable at all
- **The stamped pack is not loaded** — Offer the other pack's entry, labelled and unticked
- **Class, race and background drift** — Per feature, spell and item only
- **Where `appVersion` gets its first value** — `""` in `blankChar()`, `APP_VERSION` in `newCharacter()`
- **When a backup cannot be stored** — Offer the snapshot as a download, then continue
- **An attack the player has edited** — Leave it alone (owner's call)
- **What `genFp` covers** — Every field the generator sets, the two ticks included
- **The shape of `genFp`** — A single hash

### [Settings & updates](features/settings-and-updates.md)

- **How to tame the long Settings modal** — Folding groups built from the feature list's section header
- **How fold state is stored** — Collapse map; absent = never touched
- **What a toggle does** — Flips display and caret in place
- **Where the delegated listener lives** — `#setSections`
- **Version button and update pill** — One control: the pill takes the button's slot
- **What the pill opens** — The changelog, led by a download banner
- **The pill's element** — A `<button>`
- **Where the changelog lives** — Embedded in `30-version.js`, keeping the single-file offline design; `docs/CHANGELOG.md` is generated from it so the two cannot drift
- **Where icon credits live** — In Settings
- **Where the Download link may point** — A `https://github.com/` page from the response, else the releases page
- **How Import settings asks about loaded rules** — A window with three answers: Cancel, Keep my rules, Replace my rules
- **When Import settings asks** — Only when the file carries readable rules and some are loaded
- **A settings file with an empty pool** — Treated as carrying no rules
- **Where an import's outcome is shown** — A status line beside the Import button

## UI

### [Shell](ui/shell.md)

- **Does `selectTab()` scroll?** — No. The caller decides: the tab bar goes to the top, a note jump to its card
- **Where does the dismissal guard live?** — `dismissModal()`, in front of the three user dismissals only
- **Which modals get a guard?** — Only one that stands to lose something (the choice pickers)
- **Where a dismissed window's follow-up lives** — With its guard, as `then`, cleared by every open and close
- **Where does auto-focus land?** — The first text box on the first screenful with a fine pointer; the dialog itself on touch
- **The emblem slot in the header** — Assigned on every open
- **Where the toast lives** — In the template, empty from load
- **A tap on a finder row** — Updates that row and the footer in place
- **The off-screen Add button** — `width:auto` on the origin select, `flex-wrap` as a safety net
- **Markup that moves, in `wire()`** — A local `on()` that skips a missing id
- **The modal title's contract (#69)** — Plain text, set as `textContent`; callers never escape it

### [Sections & layout](ui/sections-and-layout.md)

- **How is a section identified?** — A stable `k` in `NOTE_SECTIONS`
- **The `origin` title on the Notes tab** — Ask `noteTitle()`, which asks `raceTerm()`
- **Familiars on a phone** — Flatten `.stack` inside the ≤820px query and sink the pair with `order:1`
- **Where the familiar row may wrap** — Only in `#familiarList`
- **A collapsible in Settings** — Reuse `.fgroup` / `.fghead` / `.fcaret`
- **How collapse state is stored** — As shut = `true`, absent = default, so a default can change without reopening what a player shut
- **Where Rules-tab folding is stored** — `settings.rulesCollapse`
- **Colour of group names** — `--accent`, set on the shared `.fgname` rule
- **Counts and badges in a heading** — Counts in `.cnt`, badges keep the `.fgcount` pill
- **Order of favourite attacks** — The order they were added
- **Headings on the Attacks card** — Only when something is starred
- **The shared section-head rule** — `.fghead,.inv-sec-head` share one rule; the inventory class keeps its name
- **Fragment prefixes after the Tables tab went** — Left as they were (`50-` is a gap)

### [Theming & icons](ui/theming-and-icons.md)

- **Where the emblem map lives** — In the app: `src/icons/icons.json`, generated into `05-icons.js`
- **Keep the `.svg` files?** — No: the generated fragment is the vendored artwork
- **Fetch during the build?** — No: run by hand
- **What an emblem is keyed by** — The entity's name, lower-cased
- **An unmapped name** — No emblem (`""`)
- **Subclasses** — No emblem
- **An upstream icon with groups or transforms** — The fetcher dies, naming it; pick another icon
- **Artifact size** — No size gate; path data kept as published
- **Where the credit appears** — Settings (folded) and README §10, both generated or asserted
- **The mid-band HP colour** — Its own `--warn` token in all four palettes

## Data

### [Converter](data/converter.md)

- **How the 2024 book is selected** — `source == "XPHB"`, with the free-subset flags only as a backfill
- **Which flags mark the free 2024 subset** — `basicRules2024` **or** `srd52`
- **A table found with no sink collecting** — Drop it, emit no anchor
- **Spell-slot columns in class tables** — Skipped
- **A table cell `_cell_text()` cannot read** — Blank, counted, and a `WARNING` at the end of the run (#64)
- **How typed class-table cells print** — As the book prints them: `+2`, `1d6`, `+10 ft.`, `—` for a speed bonus of 0
- **A table's footnotes (#73)** — An optional `footnotes` list on the table, each rendered by `_cell_text()`, with its `*` kept
- **Whether identical-table reuse compares footnotes (#73)** — Yes: cols, rows and footnotes
- **Where `overlay.json` and `class-resources.json` live** — At the `data/` root; in the zip, beside `convert.py`
- **How options reach the level-up picker** — Inlined in every choice (~150 KB across the packs)
- **Which printing of an option a class offers** — The class's own source only, falling back to PHB for a 2014 book with none
- **How a bundle dedupes** — Exactly as `mergeRules()` does, and every duplicate printed
- **How a skill-proficiency list is read** — One reader, `_skill_profs()`, for species, a class's starting skills and its multiclass skills; `{"any": N}` is a choice of N from all 18 skills (#67)
- **Where a class's multiclass proficiencies come from** — 5e-tools `multiclassing`, carried as an optional `multiclass` block; `{}` kept, absent when the source has none
- **An entry node `flatten()` cannot render** — Nothing rendered, counted, and a `WARNING` at the end of every run (#68)
- **How formula lines are worded** — 5e-tools' "classic" wording, "8 + your proficiency bonus + your Intelligence modifier" (#68)
- **Whether a formula line ends with a full stop** — Yes, though the book prints none (#68)
- **A `statblock`, an entity embedded by reference** — Resolved from the dump's item files and written as the item's stat line (#68)
- **Where a magic weapon's property and mastery names come from** — The run's item index (`items-base.json`'s `itemProperty` and `itemMastery`), through one resolver shared with statblocks (#72)
- **A weapon property or mastery code nothing defines** — Printed as the code, counted with its items, and a `WARNING` at the end of every run (#72)
- **A reference carrying a note (`{uid, note}`)** — "Name (note)" in the notes and the description (#72)
- **A single `items` run on the magic-item file** — Index the `items-base.json` beside it (#72)
- **A ranged weapon with Finesse (#75)** — `finesse`, the better of STR and DEX, as for a melee one
- **Where a `+N` weapon's bonus goes (#74)** — On the weapon, `atkMisc`/`dmgMisc`, and never as an effect
- **A weapon bonus on an item that is not a weapon (#74)** — Kept in the prose; no effect
- **Telling a standing item bonus from a conditional one (#76)** — Read the sentence that states it: standing only when nothing but wearing, holding or carrying the item conditions it
- **A bonus no sentence states (#76)** — Not an effect, and a `note:` naming it
- **Bracers of Defense, whose +2 needs no armor and no shield (#76)** — Prose, like any conditional bonus
- **The Quarterstaff's once-per-rest Reaction as a tracked use (#76)** — No; it stays in the description
- **Where a `{#itemEntry}` template's text goes (#78)** — Into the description, filled from the item as 5e-tools renders it; the bonus reader reads that same text (reverses #76's "for the bonus reading only")
- **A template or placeholder that does not resolve (#78)** — Printed as it stands, counted with its items, and a `WARNING` at the end of every run
- **Which ignored item fields become effects (#79)** — `bonusAbilityCheck` as `check` and `bonusProficiencyBonus` as `profBonus`; `ability` and `modifySpeed` stay prose
- **How `{{getFullImmRes item.resist}}` prints (#78)** — Title-cased ("Acid"), as the 2024 templates call it; a raw `{{item.resist}}` prints as the item has it
- **An item's spell attack and spell save DC bonus (#77)** — `spell.attack` / `spell.dc` effects through the same sentence reader, a named class not counting as a condition

### [Supplements](data/supplements.md)

- **How a supplement is converted** — The core pipeline with the book as a parameter (`Book`): a supplement is the same pipeline pointed at a different source code
- **Whether `supplement` joins `all`** — A separate subcommand, one book per run
- **How subclass duplicates are removed** — Drop records carrying `_copy`
- **Where a supplement's spell class tags come from** — `class` and `classVariant`, from XPHB/EFA/PHB/TCE, gated on the book
- **A supplement subclass named like a 2024 one** — Offered beside it as `"Name (PACK)"`; same-pack re-import still replaces
- **Where colliding table names are fixed** — In the converter, suffixing the supplement's copy
- **How a species is kept out of Humblewood** — Pack-level `excludeSystems`, honoured by `racesForCharacter()` only
- **The Artificer, already in the 2024 pack from its TCE printing** — Tasha's skips the class and its four subclasses; the core pack's label is left alone (owner's call)
- **Where book profiles live** — `SUPPLEMENTS` in `convert.py`
- **How a book's spell file is found** — One named file, `spells-<code>.json`
- **XGE's encounter, trap and name tables; TCE's sidekick classes** — Not converted

### [Humblewood](data/humblewood.md)

- **Where PDF extraction lives** — A separate dev-only script whose reviewed output is committed
- **How tables are found** — Explicit `SPECS`, each with a declared row count
- **The unmapped "Th" ligature** — An explicit map, a phrase list for the ambiguous cases, and an allow list
- **The book's own defects** — Corrected explicitly: typos in `TEXT_ERRATA`, applied inside `normalise()`; the repeated heading in `HEAD_ERRATA`
- **Four core traits the condensed book lacks (Raptor ×2, Hedge, Mapach)** — Kept (owner's call)
- **The core book's four subclass "Features" tables** — Not extracted
- **Unnamed table references ("roll on the table below")** — Left as printed; owner chips cover them
- **March 2024 (Fizzar as a class)** — Excluded
- **A background whose characteristic tables only partly verify** — Ship all four or none
- **Where the Gadgeteer's layout is fixed** — In the extractor
- **Night Domain Spells' asterisk note (#73)** — Left in the feature prose, where the book prints it after the table; no `footnotes`

### [Homebrew](data/homebrew.md)

- **How homebrew is produced** — Hand-authored JSON
- **How a pack's dependencies are found** — Two detectors: structural (`subclasses[].class`) and declared (`requires`)
- **Matching a declared name** — Case-insensitive against everything loaded, whichever pack supplies it
- **Where the verdict lives** — Recomputed at render time from `rules`; only the declaration is stored

## Process

### [Building & CI](process/building-and-ci.md)

- **What goes in the player zip** — An allowlist matching README §9, verified after zipping; failure deletes the zip
- **How `docs/` is guarded** — Three filenames allowed
- **A source archive** — None; GitHub's automatic Source code archives
- **Naming a build with pending notes** — `v<version>+dev`
- **When the version moves** — Only on `--release`
- **Where staleness is checked** — CI and `pre-push`
- **A src-only PR in CI** — Build the artifact, exclude it from the tracked-files diff
- **Where the hooks live** — Tracked `.githooks/` via `core.hooksPath`
- **Whether `pre-push` rebuilds** — It refuses and prints the command
- **Where the workflow YAML is checked** — Hooks and `dev.sh` `w`, skipping offline
- **What `dev.sh` is** — A menu that shells out and prints each command
- **Icon generation** — Run by hand (`scripts/fetch-icons.js`), not wired into `build.sh`

### [Testing](process/testing.md)

- **Framework** — None: plain node and python3 with a small recorder
- **How suites load the app** — The real concatenation in manifest order, in a `vm`
- **How suites get the markup** — An independent splice in `harness.js`, pinned to the artifact by one assertion
- **Where tests live** — `src/tests/`, where the audience rule keeps them out of the zip
- **How checks are counted** — Each suite prints its total; `run.sh` sums them
- **When bundles are rebuilt** — On every run
- **The PDF-dependent suite in CI** — Skips cleanly without `.venv` or the PDF
- **Finding Python** — Run it
- **What `docs.js` checks** — Mechanically checkable facts

### [Screenshot QA](process/screenshot-qa.md)

- **How screenshots are taken** — The Playwright MCP server, registered at project scope in `.mcp.json`
- **How `.mcp.json` starts it** — `node scripts/playwright-mcp.js`, which picks the spawn per platform
- **The launcher's path** — Relative
- **Server version** — Pinned in the launcher
- **Browser** — Installed Chrome
- **Output directory** — `os.tmpdir`
