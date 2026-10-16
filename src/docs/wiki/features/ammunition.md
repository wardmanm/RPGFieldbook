# Ammunition

A bow, crossbow, sling, blowgun or firearm knows the kind of ammunition it fires, and a stack of
ammunition knows its kind and any magic bonus. Ammunition arrives in bundles in the rules data
("Arrows (20)") and unpacks into single pieces the moment it reaches a sheet, so a stack's quantity
is its count.

**Code:** `ammoKindOf()`, `itemAmmo()`, `weaponAmmoKind()`, `ammoRepairDef()`, `ammoStacks()`, `loadedStack()`,
`unpackAmmo()`, `ammoTable()`, `rebaseAmmo()`, `migrateAmmo()`, `ammoSpentEntry()`, `fireAmmo()`,
`undoFire()`, `ammoRecoverable()`, `recoverAmmo()`, `attackAmmo()`, `forgetAmmo()`,
`forgetGrantAmmo()`, `ammoAskDue()`, `markAmmoAsked()`, `ammoLineHTML()`, `ammoChoiceHTML()`,
`fireWeapon()`, `undoFireTap()`, `openAmmoPicker()`, `loadAmmo()`, `recoverWeaponAmmo()`,
`offerAmmoRecovery()`, `ammoKindChoices()`, `ammoKindLabel()`, `ammoKindOptionsHTML()` in
`62-ammo.js` · `tidyRule()` in `89-rules-merge.js` · `openItemForm()` in `80-modal-forms.js` · `migrate()` in `71-char-io.js` ·
`revertEquipmentGrants()` in `50-classrace.js` · `newCharacter()` in `75-home-theme.js` ·
`updProject()` in `72-char-update.js` · `endCombatAsk()` in `87-combat.js` · **Data:** `weapon.ammo`,
item `ammo`, bundle `pack` ([rules-schema](../../../../docs/rules-schema.md) §6.8) · **Tests:**
`sheet.js`, `char-update.js`, `rules-data.js` · **See also:** [Inventory](inventory.md),
[Attacks & damage](attacks-and-damage.md), [Combat view](combat-view.md),
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

**Packs from before ammunition.** A pack written before ammunition — the 2024 pack players have
was published with 1.7.2 — has no `weapon.ammo`, `ammo` or `pack` at all. `ammoRepairDef()` fills
them in from the same tables the pass below uses (`AMMO_LAUNCHERS`, `AMMO_SINGLE_NAMES`,
`AMMO_BUNDLES`, with each bundle's piece from `AMMO_PIECES`), only where the entry lacks them: a
pack's own value always wins, and nothing outside the tables is touched. `tidyRule()` runs it on
every item, so every path that loads rules — a merge, a fetch, Settings → Import, both cache
restores — leaves the pool reading as the current packs do, and every copy made from it (the
finder, starting equipment, Insert from pack) is ammunition. The weapon is copied, never edited in
place.

**Sheets from before ammunition.** `migrate()` runs `migrateAmmo()` once per character per
`AMMO_PASS`, guarded by `ammoInit`, which is never defaulted in `blankChar()` — `newCharacter()`
sets it to `AMMO_PASS` directly on the character it creates, since a fresh sheet has nothing for the
pass to migrate. Pass 1 was for sheets saved before ammunition. Pass 2 runs it once more over sheets
whose copies were made from a pack older than ammunition after pass 1 had run, or on a sheet made
since. Every step touches only an item that is not yet ammunition — a bundle the player already
marked as ammunition by hand keeps their count — so a second run changes nothing it already did.
It works from
each item's own data through built-in tables (`AMMO_PIECES`, `AMMO_SINGLE_NAMES`, `AMMO_BUNDLES`,
`AMMO_LAUNCHERS`), because no rules pool can be relied on at load. Every lookup into one of those
tables is by own property (`ammoTable()`), never plain indexing: an item named "constructor" or
"__proto__" otherwise finds an inherited property — an object or function, never `undefined` — and
the pass throws reading `.name` off it, which used to stop the whole character loading.

- known bundles unpack, the 2014 names into their 2024 piece. Each piece costs and weighs the
  bundle's own figure divided by the count, so a price the player paid survives, and a finder
  copy's description gets the piece's meta line in place of the bundle's;
- known pieces learn their kind;
- known 2024 launchers learn what they fire.

`rebaseAmmo()` re-takes the update tool's baseline for the fields the pass wrote, so the change
reads as the pack's. The copy side moves only where the player hadn't edited that field, so an edit
of theirs still reads as theirs. The pack side takes the piece's own projection where the pass knows
it, and otherwise follows the copy only where the copy matched the pack, so an older pack change the
player never applied still shows. An unpacked bundle joins a stack of the same piece, bonus and
grant — the one the player already had, wherever it sits, else the first bundle unpacked — and
stacks the player kept apart stay apart.

**The attack row.** `ammoLineHTML()` draws the line under the damage line and outside the
collapse: the loaded stack (a picker button when there is more than one), Fire (disabled when
nothing is loaded), and Recover N when N > 0. The picker button opens `openAmmoPicker()`, whose
rows (`ammoChoiceHTML()`) read the stack's name, its `×qty`, and its bonus as `· +N`/`· -N` when it
carries one, so a plain and a magic stack of the same piece read apart.

**Firing and Undo.** `fireAmmo()` takes one piece, removes the stack at its last, and counts
the shot in `ammoSpent[stack id]` as `{n, kind, snap, asked}` — rebuilt every shot, so it carries
the previous entry's `asked` forward by hand rather than losing it. `undoFire()` puts back one
piece, or the whole stack at its old place, and the whole entry, `asked` included. An Undo for
another character, or for a stack the player deleted since, does nothing.

**Recovery.** `ammoRecoverable()` gives half of each stack's count, rounded down per stack, and
summed per kind. `recoverAmmo()` adds it back: into an equivalent stack already on the sheet (not a
bundle, the same lower-cased trimmed name, bonus and grant as the `snap`) when one exists —
repointing any weapon whose `ammoStack` named the old id — else it rebuilds the stack from `snap`
under the old id, as before; either way it clears those counts. `offerAmmoRecovery()` asks after
End combat only when `ammoAskDue()` is true: some kinded entry has fired more since it was last
asked about (`n > asked`). Yes recovers and clears as above; No instead catches every entry's
`asked` up to its `n` (`markAmmoAsked()`), so a fight with no new shots asks nothing next time.
Either way Recover N on the row is unaffected — it always shows and recovers the full count,
`asked` or not.

**Forgetting a stack's count.** Deleting a stack takes its `ammoSpent` entry with it
(`forgetAmmo()`): there is nothing left to recover into. Removing the class or background that
granted a stack does the same, by the entry's own `snap.grant` rather than by id
(`forgetGrantAmmo()`), so a granted stack already fired down to nothing — and so already gone from
the inventory before the source itself is removed — still loses its count. See
[Grants & provenance](../architecture/grants-and-provenance.md).

**The +N.** `attackAmmo()` gives the loaded stack's bonus to `attackNumbers()`, for attack and
damage alike.

**The item editor.** `openItemForm()` ([Inventory](inventory.md)) learned the ammo fields, so a
homebrew bow or arrow works like a pack one. `ammoKindChoices()` lists the five 2024 kinds, then any
other kind already on the sheet (an ammunition item's or a weapon's), then the kinds the form opened
with, so an item's own kind is always on its list; `ammoKindOptionsHTML()` draws the `<select>` —
None first when asked, each kind, then "Other…" (`__other`), which opens a box for a new kind. A
weapon's **Ammunition it fires** select saves `weapon.ammo`; refusing to save — alerting instead —
only when Other… is chosen and the box is left blank. The **Ammunition** toggle shows **Kind** and a
**Bonus to attack and damage** select (+0 to +3, plus the item's own bonus if it's outside that
range); saves `ammo:{kind,bonus}` (bonus omitted at +0), and refuses the same way when Other… is
blank. **Insert from pack** runs the new item through `unpackAmmo()` first, so picking "Arrows (20)"
fills the form with Arrow ×20 already marked as ammunition — the one place the form's quantity box
is filled for the player. Save always carries `ammoStack` and `pack` from the item being edited,
since neither is on the form.

## Rules that must hold

- **Per-character ammo state never goes inside `weapon`.** The rules-update tool owns `weapon`: a
  value there reads as the player's edit, and an applied update wipes it.
- **The pass re-baselines only what it wrote, and never over a player's edit.** Re-baselining more
  would hide a real pack change; re-baselining an edited field would let an update overwrite it.
- **The pool repair only fills what is missing.** A pack that names its own kind, bonus or bundle
  keeps it; `ammoRepairDef()` never overwrites, and never edits a weapon object in place, since the
  pack object behind it may be shared.
- **A new pass means a new `AMMO_PASS`**, never resetting `ammoInit`: a sheet already at the number
  must be left alone, and every step of the pass must stay a no-op on a migrated item.
- **The app's tables agree with the data.** `rules-data.js` reads `data/srd52/items.json` and fails
  on any launcher, bundle or piece the tables lack or disagree with; the private suite checks the
  2024 pack the same way ([Private data](../data/private-data.md)).

## Traps

- **A redraw replaces the Fire button**, so keyboard focus is put back by `ammoFireBtn()`.
- **Enter on a focused button clicks on key-down and auto-repeats**, which is why the Undo ignores
  `e.repeat`. Space clicks once, on key-up.
- **The harness's DOM stubs return no elements**, so the focus paths are only exercised in
  Playwright.
- **A pass that runs once misses everything copied after it** (#96). Pass 1 repaired the sheets of
  the day, but the pack players had still lacked ammunition, so every launcher and bundle added
  later — and every sheet made since, which skips the pass — arrived bare. Fixing the pool, not
  only the sheets, is what stops that; pass 2 mends what had already arrived.
- **A second pass re-enables a launcher the player set to "None"**, as the first did. Since the
  item editor's select is only days older than the bug, a bare launcher is far likelier to be the
  bug than a choice; setting None again sticks, since the pass does not run again.
- **An unpacked bundle's copy keeps the bundle's own text**, so after the pass the update tool can
  offer the piece's pack description. A fresh finder copy takes the piece's text directly.
- **A bundle the player marked as ammunition is theirs.** The obvious workaround for #96 was ticking
  Ammunition on "Bolts (20)" and typing the bolts left. Unpacking it would multiply that count by
  twenty, so the bundle step skips any item that is already ammunition (caught in review).
- **A launcher the player gave a kind by hand, copied from the bare pack**, keeps its bare baseline
  (the pass skips it), so against the repaired pool the update tool lists a `weapon` change. Applying
  it is harmless, and the data release would list the same.

## Decisions

Settled with Mike on 2026-10-01 and 2026-10-02; the full discussion is in
[the spec](../../specs/2026-10-02-ammo-design.md) §2.

| Question | Decision | Rejected, and why |
|---|---|---|
| Where ammo is spent | A **Fire** button on the weapon's attack row, which the combat view already shows | The inventory row: away from the attack, and the inventory card is not in the combat view by default. Both: a second control for the same thing |
| How a weapon finds its ammo | **By kind, the player picks the stack**: a longbow takes arrows and loads the Arrow stack itself; with plain and +1 arrows both carried, the player chooses, and the choice is remembered | Always choosing by hand: a step every time for the common single-stack case. Kind only: no way to load the +1 arrows |
| Recovery | **Asked at End combat, plus a Recover button** on the row: half of what was fired since the last recovery, rounded down | A button only (the first answer, revised 2026-10-02): the prompt is where the player is when it matters. End combat only: shots fired outside a tracked fight would never come back |
| Bundles | **Unpack on arrival**: "Arrows (20)" ×2 becomes "Arrow" ×40, from the finder, starting equipment and Insert from pack; sheets already holding bundles unpack once on load | Unpack on first shot: inventories look inconsistent. Count inside a bundle: "×2, 7 left in the open one" |
| A stack at 0 | **Removed, like a potion**; recovery recreates it from a copy kept when it was spent | Keeping it at ×0: Mike chose removal; the copy makes recovery work regardless |
| The 2014 duplicates (Crossbow Bolt, Blowgun Needle, their bundles, the 2014 Net) | **Stop shipping them**: the converter honours `reprintedAs` | Leaving them: a second kind of bolt in the stack picker. A separate issue: they are in the way of this one |
| Magic ammunition | **Included**: the converter reads 5e-tools' magic variants for ammunition | Out of scope: Mike wants it now |
| The item editor and pack format | **Both** learn the ammo fields | The editor only: homebrew packs could not mark ammo weapons |
| Recover N's visibility | **Shows only when N > 0** | While `ammoSpent` holds anything: a single stray shot gives nothing back, so a "Recover 0" button would be noise. Counts keep accumulating until a recovery can return something |
| A pack older than ammunition (#96) | **The app fills in what it lacks, from its own tables, at load** (`ammoRepairDef()` in `tidyRule()`), and runs the sheet pass once more | Only a data release: players would stay broken until they downloaded it, and so would any older or homebrew pack naming the standard weapons. Only re-running the sheet pass: every copy made afterwards would arrive bare again |
| Merging an unpacked bundle | **Only into a stack of the same name, bonus and grant** | Merging any stack of the kind: would pull from a stack the player kept apart on purpose, and take back more than a removed class actually granted |

## Open

- Thrown weapons as their own ammunition (Dart, Javelin, Dagger).
- Firearm reloading and energy cells (XDMG).
- Magic variants outside the selection rule (BMT, AU, the 2014 DMG), and generic +N weapons.
- Containers (Quiver capacity).
- **2014-named single pieces keep their name on a sheet migrated before this branch.** "Crossbow
  Bolt" and "Blowgun Needle" learn the 2024 kind and fire (`AMMO_SINGLE_NAMES`), but `migrateAmmo()`
  never renames them, so the rules-update tool lists them as not in any loaded pack. Existing
  copies of the 35 dropped 2014 gear items ("Spell Scroll (1st Level)", "Rations (1 day)"…) show
  the same way.
- **Picker rows can look identical** when two grants each give "Arrow ×20": stacks of different
  grants stay apart by design (see Decisions, "Merging an unpacked bundle"), and nothing in
  `ammoChoiceHTML()` tells them apart. An origin hint on the row would.
- **Xanathar's five Adamantine Ammunition pieces carry rarity "Unknown"** (5e-tools writes
  "unknown"), which sorts first in the item finder's Rarity filter.

## History

- 2026-10-02 — Ammunition: launchers fire from a loaded stack with Undo, bundles unpack on arrival, recovery at End combat and on the row, the loaded +N. → ledger L4952, #6
- 2026-10-02 — The item editor sets what a weapon fires and marks ammunition, with a bonus; Insert from pack unpacks a bundle. → ledger L4978, #8
- 2026-10-02 — The final review's fixes: a hostile item name no longer stops a sheet loading; removing a class forgets its spent arrows; End combat asks only about new shots; recovery joins an equivalent stack; the picker shows +N. → ledger L4989, #6
- 2026-10-09 — The tables-agree-with-the-data check reads SRD 5.2 publicly and the 2024 pack in the private suite. → ledger L5426, #85
- 2026-10-16 — A pack older than ammunition is filled in at load (`ammoRepairDef()`), and the sheet pass runs once more (`AMMO_PASS` 2). → ledger L5780, #96
