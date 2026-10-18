# Ammunition recovery options and thrown weapons — design

**Status:** approved 2026-10-18, not yet built · wave 1 of [1.9.0](../wiki/roadmap/1.9.0.md)
**Issue:** #104 (ammo recovery should have options). Built on one branch, `issue/104-ammo-recovery`.
Extends the ammunition design of [2026-10-02](2026-10-02-ammo-design.md); read the
[Ammunition](../wiki/features/ammunition.md) page first.

---

## 1. What it is

A character chooses how fired ammunition comes back: half of it (the rules as written, and today's
behaviour), all of it, only the shots that hit, or none. A piece of ammunition can override that
for itself — firearm bullets never come back, and a weapon thrown always does unless the player
says otherwise. Thrown weapons (Dagger, Dart, Handaxe, Javelin, Light Hammer, Spear, Trident) get a
**Throw** button on their attack row that spends one from the weapon's own count, as Fire spends an
arrow. Ending a fight recovers what the rules give back on its own, says so, and offers an Undo,
instead of asking.

Why: the half rule is one table's choice among several, a bullet that comes back is wrong, and a
dagger thrown was never counted at all (the deferred "thrown weapons track no ammunition of their
own" in [Known issues](../wiki/roadmap/known-issues.md)).

## 2. Decisions

Settled with Mike on 2026-10-17 (the 1.9.0 page) and 2026-10-18 (this brainstorm). The rejected
options are recorded so they are not re-proposed without the reason they lost.

| # | Question | Decision | Rejected, and why |
|---|---|---|---|
| 1 | Where the rule lives | **Per character, Settings → Sheet display**, "Ammo recovery": Half (RAW) / All / Hits only / None | App-wide: two tables on one device can't differ |
| 2 | How Hits-only learns the result | **Fire asks Hit or Miss at once**, before the shot is counted; Undo reverses it | Tagging after the fact: untagged shots need a default. Two Fire buttons: a wider row, easy to mis-tap |
| 3 | Which shots come back in Hits-only | **Every hit comes back; misses are lost** | Half of the hits: harsher, and two rules to explain |
| 4 | Per-item recoverability | **An item's own `recover` (always / never) wins over the sheet's rule**, set in the item editor | The sheet's rule alone: a bullet and a javelin can't both be right |
| 5 | Where the defaults come from | **The app, by kind and property**: a firearm bullet never comes back, a Thrown weapon always does, unless the item says otherwise | Writing `recover` into the packs: every pack's digest moves and a data release (private packs too) is needed, for a default the app can know |
| 6 | None and an item set to always | **The item wins**: None is the sheet's default giving nothing back; a dagger is still picked up | None as a master switch: a thrown dagger would be lost for good on a table that doesn't use ammunition recovery |
| 7 | Thrown weapons | **A Thrown weapon throws itself**: Throw spends one from its own count | Only the field, thrown weapons later: "always" would have no user |
| 8 | A thrown weapon at ×0 | **Stays on the sheet at ×0, Throw disabled**, until recovery brings it back | Removed like an arrow stack: its attack row would vanish mid-fight |
| 9 | End combat | **Recovers on its own, with a toast and an Undo**, when anything is recoverable | Still asking Yes/No: a tap after every fight |
| 10 | Shots fired under one rule, recovered under another | **The rule is read at recovery**; a Hit/Miss answer is recorded whenever it is given; in Hits-only, an unanswered shot comes back at half | The rule in force at each shot: every shot would carry its own rule, and changing the setting would do nothing to shots already fired |

Decision 5 changes what the 1.9.0 page recorded on 2026-10-17 (`ammo.recover`, "allowed in pack
data"): the override is a top-level item field set in the item editor, and the pack format does
not change.

## 3. Data

**On the character** — one new field, two new counts:

- `character.ammoRecovery`: `"half"` | `"all"` | `"hits"` | `"none"`. `blankChar()` sets
  `"half"`, so every existing sheet keeps the behaviour it has today. `ammoRecoveryOf(c)` reads it,
  and anything else reads as `"half"`. It is in no other place: not `settings`, not a pack.
- `ammoSpent[id]` (the existing map, stack or weapon id → entry) gains `hits` and `misses`: whole
  numbers, read through `ammoSpentEntry()`, each clamped to [0, n] and `hits + misses` to n. An
  entry from before this has neither, which reads as 0 and 0: every shot unanswered.
  The entry's `asked` is no longer read or written (§6); an old entry keeps it, harmlessly.

**On an item** — one new optional field:

- `item.recover`: `"always"` | `"never"`; absent (or anything else) means "the sheet's rule". It is
  a top-level field, outside `ammo` and `weapon`, because the rules-update tool owns those: a value
  there reads as the player's edit and an applied update wipes it. Like `ammoStack`, every
  rebuild-from-form save carries it across ([Inventory](../wiki/features/inventory.md), "Every
  rebuild-from-form save carries what the form does not ask about"), and it is not in `UPD_FIELDS`.

**In the packs** — nothing. `rules-schema.md` does not change.

## 4. Who gets what back

### 4.1 The rule for one entry

`ammoRecoverRule(c, entry, item)` gives the rule that applies to one spent entry: the item's own
`recover` when it is `"always"` or `"never"` (the live item if it is on the sheet, else the entry's
`snap`); else the app's default (§4.2); else the sheet's rule, `ammoRecoveryOf(c)`.

### 4.2 The app's defaults

- An ammunition item of kind `firearm bullet` → `"never"` (`AMMO_RECOVER_DEFAULTS`, a kind table in
  `62-ammo.js` beside the others, read through `ammoTable()`).
- A thrown weapon (§5.1) → `"always"`.
- Anything else → none.

### 4.3 How much comes back

`ammoBack(rule, e)` for an entry `e = {n, hits, misses}`:

| Rule | Back |
|---|---|
| `always`, `all` | `n` |
| `half` | `floor(n / 2)` — today's rule, per entry |
| `hits` | `hits + floor((n − hits − misses) / 2)` |
| `never`, `none` | 0 |

`ammoRecoverable(c)` sums this per kind (a thrown weapon's kind is its own lower-cased name), listing
only kinds with something to give back, as now. `recoverAmmo(c, kinds)` gives back that many per
entry, by the paths it has today (onto the stack, onto an equivalent stack, or rebuilt from the
`snap`; for a thrown weapon, onto the weapon item, which is still there at ×0), and clears the
entries it recovered — and, as today, the entries of the kinds asked that give nothing back, since
their shots are spent. It returns a **recovery record** (§6) as well as the count.

**Recover N** on a row shows while N > 0. Under None it therefore shows only for an item whose own
`recover` is `"always"`, or a thrown weapon left on its default.

## 5. Firing and throwing

### 5.1 What a thrown weapon is

`weaponThrown(item)`: the item has a `weapon` whose `notes` list the property **Thrown** — the
notes are `·`-separated segments, the properties segment comma-separated (`Range 20/60 · Finesse,
Light, Thrown · Mastery: Nick`), and the match is a whole property, any case. Every thrown weapon in
the SRD 5.2 and 2024 packs carries it; a homebrew weapon gets it by typing the property into its
notes. A weapon that is also a launcher (`weapon.ammo`) is a launcher, never thrown.

### 5.2 The attack row

`ammoLineHTML()` draws, under a launcher's row, what it draws today. Under a thrown weapon's row it
draws the weapon's own count (`Dagger ×2`, no picker), **Throw** (disabled at ×0), and Recover N.
A thrown weapon's row is drawn whether or not it is equipped, as today.

### 5.3 Fire and Throw

- `fireAmmo(c, weaponItem, outcome)` — `outcome` is `"hit"`, `"miss"` or absent. It counts the shot
  as today, and adds one to `hits` or `misses` when an outcome is given.
- `throwWeapon(c, weaponItem, outcome)` — the thrown counterpart: one off the weapon item's own
  count (never below 0, the item stays), one on `ammoSpent[weaponItem.id]` with `kind` its
  lower-cased name and a `snap` of the item at qty 1; returns the same Undo record shape. Shares
  the entry-building code with `fireAmmo()`; it does not repeat it.
- `undoFire()` reverses either, exactly as today: the count back, and the entry as it was, outcome
  tallies included.

### 5.4 The Hit or miss question

On the DOM side, Fire and Throw ask first when the rule for that item (§4.1, ignoring the counts) is
`hits`: a small dialog, "Hit or miss?", with **Hit** and **Miss**; focus starts on Hit; closing it
(✕, Escape) fires nothing. Every other rule fires at once. A thrown weapon on its default is
`always`, so it never asks. The toast says which: "Fired an arrow · hit · 18 left".

## 6. End combat

`endCombatAsk()` keeps its "End combat at round N?" confirmation. Then, in place of
`offerAmmoRecovery()`'s question, `applyAmmoRecovery()`: when `ammoRecoverable()` has anything, it
recovers it all (§4.3) and its summary joins the End combat toast — "Combat ended after 7 rounds
(42 sec) · recovered 6 of 12 arrows, 2 of 2 daggers". The toast then carries **Undo recovery**,
which reverses exactly that recovery from its record (§4.3): every quantity it added is taken back
off the item it went onto (never below 0), every stack it rebuilt is removed while it still holds no
more than it was given, every weapon it repointed is pointed back, and every entry it cleared is put
back as it was. The Undo belongs to the character it was shown for and applies once. When nothing is
recoverable the toast says only that combat ended.

Shots fired outside a tracked fight are recovered too: End combat recovers whatever is outstanding,
as the row's Recover N does. `ammoAskDue()`, `markAmmoAsked()` and the `asked` count go.

## 7. Settings and the item editor

- **Settings → Sheet display**, under its *Cards* group or a new *Ammunition* group: "Ammo
  recovery", a dropdown (four choices, so a dropdown by the page's own rule): Half (rules as
  written) · All · Hits only · None, with one line of help: "What comes back after a fight. Thrown
  weapons and items set to Always come back anyway." Writes `character.ammoRecovery`, saves, redraws
  the Attacks card.
- **The item editor** (`openItemForm()`), for an ammunition item and for a thrown weapon: a
  "Recovery" select — "Sheet's rule" (with the app default named when there is one: "Default: never
  comes back", "Default: always comes back"), Always, Never. Writes `item.recover`, or deletes it for
  the first choice.

## 8. Edge cases

- **A sheet from before #104** has no `ammoRecovery` and no tallies: it reads as half, every shot
  unanswered — exactly today's behaviour.
- **The setting changed with shots outstanding:** read at recovery (decision 10).
- **Hits-only, an item set to always or never:** no question; the item's rule applies.
- **A thrown weapon deleted at ×0:** its count goes with it (`forgetAmmo()`, as for a stack).
- **A thrown weapon granted by a class or background:** removing the source forgets its count by
  the snap's grant (`forgetGrantAmmo()`), as for a granted arrow stack.
- **A thrown weapon whose stack is also equipped for melee:** Throw is only ever pressed by the
  player; melee attacks spend nothing.
- **Undo recovery after more play:** the record takes back only what it gave; anything fired since
  stays fired (its new entry is not one the record cleared).
- **Undo recovery after a switch to another sheet:** does nothing.
- **A hand-edited `hits` above `n`, or negative:** clamped on read (§3).

## 9. Testing

`sheet.js` (pure): `ammoRecoveryOf()` and its default; `ammoRecoverRule()` for every source (item
always/never, firearm bullet, thrown, sheet rule); `ammoBack()` across the table, including hits-only
with unanswered shots; `ammoSpentEntry()` clamping; `weaponThrown()` over the SRD weapons' notes, a
launcher, junk notes, and "Thrown" as a substring of another word (not a match); `fireAmmo()` with
each outcome and `undoFire()` restoring the tallies; `throwWeapon()` down to ×0 (the item stays) and
back through Undo; `recoverAmmo()` under each rule, None with an item set to always, onto a thrown
weapon at ×0, and its record; the recovery Undo after a later shot; the round trip of
`ammoRecovery`, `recover` and the tallies; a hostile `recover` value. The `ammoAskDue()` /
`markAmmoAsked()` tests go with the functions.

`rules-data.js` (source guards): the Throw, Hit and Miss hooks are wired; the Sheet display row and
the item editor's select exist and are wired; `ammoRecovery` is in `blankChar()`.

Playwright: Fire in Hits-only (a hit, a miss, closing the question), Throw a Dagger ×2 down to ×0
and Recover, End combat with arrows and daggers outstanding and its Undo recovery, the Settings row,
the item editor's select; both skins, a phone width.

## 10. Docs

[Ammunition](../wiki/features/ammunition.md) (the rule, the defaults, thrown weapons, the question,
End combat), [Combat view](../wiki/features/combat-view.md) (End combat no longer asks),
[Inventory](../wiki/features/inventory.md) (`recover`, the editor's select),
[Settings & updates](../wiki/features/settings-and-updates.md) (the Sheet display row),
[Character model](../wiki/architecture/character-model.md) (`ammoRecovery`),
[Known issues](../wiki/roadmap/known-issues.md) (the thrown-weapons line closes), the
[1.9.0 page](../wiki/roadmap/1.9.0.md) (History), the ledger, one UNRELEASED bullet.

## 11. Out of scope

- Writing `recover` into the packs (decision 5).
- Firearm reloading, energy cells, quiver capacity, magic variants outside the selection rule — the
  other deferred ammunition items stay deferred.
- A count for thrown weapons that are not in the player's inventory (an improvised throw).
- #105's combat-end dialog, which will show this recovery inside it; this branch keeps the toast.

## 12. Release note

For `UNRELEASED.md`, one bullet:

- Choose how ammunition comes back after a fight in Settings → Sheet display: half (the rules as
  written), all, only the shots that hit, or none. Firearm bullets never come back, and any item can
  be set to always or never. Thrown weapons such as daggers and javelins now have a Throw button
  that counts them, and they come back after the fight. Ending combat recovers ammunition on its own,
  with an Undo.
