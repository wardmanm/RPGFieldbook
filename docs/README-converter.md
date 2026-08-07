# Fieldbook rules converter

Turns raw [5e-tools](https://5e.tools) data files into the Fieldbook rules schema,
preferring the 2024 rules (XPHB / `basicRules2024`). Pure Python 3.8+, no dependencies.
You run it locally whenever the data changes — no more hand-conversion.

## Get the source data
From the 5e-tools GitHub data repo (or the site's `data/` folder):
- `conditionsdiseases.json`
- `feats.json`
- `spells/spells-xphb.json`
- `spells/sources.json` (spell → class mapping)
- `class/class-*.json` (one per class)

## Run it

```bash
# one at a time
python convert.py conditions conditionsdiseases.json                 -o conditions-2024.json
python convert.py feats      feats.json --overlay overlay.json        -o feats-2024.json
python convert.py spells     spells-xphb.json --sources sources.json  -o spells-2024.json
python convert.py classes    class-*.json --overlay overlay.json      -o classes-2024.json

# or everything found in a folder at once
python convert.py all ./5etools-data --overlay overlay.json -o ./rules
```

Import the resulting `*-2024.json` files into the app via **Settings → Rules → Import files**,
or host them and add them as sources (a manifest with `include: [...]` also works).

## What each converter produces
- **conditions** → `{ "keywords": [...] }` — 2024 conditions/statuses, plus any 2014 ones with no 2024 version.
- **feats** → `{ "feats": [...] }` — category + prerequisite line, then flattened text; effects from the overlay.
- **spells** → `{ "spells": [...] }` — `meta` (school · time · range · components · duration) + flattened text + higher-level/material; with `--sources`, each spell is tagged with its 2024 `class` list.
- **classes** → `{ "classes": [...] }` — hit die, saves, level-1 skill choice, spellcasting ability, per-level traits, ASIs as `asi` choices, subclass choice at the right level, Fighting Style as an `option` choice, and each XPHB subclass. Caster classes also get per-level "prepared/known spells" notes read from the class table.

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


## Equipment
Both the backgrounds and classes converters now emit `equipmentGrants` from 5e-tools `startingEquipment` (currency in copper → gp; class `goldAlternative` dice → average gp).
