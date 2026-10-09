# Supplements

Xanathar's Guide to Everything (system `XGE`) and Tasha's Cauldron of Everything (system `TCE`)
are **supplement packs**: additive D&D content loaded beside the 2024 rules, never a system a
character is created in. They are 2014-era books converted as published, from the same 5e-tools
dump as the core pack, by `convert.py supplement`, one book per run, into `data/xanathars/` and
`data/tashas/`. Every trap on this page produced output that looked entirely correct: right
entry counts, valid JSON, and something missing or wrong inside.

**Code:** `_run_supplement()`, `supplement_defaults()`, `pick_sources()`, `convert_subclasses()`,
`_subclass_levels()`, `convert_class_features()`, `convert_spells()`, `_render_prereq()`,
`reserved_names()`, `_register()`, `_pack()`, `convert_ammo_variants()` and the `Book` class in
`scripts/convert.py`;
`bundle()` in `tools/data-kit/fbdata.py`; `subclassesFor()`, `subSourceTag()` in
`50-classrace.js`; `racesForCharacter()`, `systemOf()` in `52-race.js`; `mergeRules()` in
`89-rules-merge.js`; `findTable()` in `86-tables.js` · **Data:** `data/xanathars/*.json`,
`data/tashas/*.json`, `data/class-resources.json` · **Tests:** `converter.py`, `rules-data.js`,
`tables.js` · **See also:** [Converter](converter.md), [Rules packs](../architecture/rules-packs.md),
[Character building](../features/character-building.md), [Rules & tables](../features/rules-and-tables.md),
[README-converter](../../../../docs/README-converter.md)

## How it works

**One pipeline, a different book.** `Book` carries the 5e-tools `source` codes to keep, the
`system` stamp (the app's merge namespace and the `DATA_VERSIONS` key), per-file pack names
(`"<label> — Spells"` and so on), the `_note` and `excludeSystems`. With no codes it is the
default 2024 book and `pick_sources()` is exactly `pick_2024_preferred()`; with codes it is a plain
source filter. Every place the core run needed a 2014-era variation is gated on
`Book.is_default`, so the core output cannot move.

**Profiles.** `SUPPLEMENTS` in `convert.py` holds each book's pack name, `excludeSystems:
humblewood`, the edition `_note` (built from `_EDITION_NOTE`) and, for TCE, `skip_classes:
Artificer` plus the note saying so. `supplement_defaults()` turns a profile into flag defaults;
any flag given wins. The reproducing commands are the ones `dev.sh` runs, after the core pack:

```bash
python3 scripts/convert.py supplement "$dir" -o data/xanathars --book XGE --system XGE \
  --avoid-table-names data/5e2024/tables.json
python3 scripts/convert.py supplement "$dir" -o data/tashas --book TCE --system TCE \
  --avoid-table-names data/5e2024/tables.json
```

**What a run produces.** Glossary, magic items, feats, species, spells, subclasses, `features`
(options from `optionalfeatures.json` plus Tasha's optional class features) and tables. `emit()`
writes no file for an empty category and says so, which is why Xanathar's has no `races.json`.
Current counts, asserted file by file in `rules-data.js`:

| Pack | keywords | items | feats | species | spells | subclasses | features | tables |
|---|---|---|---|---|---|---|---|---|
| XGE | 22 | 53 | 15 | — | 95 | 31 | 22 | 74 |
| TCE | 3 | 84 | 15 | 1 (Custom Lineage) | 21 | 26 | 76 | 37 |

17 of Xanathar's tables, every one a downtime table, carry `footnotes` ("Might involve a rival",
"Halved for a consumable item like a potion or scroll"); `tables.js` pins them. Tasha's has none.

A supplement run also expands the book's own ammunition variants (`convert_ammo_variants()`):
Xanathar's Walloping and Adamantine Ammunition.

**Subclasses stand alone.** A supplement's subclasses are `subclasses` records that attach to a
class by name (schema §6.5), not nested in a class. `convert_subclasses()` drops every `_copy`
record, resolves features through `_subclass_levels()` (a 7-part feature UID names the feature's
own book, which overrides the subclass's: five XGE/TCE features are printed elsewhere), adds option
pickers from the subclass's own printing (Arcane Archer and College of Swords in XGE, Rune Knight
in TCE; College of Swords falls back to the PHB's fighting styles), and takes trackers from
`class-resources.json` `"Class/Subclass"` keys (Arcane Archer's Arcane Shot). `supplement` always
reads that file from `data/`. Features keep their 2014 levels. Each file's `_note` says so, and
that a 2024 character gains any earlier ones at level 3, but only a reader of the JSON sees it: the
app ignores `_note` and the bundle drops it.

**Tasha's optional class features** live as `classFeature` records, not in
`optionalfeatures.json`. `convert_class_features()` takes those for classes the book does not
define itself, names each `"<Class>: <Feature>"` (three classes print "Martial Versatility"), and
adds `(Level N)` to every member of a group whose names still collide.

**Spell class tags.** `sources.json` files a 2014 book's spell lists under `classVariant`, and under
PHB/TCE sources. For a supplement, `convert_spells()` reads `class` and `classVariant` from XPHB,
EFA, PHB and TCE; the default run still reads `class` from XPHB and EFA only. Every tag names a
2024 class. One book's spells are one file, `spells/spells-<code>.json`, with no glob.

**Prerequisites.** `_render_prereq()` renders the `race` and `proficiency` prerequisite shapes only
when `legacy` is set, which is every non-default book.

**Magic weapons.** A supplement's weapons carry the 2014 PHB's bare codes (`"L"`, `"V"`) and the
book defines none of them. `supplement` loads the dump's `items-base.json` into the item index, as
`all` does, and `convert_items()` names them from it: Xanathar's three staves read "Versatile 1d8",
Tasha's Moon Sickles "Light". Tasha's four `+N` weapons (three Moon Sickles, Baba Yaga's Pestle)
carry the bonus on the weapon and no `attack`/`damage` effect, like the core pack's. Resolution, the
warning and the bonus rule: [Converter](converter.md).

**Table names.** `--avoid-table-names PACK.json` reads the core pack's table names and, inside
`reserved_names()`, `_register()` appends `" (XGE)"` / `" (TCE)"` to any table that would reuse one.
The prose anchor is written from `_register()`'s return value, so it follows the rename. Today 12
names carry the suffix: `Gloom Stalker Spells (XGE)`, seven TCE tables from subclasses the 2024 PHB
reprinted, and four TCE "Replicable Items" tables that collide since the 2024 pack gained the
Artificer's.

**In the app.** `excludeSystems` is stamped onto every entry by `mergeRules()` and read only by
`racesForCharacter()`, which keeps Custom Lineage out of a Humblewood character's picker;
`findRaceDef()` stays unfiltered so an existing character keeps resolving it. Spells, feats,
subclasses and items stay available to both systems. `subclassesFor()` offers a same-named
subclass from a different pack beside the original, keyed `"Gloom Stalker (XGE)"`; a re-import from
the same pack still replaces. `subSourceTag()` stops such a key being tagged twice. Loading, merging
and missing-dependency reporting: [Rules packs](../architecture/rules-packs.md).

## Rules that must hold

- **A supplement run never changes the default run.** Each widening (`classVariant`, the extra
  sources, legacy prerequisites, `FIGHTING_STYLES`) is gated on `Book.is_default`. Check with the
  byte-for-byte diff on [Converter](converter.md) after any change here.
- **Dedupe subclasses on `_copy`, never on name.** See Traps.
- **Table names are unique across every pack, and every anchor resolves inside its own pack.**
  `rules-data.js` asserts both over all five packs.
- **Every file in a pack folder declares the same `system` and `excludeSystems`.** The bundle is one
  file and can carry one answer; `bundle()` in `fbdata.py` fails the build otherwise, and `rules-data.js`
  asserts it per file, plus that each `_note` says the content is 2014-era.
- **Book profiles live in `SUPPLEMENTS`, not in `dev.sh`.**
- **Convert the core pack first.** `--avoid-table-names` reads `data/5e2024/tables.json`, so a
  supplement converted against a stale core pack reserves the wrong names.

## Traps

- **`_copy` stubs.** 5e-tools ships every XGE/TCE subclass twice, 122 records for 61 subclasses. The
  second is a `_copy` stub under the 2024 `classSource` (EFA for the Artificer), and 35 of 57 carry
  no `subclassFeatures`. The obvious dedupe, by (class, name) preferring the newer `classSource`,
  keeps the stub: 26 of 61 subclasses would have shipped with `"levels": {}`. Guard: `converter.py`
  asserts the stub is dropped; `rules-data.js` asserts every subclass has a class and a trait; a
  featureless subclass prints a `WARNING`.
- **`classVariant`.** Reading only `class` gave Xanathar's 0 of 95 spell tags and Tasha's 7 of 21:
  a complete-looking pack whose "only my class" filter hides everything in it. Guard:
  `rules-data.js` asserts every Xanathar's spell carries a class list.
- **Same-named subclasses.** The 2024 PHB reprinted seven XGE/TCE subclasses (Gloom Stalker, Fey
  Wanderer, Soulknife, Psi Warrior, Oath of Glory, Path of the Zealot, College of Glamour).
  `subclassesFor()` was keyed by name, which is what `character.classes[].subclass` stores, so
  loading a supplement would have swapped every 2024 character's subclass for the 2014 one. Guard:
  `rules-data.js` merges both and checks both survive.
- **Table names are a global lookup.** `findTable()` matches by name and an anchor names no pack, so
  a reused name opens the other book's table. Guard: the suffix, and the cross-pack tests.
- **The profile has no `--avoid-table-names`.** `supplement_defaults()` fills pack name, note,
  exclusions and skips, but the reserved-names file comes only from the flag. A re-run with just
  `--book XGE` reproduces everything except the suffixed table names and their anchors. Use the
  `dev.sh` command.
- **Legacy prerequisite shapes.** 5 of the 77 2024 feats carry a `proficiency` prerequisite that the
  core pack does not render; rendering it for everyone would have moved `data/5e2024/feats.json`.
  Hence the gate rather than "verified harmless".

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| How a supplement is converted | The core pipeline with the book as a parameter (`Book`): a supplement is the same pipeline pointed at a different source code | — |
| Whether `supplement` joins `all` | A separate subcommand, one book per run | Folding it into `all`: `all` converts the core from many files, this converts one book, they share no inputs, and `all`'s output must never move |
| How subclass duplicates are removed | Drop records carrying `_copy` | Dedupe by (class, name) keeping the newer `classSource`: that keeps the featureless stub |
| Where a supplement's spell class tags come from | `class` and `classVariant`, from XPHB/EFA/PHB/TCE, gated on the book | `class` only: 0 of 95 Xanathar's spells tagged |
| A supplement subclass named like a 2024 one | Offered beside it as `"Name (PACK)"`; same-pack re-import still replaces | Last-wins by name: silently swaps existing characters' subclasses |
| Where colliding table names are fixed | In the converter, suffixing the supplement's copy | In the app: renaming in the converter makes the anchors follow for free, since `_register()` returns the final name |
| How a species is kept out of Humblewood | Pack-level `excludeSystems`, honoured by `racesForCharacter()` only | Extending `systemOf()`: a pack whose `system` the app cannot place should say who it is not for |
| The Artificer, already in the 2024 pack from its TCE printing | Tasha's skips the class and its four subclasses; the core pack's label is left alone (owner's call) | Fixing the label: drops the class from the core pack, bumps its data version, and a core-only Artificer player loses the class |
| Where book profiles live | `SUPPLEMENTS` in `convert.py` | `dev.sh`: prose duplicated into a menu is how a re-run quietly stops reproducing the packs |
| How a book's spell file is found | One named file, `spells-<code>.json` | A glob: one matching the wrong book would convert it silently |
| XGE's encounter, trap and name tables; TCE's sidekick classes | Not converted | Converting them: bespoke 5e-tools shapes needing their own parsers, for DM content the sheet cannot act on; sidekicks have `hd: null` and are skipped by the existing guard |

## Open

- **Artificer and Mystic are 2014/UA content labelled `XPHB`** in `data/5e2024/classes.json`:
  `convert_classes()` falls back to the first printing (`cls[0]`) when a class has no XPHB or PHB
  version. See [Known issues](../roadmap/known-issues.md).
- Subclass features sit at their 2014 levels; the `_note` says so rather than re-levelling them.
- A supplement's options for a 2024 class (XGE and TCE invocations, TCE maneuvers and metamagic)
  are library `features` only. The 2024 class's level-up picker offers its own printing, per
  `_pick_optfeats()`.

## History

- 2026-08-14 — Xanathar's and Tasha's converted as supplement packs: `Book`, the `_copy` filter, `classVariant` tags, `--avoid-table-names`, `excludeSystems`, the Artificer skip. → ledger L1816
- 2026-09-25 — Option pickers for Arcane Archer, College of Swords and Rune Knight; Tasha's Artificer tables suffixed. → ledger L3596, #60
- 2026-09-25 — `supplement` reads `class-resources.json`: Arcane Archer's Arcane Shot tracker. → ledger L3649
- 2026-09-25 — Moved to the v2.36.1 dump: XGE's Power Word Pain gains Bard; both packs' subclasses unchanged. → ledger L3676
- 2026-09-28 — Xanathar's 17 downtime tables carry their footnotes; `tables.json` was the only file to move. → ledger L4273, #73
- 2026-09-28 — Text `flatten()` had dropped is restored: Xanathar's Arcane Shot save DC; Tasha's Path of the Beast Bite, Claws and Tail, College of Creation motes, Circle of Stars omens, Custom Lineage traits and Luba's Tarokka Weal and Woe. → ledger L4025, #68
- 2026-09-28 — Magic weapons name their properties from the core `items-base.json`: Xanathar's three staves, Tasha's three Moon Sickles and Baba Yaga's Pestle. → ledger L4327, #72
- 2026-09-28 — Tasha's six `bonusWeapon` items lose their `attack`/`damage` effects: the four weapons keep the bonus on the weapon, the Eldritch Claw Tattoo and Baba Yaga's Mortar and Pestle in prose. → ledger L4392, #74
- 2026-10-02 — Ammunition kinds, bundles and magic ammunition from 5e-tools' variants; a 2014 item reprinted under another name no longer ships beside its 2024 self (40 dropped). → ledger L4923, #7
- 2026-10-09 — Bundling moves to `bundle()` in `tools/data-kit/fbdata.py` (Python), replacing the Node bundler. → ledger L5342, #85
