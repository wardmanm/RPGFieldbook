# Converter

`scripts/convert.py` turns a 5e-tools data dump into the D&D 2024 rules pack, `data/5e2024/`, and
(through `supplement`) into the Xanathar's and Tasha's packs. It is stdlib-only Python 3.8+ and
ships to players in the zip's `scripts/`, so it is both a dev tool and a player tool. Its output is
committed; `scripts/bundle-rules.js` then rolls each system folder into the one-file pack players
import. The player-facing how-to is [README-converter](../../../../docs/README-converter.md); this
page is what that file does not say: what must not move, and the traps that have already shipped.

**Code:** `main()`, `pick_2024_preferred()`, `pick_sources()`, `flatten()`, `table_ctx()`,
`ref_ctx()`, `_register()`, `_class_tables()`, `convert_classes()`, `_multiclass()`, `_optfeat_choices()`,
`convert_races()`, `_pack()`, `_write()` in `scripts/convert.py`; `bundle()` in
`scripts/bundle-rules.js`; `dataChangedSince()` in `scripts/release.js`; `mergeRules()` in
`89-rules-merge.js`; `DATA_VERSIONS` in `30-version.js`; `RULE_CATS` in `88-settings.js` ·
**Data:** `data/5e2024/*.json`, `data/overlay.json`, `data/class-resources.json`,
`_conversion-data/5etools-v2.36.1/` (gitignored) · **Tests:** `converter.py`, `rules-data.js`,
`tables.js` · **See also:** [Supplements](supplements.md), [Rules packs](../architecture/rules-packs.md),
[Class resources](../features/class-resources.md), [Rules & tables](../features/rules-and-tables.md),
[rules-schema](../../../../docs/rules-schema.md)

## How it works

**Subcommands.** `conditions`, `glossary`, `feats`, `backgrounds`, `items`, `spells`, `classes`,
`races` convert one file; `all <dir>` converts a whole dump into `data/5e2024/`; `supplement <dir>
--book XGE|TCE` converts one supplement book (see [Supplements](supplements.md)). `all` is the only
path that reproduces the committed core pack.

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
`convert_spells()` filter on `source == "XPHB"` alone, with no backfill at all.

**Current output** (counted from `data/5e2024/`): 16 backgrounds, 14 classes, 21 conditions,
77 feats, 58 features, 115 glossary terms, 99 items, 542 magic items, 10 species, 391 spells,
105 tables. Spells carry a `class` list only when `--sources sources.json` is supplied (`all` finds
it in `spells/`); the spell file itself has no per-spell class data.

**Tables are lifted, not dropped.** While an entity is flattened inside `table_ctx()`, every
5e-tools `table` or `tableGroup` node is normalised by `_norm_table()` to
`{name, cols, align, rows, owner, ownerKind}` and appended to one sink, and the prose gets a
`[Table: Name]` anchor at the exact spot. `_register()` reuses an identical table and suffixes a
colliding name `" (2)"`, because the name is the app's merge key and the anchor's only handle.
`_class_tables()` turns `classTableGroups` into one Level-indexed `"<Class> Features"` table,
skipping spell-slot groups and the cantrip/prepared/known count columns, and suppressing a table
left with nothing but its Level column. `all` writes the sink as `tables.json`; a single
subcommand does so only with `--tables PATH`. How the app renders them: [Rules & tables](../features/rules-and-tables.md).

**References are inlined.** A class or subclass feature can point at a sibling feature
(`refClassFeature` / `refSubclassFeature`) instead of containing it. Inside `ref_ctx()`,
`flatten()` resolves and inlines it, with a seen-set so a feature cannot inline itself.
`refOptionalfeature` nodes become a bullet naming the option; the options themselves reach the
sheet through the pickers below.

**Option pickers.** `_optfeat_choices()` reads a class or subclass's `optionalfeatureProgression`
(a running total per level, as a map or a 20-long list) and emits an `option` choice at every
level the total rises, asking for the rise ("Maneuvers: choose 2 more"), offering only options whose
level prerequisite that level meets. Each option carries its prose, `repeatable` where the book
prints a "Repeatable" subsection, and a `cost` from 5e-tools `consumes` (`_optfeat_cost()`, with the
singular pool name mapped to the tracker's name by `_CONSUMES_AS`). `all` also writes the 58 XPHB
options as library entries in `features.json`. Student of War, which the source states only in
prose, comes from `_prose_choices()`, keyed by (class, subclass, source).

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
the entry count and any unresolved `{@` tag left in the file. `_pack()` builds the wrapper in a
fixed key order: `system`, `name`, `version`, then `_note` and `excludeSystems` only when the book
sets them, then the array.

**Bundling.** `bundle()` in `bundle-rules.js` reads every `.json` directly inside each system
folder and writes `dist/<system>_full.json` with `rulebook: true` and a `dataVersion` read from
`DATA_VERSIONS` in `30-version.js` (never duplicated). It dedupes the way `mergeRules()` does, by
name (subclasses by class and name), last file wins, replaced in place, and prints every duplicate
it folded: today one, `Net`, in both item files. `_note` is not copied into the bundle. The build
fails if a folder's files disagree on `system`, `excludeSystems` or `requires`, or if the system
has no `DATA_VERSIONS` entry.

## Rules that must hold

- **The default run reproduces `data/5e2024/` byte for byte.** `release.js`'s
  `dataChangedSince()` runs `git diff --quiet <last tag> -- data/<dir>`; any byte that moves bumps
  that system's `DATA_VERSIONS`, the Settings badge, and the release notes, and every player is told
  to re-download a pack. Check it before and after any converter change:
  `python3 scripts/convert.py all _conversion-data/5etools-v2.36.1 -o /tmp/chk && diff -r /tmp/chk data/5e2024`.
  CI cannot run this (it has no dump), so it is a manual gate.
- **Filter on `source`; flags only backfill.** Never select by `basicRules2024` (or `srd52`)
  alone. After any change to a converter path, count its `source == "XPHB"` entries in the dump and
  compare with the output before believing the output.
- **Stdlib only.** `convert.py` ships to players. Anything needing a third-party library belongs in
  a dev-only script (the Humblewood extractor is the precedent).
- **Never quiet.** A missing input warns; a supplement category with nothing in it writes no file
  and says so; a subclass that resolves no features is listed in a `WARNING`. Every bug on this page
  was a silent skip first.
- **Anchors only when a sink is collecting.** With no sink, a table is dropped with no anchor: an
  anchor with nothing behind it reads worse than the old silent drop.
- **Table names are unique and global.** They are the merge key in the app and the only thing an
  anchor carries.
- **Key order and pack-name strings are load-bearing.** `_pack()`'s order and the `_XPHB_NAMES`
  strings are what the committed files contain; "tidying" either moves every file.
- **`_spell_notes()` stays as it is.** It writes each caster level's `spells.note` ("You can now
  have …"), which `applyClassLevel()` and `openClassInfo()` in `56-class.js` show.
- **`overlay.json` and `class-resources.json` stay out of the system folders.** The bundler takes
  every `.json` in a system folder, so a helper file there would be swept into a pack.
- **The bundle equals its files.** `rules-data.js` merges each folder file by file and then the
  bundle, and asserts the same entries, for all five systems.
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
  after). Guard: `converter.py` covers each node type.
- **A tagline as a description.** `_sub_blurb()` takes a subclass's first paragraph over 40
  characters; eight 2024 italic taglines are 41+ and shipped as the whole description. It now skips
  a paragraph that is only `{@i …}`.
- **Editions mixed silently.** 5e-tools files every edition's maneuvers under one feature type, so a
  2024 Battle Master was one filter away from the 2014 Parry. `_pick_optfeats()` takes one printing
  only. Likewise `features.json` is XPHB-only, and `FIGHTING_STYLES` (the 2024 menu, wording and all)
  is substituted only on the default run.
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
| Where `overlay.json` and `class-resources.json` live | At the `data/` root; in the zip, beside `convert.py` | In a system folder: the bundler would sweep them into a pack |
| How options reach the level-up picker | Inlined in every choice (~150 KB across the packs) | A shared reference: ~5× smaller, but needs app code and cross-pack filtering; inline needs none, and an older app gets pickers from a re-downloaded pack alone |
| Which printing of an option a class offers | The class's own source only, falling back to PHB for a 2014 book with none | Mixing printings: a 2024 Battle Master would be offered the 2014 Parry too |
| How a bundle dedupes | Exactly as `mergeRules()` does, and every duplicate printed | Silent dedupe: the `Net` duplicate would vanish unreported; the promise is that a bundle equals its files |
| Where a class's multiclass proficiencies come from | 5e-tools `multiclassing`, carried as an optional `multiclass` block; `{}` kept, absent when the source has none | A table in the app: homebrew and Humblewood classes would get a silent guess, and the rules text belongs in the pack (#66) |

## Open

- **Class progression tables lose their dice and bonus columns.** `_cell_text()` renders strings,
  numbers, `roll` and `entry`/`entries` cells; 5e-tools writes `classTableGroups` cells such as
  Rage Damage as `{"type":"bonus","value":2}` and Bardic Die, Martial Arts and Sneak Attack as
  `{"type":"dice","toRoll":[…]}`, and those come back empty. Result in `data/5e2024/tables.json`,
  unchanged since tables first shipped: Barbarian Features has a blank Rage Damage column, Monk
  Features blank Martial Arts and Unarmored Movement, and Bard and Rogue have no Features table at
  all (left with only a Level column, so suppressed). `converter.py` passes because its synthetic
  class table writes Rage Damage as the string `'+2'`. Fixing it moves `data/5e2024/`, so it is a
  data release. Prose tables in the dump carry no such cells (scanned), so only class tables are
  affected.
- The Artificer and the UA Mystic sit in `data/5e2024/classes.json` under the `XPHB` stamp; see
  [Supplements](supplements.md).
- `convert.py` looks for its helper files in the dump and in `<repo>/data/`, never beside itself,
  so a player running the zip's `scripts/convert.py` must pass `--overlay` and `--resources`
  explicitly (`all` warns when it cannot find them). Verified by reading `main()`, not by running.
- The module docstring's USAGE block predates `supplement` and the unprefixed filenames.
- `bundle-rules.js`'s comments still place `mergeRules()` in `88-settings.js` (it is in
  `89-rules-merge.js`) and list two systems (there are five).
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
- 2026-09-28 — `_multiclass()`: classes carry an optional `multiclass` block; `data/5e2024/` moved by that key alone. → ledger L3761, #66
