# Fieldbook Rules Pack Schema

This is the authoritative reference for the JSON "rules packs" that the Fieldbook
character-sheet app loads. It replaces the old `rules-example/` template files — an
author (human or AI) can produce any pack from the specs below.

Packs are loaded in-app via **Settings → Rules → Import files** (pick one or more `.json`
files) or from a **manifest URL**. Everything merges into one shared rules pool that the
sheet reads from (spell/feat/class pickers, the glossary tab, ancestry/background/class
selection, and the effects engine).

The companion tool `convert.py` generates most of these files from 5e-tools data; hand-author
new content (or homebrew) using this schema.

---

## 1. File wrapper

Every pack is a single JSON object. It may contain **any mix** of the category arrays.

```json
{
  "system": "Humblewood",
  "name": "Humblewood Races",
  "version": 1,
  "_note": "Optional free text; ignored by the app.",
  "excludeSystems": ["humblewood"],
  "requires": [
    { "pack": "D&D 2024", "file": "5e2024_full.json", "spells": ["Haste"] }
  ],

  "keywords":    [ ... ],
  "features":    [ ... ],
  "items":       [ ... ],
  "spells":      [ ... ],
  "races":       [ ... ],
  "classes":     [ ... ],
  "subclasses":  [ ... ],
  "backgrounds": [ ... ],
  "feats":       [ ... ],
  "tables":      [ ... ]
}
```

- **`system`** *(recommended)* — the source label. Used as the dedup key and shown as an
  annotation when names collide across sources. Use `"XPHB"` for D&D 2024 core, `"Humblewood"`
  for Humblewood, or your own campaign label.
- **`name`, `version`, `_note`** — optional metadata. `_note` is ignored by the app.
- **`excludeSystems`** *(optional, array of strings)* — character systems this pack's **species**
  must not be offered to. Values are `"dnd"` and/or `"humblewood"`, matched case-insensitively.
  Use it when `system` is a label the app can't place on its own: the D&D supplements ship
  `"system": "XGE"` / `"TCE"`, which is neither `"XPHB"` nor `"Humblewood"`, so without this
  Tasha's Custom Lineage would offer itself to a Humblewood character. It affects the ancestry
  picker only — spells, feats, subclasses and items from the pack stay available to everyone, and
  an already-chosen species always keeps resolving (see §6.2). If a pack is split across several
  files, **every file must declare the same value**: the bundler folds a folder into one file, so
  it can only carry one answer, and it fails the build if the files disagree.
- **`requires`** *(optional, array)* — content this pack refers to but does **not** ship, so the app
  can tell a player what's missing instead of failing quietly. Each entry names a source, then lists
  entry names per category using the same category keys as the pack body:

  ```json
  { "pack": "Xanathar's Guide to Everything", "file": "xanathars_full.json",
    "spells": ["Cause Fear", "Primal Savagery"] }
  ```

  `pack` and `file` are for the message; `file` is the actionable half, because it tells the player
  exactly what to import. Names are matched **case-insensitively against everything loaded,
  whichever pack supplies it** — having that spell from somewhere else is not an error. A category
  key the app doesn't know is ignored rather than reported missing. Every file in a folder must
  declare the same value, for the same reason as `excludeSystems`.

  You do **not** need to declare a subclass's parent class: that is a field the app resolves, so a
  missing one is detected on its own (§6.5). Declare what the schema *can't* see — an expanded spell
  list is prose, so the spells it names are invisible to any automatic check.

  Nothing here ever blocks loading. The pack merges as normal and everything it does ship keeps
  working; the app shows a red **! n missing** chip on that pack in Settings → Rules data, with a
  tooltip naming what's absent and where to get it.
- **`rulebook`** *(optional, boolean)* — mark a pack that carries a whole system in one file, the
  way `5e2024_full.json` and `humblewood_full.json` do. Purely presentational: the app files it
  under a **Rulebook** heading in Settings → Loaded rules data instead of **Mixed**. Merging is
  unaffected — a rulebook merges exactly as its individual files would.
- Category keys are all optional; include only what the pack provides. Split a large pack
  across several files (one category each) or keep it in one file — both work.
- `"features"` and `"traits"` are accepted as aliases for the same category.

### Merging & source annotation
- Entries are keyed by **`system` + name** (subclasses by `system` + class + name).
- Re-loading the **same source** replaces its own entries (safe to re-import an updated file).
- A same-named entry from a **different source** is **kept**, and both are shown annotated,
  e.g. `Alert (XPHB)` vs `Alert (Humblewood)`. Nothing is silently overwritten.
- The app assigns its own internal ids at load time — **do not** add an `_id` field.

---

## 2. Manifest (`include`)

For URL-hosted packs, a manifest can pull in split files. Paths are resolved **relative to
the manifest's URL**. (`include` is only followed for URL sources, not local file imports —
for local imports just select all the files.)

```json
{
  "name": "Humblewood Rules",
  "version": 1,
  "include": ["conditions.json", "races.json", "classes.json", "spells.json"]
}
```

---

## 3. Reference values

**Ability abbreviations:** `str` `dex` `con` `int` `wis` `cha`

**Skill keys** (used in `effects` targets as `skill.<key>`). In `skills: [...]` grant lists you
may use **either** the key or the display name — both match.

| key | display | key | display |
|---|---|---|---|
| `acrobatics` | Acrobatics | `medicine` | Medicine |
| `animal` | Animal Handling | `nature` | Nature |
| `arcana` | Arcana | `perception` | Perception |
| `athletics` | Athletics | `performance` | Performance |
| `deception` | Deception | `persuasion` | Persuasion |
| `history` | History | `religion` | Religion |
| `insight` | Insight | `sleight` | Sleight of Hand |
| `intimidation` | Intimidation | `stealth` | Stealth |
| `investigation` | Investigation | `survival` | Survival |

**Choice types:** `skill` · `asi` · `subclass` · `feat` · `option` (see §5).

---

## 4. Effects

`effects` is an array of `{ "target", "value" }` that automatically modify the sheet while the
owning thing is active (a feature that's toggled on, an item that's equipped, an active status,
a race trait, a chosen option, etc.). `value` is a **signed integer** (e.g. `2`, `-1`).

```json
"effects": [ { "target": "ac", "value": 1 }, { "target": "attack.ranged", "value": 2 } ]
```

Removing the source (unequip, remove ancestry, etc.) reverts its effects automatically.

**Valid targets**

| target | meaning |
|---|---|
| `ac` | Armor Class |
| `init` | Initiative |
| `speed` | Speed |
| `hp.max` | Max HP |
| `profBonus` | Proficiency Bonus |
| `attack` / `attack.melee` / `attack.ranged` | To-hit (all / melee / ranged) |
| `damage` / `damage.melee` / `damage.ranged` | Damage (all / melee / ranged) |
| `ability.<abbr>` | Ability **score** (e.g. `ability.str`) |
| `save.<abbr>` | Saving throw bonus (e.g. `save.con`) |
| `skill.<key>` | Skill bonus (e.g. `skill.stealth`) |

> Effects express **numeric** changes only. Non-numeric rules ("advantage on Stealth",
> "resistance to fire") belong in the `description` text.

---

## 5. Choices

`choices` (used inside class/subclass levels) presents the player with a selection when they
reach that level.

```json
"choices": [
  { "type": "skill", "choose": 2, "from": ["Arcana","History","Insight","Religion"] },
  { "type": "asi" },
  { "type": "feat" },
  { "type": "subclass", "label": "Choose a subclass" },
  { "type": "option", "label": "Fighting Style", "choose": 1, "from": [
      { "name": "Archery",  "description": "+2 to ranged attack rolls.", "effects": [ { "target": "attack.ranged", "value": 2 } ] },
      { "name": "Defense",  "description": "+1 AC while wearing armor.",  "effects": [ { "target": "ac", "value": 1 } ] }
  ]}
]
```

- **`skill`** — `choose` N from `from` (display names). Already-proficient options are disabled.
- **`asi`** — Ability Score Improvement (+2 one / +1 two) or a feat instead.
- **`feat`** — pick any feat; optional `from: [names]` restricts the list.
- **`subclass`** — pick the class's subclass (see §6.5). `label` optional.
- **`option`** — generic pick where each option can carry its own `effects` (fighting styles,
  signature choices, etc.). `from` is a list of `{name, description, effects?}`.

---

## 6. Category schemas

### 6.1 `keywords` — glossary terms, conditions & statuses

```json
{ "term": "Grappled", "type": "text", "text": "A Grappled creature's Speed becomes 0…", "cond": true }
{ "term": "Half Cover", "type": "image", "image": "data:image/png;base64,…" }
```

- `type`: `"text"` (with `text`) or `"image"` (with `image` as a data URL).
- **`cond: true`** marks the entry as a condition/status so it appears in the sheet's
  **Statuses & Conditions** picker. Plain rules terms omit it (they still show in the Rules tab
  and stay tappable in descriptions).

### 6.2 `races` — ancestries

```json
{
  "name": "Mapach",
  "category": "Humblefolk",
  "description": "…",
  "size": "Medium",
  "speed": "30 ft",
  "abilityScores": { "dex": 2, "con": 1 },
  "skills": ["Sleight of Hand"],
  "saves": ["dex"],
  "proficiencies": "Thieves' Tools",
  "languages": "Common, plus one of your choice",
  "traits": [
    { "name": "Clever Paws", "description": "…", "effects": [ { "target": "skill.sleight", "value": 0 } ], "skills": ["Sleight of Hand"] }
  ],
  "subraces": [
    { "name": "Ringtail", "description": "…", "traits": [ … ] }
  ]
}
```

- `size` is one of `Tiny`, `Small`, `Medium`, `Large`, `Huge`, `Gargantuan` — or an **array** of them
  for a species that offers a choice (`["Small","Medium"]`), which the app shows as "Small or Medium".
  It seeds the character's Size the same way `speed` seeds their speed: only when it isn't already
  set, so a subrace never overrides its parent and the player's own choice always wins. Size is what
  drives carrying capacity (Large and up carry double, Tiny half). Omit it and the character reads as
  Medium; a character can always set their own in **Settings**.
- `abilityScores` is a map of `abbr → +N`. **2024 races usually omit it** (ability boosts come
  from backgrounds); include it only for older/ancestry-boost content. For a *player-chosen*
  racial increase (older-style "+2 to any, +1 to any"), use `abilityChoice` instead (below).
- `traits[]` each have `name`, `description`, and optionally `effects`, `skills`, `saves`
  (skills/saves are granted; effects applied). Provenance is tracked, so removing the ancestry
  reverts everything it granted.
- `subraces[]` (a.k.a. lineages) use the same shape as the parent; the app shows them as
  sub-options and applies the chosen one.
- `category` is an optional grouping label in the ancestry picker.
- `choices[]` offers a player-chosen skill, same shape as a class's: `{ "type": "skill",
  "choose": 1, "from": ["Insight","Perception","Survival"] }`. Put it on the race (or inside a
  trait) rather than baking a fixed `skills` list when the rules let the player pick.
- **Species are filtered by system.** The ancestry picker only offers races whose `system` matches
  the character's (`"XPHB"` → a D&D character, `"Humblewood"` → a Humblewood one); any other label
  is treated as setting-agnostic and shown to both, so homebrew is never hidden. Only *races* are
  filtered — classes, spells, feats and items stay pooled, because Humblewood supplements the D&D
  core rather than replacing it. A character that already has a cross-system ancestry keeps it and
  all its traits; the filter applies to the picker, not to lookups.
  A pack whose `system` is a label the app can't place can say who it is **not** for instead, with
  the file-level `excludeSystems` (§1) — that is how the D&D supplement packs (`"XGE"`, `"TCE"`)
  keep Tasha's Custom Lineage out of a Humblewood character's list. An explicit exclusion wins over
  the name-based guess.

**`abilityChoice`** *(optional, on a race **or** a subrace)* — offers a player-chosen ability
increase in the Add-ancestry dialog, the way backgrounds do:

```json
"abilityChoice": { "modes": ["2-1", "1-1-1"], "eligible": ["str","dex","con","int","wis","cha"], "hint": "typical: DEX & CON" }
```

- **`modes`** — any of `"2-1"` (+2 to one, +1 to another) and `"1-1-1"` (+1 to three). A **None**
  option is always offered, with a note that 2024 rules put ability increases on your background.
- **`eligible`** *(optional)* — abilities the player may choose from (defaults to all six).
- **`hint`** *(optional)* — a short "typical spread" reminder shown by the chooser.
- Put it on a **subrace** when the increase belongs to that ancestry option (e.g. a jerbeen's
  Rockburrow lineage) — the subrace's `abilityChoice` overrides the base race's. Don't combine
  `abilityChoice` with a fixed `abilityScores` map on the same entry.

### 6.3 `classes`

```json
{
  "name": "Wizard",
  "description": "…",
  "hitDie": "d6",
  "savingThrows": ["int", "wis"],
  "spellcasting": "int",
  "levels": {
    "1": {
      "traits": [ { "name": "Spellcasting", "description": "…" } ],
      "choices": [ { "type": "skill", "choose": 2, "from": ["Arcana","History","Insight","Investigation","Medicine","Nature","Religion"] } ],
      "spells": { "note": "Know 3 cantrips and 6 level-1 spells." }
    },
    "3": { "traits": [ { "name": "Subclass" } ], "choices": [ { "type": "subclass" } ] },
    "4": { "traits": [ { "name": "Ability Score Improvement" } ], "choices": [ { "type": "asi" } ] }
  },
  "subclasses": { }
}
```

- **`hitDie`** like `"d8"`. **`savingThrows`** is a list of ability abbreviations.
- **`spellcasting`** *(optional)* — set to the caster's ability (`"int"`/`"wis"`/`"cha"`)
  **only for standard slot casters**. This flags the class as a full caster and the app
  auto-fills spell slots by level. **Omit it** for half/third casters (the app knows Paladin,
  Ranger, Artificer, Eldritch Knight, Arcane Trickster, Warlock by name) and for
  non-slot/point-based classes (they'd otherwise get full-caster slots).
- **`levels`** is keyed by level number (as strings). Each level may have `traits`, `choices`,
  and a `spells: { note }` string. Levels with no class feature can be omitted (e.g. if a
  subclass supplies that level's feature).
- **`subclasses`** may be an inline object `{ "Name": { levels… } }`, **but the preferred
  pattern** is to put subclasses in the top-level `subclasses` array (§6.5) so add-on packs can
  attach subclasses without redefining the class.

#### Class/subclass resources (auto trackers)

A class **or subclass** may declare `resources` — point-pools the app tracks automatically
(Rage, Ki/Focus, Sorcery Points, Scrap, etc.). Each is created on the sheet's **Resources**
card, scales its **max** with class level, and refills on the matching rest.

```json
"resources": [
  { "name": "Rage",           "per": "long",  "max": { "byLevel": [2,2,3,3,3,4,4,4,4,4,5,5,5,5,5,5,6,6,6,6] } },
  { "name": "Sorcery Points", "per": "long",  "max": { "formula": "level" } },
  { "name": "Bardic Inspiration", "per": "long", "max": { "formula": "cha" } }
]
```

- **`name`** — the pool's display name.
- **`per`** — `"long"`, `"short"`, or `"none"` (never auto-resets). A long rest also resets
  `short` pools.
- **`max`** — one of:
  - `{ "byLevel": [ … ] }` — array indexed by **class level** (index 0 = level 1); a `0`
    means the resource doesn't exist yet at that level (e.g. Ki starts at level 2).
  - `{ "formula": "level" }` — equals the class level.
  - `{ "formula": "<abbr>" }` — an ability modifier (min 1), e.g. `"cha"` → CHA modifier;
    supports an offset like `"cha+1"`.
  - a plain number.

Auto resources are managed (max locked, shown with an "auto" badge); players can still spend/
gain and reset them, and add their own manual resources on the sheet. When generating with
`convert.py`, XPHB class resources live in a hand-editable **`class-resources.json`** overlay
(keyed by class name) that the converter applies — mirroring `overlay.json` for feats.

### 6.4 `backgrounds` (2024 style)

```json
{
  "name": "Acolyte",
  "description": "",
  "abilityScores": ["int", "wis", "cha"],
  "feat": "Magic Initiate (Cleric)",
  "skills": ["Insight", "Religion"],
  "tools": "Calligrapher's Supplies",
  "languages": "one of your choice",
  "equipment": "Choose A or B: …",
  "feature": { "name": "Bandit Routes", "description": "…" }
}
```

- **`abilityScores`** is the list of **three eligible** abilities; when added, the app prompts
  the player to distribute **+2/+1** (two of them) or **+1/+1/+1** (all three).
- **`feat`** — a string, or an **array** `["Woodwise","Speech of the Ancient Beasts"]` to offer a
  choice. If the name matches a `feats` entry, its effects are applied.
- **`skills`** (granted), **`tools`/`languages`** (added as proficiency notes), **`equipment`**
  (text). **`feature`** is optional (2024 XPHB backgrounds have none; some settings do).

### 6.5 `subclasses` (attach to a class by name)

```json
{
  "class": "Fighter",
  "name": "Scofflaw",
  "description": "…",
  "spellcasting": "int",
  "levels": {
    "3": { "traits": [ { "name": "Brutal Brawler", "description": "…" } ] },
    "7": { "traits": [ … ] }
  }
}
```

- **`class`** matches the parent class name (case-insensitive). The subclass then appears in that
  class's subclass picker alongside any others, annotated by source.
- `levels` use the same shape as class levels (`traits`, `choices`, `spells`).
- `spellcasting` here grants a subclass caster ability (e.g. Eldritch Knight) if desired.
- **If the parent class isn't loaded**, the subclass is unreachable — it can't attach to anything.
  The app detects that on its own (no `requires` entry needed) and shows a red **! n missing** chip
  on your pack naming the classes it couldn't find, rather than the subclass picker claiming the
  class has no subclasses.
- **Same name as one the class already has?** Both are offered, and yours is labelled with your
  pack — `Gloom Stalker` and `Gloom Stalker (XGE)`. It does **not** replace the existing one:
  the picker's key is what a character stores, so overwriting it would silently change subclasses
  that were already chosen. Re-importing your *own* pack still replaces your own entry, so
  updating a pack works as expected.

### 6.6 `feats`

```json
{ "name": "Archery", "description": "+2 to ranged weapon attack rolls.", "effects": [ { "target": "attack.ranged", "value": 2 } ] }
```

- `effects` optional — include them when the feat has a clean numeric effect; otherwise the
  mechanics live in `description`.

### 6.7 `spells`

```json
{ "name": "Fire Bolt", "level": 0, "meta": "Evocation · 1 action · 120 feet · V, S · Instantaneous", "text": "…", "class": ["Sorcerer","Wizard"] }
```

- **`level`** 0–9 (`0` = cantrip).
- **`meta`** convention: `School · casting time · range · components · duration`, separated by
  ` · ` (middle dot). The **first segment is read as the school** for the browser's filter.
- **`class`** *(optional)* — a list of class names the spell belongs to; drives the "my class"
  filter in the spell browser. Omit to show it for everyone.
- Put any "At Higher Levels" and material component notes in `text`.

### 6.8 `items`

```json
{ "name": "Longsword", "system": "XPHB", "category": "Weapon", "type": "Martial Melee Weapon",
  "rarity": "Mundane", "cost": "15 gp", "weight": 3,
  "description": "Damage 1d8 slashing (Versatile 1d10) · Properties: Versatile · Mastery: Sap",
  "effects": [] }
```

- **Armor** is equippable and drives **AC**: an item is treated as armor when its `category` is
  `Armor`/`type` contains Armor or Shield, or its `description` starts with an `AC …` line. Base
  AC + capped Dex (light = uncapped, medium = +2, heavy = none) and shields (+2) are read from the
  description automatically; you may instead give a structured `"armor": {"kind":"body","base":14,"dexCap":2}`
  or `{"kind":"shield","bonus":2}`. Magic bonuses still go through `effects` (`{"target":"ac","value":1}`).
- **Weapons create an Attacks entry.** Give an item a structured `weapon` object and adding it to a
  character automatically creates the matching row under **Attacks & Weapons**, with to-hit and
  damage worked out; removing the item removes the attack again.

  ```json
  "weapon": { "kind": "melee", "ability": "str", "dice": "1d8", "damageType": "slashing",
              "notes": "Versatile (1d10)", "atkMisc": 0, "dmgMisc": 0 }
  ```

  `kind` is `"melee"` or `"ranged"`; `ability` is the ability the attack uses (`str`/`dex`/…, and
  finesse weapons should name the one the character will actually want); `dice` is the damage dice;
  `damageType` is free text. `notes`, `atkMisc` and `dmgMisc` are optional — the last two are flat
  modifiers added to the roll, for a `+1` weapon that has no other effect. Without a `weapon` object
  an item is just inventory, however weapon-like its description reads.
- **`effects`** apply **while equipped** (e.g. a Ring of Protection: `{"target":"ac","value":1}`). Base
  gear/armor usually have none — the app doesn't replace base AC from an effect; that lives in the
  `description` or the `armor` object. Weapon damage comes from `weapon`, not from `effects`.
  `equipped`, `qty` and `sectionOverride` (which inventory section to file it under) are set
  per-character when the item is added, not in the pack.
- **`weight`** is a **number of pounds, per unit** — not per stack. It is copied onto the character's
  item when the item is added, totalled in the Inventory tab (multiplied by quantity, and added to
  the weight of any coins carried), and used for carrying capacity when the character has
  encumbrance switched on. Omit it and the item weighs nothing, which is the right answer for most
  small things.
- Optional facet/display fields used by the item browser: **`category`** (coarse — Weapon / Armor /
  Tool / Gear / Wondrous Item / Potion / Ring / Wand / etc.), **`type`** (specific, e.g. "Heavy Armor"),
  **`rarity`** (Mundane / Common / Uncommon / Rare / Very Rare / Legendary / Artifact), **`cost`**
  (display string), **`weight`** (number), **`attune`** (bool — needs attunement), and **`attuneNote`**
  (e.g. "by a Cleric"). The browser filters on category, rarity, and attunement, and groups by category;
  all are safe to omit for simple items.

### 6.9 `features` / `traits` (standalone)

```json
{ "name": "Rage", "source": "Barbarian", "description": "…",
  "uses": { "max": 3, "per": "long" },
  "cost": { "resource": "Rage", "amount": 1 } }
```

- A loose feature not tied to a race/class/background. `source` optional label.
- **`uses`** *(optional)* — a per-rest counter: `{ max, per }` where `per` is `"short"` or
  `"long"`. Shows as tappable pips; rests reset it (a long rest also resets `short`).
- **`cost`** *(optional)* — `{ resource, amount }`. Adds a **Use** button that spends `amount`
  from the matching **resource** pool (§6.3) when the feature is used (and ticks `uses` if the
  feature also has them). Blocked if the resource is missing or too low. Because the resource
  refills on its own rest, the feature becomes usable again automatically after that rest.
- These same `uses` and `cost` fields are also honored on **class/subclass level `traits`**, so
  data-authored features can declare their own tracker and resource cost (e.g. a trait that
  costs 2 Scrap, or is usable twice per short rest).

---

### 6.10 `equipmentGrants` — starting equipment (backgrounds, classes, races)

Structured starting equipment that links to the loaded **item list** and drops into the
character's Inventory (and coins) when the source is added. Supports fixed grants and
"choose A or B" picks. Keep the human-readable `equipment` string too (for print/display);
`equipmentGrants` is the machine-readable version.

```json
"equipmentGrants": [
  { "items": [ { "name": "Knife" }, { "name": "Winter Blanket" } ], "gold": 10 },
  { "choose": [
      { "label": "A", "items": [ { "name": "Spear" }, { "name": "Arrows", "qty": 20 } ], "gold": 14 },
      { "label": "B", "gold": 50 }
  ]}
]
```

- An array of **blocks**. A block with **no `choose`** is granted outright (`{ items, gold }`).
  A block with **`choose`** presents a picker; each option is `{ label?, items, gold }` and the
  player picks one.
- **`items[]`** — each `{ "name", "qty"? }` (qty defaults to 1). The name is matched
  (case-insensitively) against the loaded item list: on a match the full item is added (its
  description, effects, and — for weapons — a linked Attacks entry). On no match it's added as a
  plain named item, so nothing is lost. Load the item packs for full linking.
- **`gold`** — added to the character's gold (gp). The `"or 50 GP"` halves are just an option
  whose only field is `gold`.
- **Provenance & revert.** Everything granted is tagged with its source; removing or swapping the
  background/class/race removes exactly those items and their attacks, and subtracts the granted
  gold (clamped at 0 if already spent). Items the player already owned are never touched.
- Honored on **backgrounds** (§6.4), **classes** (§6.3, applied once when the class is first added),
  and **races** (§6.2). Class gold-alternatives expressed as dice (e.g. `5d4 × 10`) are converted
  to their **average** by `convert.py`.

### 6.10a Pack-level `dataVersion`

The two bundled packs carry `"dataVersion": "1.3.0"` alongside `system` and `name`. It is the
Fieldbook release in which **that system's** content last changed, and the app compares it against
what the running build expects, so it can say "your rules data is current" or "a newer pack exists".

It is per system: a release that only touches Humblewood leaves the D&D pack's `dataVersion` alone,
so D&D players aren't told to re-import a file that hasn't moved. Distinct from `version`, which is
the schema version. Hand-written packs can omit it — an absent `dataVersion` means "unknown", and
the app stays quiet rather than guessing.

### 6.11 `tables` — reference tables

Roll tables, class progressions, and the lookup tables the rules prose keeps pointing at. They
appear in the app's **Tables** tab, and any description that carries a `[Table: Name]` anchor
(§7) renders that name as a tappable chip which opens the table in place.

```json
"tables": [
  {
    "name": "Wild Magic Surge",
    "caption": "Wild Magic Surge",
    "cols": ["1d100", "Effect"],
    "align": ["center", "left"],
    "rows": [
      ["01-02", "Roll on this table at the start of each of your turns."],
      ["03-04", "You cast Fireball as a level 3 spell."]
    ],
    "owner": "Wild Magic Sorcery",
    "ownerKind": "subclass"
  }
]
```

- **`name`** (required) — the merge key **and** the anchor target, so it must be unique within a
  pack and match any `[Table: …]` anchor exactly (lookup is case- and whitespace-insensitive).
  `convert.py` uniquifies collisions by appending ` (2)`, ` (3)`.
- **`rows`** (required) — an array of arrays of **strings**. Cells are plain text, escaped on
  render; no markup. Ragged rows are padded to the widest row, but authoring them rectangular is
  better. A table with no rows is skipped.
- **`cols`** — the header labels. The key is `cols`; **`columns` is not read**, and a table that uses
  it renders with no header row while looking perfectly correct in the JSON. Omit `cols`, or leave
  every entry `""`, only when you genuinely want a headerless table.
- **`align`** — per-column `"left"` (default) / `"center"` / `"right"`.
- **`caption`** — optional; only present when the source table had one. `name` is what's displayed.
- **`source`** — optional provenance label (e.g. `"Humblewood"`), for tables extracted from a book
  rather than generated by `convert.py`. Display only.
- Keys beginning with `_` are **extractor internals and must not appear in a shipped pack**. The
  Humblewood extractor strips them on write.
- **`owner`** / **`ownerKind`** — which entity the table came from. `ownerKind` is one of
  `class`, `subclass`, `spell`, `item`, `feat`, `background`, `rule`; it groups the Tables tab and
  lets a class or subclass view show a chip for its own table even when no prose anchor exists.
- Rolling is **not** performed in-app — a `1d100` column is just text (`"01-02"`), so players roll
  their own dice.
- Tables are **reference data only**: nothing here is written to a character, so adding or removing
  a tables pack never affects saved characters.

## 7. Conventions & tips

- Use **`system: "XPHB"`** for D&D 2024 core content and a distinct label (e.g. `"Humblewood"`)
  for settings, so cross-source duplicates annotate cleanly instead of clobbering each other.
- **Strip 5e-tools `{@tag}` markup** to plain text before authoring (or generate with
  `convert.py`, which handles the tag rules).
- Keep **names exact** — feat lookups (from backgrounds), subclass→class matching, and the
  spell "my class" filter all match on names.
- Prefer the **top-level `subclasses` array** over inline class subclasses so packs can extend
  existing classes (including XPHB ones) without redefining them.
- Only set a class/subclass **`spellcasting`** ability when you want the app's automatic
  spell-slot table; leave it off for point/resource-based classes.
- Effects are **numbers only** — everything conditional or non-numeric goes in `description`.
- **Link a table from prose with a `[Table: Name]` anchor.** Put it in any description/text field
  at the point the table belongs; the app turns it into a chip that opens the matching §6.11 table.
  If no matching table is loaded it degrades to the plain sentence "the *Name* table", so an anchor
  is always safe to author even when the tables pack is optional. `convert.py` writes these
  automatically wherever it lifts a table out of 5e-tools prose.
