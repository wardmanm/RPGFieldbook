# Ammunition

A bow, crossbow, sling, blowgun or firearm knows the kind of ammunition it fires, and a stack of
ammunition knows its kind and any magic bonus. Ammunition arrives in bundles in the rules data
("Arrows (20)") and unpacks into single pieces the moment it reaches a sheet, so a stack's quantity
is its count.

**Code:** `ammoKindOf()`, `itemAmmo()`, `weaponAmmoKind()`, `ammoStacks()`, `loadedStack()`,
`unpackAmmo()`, `rebaseAmmo()`, `migrateAmmo()` in `62-ammo.js` · `migrate()` in `71-char-io.js` ·
`updProject()` in `72-char-update.js` · **Data:** `weapon.ammo`, item `ammo`, bundle `pack`
([rules-schema](../../../../docs/rules-schema.md) §6.8) · **Tests:** `sheet.js`, `char-update.js`,
`rules-data.js` · **See also:** [Inventory](inventory.md), [Attacks & damage](attacks-and-damage.md),
[Converter](../data/converter.md), [Rules-update tool](rules-update-tool.md)

## How it works

**Kinds.** A kind is the lower-case name of the single piece: `arrow`, `bolt`, `firearm bullet`,
`needle`, `sling bullet`, or one a pack invents. `ammoKindOf()` trims and lower-cases, so matching
is case-blind. A launcher's kind is `weapon.ammo` (`weaponAmmoKind()`). A stack's is `ammo.kind`,
with an optional whole-number `ammo.bonus` (`itemAmmo()`).

**Stacks.** `ammoStacks()` lists the stacks of a kind in inventory order. `loadedStack()` is the one a
weapon fires from: the stack the player chose (`ammoStack` on the weapon item, kept outside `weapon`
because the rules-update tool owns `weapon`) while it exists and is of the right kind, else the first
of its kind.

**Bundles.** `unpackAmmo()` turns a bundle into its single piece and the number one bundle holds:
the pool's own entry for the piece when it has one, else a piece made from the bundle with cost and
weight divided.

**Sheets from before ammunition.** `migrate()` runs `migrateAmmo()` once per character, guarded by
`ammoInit`, which is never defaulted. It works from each item's own data through built-in tables
(`AMMO_PIECES`, `AMMO_SINGLE_NAMES`, `AMMO_BUNDLES`, `AMMO_LAUNCHERS`), because no rules pool can be
relied on at load:

- known bundles unpack, the 2014 names into their 2024 piece. Each piece costs and weighs the
  bundle's own figure divided by the count, so a price the player paid survives, and a finder
  copy's description gets the piece's meta line in place of the bundle's;
- known pieces learn their kind;
- known 2024 launchers learn what they fire.

`rebaseAmmo()` re-takes the update tool's baseline for the fields the pass wrote, so the change
reads as the pack's. The copy side moves only where the player hadn't edited that field, so an edit
of theirs still reads as theirs. The pack side takes the piece's own projection where the pass knows
it, and otherwise follows the copy only where the copy matched the pack, so an older pack change the
player never applied still shows. An unpacked bundle joins an earlier stack of the same piece, bonus
and grant; stacks the player kept apart stay apart.

## Rules that must hold

- **Per-character ammo state never goes inside `weapon`.** The rules-update tool owns `weapon`: a
  value there reads as the player's edit, and an applied update wipes it.
- **The pass re-baselines only what it wrote, and never over a player's edit.** Re-baselining more
  would hide a real pack change; re-baselining an edited field would let an update overwrite it.
- **The app's tables agree with the data.** `rules-data.js` reads `data/5e2024/items.json` and fails
  on any launcher, bundle or piece the tables lack or disagree with.
