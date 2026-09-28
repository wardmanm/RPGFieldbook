# Vitals & rest

The Vitals card and the Rest & Recovery card on the Sheet tab. Vitals holds the stat strip (AC,
Initiative, Speed, Size, Passive Perception), the Inspiration star, and the Hit Points panel —
Current, Max and Temp boxes, − and + buttons, and the death-save row. Rest & Recovery holds Short
Rest, Long Rest and the Hit Dice. This page covers how hit points are typed and spent, the Max HP
lock, the level-1 seed, the colour bands, the three Hit Dice looks, and what each rest gives back.

**Code:** `applyHPInput()`, `adjustHP()`, `renderHP()`, `hpBand()`, `signedEntry()`,
`signedDelta()`, `entryDigits()` in `66-coins-hp.js`; `clampHP()`, `effMaxHP()`, `buildDeath()` in
`00-constants.js`; `longRest()`, `shortRest()`, `hitDicePool()`, `renderHitDice()`, `hdStyle()`,
`hdFullHTML()`, `hdCondensedHTML()`, `hdDiceHTML()`, `hdPips()`, `rollHitDie()`,
`recoverHitDice()`, `renderDeath()` in `65-resources.js`; `level1HP()`, `seedLevel1HP()`,
`resyncLevel1HP()`, `hitDieMax()` in `56-class.js`; `charSize()`, `sizeOptionsHTML()`,
`capacityFor()` in `25-origins-items.js`; `openSizePicker()` in `80-modal-forms.js`; `bumpHP()`,
the padlock, death-save and hit-dice handlers in `90-boot.js` · **Tests:** `sheet.js`,
`char-update.js`, `rules-data.js` · **See also:** [Character building](character-building.md) (hit
points on level-up), [Armor & AC](armor-and-ac.md), [Inventory](inventory.md) (encumbrance),
[Combat view](combat-view.md), [Class resources](class-resources.md)

## How it works

**The stat strip.** AC, Initiative and Speed tap through to their breakdowns (`data-stat`); AC is
[Armor & AC](armor-and-ac.md), and Speed is its base plus `speed` effects, then encumbrance.
**Size** is `charSize()`: the size the player chose, else the ancestry's (`raceDefSize()`), else
Medium. Tapping it (or Enter/Space) opens `openSizePicker()` — a chooser, not a breakdown, with
"From ancestry (…)" first and a carrying-capacity preview from `capacityFor()`. The same list,
`sizeOptionsHTML()`, is in Settings → This character. Size changes nothing but carrying capacity,
and that only while Encumbrance is on. Passive Perception is covered in
[Abilities & skills](abilities-and-skills.md); the ✦ star in the card label toggles Inspiration.

**Typing hit points.** The three boxes are `type="text" inputmode="tel"` with `data-hp`, **not**
`data-path`, and commit on `change` (blur) or Enter, which reselects the box for the next entry.
`applyHPInput()`:

1. Ignores anything but `cur`, `max` and `temp`.
2. Refuses Max while it is locked, and repaints.
3. In Current or Temp, a signed negative (`signedDelta()`: "-7") is damage → `adjustHP()`.
4. Otherwise `signedEntry()`: "12" sets, "+4" adds, "-3" subtracts (Max only, by now), blank clears,
   and anything else ("1 2", "+ab") returns `null` and the box is put back. Then `clampHP()`.

`entryDigits()` is the shared digit grammar — a space after the sign is allowed, inside the digits
it is not. A negative in Max lowers your maximum, not damage; `clampHP()` then drags Current down
and Temp is untouched.

**Damage and healing.** `adjustHP(delta)` is the one HP-delta path — the − and + buttons
(`bumpHP()`, ±1), typed damage, and a spent hit die. Damage soaks Temp first; spent-out Temp reads
`""`, as a long rest leaves it; the overflow comes off Current. Healing goes to Current only.
`clampHP()` then floors all three at 0 (a blank stays blank) and caps Current at `effMaxHP()`, which
is Max plus any `hp.max` effects; `#maxNote` shows the effective maximum when an effect applies.

**The Max HP lock.** `hp.locked` (default `true`) is read as `!==false`. `renderHP()` makes Max
`readOnly` and draws the padlock (`[data-hplock]`, an inline SVG with both shackles, toggled by
`.hp-lock.open`); `applyHPInput()` refuses Max again, because `readOnly` does not stop a paste.
Tapping the padlock toggles it with no confirm, and focuses Max when opening. A level-up opens it;
the level's hit-points step puts it back as it was ([Character building](character-building.md)).
Adding a second class opens it too, and so does a first class that starts above level 1.

**The level-1 seed.** `level1HP(d)` is max(1, hit die + CON modifier), with CON read by `modOf()`
from the typed score; it returns 0 for a die it cannot parse. `seedLevel1HP()` writes it to Max
(and to Current if that is blank) when the class being added is the sheet's only one **and** Max is
blank, whatever level it starts at, and returns whether it wrote. A first class that starts above
level 1 then opens its window with the level-up hit-points step for levels 2..N (so "roll 2d10" for
a level-3 Fighter), whose `hint` says level 1 is already counted; the step is offered only on top
of a seed, never over a Max the player typed first. A second class never seeds: its levels get the
same step with its own die ([Character building](character-building.md)).
`resyncLevel1HP(prevCon)` runs on every CON keystroke: while there is one class at level 1
and Max still holds what the *previous* CON would have produced, it rewrites Max for the new CON and
keeps a full Current full. `removeClass()` blanks Max (and Current) only when the class removed is
the only one, at level 1, and Max still equals the seed.

**Colour bands.** `hpBand()` returns `hp-warn` at or below 50% of `effMaxHP()` and `hp-danger` at or
below 25%; nothing when no maximum is set or `character.hpColor` is `false` (Settings → This
character → Colour current HP). Temp is not counted. `--warn` is its own token in all four palettes.

**Death saves.** `buildDeath()` draws three circles per side: `○○○ – ☠ – ○○○`, failures left,
successes right. Clicking circle *i* sets the count to *i*, or to *i* − 1 if it was already *i*. The
failure set is `flex-direction:row-reverse`, keyed off `data-kind="fail"`, so both sides fill
outward from the skull. The skull is written `&#9760;&#65038;`. Only a long rest clears them;
nothing rolls them or resets them on healing.

**Hit Dice.** `hitDicePool()` groups dice by size, d12 first. In auto mode each class contributes
its hit die × its level; in manual mode the pool is parsed from the text field ("2d8 + 1d6"). Spent
dice live in `hdUsed[die]`, clamped to the total. `renderHitDice()` writes the auto pool back into
`character.hitdice`, shows the text field only in manual mode (with a "Reset to class" banner), and
draws an empty state with no class and no manual dice. Switching to manual asks first — the dice will
stop following the class at level-up; switching back does not. The look is `hdStyle()`, chosen
under Settings → This character → Hit Dice display:

- **Full** (the default): a boxed cell per die size — die, "left / total", pips, Roll.
- **Condensed**: one line per size — die, pips, "3/5", Roll — in `.hd-grid`, whose rows are
  `display:contents` so a multiclass pool lines up column by column.
- **Dice**: every die a token. Tap an unspent one to roll and heal; tap a spent one to put back
  exactly one.

In Full and Condensed, clicking pip *i* marks *i* spent (or *i* − 1 if already *i*), without healing.
Putting a die back never un-heals. `rollHitDie()` rolls the die, adds the CON modifier from
`abilFinal()` (items and statuses included), heals at least 0 through `adjustHP()`, and shows the
working.

**Rests.** `longRest()` sets Current to the effective maximum (if one is set), clears Temp and death
saves, restores every spell slot, gets back half the total Hit Dice (at least one, largest die
first — `recoverHitDice()`), and resets short- and long-rest feature uses, item uses and resources.
`shortRest()` restores Warlock pact slots and short-rest feature uses, item uses and resources, and
reminds the player to spend Hit Dice. Both end in a summary of what came back.

## Rules that must hold

- **HP boxes are not `data-path`.** That handler writes on every keystroke, so "-3" would store "-"
  at the first character. Because they are outside the `[data-path]` loop, `renderHP()` is called in
  `renderAll()` — the character-load path — or the boxes load blank over a correct model and the
  first blur writes `""` over real HP.
- **Every HP change ends in `clampHP()`**, which is model-only and testable. The ceiling is not in
  the parser: coins share `signedEntry()` and have no maximum.
- **`adjustHP()` is the only damage path** and stays out of `90-boot.js`, which the harness drops.
- **The automatic writers bypass the lock.** `seedLevel1HP()`, `resyncLevel1HP()`, `removeClass()`'s
  un-seed and the level-up step write `character.hp.max` directly; routing them through
  `applyHPInput()` would leave a locked level-1 character with no hit points.
- **`level1HP()` is the one formula for three callers** — seed, resync, un-seed — which must agree to
  the number, so it reads CON with `modOf()`. An effects-aware seed would stop matching minutes later
  and the clean revert would stop firing, silently.
- **Floor at 1.** `effMaxHP()>0` means "a maximum is set" in `clampHP()` and `longRest()`, and
  `level1HP()` returns 0 for "no die".
- **Nothing sits between `#hdWrap` and `.hd-grid`, or inside it.** `.hd-row{display:contents}` is
  the column alignment, and it breaks silently and only on a multiclass sheet. The manual-mode
  banner stays outside the grid, where it would otherwise size the columns. `rules-data.js` asserts
  the CSS and that the builder puts `.hd-row` directly inside `.hd-grid`.
- **`hdStyle()` falls back to `"full"`, the `blankChar()` default**, so older sheets need no
  migration.
- **Both cards are note anchors** (`vitals` and `rest` in `NOTE_SECTIONS`); removing either orphans
  its notes.
- **`wire()` binds these buttons through a null-safe helper.** It has no `try`; one missing id used to
  throw and leave every later listener unbound.

## Traps

- **An inert sheet with a clean console.** Five unguarded `getElementById(...).addEventListener`
  calls (star, ±, both rests) all pointed at markup the Vitals restructure moved; one bad id stops
  every listener after it. `recompute()`'s star lookup is guarded for the same reason.
- **`type="number"` sanitizes a leading `+` to empty**, and iOS's numeric pad has no sign keys —
  hence `text` with `inputmode="tel"`.
- **Adding CON to the seed without `resyncLevel1HP()` was a regression**: seed at CON 10, type 16,
  and Max no longer equals what `removeClass()` recomputes, so a d10's HP survives onto a d6.
- **A character created above level 1 had no hit points.** The seed was gated on *total* level 1
  and nothing asked for the levels above it, so a first class added at level 3 left Max and Current
  blank; a Wizard added next then read "Max HP 0 → 4". The old test asserted exactly that
  ("starting above level 1 does not seed HP") and was inverted with the fix (#66).
- **`bumpHP` once had no floor** (holding − went to −7), and an `applyHPInput()` guard written as
  `k in character.hp` would have let a `data-hp="locked"` hook write a boolean.
- **`recompute()` does not call `renderHP()`**, so anything that changes the lock renders it itself.
- **The dice style was first built with pip semantics** — tap a spent die and get several back.
  Caught in a live click-through. The comment above `hdDiceHTML()` still describes those semantics;
  the handler in `90-boot.js` returns exactly one.
- **The layout guards once encoded nesting.** `rules-data.js` sliced "to the next card" and "to the
  first `</div>`"; moving a block broke them for reasons unrelated to what they guarded. They now
  use a `block` helper that counts divs, and each was mutation-tested.

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| Where HP's upper bound lives | `clampHP()`, run by every HP-changing path | A `max` argument on the parser: coins have no max, and the bound must also hold for ±, hit dice, rests and lowering Max |
| How HP boxes commit | On `change`, outside `data-path` | `data-path`: commits every keystroke, storing a bare sign |
| Where the lock flag lives | `hp.locked`, inside `hp` | A top-level `hpLocked`: `migrate()` already merges `hp` onto defaults, so every old sheet gains the field with no code |
| Whether the padlock confirms | No confirm | Confirming like the manual Hit Dice switch: that is a mode change with consequences, this is undone by a second tap |
| CON in the level-1 seed | `modOf()` of the typed score | `abilFinal()`: effects change minutes later and the un-seed match would fail silently |
| CON when spending a hit die | `abilFinal()` | Harmonising with the seed: the value is consumed at once and never re-derived |
| Tracking CON edits after the seed | Stateless: recompute what the previous CON would have written and match it | A new character field: no migration surface, and an old sheet upgrades on its first CON edit |
| A first class that starts above level 1 | Seed level 1, then the level-up HP step for levels 2..N (average by default) | No hit points at all, as before #66; or several dice boxes, one per level — the one box already takes a total and "Roll for me" rolls all of them |
| Temp HP in the colour bands | Excluded | Included: it sits above the maximum and could read healthy while the real pool is empty |
| The amber band's colour | A new `--warn` token | `--accent`: equals `--brick` on the classic skin, so the two bands would match |
| Default Hit Dice look | Full (owner's call): it speaks the same language as the Vitals strip and the HP panel, at the cost of height | — |
| Tapping a spent die in the dice look | Puts back exactly one | Pip semantics: tokens are interchangeable, and getting three back contradicts the tooltip |
| Where the Hit Dice sit | Rest & Recovery, under the rest buttons | Under Hit Points in Vitals: they rode into the combat view by default, between the player and the hit points |
| Death saves filling outward | CSS `row-reverse` off `data-kind="fail"` | `buildDeath()` counting backwards: the click handler and `.on` toggling would have to change |
| Size on tap | A chooser | A breakdown like the other boxes: size is a choice, not a derived number |

## Open

- The dice look cannot mark a die spent without healing; Full and Condensed can, and the settings
  hint says so.
- There is no box to type a base Speed: `character.speed` is only ever written by the ancestry seed,
  so a custom ancestry reads 0 plus effects. Swapping ancestry keeps the first one's speed and size
  ([Character building](character-building.md)).
- The level-1 resync stops at level 2 by design; from there Max is a total the app never computed.
- `removeClass()` un-seeds only a level-1 class. A first class added at level 3 and then removed
  keeps the Max its window added (seed plus levels 2–3), as a levelled-up class always has, so
  re-adding a different class does not seed over it. Recording what the app wrote per class would
  close this; not done.
- See [Known issues](../roadmap/known-issues.md).

## History

- 2026-08-10 — level-1 Max HP seeded from the hit die, and cleared again by `removeClass()`.
  → ledger L1174
- 2026-08-11 — Vitals restructured: signed HP entry, `clampHP()`, the `○○○ – ☠ – ○○○` death row,
  and a Rest & Recovery card holding the rests and Hit Dice. → ledger L1614
- 2026-08-11 — Size shown in Vitals, with a picker. → ledger L1711
- 2026-08-14 — CON in the level-1 seed, kept in step by `resyncLevel1HP()`; damage spends Temp
  first. → ledger L2035, #24, #28
- 2026-08-14 — Max HP lock, Hit Dice moved under Hit Points, current-HP colour bands, and three Hit
  Dice looks. → ledger L2105
- 2026-09-25 — every level-up asks for hit points. → ledger L3548, #58
- 2026-09-25 — Hit Dice back in Rest & Recovery, reversing their move into Vitals. → ledger L3676
- 2026-09-28 — a first class that starts above level 1 is seeded and asks for levels 2..N; it used
  to get no hit points at all. → ledger L3886, #66
