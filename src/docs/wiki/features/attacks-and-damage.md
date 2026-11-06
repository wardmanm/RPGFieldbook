# Attacks & damage

The **Attacks & Weapons** card, at the top of the Inventory tab (on the Sheet until #103): one row per attack, each showing a to-hit (or a save
DC) and a damage line worked out from the character's abilities, proficiency and effects. Rows come
from three places — made by hand, generated from a weapon in the inventory, or generated from a spell
— and the last two stay linked to what made them. Most of the complexity is in keeping those links
alive through edits, rules updates and old saves without ever overwriting what the player tuned.

**Code:** `attackNumbers()`, `spellFxList()`, `attackDamageStr()`, `extraDamageList()`, `renderAttacks()`,
`openAttackForm()`, `openAttackBreakdown()`, `carryAttackLinks()`, `syncSpellAttack()`,
`detectSpellAttack()`, `spellDamageFromText()`, `ensureSpellAttacks()` in `60-attacks.js` ·
`attackVisible()`, `isEquippable()` in `25-origins-items.js` · `addAttackForItem()`, `equipNewWeapon()` in `85-browse.js` ·
`newCharacter()` in `75-home-theme.js` ·
`syncItemAttack()` in `80-modal-forms.js` · `updResyncAttack()`, `updAtkEdited()`, `stampAtkGen()` in
`72-char-update.js` · `migrateWeaponEquip()` in `71-char-io.js` · **Data:** an item's `weapon` object
([rules-schema §6.8](../../../../docs/rules-schema.md)) · **Tests:** `sheet.js`, `char-update.js`
(R7), `rules-data.js` (wiring guards) · **See also:** [Spells](spells.md), [Inventory](inventory.md),
[Ammunition](ammunition.md), [Computed stats & effects](../architecture/computed-stats-and-effects.md),
[Rules-update tool](rules-update-tool.md)

## How it works

**The record.** `character.attacks[]` holds `{id, name, kind, ability, proficient, atkMisc, damageDice,
damageType, dmgMisc, addAbilityDamage, notes}`, plus optional `extraDamage`, `fav`, the links `itemId`
/ `spellId` / `source` / `save`, and `genFp`.

**The numbers.** `attackNumbers(a)` takes the ability modifier (`finesse` is the better of STR and
DEX, labelled DEX on a tie; `none` is 0). To-hit is that modifier, plus the proficiency bonus when
`proficient`, plus `atkMisc`, plus the effects it counts; the damage bonus is the modifier when
`addAbilityDamage`, plus `dmgMisc`, plus the effects it counts. `kind` is melee unless it says
ranged. Which effects (`atkList`, `dmgList`, returned beside the sums):

- **A weapon's row** (anything not `source:"spell"`): every `attack` and `attack.<kind>` effect and
  every `damage` and `damage.<kind>` one, ticked Include spells or not. Never `spell.attack`.
- **A spell's row**: `spellFxList()`, the same set the Spellcasting card and the cast window take
  ([Spells](spells.md)): `spell.attack`, plus the generic effects ticked Include spells
  (`spells:true`), `.melee`/`.ranged` ones only on an attack spell of that range. A save row has no
  range, so only the "all attacks" damage ones. An unticked generic effect is for weapons only.
  The row keeps its own ability part, so a row whose `ability` is set shows it even with no
  spellcasting ability chosen (#74).

`atkMisc`/`dmgMisc` belong to this row alone; an effect applies to every row it reaches while its
source is live, so a magic weapon's own `+N` is its row's `atkMisc`/`dmgMisc` and never an effect.
Tapping a to-hit opens `openAttackBreakdown()`, which lists the modifier, proficiency, the manual
extras and exactly the effects `attackNumbers()` counted, by name.

**The damage line.** `attackDamageStr(a, bonus)` builds `dice bonus type` for the main part and one
`dice type` per `extraDamage` entry (`{dice, type}` — a sword's 1d8 slashing *and* 1d6 poison),
joined with ` + `. Only the main part takes the bonus: an extra type is its own roll. One formatter
serves the row, the breakdown, the print sheet (`printSheet()`) and the cast dialog
(`promptSpellAttack()`), so none of them can promise different damage. The form's repeatable list is
`xDmgFieldHTML()` / `wireXDmgField()` / `readXDmg()` / `clearXDmgField()`, parameterised on the element
id and shared with the spell form.

**Ammunition.** A row whose item has `weapon.ammo` carries, under the damage line and outside the
collapse, the ammunition line drawn by `ammoLineHTML()`: the stack it is loaded with, Fire, and
Recover N — see [Ammunition](ammunition.md). `attackNumbers()` adds the loaded stack's `ammo.bonus`
(`attackAmmo()`) to both the to-hit and the damage bonus, and `openAttackBreakdown()` names the stack
("+1 Arrow (loaded)") alongside the other sources.

**The card.** Rows collapse individually (`atkCollapse.items`) with a Collapse all / Expand all
button that hides on an empty list. A star moves a row under a `★ Favorites` heading (`ATK_FAV`, the
same label as `FEAT_FAV`); favourites keep insertion order, and the two headings appear only when
something is starred. The shared heading style comes from `.inv-sec-head` — see
[Sections & layout](../ui/sections-and-layout.md).

**Weapons.** An inventory item with a `weapon` object gets a linked row from `addAttackForItem()`:
proficient, ability damage on, `itemId` set, and a `genFp` stamp. It is reached from the item finder
(`addLibraryItems()` — one attack however many are added), starting equipment (`grantItemByName()`,
see [Grants & provenance](../architecture/grants-and-provenance.md)) and the item form, whose save
runs `syncItemAttack()`: update the linked row in place and re-stamp it, create one if missing, or
delete it when the Weapon box is unticked. The form keeps `weapon` only when damage dice are given,
and asks only for kind, ability, dice and type: the weapon's `notes`, `atkMisc` and `dmgMisc` are
carried from `wFrom`, the pack weapon last put in by *Insert from rules pack*, else the item's own.
Deleting the item deletes its row (the confirm says so), and so does using up the last of a
consumable. A pack weapon's `ability` comes from the converter: `finesse` for any weapon whose
properties include Finesse, melee or ranged (a Dart), else `dex` for a ranged one and `str` for a
melee one. `ability` and `kind` are independent: a Dart row is `finesse` and `ranged`, so it takes
the better of STR and DEX and still gets `attack.ranged` effects. A `+N` pack weapon carries its
bonus as `atkMisc`/`dmgMisc` and no `attack`/`damage` effect. Its `notes` ("Range 20/60 ·
Finesse, Light, Thrown · Mastery: Nick") are copied onto the row as text; nothing parses them.

**Equipping.** `isEquippable()` is true for effects, armor *or* a weapon. `attackVisible(a)` gates only
rows with an `itemId` whose item still exists, on that item's `equipped`; hand-made rows and spell rows
always show, and so does an orphan (its item was deleted, so nothing could ever re-equip it). Rows are
hidden, never removed. **A weapon arrives equipped, with its row showing** (#128): the finder
(`addLibraryItems()`) and a grant (`grantItemByName()`, starting equipment) share one path,
`equipNewWeapon()`, which equips it and calls `addAttackForItem()`. On the item form a new item's
Equipped box follows its Weapon box and Insert from rules pack (on for a weapon, off for anything
else, so a shield inserted after a sword stays unequipped) until the player sets Equipped; an item
being edited keeps what it has. Armour and shields arrive unequipped (Mike: #130
changes shield stacking first). `migrateWeaponEquip()`, run at the end of `migrate()`, equips every
weapon once and records `wpnEquipInit` — pre-existing weapons were all `equipped:false` because no
control existed. `newCharacter()` sets `wpnEquipInit` on the sheet it creates, so the pass never
runs on a new sheet.

**Editing.** `openAttackForm()` rebuilds its record from the boxes, so `carryAttackLinks()` copies the
four `ATTACK_LINK_FIELDS` (`itemId`, `spellId`, `source`, `save`) across, and the save carries `genFp`.
`extraDamage` is written only when non-empty.

**Resync on a rules update.** `updResyncAttack(it)` finds the row by `itemId` (none: add one). Attacks
carry no `src`, so only the item can regenerate them; the question is whether the row is still as
generated. `genFp` is one hash over `ATK_GEN_FIELDS` — name, kind, ability, proficient, atkMisc,
damageDice, damageType, dmgMisc, addAbilityDamage, notes — and `updAtkEdited()` is three-valued:
`false` rebuilds (keeping the id, so collapse state survives), `true` (player edited) and `null` (no
stamp, pre-1.5) are left alone.

**Spell rows.** `syncSpellAttack(sp)` deletes every row with that `spellId` and rebuilds from the
spell: an `attack` spell gets a row with `source:"spell"`, the character's `spellAbility`, proficient,
no ability damage; a `save` spell gets `save:{ability}` and no to-hit. `sp.extraDamage` is copied on.
A save spell with no damage (`spellHasDamage()`: main dice or extras) gets **no row** — it would only
repeat the Spell Save DC; an attack spell always does, because the to-hit appears nowhere else.
Spell rows show **Cast** where a weapon shows Edit; `recompute()` re-points their `ability` at the
current `spellAbility` every pass; save rows print `DC N ABILITY` from `spellDC()`, marked when a
`spell.dc` effect applies, and their damage takes only the ticked damage effects (`n.dmgFx`; a
save spell adds no ability), marked when one applies. The print sheet passes the same. On every row the to-hit, the damage and a save row's
DC are red with ▼ (`fx-neg`) when any one effect on them is a penalty: `attackNumbers()` returns
`atkNeg`/`dmgNeg` beside `atkFx`/`dmgFx`. `openAttackBreakdown()` reddens a penalty effect's line;
the modifier and the manual extras are not effects and stay plain.

**The damage detector.** `detectSpellAttack(sp)` runs only while `sp.atkType` is `undefined`: "make a
ranged/melee spell attack" → attack and kind; "*Ability* saving throw" → save and `saveAbility`;
otherwise `""`, a stored "not an attack". `spellDamageFromText()` then reads the first
`NdN [+ N] <type> damage`, falling back to a typeless `NdN [+ N] damage` ("of the chosen type": fill
the dice, leave the type blank), and only ever fills blanks. `ensureSpellAttacks()` runs from every
`renderAll()`: it detects and syncs spells never detected, `spellDamageBackfill()` re-reads damage for
spells with a type but no dice, and `dropDamagelessSpellRows()` removes save rows the damage rule no
longer allows, leaving orphan rows alone.

## Rules that must hold

- **A spell's row counts what the card and the cast window count.** All three read `spellFxList()`;
  a spell row never adds an unticked generic effect, and a weapon row never asks about the tick.
- **Only the main damage part takes the bonus.** Getting this wrong is invisible in the JSON and wrong
  at the table.
- **Explicit wins.** Detection runs only on `atkType === undefined`; the form stores "Not an attack"
  as `""` so it sticks. The backfill never changes `atkType` and never overwrites a typed value.
- **Every rebuild-from-form path carries the links and `genFp`.** Lose `itemId` and the next pack
  update finds no row, calls `addAttackForItem()` and the player gets a duplicate.
- **A resync never overwrites a row the player touched**, and `null` means leave it. The fingerprint
  must cover every field the generator sets — `proficient` and `addAbilityDamage` included — and
  never `extraDamage`, the id or the links, which the generator does not set.
- **Everything that rewrites a row from its item re-stamps it** (`addAttackForItem()`,
  `syncItemAttack()`); otherwise editing the weapon makes its own attack look hand-edited forever.
- **Hidden, never removed** on unequip; orphans stay visible.
- **`wpnEquipInit` is never set by `blankChar()`** — `migrate()` builds from `blankChar()`, so every
  old sheet would arrive pre-marked and skip the migration. A test asserts it. `newCharacter()` sets
  it, since a new sheet's weapons arrive equipped.
- **A spell row is derived.** Anything it shows must be a field on the spell; the row has no editor.
- `extraDamage` and `genFp` are optional and absent when empty, so old saves load byte-identical.

## Traps

- **A spell row read higher than its cast window (#129).** `attackNumbers()` added every `attack`
  and `damage` effect to spell rows, while the Spellcasting card and `promptSpellAttack()` added
  none, so with Archery a Fire Bolt row read 2 above the window. Archery is ranged *weapon*
  attacks: the fix is an Include spells tick, unticked by default, and the packs are unchanged. A
  character with Archery sees Fire Bolt's row drop by 2. → L9101
- **The flag in `blankChar()`.** `wpnEquipInit` was first set there and silently skipped the
  migration for every existing sheet; caught by a test before it shipped. → L3213
- **Gating on `equipped` without a migration** would have emptied every existing Attacks card, and a
  migration without the flag would re-equip a deliberately unequipped weapon on every load. → L3213
- **`(\d+d\d+)\s+(\w+)\s+damage` read `+` as the damage type**, so Disintegrate and Finger of Death
  showed a bare DC. The typeless fallback requires `damage` *immediately* after the dice, which is what
  rejects Ray of Enfeeblement's "subtracts 1d8 from all its damage rolls". → L2989
- **Green unit tests, broken old sheets.** The no-damage rule lives in `syncSpellAttack()`, which never
  re-runs for a spell nobody edits; only browser QA showed old save rows surviving. Hence the sweep
  on load. → L2989
- **The first fingerprint left out `proficient` and `addAbilityDamage`**, so unticking one was undone
  by the next resync. → L2945
- **Three copies of the damage expression** (row, breakdown, print); the print one had already
  drifted. → L2742
- **Magic weapons attacked with Strength (#72).** The converter named properties only from the
  file it was converting, so a finesse magic weapon (Dagger of Venom, Scimitar of Speed, Sun Blade,
  the Psychic Blade item) shipped `ability: "str"` and notes reading "F, L, T". The app did the
  arithmetic right on the wrong field. Fixed in the packs, not the app; an existing sheet gets the
  corrected weapon through the rules-update tool, which rebuilds the row only if it was never
  edited. See [Converter](../data/converter.md). → L4327
- **A +N weapon counted its bonus twice (#74).** The packs wrote it on the weapon *and* as global
  `attack`/`damage` effects on the item: the +1 Dagger of Venom's row read +2, and every other row,
  spell rows included, +1 while it was equipped. `attackNumbers()` was right to add both, so it is
  unchanged; the packs no longer carry the effects. The item form's Insert had carried the weapon's
  `atkMisc` only from the item being edited, which the effect had hidden; it now carries it from the
  inserted entry too. An existing sheet gets the fix through the rules-update tool, as "effects
  changed". → L4392
- **An item's spell bonus reached no spell row (#77).** The packs never read `bonusSpellAttack` /
  `bonusSpellSaveDc`, and no target could carry them; `spell.attack` and `spell.dc` now do. A Staff
  of Power's row stays its weapon's +4: only spell rows take `spell.attack`, and `attack` was not
  reused for it because it reaches every weapon row. → L4568
- **A Dart could only use DEX (#75).** The converter gave every ranged weapon `dex` and never
  asked about Finesse. Fixed in the pack; `attackNumbers()` already read `finesse` for any kind. An
  existing Dart reaches `finesse` through the rules-update tool, and its row is rebuilt only if it
  was never edited. → L4466
- **Every literal-id `getElementById` lookup in a form is checked by `rules-data.js`** against the
  ids the app renders; a generated id is not "declared", which is why clearing the spell form's list
  goes through `clearXDmgField()`. → L2863
- **Starting weapons had no attack row until a reload (#128).** Only the finder equipped a weapon on
  arrival; a grant and a new item on the form left it `equipped:false`. A new character's weapons
  were equipped only on its first reload, by `migrateWeaponEquip()` (`newCharacter()` skips
  `migrate()` and never set `wpnEquipInit`), and that pass also re-equipped any weapon the player
  had unequipped before it. → L9101

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| Do generic to-hit and damage effects count for spells? (#129) | Only when ticked: a per-effect Include spells tick (Mike) in every effect editor (item, feature, status, familiar), unticked by default | One switch per character: can't have one item count and another not. Always counting: no way to say "weapons only" |
| Which targets get the tick (#129) | The six generic ones: to-hit and damage, each all / melee / ranged | Spell attack and Spell save DC: they already count only for spells |
| Where a ticked to-hit counts (#129) | All three places agree; melee/ranged-only ones where the spell's range is known (its row and the cast window); the card takes the "all attacks" ones | — |
| Where a ticked damage counts (#129) | Every spell that deals damage, attack or save; melee/ranged-only ones need an attack spell of that range | Attack spells only: a save spell's damage could never take one |
| May a rules resync overwrite a player-edited attack? | No — rebuild only when `updAtkEdited()` is `false` (owner's call) | Rebuilding wholesale from the item: silently discarded the edit, with nothing to undo it |
| Where does a spell's second damage type live? | On the spell, copied onto its row | On the row: rebuilt from the spell every time, and it has no Edit button |
| Do save spells without damage get a row? | No; attack spells always do | Keeping them: a name that repeats the Spell Save DC in a list scanned mid-combat for numbers |
| Auto-detect a second damage type? | No — leave the box blank | A pattern: phrased too many ways for a guess to beat a blank |
| Heal old sheets' damage-free rows | A targeted sweep, `dropDamagelessSpellRows()` | A blanket re-sync: new uids, collapse state lost on rows that were fine |
| What happens to a weapon's attack on unequip? | Hidden | Removed: throws away an attack the player tuned |
| How a new weapon arrives (#128) | Equipped with its row, from the finder, a grant or a new item on the form; armour and shields unequipped (Mike) | Equipped from the finder only: starting weapons showed no row until a reload. Armour and shields too: #130 changes shield stacking and must not go live first |
| How the item form equips a new weapon (#128) | Its Equipped box follows Weapon until the player sets Equipped | Save equipping it behind an unticked box: the form would show one thing and save another |
| Order of starred attacks | Insertion order | Sorting: the list is short and hand-built, so a row stays where it was put |
| Should `attackNumbers()` skip the effects of the item that owns the row? (#74) | No: effects are global, a weapon's own bonus is its `atkMisc`/`dmgMisc`, and the packs are fixed | Skipping them: fixes only the weapon's own row on an old sheet (every other row keeps the +N), and makes an effect the player typed on a weapon mean one thing on its row and another on the rest |

## Open

- **Deleting a weapon's row is not sticky:** the next item save or rules update recreates it.
  Unequipping is the way to hide it.
- `syncSpellAttack()` copies `sp.atkNote` into the row's notes, but nothing in the app or the packs
  writes `atkNote`.
- `printSheet()` lists every attack, including rows hidden by an unequipped weapon.
- An item's `attackId` is written but never read (links resolve by the row's `itemId`), and
  `updResyncAttack()` leaves it pointing at a discarded id.
- Delayed Blast Fireball ("base damage is 12d6") and Glyph of Warding (a list of types) are still not
  read by the detector.
- At phone width a row's name runs into its type label behind the to-hit pill (seen in #48–#56, not
  fixed).
- More in [Known issues](../roadmap/known-issues.md).

## History

- 2026-08-07 — Spells can be attacks or saves and sync a row into Attacks; per-row collapse. → ledger L179
- 2026-08-07 — Attack cantrips auto-detected from spell text; "Not an attack" sticks. → ledger L212
- 2026-08-17 — Additional damage types (`extraDamage`); one damage formatter for row, breakdown and print. → ledger L2742, #30
- 2026-08-17 — Editing an attack keeps `itemId`/`spellId`/`source`/`save` (`carryAttackLinks()`). → ledger L2850
- 2026-08-17 — Spells carry their own extra damage; the cast dialog uses the row's formatter. → ledger L2863
- 2026-08-17 — Resync leaves player-edited attacks alone (`genFp`, three-valued `updAtkEdited()`). → ledger L2945
- 2026-08-18 — Damage-free save spells lose their row; detector reads flat bonuses and typeless damage. → ledger L2989
- 2026-08-18 — Attacks gain favourites and Collapse all. → ledger L3123
- 2026-08-18 — Weapons are equippable; their rows follow the equipped state; `migrateWeaponEquip()`. → ledger L3213
- 2026-09-28 — Pack magic weapons carry their properties' names and a finesse one attacks with `finesse`; the rules-update tool offers the fix to existing sheets. → ledger L4327, #72
- 2026-09-28 — A `+N` pack weapon adds its bonus once, to its own row, and nothing to other rows; the item form's Insert keeps a weapon's bonus and notes. → ledger L4392, #74
- 2026-09-28 — A ranged Finesse weapon (the Dart) attacks with the better of STR and DEX. → ledger L4466, #75
- 2026-09-28 — Spell attack rows take `spell.attack` effects and save rows `spell.dc`, through `spellDC()`; weapon rows take neither. → ledger L4568, #77
- 2026-10-02 — Ammunition: launchers fire from a loaded stack with Undo, bundles unpack on arrival, recovery at End combat and on the row, the loaded +N. → ledger L4952, #6
- 2026-10-13 — A to-hit, damage or save DC an effect lowers is red with ▼; the breakdown reddens that effect's line. → ledger L5700, #89
- 2026-10-23 — The card moves, unchanged, from the Sheet to the top of the Inventory tab, its note, combat-view place and #97 pencil with it. → ledger L6633, #103
- 2026-10-24 — The ☰ section flyout is retired; `.inv-sec-head` gives the card its heading style only. → ledger L6804, #103
- 2026-11-06 — A weapon arrives equipped with its row from a grant and from the item form, as from the finder, through `equipNewWeapon()`; `newCharacter()` sets `wpnEquipInit`. Armour and shields arrive unequipped. → ledger L9101, #128
- 2026-11-06 — A spell's row takes `spellFxList()`: `spell.attack` and the effects ticked Include spells, as the card and the cast window do; a save row shows its ticked damage. → ledger L9101, #129
