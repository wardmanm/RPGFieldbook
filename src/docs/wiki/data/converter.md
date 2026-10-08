# Converter

`scripts/convert.py` turns a 5e-tools data dump into the D&D 2024 rules pack, `data/5e2024/`,
(through `supplement`) into the Xanathar's and Tasha's packs, and (through `srd`) into the SRD 5.2
pack, `data/srd52/`. It is stdlib-only Python 3.8+ and
ships to players in the zip's `scripts/`, so it is both a dev tool and a player tool. Its output is
committed; `scripts/bundle-rules.js` then rolls each system folder into the one-file pack players
import. The player-facing how-to is [README-converter](../../../../docs/README-converter.md); this
page is what that file does not say: what must not move, and the traps that have already shipped.

**Code:** `main()`, `_run_core()`, `srd_view()`, `pick_2024_preferred()`, `pick_sources()`,
`_render_optfeat_prereq()`, `_ref_feats()`, `load_feat_index()`, `flatten()`, `table_ctx()`,
`ref_ctx()`, `_register()`, `_norm_table()`, `_cell_text()`, `_dice_text()`, `_cell_miss_warnings()`,
`_formula_text()`, `_attr_choose()`, `_full_stop()`, `statblock_ctx()`, `load_item_index()`,
`_statblock_text()`, `_item_traits()`, `_entry_miss_warnings()`, `_expand_item_entries()`,
`_fill_template()`, `_full_imm_res()`, `_template_leftovers()`, `_template_miss_warnings()`,
`convert_items()`, `_item_effects()`, `_bonus_reading()`, `_bonus_prose_notes()`, `_weapon_defs()`,
`_weapon_refs()`, `_weapon_miss_warnings()`, `_class_tables()`, `convert_classes()`,
`_skill_profs()`, `_multiclass()`, `_optfeat_choices()`, `convert_races()`,
`_ammo_kind()`, `_ammo_type_kind()`, `_pack_of()`, `_shipped_2024()`, `_reprint_keys()`,
`_fill_variant()`, `_ammo_pieces()`, `_is_ammo_variant()`, `_variant_selected()`,
`convert_ammo_variants()`,
`_pack()`, `_write()` in `scripts/convert.py`; `bundle()` in `scripts/bundle-rules.js`;
`pack_digest()` in `tools/data-kit/fbdata.py`; `mergeRules()` in `89-rules-merge.js`;
`DATA_VERSIONS` in `30-version.js`; `RULE_CATS` in `88-settings.js` ·
**Data:** `data/5e2024/*.json`, `data/srd52/*.json`, `data/overlay.json`, `data/class-resources.json`,
`scripts/srd-corrections.json`, `_conversion-data/5etools-v2.36.1/` (gitignored) · **Tests:**
`converter.py`, `rules-data.js`, `tables.js`, `srd-verbatim.py` · **See also:** [Supplements](supplements.md),
[SRD 5.2](srd.md), [Rules packs](../architecture/rules-packs.md),
[Class resources](../features/class-resources.md), [Rules & tables](../features/rules-and-tables.md),
[rules-schema](../../../../docs/rules-schema.md)

## How it works

**Subcommands.** `conditions`, `glossary`, `feats`, `backgrounds`, `items`, `spells`, `classes`,
`races` convert one file; `all <dir>` converts a whole dump into `data/5e2024/`; `supplement <dir>
--book XGE|TCE` converts one supplement book (see [Supplements](supplements.md)); `srd <dir>`
converts the SRD 5.2 pack (below, and [SRD 5.2](srd.md)). `all` is the only path that reproduces the
committed core pack, and `srd` the only one that reproduces `data/srd52/`. Both are
`_run_core()`, the whole-dump conversion: `all` calls it with the default `Book`, `srd` with
`srd_book()` over a filtered copy of the dump.

**What `all` finds.** It searches the dump root and its `spells/` and `class/` subdirectories
(5e-tools keeps spells and classes there), converts `items-base.json` to `items.json` and the
magic-item file `items.json` to `items-magic.json`, reads `optionalfeatures.json` for the option
pickers, and finds `overlay.json` and `class-resources.json` by trying the flag, then the dump
directory, then the repo's `data/`, printing which one it used. Every missing input is a
`WARNING:` line plus an end-of-run summary; nothing is skipped quietly.

**Selection: the source is the filter.** `pick_2024_preferred()` takes every entry whose `source`
is `XPHB`, then backfills entries XPHB does not cover by name that carry `basicRules2024` **or**
`srd52` (the free 2024 subset), then `basicRules` (2014). Feats, items, magic items, conditions,
the glossary and species go through it via `pick_sources()`. `convert_backgrounds()` and
`convert_spells()` filter on `source == "XPHB"` alone, with no backfill at all. Items also pass a
`shipped` set (`_shipped_2024()`, from both item files): a 2014 entry whose `reprintedAs` names
something the 2024 pack ships is left out, which drops 40 renamed duplicates (Crossbow Bolt, the
2014 Net, Acid (vial)…). `srd52` is read as truthy, in `pick_2024_preferred()`, `_shipped_2024()`
and `_variant_selected()` alike: it is `true` **or a string**, the entry's SRD name, and a string
counts. That is how the 2024 pack carries Carrion Crawler Mucus and Lolth's Sting, under their 2024
names.

**Current output** (counted from `data/5e2024/`): 16 backgrounds, 14 classes, 21 conditions,
77 feats, 58 features, 115 glossary terms, 94 items, 529 magic items, 10 species, 391 spells,
108 tables. Spells carry a `class` list only when `--sources sources.json` is supplied (`all` finds
it in `spells/`); the spell file itself has no per-spell class data.

**Ammunition.** `convert_items()` reads three 5e-tools shapes `all` used to drop entirely. A
launcher's `ammoType` ("arrow|xphb") becomes `weapon.ammo` through `_ammo_type_kind()`, which
resolves the reference through the run's item index to the piece's own kind — a 2014 launcher
naming "crossbow bolt" still reads "bolt". A piece of ammunition (`type` `A`/`AF`) gets `ammo:
{kind}` from `_ammo_kind()`: the item's family flag (`arrow`, `bolt`, `bulletSling`,
`bulletFirearm`, `needleBlowgun`), or, when the book defines no flag (XGE's Unbreakable Arrow),
the matching word in its name. A bundle's `packContents` becomes `pack: {item, qty}` through
`_pack_of()`, naming the single piece it unpacks into ("Arrows (20)" → `{"item":"Arrow","qty":20}`).
`convert_ammo_variants()` reads `magicvariants.json` for ammunition variants only (a `requires`
naming an ammunition type), selected exactly as an item is — the 2024 pack takes XPHB plus the
free-subset flags, a supplement its own source — and expands each onto every single 2024 piece in
the run's index ("+1 Arrow", "Arrow of Slaying"), never a bundle, with its `{=bonusWeapon}` and
other `{=key}` placeholders written out from `inherits`. The variant's text is the same for every
piece it expands onto, so it is flattened once under the variant's own name, not once per piece;
a table inside it (Slaying's d100 creature table) is lifted once the same way, as "Ammunition of
Slaying Table", and every expanded piece's description carries the one anchor.

**Tables are lifted, not dropped.** While an entity is flattened inside `table_ctx()`, every
5e-tools `table` or `tableGroup` node is normalised by `_norm_table()` to
`{name, cols, align, rows, owner, ownerKind}` and appended to one sink, and the prose gets a
`[Table: Name]` anchor at the exact spot. A node's `footnotes` (what a `*` in a row or label points
at) become a `footnotes` list after `rows`, each rendered through `_cell_text()` exactly as a cell
is, the `*` kept and blank ones dropped; a table with none gets no key. In the v2.36.1 dump only
Xanathar's 17 downtime tables reach a pack with footnotes. `_register()` reuses a table identical
in cols, rows and footnotes, and suffixes a colliding name `" (2)"`, because the name is the app's
merge key and the anchor's only handle.
`_class_tables()` turns `classTableGroups` into one Level-indexed `"<Class> Features"` table,
skipping spell-slot groups and the cantrip/prepared/known count columns, and suppressing a table
left with nothing but its Level column. Eleven of the twelve 2024 classes get one; the Wizard's
columns are all spell counts. `all` writes the sink as `tables.json`; a single subcommand does so
only with `--tables PATH`.

**Cells are rendered as the book prints them.** `_cell_text()` de-tags strings, prints a `roll` as
text (`01-02`), flattens `entry`/`entries`, and renders the three typed values 5e-tools uses, all
in `classTableGroups`: `bonus` as `+2` (Rage Damage), `bonusSpeed` as `+10 ft.`, or `—` for 0
(Unarmored Movement), and `dice` as `1d6` through `_dice_text()` (Martial Arts, Bardic Die, Sneak
Attack). A dict cell it cannot read comes back blank **and** is counted in `_CELL_MISSES`;
`_cell_miss_warnings()` turns the count into a `WARNING` at the end of `all`, `supplement` and a
`--tables` run. How the app renders them: [Rules & tables](../features/rules-and-tables.md).

**References are inlined.** A class or subclass feature can point at a sibling feature
(`refClassFeature` / `refSubclassFeature`) instead of containing it. Inside `ref_ctx()`,
`flatten()` resolves and inlines it, with a seen-set so a feature cannot inline itself.
`refOptionalfeature` nodes become a bullet naming the option; the options themselves reach the
sheet through the pickers below.

**Formulas, one-entry items and stat blocks are written out.** `flatten()` writes the book's
centred formula lines (`abilityDc`, `abilityAttackMod`, `abilityGeneric`) through
`_formula_text()`, worded as 5e-tools' classic renderer words them: "Spell save DC = 8 + your
proficiency bonus + your Intelligence modifier", "Spell attack modifier = your proficiency bonus +
your Intelligence modifier", and several abilities as "Strength or Dexterity modifier (your
choice)" (`_attr_choose()`). `_full_stop()` ends each with a full stop, because a named subsection
joins its blocks with spaces. A list item carrying one `entry` instead of `entries` reads exactly
as its `entries` twin, "Name: text". A `statblock` embeds another entity by reference:
`_statblock_text()` resolves an item one through the index `load_item_index()` builds from
`items-base.json` and `items.json`. `all` and `supplement` set that index themselves;
`statblock_ctx()` sets it in a test. `_item_traits()` then writes the item's stat line in the
wording `convert_items()` gives a base weapon, and its prose with any shared template written out
(below). The one statblock in the converted books is the 2024
Soulknife's Psychic Blade. `image` and `gallery` are skipped on purpose. Any other node renders
nothing **and** is counted in `_ENTRY_MISSES`, and so is a statblock that does not resolve (it keeps
its name). `_entry_miss_warnings()` reports each type as a `WARNING` at the end of `all`,
`supplement` and every single subcommand. No run on the v2.36.1 dump reports one today.

**Shared item text is written out.** 5e-tools gives a family of items one text: the item's
entries carry `{#itemEntry Name|SRC}`, and `items-base.json`'s `itemEntry` list (which
`load_item_index()` keeps, by name and source) holds the template. Before `flatten()`,
`_expand_item_entries()` puts the template's entries where the tag stood (a tag with no source
names the DMG's, as in 5e-tools), and `_fill_template()` fills every string in them from the item:
`{{item.resist}}` and `{{item.detail1}}` as the item has them ("acid", "pearl"),
`{{getFullImmRes item.resist}}` through `_full_imm_res()`, title-cased as the 2024 templates call it
("Acid"). So a Ring of Acid Resistance reads "You have Resistance to Acid damage while wearing this
ring. The ring is set with pearl", and a template's named entries (Tasha's "Damage Absorption")
read "Name: text" like any other. `convert_items()` and `_item_traits()` both expand. A tag with no
template, a placeholder with no value, and any template text still printed after `flatten()` (a
tag inside a sentence, found by `_template_leftovers()`) stay as they stand **and** are counted in
`_TEMPLATE_MISSES`; `_template_miss_warnings()` reports each as a `WARNING` at the end of `all`,
`supplement` and every single subcommand. 54 pack items use a template (core: ten Dragon Scale
Mails, 14 Ioun Stones, ten Potions and ten Rings of Resistance; Tasha's: ten Absorbing Tattoos);
none warns on the v2.36.1 dump.

**Weapon properties and masteries are named from their definitions.** Only `items-base.json`
defines them: `itemProperty` (27, keyed by abbreviation, several per code across PHB/XPHB/DMG/XDMG,
all named alike) and `itemMastery` (8). `items.json` copies each base weapon's codes, and every
other weapon field, onto its magic weapons and defines none. `_weapon_defs()` reads both lists from
one file; a property is named by its first entry, or, for the 2014 `S`, by its top-level `name`
("special", printed "Special"). `load_item_index()` returns `(items, props, masteries)`, and
`convert_items()` starts from that index and adds its own file's definitions. `all` and
`supplement` set the index once per run; the single `items` subcommand indexes the
`items-base.json` beside its input. One resolver, `_weapon_refs()`, serves `convert_items()` and
`_item_traits()`: a reference is `"F"`, `"F|XPHB"` or `{uid, note}`, a property is looked up by
abbreviation and a mastery by name, and a note prints in brackets ("Two-Handed (unless mounted)",
the Psychic Blade's "Vex (you can use this property, …)"). `weapon.ability` is `"finesse"` for any
weapon whose named properties include Finesse, melee or ranged (the Dart), else `"dex"` for a ranged
weapon and `"str"` for a melee one, so a magic weapon attacks as its base weapon does. A code nothing defines is printed as it stands and
recorded in `_WEAPON_MISSES` with the items carrying it; `_weapon_miss_warnings()` reports each at
the end of `all`, `supplement` and every single subcommand. Every code in the v2.36.1 dump resolves.

**A weapon's bonus is the weapon's.** 5e-tools' `bonusWeapon` (or the split `bonusWeaponAttack` /
`bonusWeaponDamage`) becomes `weapon.atkMisc` / `dmgMisc`, which the item's attack row reads once.
`_item_effects()` writes only the bonuses that apply to the whole character while the item is
equipped: `bonusAc` as `ac`, `bonusSavingThrow` as the six `save.*`, `bonusSpellAttack` as
`spell.attack`, `bonusSpellSaveDc` as `spell.dc`, `bonusAbilityCheck` as `check` and
`bonusProficiencyBonus` as `profBonus`, each only when it is standing (below). It never turns a weapon bonus into an `attack`/`damage` effect, which would reach
every attack. On an item with no weapon
(Bracers of Archery, Rod of Lordly Might, Oil of Sharpness; Tasha's Eldritch Claw Tattoo and Baba
Yaga's Mortar and Pestle) the bonus is scoped to one weapon, bows or unarmed strikes, which no
effect target can express, so it stays in the prose. The packs ship 15 `+N` weapons: 11 core, 4
Tasha's.

**An item's bonus is an effect only when the book gives it all the time.** 5e-tools sets
`bonusAc`, `bonusSavingThrow`, `bonusSpellAttack`, `bonusSpellSaveDc`, `bonusAbilityCheck` and
`bonusProficiencyBonus` for its search filters
whether the bonus is standing or momentary, and no field tells the two apart, so `_bonus_reading()`
reads the sentence that states it: "+N bonus to … Armor Class/AC"; "+N bonus to … saving throws"
alone or in a list (one named save, or death saves, is not all six); "+N bonus to … spell attack
rolls"; "+N bonus to … saving throw DC(s)" or "spell save DC"; the Robe of the Archmagi's "Your
spell save DC and spell attack bonus each increase by 2"; "+N bonus to … ability checks" alone or in
a list (one named check, or checks "made with" a tool, is not all of them); or "Proficiency Bonus
increases by N". A class named in it ("the saving throw
DCs of your druid and ranger spells") is no condition: the sheet has one spellcasting, and the class
is the item's attunement. It reads that sentence up to the end of the bonus's own clause, sets aside
the conditions an equipped item always meets ("while wearing / holding / wielding / carrying",
"while … is on your person", "while … orbits your head"), and calls the bonus conditional if any of
reaction, when, whenever, if, unless, until, against, while, as long as, for every, allies,
creature(s), once or each time remains. A conditional bonus, or one no sentence states (a table
row), stays in the prose; `_bonus_prose_notes()` prints each as a `note:` at the end of `all`,
`supplement` and `items`, with the words that decided it. It reads the description as written,
shared templates included: the ten Dragon Scale Mails state their +1 only in theirs. Today 19 items keep
standing `ac`/`save.*` effects, all core; five are prose (Quarterstaff of the Acrobat, Arrow-Catching
Shield, Bracers of Defense, Rod of Alertness, Tasha's Teeth of Dahlver-Nar). 28 carry `spell.attack`
and/or `spell.dc` (9 core, 19 Tasha's), every one standing. Two carry the last two: the Stone of
Good Luck `check` +1 beside its six saves, and the Ioun Stone of Mastery `profBonus` +1, both core.
The dump's other item fields that name numbers stay prose: `ability` sets a score ("becomes 21"),
caps it ("increases by 2, to a maximum of 20") or is a one-time increase (the Manuals and Tomes),
and `modifySpeed` multiplies, sets or copies a speed or adds another mode; none is a flat bonus.

**Option pickers.** `_optfeat_choices()` reads a class or subclass's `optionalfeatureProgression`
(a running total per level, as a map or a 20-long list) and emits an `option` choice at every
level the total rises, asking for the rise ("Maneuvers: choose 2 more"), offering only options whose
level prerequisite that level meets. Each option carries its prose, `repeatable` where the book
prints a "Repeatable" subsection, and a `cost` from 5e-tools `consumes` (`_optfeat_cost()`, with the
singular pool name mapped to the tracker's name by `_CONSUMES_AS`). `all` also writes the 58 XPHB
options as library entries in `features.json`. Student of War, which the source states only in
prose, comes from `_prose_choices()`, keyed by (class, subclass, source). An option's prerequisite
line comes from `_render_optfeat_prereq()`; a spell prerequisite shaped as a choice (a dict) is
printed by its own `entry` text through `strip_tags()`, in the dump's title case, so Agonizing
Blast, Eldritch Spear and Repelling Blast read "Prerequisite: Level 2 Warlock and a Warlock Cantrip
That Deals Damage".

**The Fighting Style menu.** On a run with no source codes (`all` and `srd`), `convert_classes()`
replaces the Fighting Style class feature with `FIGHTING_STYLES`, the 2024 menu, wording and all,
limited to the `Book`'s `fighting_styles` when it has them (the SRD's four). The Paladin's and
Ranger's feature also names its own option ("Instead of choosing one of those feats, you can choose
the option below") by reference: `_ref_feats()` finds the `refFeat` in the class feature, and the
feat, looked up in `_FEAT_INDEX` (`load_feat_index()`, from `feats.json` and, in an SRD run, the
view's `srd-ref-feats.json`), is added as one more option: Blessed Warrior for the Paladin, Druidic
Warrior for the Ranger. The 2024 Paladin and Ranger menus are the ten styles plus that option, the
Fighter's the ten; the SRD's are the four plus the option, and four.

**Skill proficiencies: one reader.** `_skill_profs()` reads every 5e-tools skill-proficiency list
the converter meets: a species' `skillProficiencies` (through `_race_skills()`), a class's
`startingProficiencies.skills` and its multiclass skills. A bare name or `{"perception": true}` is a
fixed skill; `{"choose": {"from", "count"}}` becomes a `skill` choice of `count` from that list;
`{"any": N}` becomes a choice of N from all 18 skills, alphabetical. Anything else is handed back
for the caller to report. A class's starting skills become its level-1 `skill` choice (Rogue:
choose 4 of 10; Bard: choose 3 of all 18), which is what `addClass()` offers a first class, or its
fixed `skills`.

**Multiclassing.** `_multiclass()` reads a class's `multiclassing.proficienciesGained` into an
optional `multiclass` block: skills as a level-choice-shaped `skill` choice, armor, weapon and tool
training as one `proficiencies` string ("Light armor, Thieves' Tools"; "Choose one X" becomes "one
X of your choice"). A class whose entry is `{}` (Monk, Sorcerer, Wizard) gets `"multiclass": {}`;
one with no entry (the UA Mystic) gets no key, so the app can tell "gains nothing" from "not
said". The pack's Artificer is the TCE printing and carries TCE's row. What the app does with it:
[Character building](../features/character-building.md); the shape: rules-schema §6.3.

**Hand-authored inputs.** `data/overlay.json` (`byName`: Archery, Defense) adds numeric `effects`
to feats and fighting-style options by name, via `apply_overlay()`. `data/class-resources.json`
adds resource trackers, keyed by class name or `"Class/Subclass"`. They sit at the `data/` root,
not in a system folder, and the zip ships them in `scripts/` beside `convert.py`. Details of the
trackers: [Class resources](../features/class-resources.md).

**Writing.** `_write()` dumps with `indent=2`, `ensure_ascii=False` and a final `\n`, then reports
the entry count and any unresolved `{@` tag or template text (`{#`, `{{`) left in the file. `_pack()` builds the wrapper in a
fixed key order: `system`, `name`, `version`, then `_note` and `excludeSystems` only when the book
sets them, then the array.

**Bundling.** `bundle()` in `bundle-rules.js` reads every `.json` directly inside each folder that
`data/packs.json` registers and writes the registry's `dist/<file>` (`5e2024_full.json`, …) with
`rulebook: true` and the registry's title, licence, credit and version as `dataVersion` (never
written here; see [Data archive](../architecture/data-archive.md)). It dedupes the way
`mergeRules()` does, by
name (subclasses by class and name), last file wins, replaced in place, and prints every duplicate
it folded — none, in the v2.36.1 dump. Before #7 that was one, `Net`, shipped from both item files
(the 2014 weapon in `items.json`, the 2024 gear in `items-magic.json`); `_shipped_2024()` now drops
the 2014 one before bundling ever sees it. `_note` is not copied into the bundle. The build
fails if a folder's files disagree on `system`, `excludeSystems` or `requires`, or if their
`system` is not the registry's.

**SRD mode** (`srd`, #84). The SRD 5.2 pack is the 2024 pipeline run over an SRD-only copy of the
dump. This is the outline; [SRD 5.2](srd.md) has the whole of it.

- **The view.** `srd_view()` writes a copy of every file the converter reads into a temporary
  directory, holding only the entries whose `srd52` is truthy (a magic variant's sits on
  `inherits`), each marked `srd52: true` so the 2024 checks keep it; lookup data is copied whole.
  **The free-rules trap, reversed:** here the flag *is* the filter. No entry gets in by its
  `source`, nothing is backfilled, and `basicRules2024` is never read. `_run_core()` then runs
  unchanged with `srd_book()`: no source codes, so `is_default` holds and every 2024 behaviour stays
  on, but its own `system` ("SRD 5.2"), pack names (`SRD_NAMES`) and `excludeSystems`.
- **Renames.** An entry whose flag is a string takes that name, and its references follow in three
  layers: `{@spell}` and `{@item}` tags anywhere in the view; the old name in the entry's own prose
  and table captions, before tables are built; and `sources.json`, re-keyed, with its Artificer tags
  dropped.
- **Corrections.** After the pipeline, `_srd_apply_corrections()` applies
  `scripts/srd-corrections.json` to the converted text, so the pack reads as the SRD 5.2.1 PDF does.
  A correction that no longer matches is an error. `srd-verbatim` checks the result against the PDF.
- **The leak scan.** Then `_srd_leaks()` fails the run on any record or subclass named as an entry
  the view dropped, and on any renamed entry's old name in the text. A failed run writes nothing.

## Rules that must hold

- **Both packs reproduce byte for byte: `all` makes `data/5e2024/`, `srd` makes `data/srd52/`.**
  A value that moves changes the pack's content digest (`pack_digest()`), so the next release, app
  or data, bumps that pack's version and every player is told to re-download a pack that did not
  change. The digest reads canonical JSON, so key order and whitespace alone don't move it, but the
  gates are still bytes. Check both before and after any converter change, since the SRD pack runs
  the same pipeline:
  `python3 scripts/convert.py all _conversion-data/5etools-v2.36.1 -o /tmp/chk && diff -r /tmp/chk data/5e2024`
  and
  `python3 scripts/convert.py srd _conversion-data/5etools-v2.36.1 -o /tmp/srd && diff -r /tmp/srd data/srd52`.
  CI cannot run them (it has no dump), so they are manual gates.
- **Filter on `source`; flags only backfill.** Never select by `basicRules2024` (or `srd52`)
  alone. After any change to a converter path, count its `source == "XPHB"` entries in the dump and
  compare with the output before believing the output. The one exception is `srd`, where the flag
  is the filter by design: there the SRD view, not a selection site, does it.
- **`srd52` is read as truthy, never `is True`.** It can be a string, a rename; reading it with
  `is True` drops every renamed entry.
- **Stdlib only.** `convert.py` ships to players. Anything needing a third-party library belongs in
  a dev-only script (the Humblewood extractor is the precedent).
- **Never quiet.** A missing input warns; a supplement category with nothing in it writes no file
  and says so; a subclass that resolves no features is listed in a `WARNING`, and so is every
  table cell `_cell_text()` could not read, every entry node `flatten()` could not render, every
  weapon property or mastery code no definition names and every template or placeholder left
  unexpanded; a starting or multiclass skill entry
  `_skill_profs()` cannot read is a `note:`, and so is every item bonus kept in the prose. Every
  bug on this page was a silent skip first.
- **Weapon codes are named from the whole run's definitions, never from the file being converted.**
  The magic-item file uses codes it does not define. One resolver, `_weapon_refs()`, for items and
  statblocks alike.
- **A weapon bonus is never an effect.** It lives on the weapon as `atkMisc`/`dmgMisc`; an item's
  `attack`/`damage` effect applies to every attack while it is equipped. `rules-data.js` fails on
  any pack item carrying one, with an (empty) allowlist for an item whose bonus truly reaches every
  attack.
- **An item bonus is an effect only when its sentence states it standing.** A 5e-tools
  `bonus*` field is a filter tag, not a rule. `rules-data.js` holds the reviewed lists: every
  `ac`/`save.*`, every `spell.*` and every `check`/`profBonus` effect in any pack must be on one,
  and every item on them must
  still ship it, so a dump upgrade that moves the reader's verdict fails there and is read again by
  hand.
- **A pack ships only targets the app adds up.** An effect whose target `fxTargets()` does not list
  is summed by nothing and changes no number, silently. `rules-data.js` fails on any such target in
  any pack, so a new target reaches the app before the packs carry it.
- **No 5e-tools markup reaches a player.** `rules-data.js` fails on any `{#…}`, `{{…}}`, `{=…}` or
  `{@…}` in any string of any file of any pack, and pins the template text of each family that
  shipped the tag.
- **One skill reader.** Species, class starting skills and multiclass skills all go through
  `_skill_profs()`. A second parser at a call site is how the Bard lost its skills.
- **Anchors only when a sink is collecting.** With no sink, a table is dropped with no anchor: an
  anchor with nothing behind it reads worse than the old silent drop.
- **Table names are unique and global.** They are the merge key in the app and the only thing an
  anchor carries.
- **Key order and pack-name strings are load-bearing.** `_pack()`'s order and the `_XPHB_NAMES`
  and `SRD_NAMES` strings are what the committed files contain; "tidying" any of them moves every
  file.
- **`_spell_notes()` stays as it is.** It writes each caster level's `spells.note` ("You can now
  have …"), which `applyClassLevel()` and `openClassInfo()` in `56-class.js` show.
- **`overlay.json` and `class-resources.json` stay out of the system folders.** The bundler takes
  every `.json` in a system folder, so a helper file there would be swept into a pack.
- **The bundle equals its files.** `rules-data.js` merges each folder file by file and then the
  bundle, and asserts the same entries, for all six packs.
- **A new rules category is registered everywhere at once.** `CATS` in `bundle-rules.js` must stay
  in step with `RULE_CATS`; a category the bundler does not list is silently left out of every
  bundle. In the app, `tables` had to be added to the `rules` initializer in `00-constants.js`,
  `RULE_CATS`, `mergeRules()`'s category map and `resetRules()`. See
  [Rules packs](../architecture/rules-packs.md).

## Traps

- **The `basicRules2024` trim — five times.** That flag marks only the free subset. Filtering on it
  cost backgrounds (4 of 16), spells (339 of 391), feats (17 of 77), base items (78 of 99) and magic
  items (440 of 528). Then 5e-tools v2.36.1 moved the 2024 Cloak of Invisibility from
  `basicRules2024` to `srd52` alone, and a backfill reading one flag dropped it. Guard:
  `converter.py` asserts XPHB-first selection and the `srd52` backfill; the counts above are
  checked by hand against the dump.
- **Silent `all`.** Before it searched subdirectories, `all` produced no spells and no classes and
  said nothing; the items glob matched `items-base*.json` first so magic items were never reached;
  one class with `hd: null` (a TCE sidekick) killed all 14; and the helper files were looked for
  only in the dump, which lost the Archery/Defense effects and the Rage/Focus/Sorcery trackers.
  A name-level diff showed nothing lost; only a content-level one does. Guard: `convert_classes()`
  skips a class with no hit die with a note, and every missing input warns. The ledger says the
  lost effects and trackers are asserted in the test suite, but no tracked suite reads them from
  `data/5e2024/` (searched): today the only guard for that content is the byte-for-byte diff.
- **Dropped structure.** `flatten()` once discarded every table, then every `ref*Feature` node (579
  in the class files of the v2.36.1 dump, and the real reason Wild Magic Surge was missing), then
  every `refOptionalfeature` ("…presented in alphabetical order." with nothing
  after). Then, until #68, four more types, 28 nodes across the three packs: `abilityDc` and
  `abilityAttackMod` (the Artificer's spell save DC; "your Arcane Shot save DC is calculated as
  follows:" and nothing), list items with a singular `entry` (Path of the Beast's Bite, Claws and
  Tail; Cackle Fever's symptoms), and `statblock` (the Soulknife's "The magic blade has the
  following traits:" and nothing). Each fix was one node type at a time, because a node with no
  branch vanished without a word. Guard: `converter.py` covers each node type with shapes copied
  from the dump, `rules-data.js` pins one text per shape in the shipped packs, and an unknown type
  is now a `WARNING`.
- **Blank class columns, and whole tables gone.** `_cell_text()` once read only strings, numbers,
  `roll` and `entries`, and returned `''` for anything else without a word. Barbarian's Rage Damage
  and Monk's Martial Arts and Unarmored Movement shipped blank from the first table release until
  #64, and Bard and Rogue lost their Features tables outright: a dice column was all they had, so
  the Level-only guard suppressed them. `converter.py` passed throughout, because its fixture wrote
  Rage Damage as the string `'+2'`. Guard: the fixtures now copy real cells from the dump, an
  unread cell is a `WARNING`, and `tables.js` fails on any shipped column that is blank in every
  row and pins the 2024 values.
- **Marks that pointed at nothing (#73).** `_norm_table()` read `rows`, `colLabels`, `colStyles`
  and `caption` and nothing else, so 17 Xanathar's downtime tables shipped rows marked `*` without
  the "Might involve a rival" or "Halved for a consumable item" they point at. Every table check
  passed: the rows were right, only the note under them was missing. Guard: `converter.py` copies
  two of those nodes from the dump, and `tables.js` fails on any shipped table with a `*` and no
  footnotes.
- **A skill shape one reader knew and another did not (#67).** The species reader turned
  `{"any": N}` into a choice from the start; the class path had its own loop that read only
  `choose` and bare names, and dropped the Bard's `{"any": 3}` without a word. The 2024 Bard shipped
  with no level-1 skill choice, so a first-class Bard was offered no skills. It is the only `any`
  among the dump's 27 class starting-skill lists. Guard: one reader, `converter.py` pins the real
  Bard shape, and `rules-data.js` fails on any class in any pack that starts with no skills.
- **Codes defined in one file, used in another (#72).** `convert_items()` named properties from
  the file it was converting, and only `items-base.json` has the table. Every magic weapon printed
  codes ("Properties: F, L, T" on the Dagger of Venom), and since `ability` asks whether "Finesse"
  is in the named list, the Dagger of Venom, Scimitar of Speed, Sun Blade and Psychic Blade
  attacked with Strength: 30 weapons across three packs, 4 with the wrong ability. Object-shaped
  references printed Python's repr ("{'uid': 'Vex" on the Psychic Blade, "{'uid': '2H" on the
  Lance), and the 2014 `S`, whose only name is a top-level key, printed "S" on the Net. Base
  weapons named everything else, because they come from the one file that has the table. Guard:
  `converter.py`
  runs real shapes through the index, `rules-data.js` fails on any bare code or repr in a shipped
  weapon and on any magic weapon that drifts from its named base weapon's dice, kind, properties or
  finesse, and an unnamed code is a `WARNING`.
- **A +N weapon counted its bonus twice (#74).** `convert_items()` wrote `bonusWeapon` onto the
  weapon and `_item_effects()` also wrote it as `attack` and `damage` effects. `attackNumbers()`
  adds both, so a +1 Dagger of Venom's row read +2, and the effects gave every other attack, spell
  rows included, +1 while it was equipped. Five non-weapon items leaked the same way (Bracers of
  Archery's +2 reached melee and spell damage). Every weapon check passed: the weapon half was
  right. 20 items across two packs; only `effects` moved. Guard: `converter.py` runs the real
  shapes, `rules-data.js` fails on any pack item with an `attack`/`damage` effect, and `sheet.js`
  and `char-update.js` read the shipped Dagger of Venom's numbers.
- **A ranged Finesse weapon could only use DEX (#75).** The ability test asked "ranged?" before
  "Finesse?", so the Dart, the one ranged Finesse weapon in any pack, shipped `"dex"`. #72's guard
  checked Finesse on melee weapons only, and passed. Guard: `converter.py` pins the real Dart, and
  `rules-data.js` checks Finesse on every weapon, melee or ranged.
- **A Reaction read as standing AC (#76).** `_item_effects()` wrote every `bonusAc` as an `ac`
  effect, so Quarterstaff of the Acrobat's once-per-rest Reaction (+5 against one attack) read
  AC +5 whenever the staff was equipped; the Arrow-Catching Shield's +2 against ranged attacks, the
  Bracers of Defense's +2 when unarmored, the Rod of Alertness's planted aura (AC and saves) and one
  of Tasha's Teeth of Dahlver-Nar did the same. #74 kept these as "global" without reading them.
  Five items across two packs; only `effects` moved. Guard: `converter.py` runs the real shapes and
  the phrasings the reader must not misread, `rules-data.js` holds the reviewed list, and
  `sheet.js` and `char-update.js` read the painted AC.
- **Spell bonuses dropped on the way in (#77).** The converter never read `bonusSpellAttack` or
  `bonusSpellSaveDc`, and the app had no target for them, so the Moon Sickles, Staff of Power, the
  Wands of the War Mage and 15 more of Tasha's focuses carried nothing: 28 items across two packs.
  Only `effects` moved. Guard: `converter.py` runs the real shapes and both wordings,
  `rules-data.js` holds the reviewed list and fails on any target the app does not know, and
  `sheet.js` and `char-update.js` read the painted numbers.
- **Half a Stone of Good Luck (#79).** The converter read `bonusSavingThrow` and never
  `bonusAbilityCheck` or `bonusProficiencyBonus`, so the stone's +1 to saves applied and its +1 to
  checks did not, and the Ioun Stone of Mastery changed no number; the app had no target for every
  ability check anyway. Two items; only `effects` moved. Guard: `converter.py` runs the real shapes
  and the wordings the reader must not misread, `rules-data.js` holds the reviewed list, and
  `sheet.js` reads every painted number the stone should and should not move.
- **A shared text shipped as its tag (#78).** `flatten()` had no branch for `{#itemEntry …}` and
  `strip_tags()` reads only `{@…}`, so 54 items across two packs read "{#itemEntry Ring of
  Resistance|XDMG}" as their whole text, a Dragon Scale Mail's after its armor line. #76 found the
  templates and read them for the bonus alone. Only `description` moved. Guard: `converter.py` runs
  the real shapes and the three ways a template can fail, and `rules-data.js` fails on any template
  or tag text in any pack.
- **A tagline as a description.** `_sub_blurb()` takes a subclass's first paragraph over 40
  characters; eight 2024 italic taglines are 41+ and shipped as the whole description. It now skips
  a paragraph that is only `{@i …}`.
- **Editions mixed silently.** 5e-tools files every edition's maneuvers under one feature type, so a
  2024 Battle Master was one filter away from the 2014 Parry. `_pick_optfeats()` takes one printing
  only. Likewise `features.json` is XPHB-only, and `FIGHTING_STYLES` (the 2024 menu, wording and all)
  is substituted only on a run with no source codes (`all` and `srd`), never in a supplement.
- **A rename read as "not flagged" (#84).** 5e-tools writes `srd52` as `true` or as a string, the
  entry's SRD name. `pick_2024_preferred()`, `_shipped_2024()` and `_variant_selected()` tested
  `is True`, so a renamed entry counted as unflagged, and the 2024 pack silently lacked Carrion
  Crawler Mucus and Lolth's Sting (renamed in the SRD to Crawler Mucus and Spider's Sting). Guard:
  `converter.py` runs a rename-flagged entry through `pick_2024_preferred()` and a rename-flagged
  variant through `_variant_selected()`, and `rules-data.js` pins both items in the 2024 pack.
- **A Python dict as a prerequisite (#84).** `_render_optfeat_prereq()` printed a dict-shaped spell
  prerequisite with `str()`, so Agonizing Blast, Eldritch Spear and Repelling Blast read "Level 2
  Warlock and {'Choose': 'Level=0|Class=Warlock', 'Entry': …} spell", 24 times across the 2024
  pack's classes and options. Guard: `converter.py` runs the real shape, and `rules-data.js` fails
  on `{'` in any file of the 2024 or SRD pack.
- **A hard-coded menu that replaced a feature (#84).** `FIGHTING_STYLES` replaced the Paladin's and
  Ranger's whole Fighting Style feature, so the option that feature offers by reference (Blessed
  Warrior, Druidic Warrior) was never on the menu. Guard: `converter.py` checks the option is added
  and the filter, and `rules-data.js` pins the 2024 Paladin, Ranger and Fighter menus and the SRD
  Fighter's.
- **Moving the dump moves the data.** Upstream corrections change prose and counts: v2.36.1 added
  Reach, three diseases, 14 XDMG magic items and a table, and reworded 11 magic items and three
  spells. A dump upgrade is therefore a data release, and a deliberate call. `dev.sh` globs
  `_conversion-data/5etools-*`, so the dump folder must be named that way.
- **`--resources` is not honoured everywhere.** The single `classes` subcommand accepts it and never
  passes it to `convert_classes()`, so classes converted that way have no trackers; `supplement`
  accepts it and always reads `data/class-resources.json` instead, silently getting nothing if that
  file is absent. Verified by reading `main()` and `_run_supplement()`, not by running.

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| How the 2024 book is selected | `source == "XPHB"`, with the free-subset flags only as a backfill | Filtering on `basicRules2024`: it selects only the free subset and has silently trimmed five categories |
| Which flags mark the free 2024 subset | `basicRules2024` **or** `srd52` | One flag: v2.36.1 moved the Cloak of Invisibility to `srd52` alone. Measured first: across the pack the change only adds free-subset entries and removes nothing |
| A table found with no sink collecting | Drop it, emit no anchor | An anchor: a dangling anchor is worse than the silent drop it would replace |
| Spell-slot columns in class tables | Skipped | Kept: the app derives slots by level, and a 10-column grid swamps a phone |
| A table cell `_cell_text()` cannot read | Blank, counted, and a `WARNING` at the end of the run (#64) | Silently blank: how Rage Damage and four other columns hid for months. Failing the run: a player on a newer dump would get no pack at all over one cell |
| How typed class-table cells print | As the book prints them: `+2`, `1d6`, `+10 ft.`, `—` for a speed bonus of 0 | The bare number (`2`, `10`): a Rage Damage of `2` and an Unarmored Movement of `10` read as a count, not a bonus |
| A table's footnotes (#73) | An optional `footnotes` list on the table, each rendered by `_cell_text()`, with its `*` kept | Appending them to the owner's prose: the note belongs under the table it annotates, not in a glossary entry a screen away. Stripping the `*`: it is what pairs a note with the rows it marks |
| Whether identical-table reuse compares footnotes (#73) | Yes: cols, rows and footnotes | Cols and rows only: a footnoted table met after an unfootnoted twin would be folded into it and lose its notes |
| Where `overlay.json` and `class-resources.json` live | At the `data/` root; in the zip, beside `convert.py` | In a system folder: the bundler would sweep them into a pack |
| How options reach the level-up picker | Inlined in every choice (~150 KB across the packs) | A shared reference: ~5× smaller, but needs app code and cross-pack filtering; inline needs none, and an older app gets pickers from a re-downloaded pack alone |
| Which printing of an option a class offers | The class's own source only, falling back to PHB for a 2014 book with none | Mixing printings: a 2024 Battle Master would be offered the 2014 Parry too |
| How a bundle dedupes | Exactly as `mergeRules()` does, and every duplicate printed | Silent dedupe: the `Net` duplicate would vanish unreported; the promise is that a bundle equals its files |
| How a skill-proficiency list is read | One reader, `_skill_profs()`, for species, a class's starting skills and its multiclass skills; `{"any": N}` is a choice of N from all 18 skills (#67) | A loop per call site: the class path's own read only `choose` and silently dropped the Bard's "any 3", while the species reader had understood it all along |
| Where a class's multiclass proficiencies come from | 5e-tools `multiclassing`, carried as an optional `multiclass` block; `{}` kept, absent when the source has none | A table in the app: homebrew and Humblewood classes would get a silent guess, and the rules text belongs in the pack (#66) |
| An entry node `flatten()` cannot render | Nothing rendered, counted, and a `WARNING` at the end of every run (#68) | Silently nothing: how four node types hid until #68. Failing the run: as for cells, a newer dump would yield no pack at all over one node |
| How formula lines are worded | 5e-tools' "classic" wording: "8 + your proficiency bonus + your Intelligence modifier" (#68) | Its other wording, "8 + Intelligence modifier + Proficiency Bonus": in 5e-tools a reader's style preference, not a printing. Every source using these nodes in the converted files (PHB, XGE, TCE, UA) prints the classic one; no XPHB entry uses them |
| Whether a formula line ends with a full stop | Yes, though the book prints none (#68) | As printed: a named subsection joins its blocks with spaces, so the Artificer's two formulas ran together ("…Intelligence modifier Spell attack modifier = …") |
| A `statblock`, an entity embedded by reference | Resolved from the dump's item files and written as the item's stat line (#68) | Its name alone: "…has the following traits: Psychic Blade." reads like a sentence that lost its content. Skipping it: the original bug |
| Where a magic weapon's property and mastery names come from | The run's item index, `items-base.json`'s `itemProperty` and `itemMastery`, through one resolver shared with statblocks (#72) | Merging the base weapon's fields into the magic one: the dump already inlines them, and a magic weapon deliberately differs (Sun Blade adds Finesse). A name table in `convert.py`: 5e-tools defines the codes, and a copy goes stale silently |
| A weapon property or mastery code nothing defines | Printed as the code, counted with its items, and a `WARNING` at the end of every run (#72) | Passing it through quietly: the original bug. Failing the run: as for cells and nodes |
| A reference carrying a note (`{uid, note}`) | "Name (note)" in the notes and the description, the Psychic Blade's long mastery note included (#72) | Dropping the note: loses rules text ("unless mounted"; Vex "doesn't count against" the mastery limit), and the statblock already printed it |
| A single `items` run on the magic-item file | Index the `items-base.json` beside it (#72) | Warning only: a player running `items items.json` would get codes and a finesse weapon attacking with Strength |
| A ranged weapon with Finesse (#75) | `finesse`, the better of STR and DEX, as for a melee one | `dex` for every ranged weapon: Finesse is the choice of either ability for a melee or a ranged attack, so a strong character's Dart used the weaker score |
| Where a `+N` weapon's bonus goes (#74) | On the weapon, `atkMisc`/`dmgMisc`, and never as an effect | Global `attack`/`damage` effects: they reach every attack, spell rows included, and doubled the weapon's own. The effects alone: the bonus would also reach every other attack |
| A weapon bonus on an item that is not a weapon (#74) | Kept in the prose; no effect | `attack`/`damage` effects: Bracers of Archery's +2 reached melee and spell damage. `damage.ranged` for the Bracers: still crossbows, darts and ranged spells. Owner may revisit |
| Telling a standing item bonus from a conditional one (#76) | Read the sentence that states it: standing only when nothing but wearing, holding or carrying the item conditions it | 5e-tools' tag alone: the original bug. `charges`: marks neither (Staff of Power, Scarab of Protection are standing). A name list in `convert.py`: silent on a dump upgrade; the reviewed list lives in `rules-data.js`, where a change fails |
| A bonus no sentence states (#76) | Not an effect, and a `note:` naming it | An effect: the one case in the packs, the Teeth of Dahlver-Nar, is one tooth's row among twenty |
| Bracers of Defense, whose +2 needs no armor and no shield (#76) | Prose, like any conditional bonus | A standing `ac` effect: +2 in plate. A scoped target the sheet can test (`armorAC()` knows armor and shields), like `attack.ranged`: new app code for one pack item. Owner may revisit |
| The Quarterstaff's once-per-rest Reaction as a tracked use (#76) | No; it stays in the description | `uses` on the item: no pack item carries any, 5e-tools has no field for a per-rest property, and one pool per item cannot hold the staff's several properties |
| Where a `{#itemEntry}` template's text goes (#78) | Into the description, expanded before `flatten()` and filled from the item as 5e-tools renders it; the bonus reader reads that same text | For the bonus reading only (#76): 54 items kept the tag as their text. A table of the texts in `convert.py`: 5e-tools defines them, and a copy goes stale silently |
| A template or placeholder that does not resolve (#78) | Printed as it stands, counted with its items, and a `WARNING` at the end of every run | Dropping it: the text would vanish without a word. Failing the run: as for cells and nodes |
| Which ignored item fields become effects (#79) | `bonusAbilityCheck` (`check`) and `bonusProficiencyBonus` (`profBonus`), through the sentence reader; `ability` and `modifySpeed` stay prose | A flat `ability.*` +2 for the capped Ioun Stones and Belt of Dwarvenkind: overshoots a score of 19 or 20. A `speed` effect for `modifySpeed`: every pack case multiplies, sets, copies or is another mode. Owner may revisit |
| How `{{getFullImmRes item.resist}}` prints (#78) | Title-cased, "Acid", as the 2024 templates call it and the 2024 book prints damage types; a raw `{{item.resist}}` prints as the item has it, "acid" (Tasha's) | One casing for both: each template states which it wants |
| An item's spell attack and spell save DC bonus (#77) | `spell.attack` / `spell.dc` effects through the same sentence reader, a named class not counting as a condition | Prose: 28 items, all standing, would do nothing. `attack`: reaches weapon rows. See [Computed stats & effects](../architecture/computed-stats-and-effects.md) for the class-limited case |
| How the `srd52` flag is read (#84) | As truthy: `true` and a string (a rename) both count | `is True`: a renamed entry read as unflagged, and the 2024 pack lost Carrion Crawler Mucus and Lolth's Sting |
| How a choice-shaped spell prerequisite prints (#84) | The dump's own `entry` text, in its title case: "a Warlock Cantrip That Deals Damage" | `str()`: printed the dict. Lower case, as the spec asked: a hand rewording of the dump's text, which every other prerequisite prints as written (a plan ruling) |
| The Paladin's and Ranger's own Fighting Style option (#84, R4) | On the menu beside the styles, from the class feature's `refFeat`, in both packs | The hard-coded menu alone: it replaced the feature, so the option the feature names was never offered |

## Open

- **Subclass table groups are never read.** A subclass carries `subclassTableGroups`, not
  `classTableGroups`, so `_class_tables()` on a subclass returns nothing. Harmless in the v2.36.1
  dump: the XPHB groups are Eldritch Knight's and Arcane Trickster's spell counts, which it would
  skip, and Psi Warrior's and Soulknife's die size and number, which their prose "Energy Dice"
  tables already carry. It would miss a new one.
- **Item ability scores and speeds stay prose.** 5e-tools' `ability` (29 core items: the Belts of
  Giant Strength, six Ioun Stones, the Manuals and Tomes…) and `modifySpeed` (11 core, and Tasha's
  Teeth of Dahlver-Nar) are not read; none is a flat bonus an effect can hold (#79).
- **Only item statblocks resolve.** Another tag (creature, hazard…) keeps its name and warns. None
  reaches the converter in the v2.36.1 dump, and a single subcommand other than `items` has no item
  index at all, so `classes` alone warns once for the Soulknife.
- **A cell carrying both `roll` and `entry` prints only the roll.** Only the DMG, BMT and LLK decks
  (Deck of Many Things, Deck of Illusions…) use it, and no pack ships those printings; the 2024
  decks have a different shape.
- The Artificer and the UA Mystic sit in `data/5e2024/classes.json` under the `XPHB` stamp; see
  [Supplements](supplements.md).
- `convert.py` looks for its helper files in the dump and in `<repo>/data/`, never beside itself,
  so a player running the zip's `scripts/convert.py` must pass `--overlay` and `--resources`
  explicitly (`all` warns when it cannot find them). Verified by reading `main()`, not by running.
- The module docstring's USAGE block predates `supplement` and the unprefixed filenames.
- A comment in `bundle-rules.js`'s dedupe loop still places `mergeRules()` in `88-settings.js` (it
  is in `89-rules-merge.js`).
- Rune Knight runes get no tracker: they are per-rune uses, not a pool. See
  [Known issues](../roadmap/known-issues.md).

## History

- 2026-08-07 — Spells filter on `source == "XPHB"`: 339 → 391, all class-tagged via `--sources`. → ledger L320
- 2026-08-10 — Tables lifted into a `tables` pack with anchors; `ref*Feature` nodes inlined; feats and items off the free-subset trim. → ledger L533
- 2026-08-10 — `all` finds subdirectories, both item files and the helper files, and warns; `convert_races()`; `data/` split by system; `bundle-rules.js`. → ledger L625
- 2026-08-11 — `_race_size()`; a full regeneration moved only `races.json`. → ledger L1426
- 2026-08-14 — Selection and labelling moved into `Book`; the default run proven byte-identical. → ledger L1816
- 2026-09-25 — #60 reported: `refOptionalfeature` dropped, `optionalfeatures.json` never read. → ledger L3548, #60
- 2026-09-25 — Option pickers across seven classes and subclasses; `_sub_blurb()` skips taglines. → ledger L3596, #60
- 2026-09-25 — Option `cost`, `"Class/Subclass"` trackers, Student of War, `features.json`. → ledger L3649
- 2026-09-25 — Source dump moved to 5e-tools v2.36.1; `srd52` backfill. → ledger L3676
- 2026-09-28 — Class tables keep their `dice`, `bonus` and `bonusSpeed` cells; Bard and Rogue Features tables (105 → 107); an unreadable cell is a `WARNING`. → ledger L3761, #64
- 2026-09-28 — `_multiclass()`: classes carry an optional `multiclass` block; `data/5e2024/` moved by that key alone. → ledger L3886, #66
- 2026-09-28 — `_skill_profs()`: one skill reader for species, starting and multiclass skills; the Bard's "any 3" is a level-1 choice of 3 from 18, the one hunk `data/5e2024/` moved by. → ledger L3985, #67
- 2026-09-28 — `flatten()` writes formula lines, one-`entry` list items and item statblocks, which it had dropped (28 nodes across three packs); an unknown node type is a `WARNING`. → ledger L4025, #68
- 2026-09-28 — `_norm_table()` carries a table's `footnotes`; `_register()` compares them; `data/xanathars/tables.json` gains 17, the only file that moved. → ledger L4273, #73
- 2026-09-28 — Weapon property and mastery codes are named from `items-base.json` through the item index (`_weapon_refs()`): 30 weapons across three packs, four magic weapons now `finesse`; an unnamed code is a `WARNING`. → ledger L4327, #72
- 2026-09-28 — A weapon bonus is never an effect (`_item_effects()`): 15 `+N` weapons count it once, on their own row, and five non-weapon items keep it in their prose; only `effects` moved, on 20 items in two packs. → ledger L4392, #74
- 2026-09-28 — Finesse is asked before "ranged?": the Dart attacks with `finesse`; one line of `items.json` moved. → ledger L4466, #75
- 2026-09-28 — An item's AC or saving-throw bonus is an effect only when its sentence states it standing (`_bonus_reading()`); five conditional ones stay prose, each printed as a `note:`; only `effects` moved, on five items in two packs. → ledger L4502, #76
- 2026-09-28 — `bonusSpellAttack` and `bonusSpellSaveDc` become `spell.attack` / `spell.dc` effects; only `effects` moved, on 28 items in two packs. → ledger L4568, #77
- 2026-09-29 — `{#itemEntry}` templates are written into the description (`_expand_item_entries()`), filled from the item; an unresolved one is a `WARNING`; only `description` moved, on 54 items in two packs. → ledger L4634, #78
- 2026-10-07 — The bundler reads `data/packs.json`; a moved value changes the pack's content digest, which is what the next release bumps, in place of `git diff` since the last tag. → ledger L5082, #83
- 2026-09-29 — `bonusAbilityCheck` and `bonusProficiencyBonus` become `check` / `profBonus` effects; only `effects` moved, on two core items. → ledger L4689, #79
- 2026-10-02 — Ammunition kinds, bundles and magic ammunition from 5e-tools' variants; a 2014 item reprinted under another name no longer ships beside its 2024 self (40 dropped). → ledger L4923, #7
- 2026-10-08 — `srd`: the SRD 5.2 pack from an SRD view of the dump through `_run_core()`, with renames, corrections and the leak scan, and its own byte-for-byte gate. Three fixes in both packs: rename flags read as truthy (the 2024 pack gains Carrion Crawler Mucus and Lolth's Sting), dict prerequisites print their text, and the Paladin's and Ranger's Fighting Style option is offered. → ledger L5148, #84
