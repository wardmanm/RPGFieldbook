# Ammunition — design

**Status:** implemented on branch `issue/6-ammo` · 2026-10-02 — see As built at the end
**Issues:** #6 (ammo items), #7 (pull item information to map ammo), #8 (update template for ammo).
All three land on one branch, `issue/6-ammo`. They share the item and weapon fields and cannot be
tested apart: the data gives the sheet something to read, and the sheet is what the data is for.
Built in three milestones (§10), each with its own commits.

---

## 1. What it is

A bow, crossbow, sling, blowgun or firearm knows what it fires. Its row on the Attacks card shows
the stack it is loaded with ("Arrow ×19") and a **Fire** button that spends one. Ending combat in
the combat view offers back half of what was fired, and a **Recover** button on the row does the
same outside a tracked fight. A stack of +1 arrows adds +1 to that row's attack and damage.

Ammunition arrives in bundles ("Arrows (20)"), and a bundle unpacks into its single pieces the
moment it lands on a sheet, so quantity is simply the count. The converter carries what 5e-tools
already says (which launcher takes which ammo, what is in a bundle), adds magic ammunition, and
stops shipping the 2014 duplicates that crowd the 2024 pack.

Why: a ranged character today tracks arrows in their head, and "Arrows (20) ×1" cannot say how many
are left.

## 2. Decisions

Settled with Mike on 2026-10-01 and 2026-10-02. The rejected options are recorded so they are not
re-proposed without the reason they lost.

| # | Question | Decision | Rejected, and why |
|---|---|---|---|
| 1 | Where ammo is spent | A **Fire** button on the weapon's attack row, which the combat view already shows | The inventory row: away from the attack, and the inventory card is not in the combat view by default. Both: a second control for the same thing |
| 2 | How a weapon finds its ammo | **By kind, the player picks the stack**: a longbow takes arrows and loads the Arrow stack itself; with plain and +1 arrows both carried, the player chooses, and the choice is remembered | Always choosing by hand: a step every time for the common single-stack case. Kind only: no way to load the +1 arrows |
| 3 | Recovery | **Asked at End combat, plus a Recover button** on the row: half of what was fired since the last recovery, rounded down | A button only (the first answer, revised by Mike on 2026-10-02): the prompt is where the player is when it matters. End combat only: shots fired outside a tracked fight would never come back |
| 4 | Bundles | **Unpack on arrival**: "Arrows (20)" ×2 becomes "Arrow" ×40, from the finder, starting equipment and Insert from pack; sheets already holding bundles unpack once on load | Unpack on first shot: inventories look inconsistent. Count inside a bundle: "×2, 7 left in the open one" |
| 5 | A stack at 0 | **Removed, like a potion**; recovery recreates it from a copy kept when it was spent | Keeping it at ×0: Mike chose removal; the copy makes recovery work regardless |
| 6 | The 2014 duplicates (Crossbow Bolt, Blowgun Needle, their bundles, the 2014 Net) | **Stop shipping them**: the converter honours `reprintedAs` | Leaving them: a second kind of bolt in the stack picker. A separate issue: they are in the way of this one |
| 7 | Magic ammunition | **Included**: the converter reads 5e-tools' magic variants for ammunition | Out of scope: Mike wants it now |
| 8 | "Template" in #8 | **The item editor and the pack format** both learn the ammo fields | The editor only: homebrew packs could not mark ammo weapons |

## 3. Data

### 3.1 In a rules pack

| Where | Field | Example | Meaning |
|---|---|---|---|
| a launcher's `weapon` | `ammo` | `"arrow"` | the kind of ammunition it fires |
| an ammunition item | `ammo` | `{"kind": "arrow"}` | what kind of ammunition it is |
| a magic ammunition item | `ammo` | `{"kind": "arrow", "bonus": 1}` | plus the bonus it adds to the attack **and** damage roll |
| a bundle | `ammo`, `pack` | `{"kind": "arrow"}`, `{"item": "Arrow", "qty": 20}` | its kind, and the single piece and count it unpacks into |

- **Kinds** are lower-case 5e-tools names of the single piece: `arrow`, `bolt`, `firearm bullet`,
  `needle`, `sling bullet`. A pack may invent its own (`dart pellet`); matching is a case-blind
  string compare after trimming.
- `bonus` is a whole number, absent for mundane ammo. It is a weapon-attack number, as
  `atkMisc`/`dmgMisc` are, so it stays out of `effects` (effects are character-wide).
- All three are documented in `docs/rules-schema.md` §6.8.

### 3.2 On a character

| Field | Where | Default | Meaning |
|---|---|---|---|
| `ammo` | an item copy | — | copied from the pack with the item, like `weapon` |
| `ammoStack` | a weapon item copy, **outside** `weapon` | — | the id of the stack the player chose to load; absent = pick by kind |
| `ammoSpent` | the character | `{}` | stack id → `{n, kind, snap}`: how many were fired from that stack since the last recovery, and a copy of the stack as it was at the last shot |
| `ammoInit` | the character | never set by `blankChar()` | the one-time unpack and kind pass has run (§3.3) |

- **`ammoStack` sits outside `weapon` on purpose.** `weapon` is a field the rules-update tool owns:
  a value inside it would make the copy read as player-edited, and an applied update would wipe it.
- **`snap`** is what lets recovery recreate a stack the last shot removed: a copy of the item (name,
  description, weight, cost, `ammo`, `src`, origin) with its qty set by recovery.
- `ammoSpent` joins `migrate()`'s map guard; readers coerce each entry. `ammoInit` follows the
  `wpnEquipInit` precedent: set on the character by the pass, never defaulted in `blankChar()`,
  so an old sheet runs the pass exactly once.
- `UPD_FIELDS.item` gains `"ammo"`, so a pack's later fix to an ammo item reaches its copies.

### 3.3 The one-time pass on existing sheets (`ammoInit`)

Runs once per character, from the item's own data, so it needs no rules pool:

- **Bundles unpack.** An item named like a known bundle ("Arrows (20)", "Bolts (20)",
  "Firearm Bullets (10)", "Needles (50)", "Sling Bullets (20)", and the 2014 "Crossbow Bolts (20)",
  "Blowgun Needles (50)") becomes its single piece ×(qty × count). Weight and cost per piece are the
  bundle's divided by the count. It merges into an existing stack of that piece.
- **Singles and launchers learn their kind.** A known single piece gets `ammo: {kind}`. A known
  XPHB launcher (Longbow, Shortbow, Light/Heavy/Hand Crossbow, Sling, Blowgun, Musket, Pistol)
  gets `weapon.ammo`, so an existing sheet can fire at once without waiting for the update tool.
- **Provenance stays honest.** A changed copy's update baseline is re-taken for the fields the
  pass changed, so the rules-update tool reads the change as the pack's and not the player's (an
  applied update later is a no-op). 2014-named pieces map to their 2024 kind.
- Anything not on the list is left exactly as it is.

## 4. Converter (#7)

All in `scripts/convert.py`. The output moves on purpose this time; the gate becomes "only these
files change, and only in these ways" (§11).

- **Launchers:** `convert_items()` sets `weapon.ammo` from `ammoType` ("arrow|xphb" → "arrow").
- **Ammunition:** an item whose 5e-tools type is ammunition gets `ammo: {kind}`. The kind comes from
  the piece itself (its family flag `arrow`, `bolt`, `bulletSling`, `bulletFirearm`,
  `needleBlowgun`; else its name, so XGE's Unbreakable Arrow is an arrow). A bundle's kind and
  `pack` come from `packContents` (item resolved through `load_item_index()` to its display name).
- **`reprintedAs`:** `pick_2024_preferred()`'s 2014 backfill skips an entry whose `reprintedAs`
  names an entry already selected. This drops Crossbow Bolt, Crossbow Bolts (20), Blowgun Needle,
  Blowgun Needles (50) and the 2014 Net. If any other category's output moves, the rule is
  narrowed to items rather than letting it move.
- **Magic ammunition:** a new reader for `magicvariants.json`, for **ammunition variants only**:
  a variant whose `requires` names an ammunition type (`A`, `A|XPHB`, `AF|…`) or an `arrow`/`bolt`
  flag. Each variant is selected exactly as other items are (`pick_sources()`: for the 2024 pack
  the 2024 book plus the free-subset flags, which admits XDMG +1, +2, +3 Ammunition and
  Ammunition of Slaying; for Xanathar's pack the book's own source, which admits XGE Walloping and
  Adamantine Ammunition) and expanded onto each **single** 2024 ammunition piece the pack ships,
  honouring `excludes`:
  - name `namePrefix + piece + nameSuffix` ("+1 Arrow", "Bolt of Slaying");
  - `rarity`, `attune` from `inherits`; weight from the piece; no cost (magic items carry none);
  - `ammo: {kind, bonus}` with `bonus` from `bonusWeapon`;
  - description from `inherits.entries`, its `{=…}` templates written out the way #78 writes out
    item entry templates, then flattened like any other item.
  The expanded items join `items-magic.json` (2024) and `data/xanathars/items-magic.json`.
- The app's one-time pass (§3.3) carries its own table of kinds, bundles and launchers, since it
  runs without a rules pool. A `rules-data.js` check reads the converted `data/5e2024/items.json`
  and fails if any ammo kind, bundle or launcher there is missing from the app's table, so the two
  cannot drift.

## 5. On the sheet: arrival

**`unpackAmmo(item, pool)`** turns a bundle into its single piece and returns it: from the pack's
own single-piece entry when the pool has it (stamped from that entry), else from the bundle itself
(name from `pack.item`, weight and cost divided). Called by:

- `addLibraryItems()` (the item finder): the finder's quantity multiplies bundles, so ×2 of
  "Arrows (20)" adds 40 arrows;
- `grantItemByName()` (starting equipment and background grants): "Arrows (20)" grants 20 arrows,
  and removing the class or background takes back exactly what it granted;
- the item editor's Insert from pack.

A new piece merges into an existing stack of the same item (same name and pack identity), as the
finder already merges by name.

## 6. On the sheet: the attack row (#6, #8)

A weapon row whose item has `weapon.ammo` shows, under its damage line:

`Arrow ×19   [Fire]   [Recover 6]`

- **The loaded stack** is `ammoStack` if that stack still exists and is of the right kind, else
  the first stack of the kind in inventory order. With more than one stack of the kind, the label
  is a button: it opens a small picker of those stacks (name, ×qty, +N), and the choice is saved as
  `ammoStack`. With none, it reads "No arrows" and Fire is disabled.
- **Fire** spends one from the loaded stack, adds one to `ammoSpent[stack.id]` (with a fresh
  `snap`), redraws and saves. The toast reads "Fired an arrow · 19 left" with **Undo**, which
  restores the stack (recreating it if that shot removed it) and the spent count together. From the
  keyboard, focus moves to Undo when the row's Fire button is gone or disabled. A row in the combat
  view works the same, being the same card.
- **The last piece** removes the stack (decision 5). The weapon then loads the next stack of the
  kind, if any.
- **Recover N** shows while `ammoSpent` holds anything of the row's kind: N is the sum, over the
  stacks of that kind, of half of each stack's count rounded down (13 plain and 4 +1 arrows fired →
  6 + 2 = 8). It adds each stack's half back (recreating a removed stack from its
  `snap`, with its original id so `ammoStack` still points at it), clears those entries, and says
  what came back. Fired but not recoverable (1 shot → 0 back) still clears.
- **The +N bonus.** `attackNumbers()` adds the loaded stack's `ammo.bonus` to `toHit` and
  `dmgBonus` for a weapon row; the breakdown (`openAttackBreakdown()`) names it ("+1 Arrow +1"),
  and print, which reads `attackNumbers()`, follows.

## 7. Recovery at End combat

`endCombatAsk()`, after its own confirm, looks at `ammoSpent`. If anything is recoverable it asks
once, listing each kind: "Recover ammunition? 6 of 13 arrows, 2 of 4 bolts". Yes recovers
everything (§6, Recover); No leaves it all on the Recover buttons. Nothing to recover asks nothing.

## 8. The item editor (#8)

- **A weapon** gains "Ammunition": None, or a kind (the five 2024 kinds, plus any kind an item or
  weapon on this sheet already uses, plus "Other…" for a new one). Saved as `weapon.ammo`.
- **Any item** can be marked "This is ammunition" with a kind and an optional bonus (+0 to +3).
  Saved as `ammo`.
- **Carried through save.** The form rebuilds `weapon` and the item record; `weapon.ammo`, `ammo`,
  `ammoStack` and `pack` are carried like `atkMisc`, `fav` and `src`.

## 9. Edge cases

- **A weapon with no ammo kind** (thrown weapons, melee) shows nothing new.
- **Deleting a stack** clears its `ammoSpent` entry (nothing to recover into, and the player chose
  to delete it); deleting the launcher leaves the counts, which belong to the ammo.
- **A character switch** with an Undo toast showing: the Undo carries the character, as the
  trackers' does, and does nothing on another.
- **Hostile data:** every ammo field is read through coercing readers; names and kinds reach markup
  only through `esc()`; a stack id reaches a selector only through `attrSel()`.
- **The rules-update tool** owns `ammo` and `weapon` (with `weapon.ammo`); it never touches
  `ammoStack`, `ammoSpent` or `qty`.
- **A pack without ammo fields** (an old pack, a homebrew one) still works: the one-time pass and
  the editor give kinds by hand, and a weapon without `weapon.ammo` simply has no Fire button.

## 10. Milestones

| | What | Closes |
|---|---|---|
| A | Converter and data: `weapon.ammo`, `ammo`, `pack`, `reprintedAs`, magic variants; `rules-schema.md` | #7 |
| B | The sheet: unpack on arrival, the one-time pass, the attack row (Fire, Undo, stack choice, Recover, +N), End combat | #6 |
| C | The item editor; docs | #8 |

## 11. Testing

- **`src/tests/converter.py`:**
  - every XPHB launcher carries its kind; every ammo item and bundle its `ammo`, every bundle its `pack`;
  - the 2014 duplicates and the 2014 Net are gone, and no other category's output moved;
  - the expanded variants: names, rarity, `bonus`, the written-out text, and that no bundle gets one;
  - the Xanathar's run yields Walloping and Adamantine pieces.
- **The data gate:** regenerate into a temp dir and diff against `data/`. Only `data/5e2024/items.json`,
  `data/5e2024/items-magic.json` and `data/xanathars/items-magic.json` change, and every change is one
  of §4's. The diff is summarised in the ledger.
- **`src/tests/sheet.js`:**
  - `unpackAmmo()` from the pool and from the bundle alone; merging;
  - the one-time pass (bundles, kinds, launchers, re-baselining, idempotence, nothing else touched);
  - loaded-stack choice; Fire to the last piece and removal; Undo after removal;
  - Recover's per-stack halving and recreation with the original id; the End combat summary text;
  - `attackNumbers()` with a +1 stack;
  - hostile ammo data through every new builder; the junk-list block;
  - `blankChar()`/`migrate()` round trip for `ammoSpent`.
- **`src/tests/char-update.js`:**
  - `UPD_FIELDS.item` with `ammo`;
  - a re-baselined copy reads as unedited;
  - a launcher update after the pass is a no-op.
- **`src/tests/rules-data.js`:** the editor's new controls are wired; the app's ammo table covers every kind, bundle and launcher in the converted data (§4); attribute escaping (automatic).
- **Driven in Playwright:**
  - add a Longbow and Arrows (20) ×2 from the finder (40 arrows);
  - Fire ×3 → 37 with Undo working;
  - add +1 arrows, switch the stack, and see the to-hit move by 1;
  - Fire the last arrow (the stack goes, Undo brings it back);
  - Start combat, fire 5, End combat, see the recovery prompt (accept), then Recover on the row after a fight outside the tracker;
  - a pre-branch sheet with "Arrows (20)" ×1 loads as Arrow ×20 with a working Fire;
  - the item editor marks a homebrew "Elven Arrow" as an arrow +1;
  - both skins, 1280 and 390.

## 12. Out of scope

- Thrown weapons as their own ammunition (Dart, Javelin, Dagger).
- XDMG firearms: energy cells, `reload`.
- Magic variants outside the selection rule (BMT, AU, the 2014 DMG), and generic +N weapons.
- Containers (Quiver capacity).
- The rest of `magicvariants.json`.

## 13. Release note

For `src/docs/UNRELEASED.md`:

> - Bows, crossbows, slings, blowguns and firearms now track their ammunition. The weapon's attack
>   row shows what it's loaded with and a Fire button that spends one (with an Undo); ending combat
>   offers to recover half of what you fired, and a Recover button does the same any time. Ammo
>   bundles like "Arrows (20)" unpack into single arrows when they reach your sheet, so the count is
>   always the number you have. Magic ammunition (+1, +2, +3, Slaying, Walloping, Adamantine) is in
>   the item finder, and a loaded +1 arrow adds +1 to the attack.

## As built (2026-10-02)

Built as designed, with these differences:

1. **`reprintedAs` covers both item files.** Mike broadened decision 6: 40 renamed 2014 duplicates
   no longer ship (5 in `items.json`, 35 gear items in `items-magic.json`).
2. **The data gate includes `data/5e2024/tables.json`.** Ammunition of Slaying's creature table is
   lifted once, as "Ammunition of Slaying Table".
3. **The fragment is `src/js/62-ammo.js`,** after `60-attacks.js`.
4. **Recover N shows only when N > 0** (§6 said "while `ammoSpent` holds anything"). A lone shot's
   count waits until a recovery can return something; End combat's Yes clears every count, as the
   rules lose that half.
5. **The one-time pass merges an unpacked bundle only within one grant,** with the same name and
   bonus, so removing a class still takes back exactly what it granted.
6. **Re-baselining** (§3.3): the copy side moves only where the player hadn't edited the field; the
   pack side takes the piece's own projection, else follows the copy only where it matched the
   pack. A finder copy's description gets the piece's meta line.
7. **Undo reverses one shot:** one piece back onto its stack, or the whole stack at its old place.
   A stack the player deleted since stays deleted.
8. **Spent counts are forgotten** when a stack is deleted and when the class or background that
   granted it is removed — including a granted stack already fired to nothing — so Recover cannot
   bring either back.
9. **A launcher's kind is its piece's kind.** `_ammo_type_kind()` resolves a launcher's `ammoType`
   through the item index, so a 2014 reference such as "crossbow bolt" reads as `bolt`. The 2024 pack's
   output is unchanged by it.
10. **The one-time pass merges wherever the stacks sit.** An unpacked bundle joins the stack of the
    same piece, bonus and grant the player already had, wherever it sits in the inventory, else the
    first bundle unpacked. The plan's code merged only into an earlier stack.
11. **An empty stack is never loaded.** A stack at ×0, which only hand-edited data can produce, is not
    offered, loaded or fired.
12. **An Undo applies once.** A double-click on the toast's Undo puts back one piece, not two.
13. **A second release note** covers the item editor's ammunition controls, beside spec §13's.
14. **End combat asks only about new shots.** Each spent count remembers how many shots End combat
    last asked about; after a No, a later fight with no new shots asks nothing, while Recover N
    keeps the full count.
15. **Recovery joins an equivalent stack** (same piece, bonus and grant) when the original stack is
    gone, and a weapon loaded with the old stack is loaded with that one.
16. **A new character never runs the one-time pass** (`newCharacter()` sets `ammoInit`).
