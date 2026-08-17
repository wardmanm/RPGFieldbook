# Fieldbook rules converter

Turns raw [5e-tools](https://5e.tools) data files into the Fieldbook rules schema,
preferring the 2024 rules (XPHB / `basicRules2024`). Pure Python 3.8+, no dependencies.
You run it locally whenever the data changes — no more hand-conversion.

## Get the source data
From the 5e-tools GitHub data repo (or the site's `data/` folder):
- `conditionsdiseases.json`
- `variantrules.json` (the rules glossary)
- `feats.json`
- `backgrounds.json`
- `races.json`
- `items-base.json` and `items.json` (base gear and magic items — two separate files)
- `spells/spells-xphb.json`
- `spells/sources.json` (spell → class mapping)
- `class/class-*.json` (one per class)

`all` finds these itself inside an unpacked 5e-tools dump; you only need the individual paths when
running one subcommand at a time.

## Run it

```bash
# everything, in one go — this is the normal way
python convert.py all _conversion-data/5etools-v2.33.2 -o data/5e2024

# or one category at a time
python convert.py conditions conditionsdiseases.json                 -o conditions.json
python convert.py feats      feats.json --overlay ../data/overlay.json -o feats.json
python convert.py spells     spells-xphb.json --sources sources.json  -o spells.json
python convert.py classes    class-*.json --overlay ../data/overlay.json -o classes.json
python convert.py races      races.json                              -o races.json
```

`all` handles the whole 5e-tools dump as it actually ships:

- it searches the input directory **and its `spells/` and `class/` subdirectories**, so spells,
  classes and `sources.json` are all found;
- it converts **both** `items-base.json` (mundane) and `items.json` (magic), into `items.json` and
  `items-magic.json`;
- it falls back to the repo's `data/overlay.json` and `data/class-resources.json` when they aren't
  in the input dir — without those you lose the Archery/Defense effects and the Rage/Focus/Sorcery
  trackers;
- it **warns loudly** for anything it can't find and prints a summary at the end, rather than
  silently writing nothing;
- classes with no hit die (the TCE sidekicks) are skipped with a note instead of aborting the run.

Output goes to `data/5e2024/`. Players don't import these individually — `./build.sh` rolls each
system's folder into one `dist/<system>_full.json` pack, and that's what ships. Import either the
full pack or any individual file via **Settings → Rules → Import files**, or host them and add them
as sources (a manifest with `include: [...]` also works).

## Supplements: one book at a time

`all` converts the core rules. A single supplement — Xanathar's Guide, Tasha's Cauldron — uses
`supplement`, which selects by `source` code instead and writes its own pack folder:

```bash
python convert.py supplement _conversion-data/5etools-v2.33.2 -o data/xanathars \
  --book XGE --system XGE --pack-name "Xanathar's Guide to Everything" \
  --exclude-systems humblewood --avoid-table-names data/5e2024/tables.json \
  --note "…2014-era content, converted as published…"
```

| flag | what it does |
|---|---|
| `--book XGE` | the 5e-tools `source` code to keep. **Required** — there is no default, because a wrong one silently converts nothing |
| `--system XGE` | the pack's `system` field: the app's merge namespace and the `DATA_VERSIONS` key. Defaults to `--book` |
| `--pack-name` | human label; each file gets `"<label> — Spells"` and so on |
| `--note` | `_note` written into every file in the folder |
| `--exclude-systems` | `excludeSystems` (schema §1) — character systems this pack's species must not be offered to |
| `--classes Artificer` | classes this book prints **in full**; they get a `classes.json` with their subclasses nested |
| `--skip-classes Artificer` | classes whose subclasses already reach the player from another pack, so they aren't shipped twice |
| `--avoid-table-names PACK.json` | an existing tables pack whose table names must not be reused |

It converts glossary, magic items, feats, races, spells, subclasses, optional features and tables,
and **writes no file for a category the book has nothing in** rather than shipping an empty pack.

Three things are specific to a 2014-era book and worth knowing:

- **Subclasses are deduplicated by `_copy`, not by name.** 5e-tools carries every XGE/TCE subclass
  twice — the second is a `_copy` stub under the 2024 `classSource`, and 35 of the 57 stubs carry
  no features at all. Keeping the stub gives you a subclass with `"levels": {}`: right count, valid
  JSON, nothing in it.
- **Class tags come from `classVariant`.** `sources.json` files a 2014 book's spells under
  `classVariant`, not `class`. Read only `class` and every Xanathar's spell ships with no class
  list, so the spell browser's "only my class" filter hides all 95 of them.
- **Table names are global in the app.** `findTable` looks up by name and the `[Table: …]` anchor
  carries no pack, so `--avoid-table-names` renames the eight tables the 2024 PHB reprinted under
  the same name (`Gloom Stalker Spells (XGE)`). The anchors follow the rename automatically.

The 2024 path is untouched by all of this: with no `--book`, selection, pack names and the `system`
stamp are exactly what they were, and `data/5e2024/` reconverts byte for byte.

## What each converter produces
**Selection rule:** everything whose `source` is **XPHB** — the definitive 2024 book — plus any
basic-rules entry XPHB doesn't already cover by name (2024 wins, then the free 2024 subset, then
2014). Do **not** filter on `basicRules2024` alone: that flag selects only the *free* subset and
silently trims the book. It has already cost 4-of-16 backgrounds, 339-of-391 spells, and
17-of-77 feats.

- **conditions** → `{ "keywords": [...] }` — 2024 conditions/statuses, plus any 2014 ones with no 2024 version.
- **feats** → `{ "feats": [...] }` — category + prerequisite line, then flattened text; effects from the overlay.
- **spells** → `{ "spells": [...] }` — `meta` (school · time · range · components · duration) + flattened text + higher-level/material; with `--sources`, each spell is tagged with its 2024 `class` list.
- **classes** → `{ "classes": [...] }` — hit die, saves, level-1 skill choice, spellcasting ability, per-level traits, ASIs as `asi` choices, subclass choice at the right level, Fighting Style as an `option` choice, and each XPHB subclass. Caster classes also get per-level "prepared/known spells" notes read from the class table.
- **races** → `{ "races": [...] }` — the 10 XPHB species, with speed, traits, and skill choices. 2024 lineages (Elf, Gnome, Goliath, Tiefling) come from `_versions` and become `subraces`; Dragonborn's ancestry is template-only in the source, so its picks are read off the Draconic Ancestry table. No `abilityScores` — 2024 puts ability increases on backgrounds.
- **glossary** → `{ "keywords": [...] }` — rules-glossary terms (Advantage, Cover, Difficult Terrain…), the same category `conditions` writes to, so the two merge in the app.
- **backgrounds** → `{ "backgrounds": [...] }` — the 16 XPHB backgrounds: ability scores, feat, skill and tool proficiencies, equipment and its structured `equipmentGrants`.
- **items** → `{ "items": [...] }` — reads **both** item files and writes two packs: base gear and magic items. Between them the largest output the converter produces.
- **tables** → `{ "tables": [...] }` — see below. Written to `tables.json` by `all`, or to the path given by `--tables` on a single subcommand.

## Tables
5e-tools prose contains real table structures (roll tables, class progressions, lookup tables).
Every converter lifts those out into a **separate tables pack** and leaves a `[Table: Name]`
anchor in the description where the table used to sit; the app renders that anchor as a chip
that opens the table, and as plain text if no tables pack is loaded. Each table records the
entity it came from (`owner` / `ownerKind`), so the Rules tab can group them and a class view
can link to its own progression table.

```bash
python convert.py all _conversion-data/5etools-v2.33.2 -o data/5e2024   # writes tables.json too
python convert.py spells spells-xphb.json -o spells.json --tables tables.json
```

`all` collects every source's tables into a single `tables.json`. Class progression tables capture
**every** column of `classTableGroups` — Rage Damage, Weapon Mastery, Bardic Die and the rest — not
just the cantrip/prepared-spell counts that become per-level notes. Spell-slot columns are skipped
because the app already derives slots by level. Roll ranges render as text (`01-02`); the app does
not roll for you.

**Referenced features.** A class/subclass feature's entries can point at a sibling feature
(`{"type":"refSubclassFeature", …}`) instead of containing it. Those references are resolved and
inlined; before, they were dropped along with the whole referenced feature. This is what used to
lose the **Wild Magic Surge** table — three later Sorcerer features cited a table that had never
made it into the data.

## The overlay (`overlay.json`)
5e-tools stores mechanical bonuses (e.g. "Archery gives +2 to ranged attacks") only as prose.
The overlay adds the machine-readable effects the sheet applies automatically. It's keyed by
entry name and merges into feats and fighting-style options during conversion:

```json
{
  "byName": {
    "Archery": { "effects": [ { "target": "attack.ranged", "value": 2 } ] },
    "Defense": { "effects": [ { "target": "ac", "value": 1 } ] }
  }
}
```

Add your own entries. Valid effect targets: `ac`, `init`, `speed`, `hp.max`, `profBonus`,
`attack`, `attack.melee`, `attack.ranged`, `damage`, `damage.melee`, `damage.ranged`,
`ability.<abbr>`, `save.<abbr>`, `skill.<key>`. You can also grant proficiencies with
`"skills": ["Perception"]` or `"saves": ["wis"]`.

## Useful flags (classes)
- `--include-legacy` — also include non-XPHB subclasses (TCE, XGE, …). Off by default to keep the ruleset edition-consistent; turning it on mixes 2014 subclasses into the 2024 chassis.
- `--no-spell-notes` — skip the per-level prepared/known-spells notes.
- `--tables PATH` *(any subcommand)* — also write that source's lifted tables to `PATH`. `all` always writes `tables.json`.
- `--overlay PATH` / `--resources PATH` *(incl. `all`)* — point at the hand-authored inputs explicitly. `all` looks in the input dir then `data/`, so you rarely need these.


## Equipment
Both the backgrounds and classes converters now emit `equipmentGrants` from 5e-tools `startingEquipment` (currency in copper → gp; class `goldAlternative` dice → average gp).
