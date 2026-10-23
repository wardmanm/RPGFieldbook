# Vitals & rest

The Sheet's dark rail (the `vitals` section, #103) and the rest and level controls in the header
above it. The rail runs down the left: the portrait with the AC shield over its bottom edge, the
death saves `✓ ○○○ ☠ ○○○ ✗`, Init / Speed / Prof badges, the Hit Points bar (Current, Max and Temp
boxes inside it, − and + either side, the Max padlock beside its label), the Hit Dice bar, and Size ·
Passive Perception in small text. The header holds Short Rest, Long Rest, the Inspiration star and
the level ring with the XP. This page covers how hit points are typed and spent, the Max HP lock,
the level-1 seed, the colour bands, the hit-dice bar and its spend box, the level badge, and what
each rest gives back.

**Code:** `applyHPInput()`, `adjustHP()`, `renderHP()`, `hpBand()`, `signedEntry()`,
`signedDelta()`, `entryDigits()` in `66-coins-hp.js`; `clampHP()`, `effMaxHP()`, `buildDeath()` in
`00-constants.js`; `longRest()`, `shortRest()`, `hitDicePool()`, `renderHitDice()`, `hdBarHTML()`,
`hdSpendHTML()`, `hdFootHTML()`, `hdBoxOpen()`, `hdRefresh()`, `hdDiceEdited()`, `toggleHdMode()`,
`openHdSpend()`, `hdConMod()`, `hdHeal()`, `hdSpendCheck()`, `spendHitDie()`,
`rollHitDie()`, `recoverHitDice()`, `renderDeath()` in `65-resources.js`; `level1HP()`, `seedLevel1HP()`,
`resyncLevel1HP()`, `hitDieMax()` in `56-class.js`; `charSize()`, `sizeOptionsHTML()`,
`capacityFor()` in `25-origins-items.js`; `openSizePicker()` in `80-modal-forms.js`; `bumpHP()`,
the padlock, death-save and hit-dice handlers in `90-boot.js` · `xpProgress()`, `xpNumber()`,
`advancementFor()`, `advancementOf()` in `41-chips.js` · `levelBadgeHTML()`, `levelRingHTML()`,
`xpBarHTML()`, `renderLevelBadge()`, `renderSheetHead()` in `40-sheet.js` · `toggleInspiration()`
in `10-compute.js` · **Tests:** `sheet.js`,
`char-update.js`, `rules-data.js` · **See also:** [Character building](character-building.md) (hit
points on level-up), [Armor & AC](armor-and-ac.md), [Inventory](inventory.md) (encumbrance),
[Combat view](combat-view.md), [Class resources](class-resources.md)

## How it works

**The rail.** `.rail` re-points the page's tokens to `--rail-*`, so it is dark in light mode and
tinted in dark mode while the cards' own rules draw it ([Sections & layout](../ui/sections-and-layout.md)).
Every id `recompute()`, `renderHP()` and the death-save code paint kept its id when it moved here.
At ≤700px the portrait sits small at the left with the rest of the rail beside it.

**The badges.** AC (the shield), Initiative, Speed and the proficiency bonus tap through to their breakdowns (`data-stat`); AC is
[Armor & AC](armor-and-ac.md), and Speed is its base plus `speed` effects, then encumbrance.
**Size** is `charSize()`: the size the player chose, else the ancestry's (`raceDefSize()`), else
Medium. Tapping it (or Enter/Space) opens `openSizePicker()` — a chooser, not a breakdown, with
"From ancestry (…)" first and a carrying-capacity preview from `capacityFor()`. The same list,
`sizeOptionsHTML()`, is in Settings → Carrying. Size changes nothing but carrying capacity,
and that only while Encumbrance is on. Passive Perception is covered in
[Abilities & skills](abilities-and-skills.md). The ✦ star (`#starBtn`) is in the header;
`toggleInspiration()` flips `character.inspiration`, and `recompute()` paints `#starBtn` and the
combat view's own `[data-inspire]` star together.

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
is Max plus any `hp.max` effects; `#maxNote` shows the effective maximum when an effect applies,
and is empty (and hidden) otherwise.

**The HP bar.** The three boxes sit inside `.hp-bar`, "26 / 38" with "+3" temp at its right.
`renderHP()` sets the fill (`#hpFill`) to Current ÷ `effMaxHP()`, clamped 0–100 and 0 with no
maximum, and gives it the band class, so the bar itself turns amber or red.

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
character → Colour current HP). `renderHP()` puts it on the bar's fill and on the Current box.
Temp is not counted. `--warn` is its own token in all four palettes, as is `--rail-warn`.

**Death saves.** `buildDeath()` draws three circles per side: `✓ ○○○ ☠ ○○○ ✗`, successes left,
failures right. Clicking circle *i* sets the count to *i*, or to *i* − 1 if it was already *i*. The
success set is `flex-direction:row-reverse`, keyed off `data-kind="succ"`, so both sides fill
outward from the skull. The skull is written `&#9760;&#65038;`. Only a long rest clears them;
nothing rolls them or resets them on healing.

**Hit Dice.** `hitDicePool()` groups dice by size, d12 first. In auto mode each class contributes
its hit die × its level (and the class name, in `cls` — joined with " / " when two classes share a
size); in manual mode the pool is parsed from the text field ("2d8 + 1d6"). Spent dice live in
`hdUsed[die]`, clamped to the total. `renderHitDice()` writes the auto pool back into
`character.hitdice` and draws `#hdWrap`, in the rail under the HP bar, as one bar (`hdBarHTML()`):
its label "Hit dice" with "CON +2" at the right, then die and "left / total" per size, filled by
what is left. With no pool (no class, a class the loaded rules have no hit die for, or manual
dice that don't parse) it draws a hint instead, with the auto/manual pill and the dice field under
it, so a custom class can switch to manual and type its dice. **One look, not three**
(#103): the old Full/Condensed/Dice styles and their Settings row are gone; `character.hdStyle`
stays in `blankChar()`/`migrate()` so an old sheet round-trips, but nothing reads it.

**Spending one.** Tapping the bar opens "Spend a hit die" (`openHdSpend()`, `hdSpendHTML()`): one
row per die size — pick it (`[data-hdpick]`, disabled when none are left), nudge `used` ±1 with
`[data-hdused]` (clamped 0..total, never heals) — then either **🎲 Roll for me** (`rollHitDie()`)
or type a roll ("I rolled [ ] → Apply"), live-checked by `hdSpendCheck(die, typed)` (a whole number
from 1 to the die, else a reason why not) and previewed as "5 + CON 5 = 10 HP → 98 / 153" before
Apply calls `spendHitDie(die, roll)`. `hdConMod()` reads CON through `abilFinal()` (items and
statuses included — the value is spent the instant it's rolled, never re-derived, unlike the
level-1 seed's `modOf()`); `hdHeal(roll, conMod)` floors the heal at 0. `spendHitDie()` is
`rollHitDie()`'s old body, shared now by both paths: mark the die used, `adjustHP(heal)`, show the
working in a `restSummary()`.

**Where the auto/manual pill and the manual-dice field live.** `[data-hdmode]` and
`#hitdiceInput` come from one builder, `hdFootHTML()`, drawn in one of two places, never both: the
spend box's foot, or inline in `#hdWrap` under the hint when the pool is empty and the box is closed
(`hdBoxOpen()` checks `#mBody` for `#hdRollMe`). `openHdSpend()` removes the inline foot before it
opens the box. While the player types in the inline field, `renderHitDice()` redraws only the
`.hd-main` part above it, so the caret stays and dice that start to parse ("2d8") bring the bar
without taking the field away; the next full draw drops the field once there is a pool. The pill
runs `toggleHdMode()` (switching to manual asks first) and an edit to the field runs
`hdDiceEdited()` after the shared `[data-path]` handler has written and saved it. Both go through
`hdRefresh()`: an open box is drawn again from the new pool, keeping the picked die, so its rows and
Roll/Apply follow; with nothing left to spend from it closes and the inline field takes over; then
the keyboard goes back to the field (caret kept) or the pill. `renderHitDice()` still patches
whichever copy is in the document (readOnly, `.hidden`, value, the pill's text/class).
`.hidden` (the IDL property) is what has to do the
hiding, not `style.display`: the input's `hidden` attribute is written into the markup itself at
render time, and a cleared inline style would not override that attribute's own
`[hidden]{display:none}` rule the way an empty string used to when the input had no `hidden`
attribute to fight.

**The level badge and XP** (`#shLevel` in the header, `levelBadgeHTML()`). A ring holds the total
level (`#levelDisp`, which `recompute()` writes). In XP mode (`character.advancement`, read through
`advancementOf()`, "xp" unless it is exactly "milestone") the XP box (`data-path="character.xp"`)
and a bar follow: `xpProgress()` reads the XP (a number, or digits with commas, through
`xpNumber()`) against the character's ruleset's `advancement` table, else `SRD_ADVANCEMENT`
(`advancementFor()`), and gives this level's threshold (`cur`) and the next one's. The bar fills
within the level, `(xp − cur) / (next − cur)` clamped to 0..1 (Mike's ruling), so a character who
has just reached level 5 shows an empty bar; it is capped at 99% until the XP reaches the next
threshold, and full at the top of the table; then the ring becomes a "Level up ready" button that runs Level up.
XP that is not a number shows as typed, with no bar. Typing in the box repaints only the ring and the
bar (`renderLevelBadge()`), so the caret stays. **Milestone mode** shows the ring alone; the XP stays
in the data, so switching back restores it. The switch is Settings → Sheet display → Advancement.

**Rests.** The header's ☕ and ☾ icons (`#btnShortRest`, `#btnLongRest`) run them. `longRest()` sets Current to the effective maximum (if one is set), clears Temp and death
saves, restores every spell slot, gets back half the total Hit Dice (at least one, largest die
first — `recoverHitDice()`), and resets short- and long-rest feature uses, item uses and resources.
`shortRest()` restores Warlock pact slots and short-rest feature uses, item uses and resources, and
points at the hit-dice bar; while any dice are left its summary also offers **Spend a hit die**
(`restSummary(…, {hd:true})`), which opens the spend box in its place. Both end in a summary of what
came back.

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
- **The manual-mode "Reset to class" banner stays outside the bar**, written into `#hdWrap` above
  `hdBarHTML()`'s output, not inside it — the same reason the old per-style banner stayed outside
  `.hd-grid`: a child spanning the bar's own layout would fight it.
- **One copy of `#hitdiceInput` and `[data-hdmode]` at a time.** The inline foot is drawn only with
  an empty pool and the box closed, and `openHdSpend()` removes it first. Two copies would leave
  `renderHitDice()` patching the wrong one.
- **`#hitdiceInput`/`[data-hdmode]` are patched by `.hidden`/property writes, not `style.display`.**
  `hdFootHTML()` bakes a literal `hidden` attribute into the input's markup at render time; a
  cleared inline style does not override an attribute the UA stylesheet still matches, so
  `renderHitDice()` toggles the `.hidden` IDL property instead, which does.
- **The rail is the `vitals` note anchor.** The old Rest & Recovery card's `rest` notes merged into
  `vitals` once, in `migrate()` (`migrateSheet103()`), under "**Rest & Recovery:**"; a saved
  `rest` in the combat view became `vitals`.
- **`#starBtn`, `#encPill` and `#roundNum` move only by DOM move**, never `label.innerHTML +=`
  ([Sections & layout](../ui/sections-and-layout.md)).
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
| Where the Hit Dice sit (#103) | In the rail, a bar under Hit Points | Rest & Recovery under the rest buttons (the 2026-09-25 answer): that card went, and a bar is one line. Under Hit Points as a panel (2026-08-14): it rode into the combat view as a block between the player and the hit points |
| Where the rests and the star sit (#103) | Icons in the header | The Rest card and the Vitals label: the clutter the issue is about |
| XP thresholds (#103) | The ruleset's `advancement` table, else the SRD's, hard-coded | The converter extracting it now: every pack's digest moves for numbers the fallback already has |
| How the XP bar fills (#103) | Within the level, `(xp − cur) / (next − cur)`, clamped 0..1 (Mike's ruling) | From 0 toward the next threshold: a character who has just reached level 5 showed 46% |
| XP or milestones (#103) | A per-character `advancement` setting | XP only: tables that use milestones keep an empty field. App-wide: two tables on one device can't differ |
| How many hit-dice looks (#103) | One bar, tapping it opens a spend box | Keeping Full/Condensed/Dice as a per-character choice: a display option for something every player does the same way — pick a die, spend it — not a matter of taste |
| Where the hit-dice pill and field sit with no pool (#103) | Inline under the hint, one copy at a time with the spend box's | An empty "Set hit dice" bar that opens the box: a box with no rows to spend from |
| How a hit die is spent (#103) | Pick, then either auto-roll or type your own roll, live-validated | Auto-roll only (the old `rollHitDie()`): a roll made at the table has to go in by hand somewhere, and a second "override HP by hand" path after the fact is worse than typing the roll itself |
| Death saves filling outward | CSS `row-reverse` off `data-kind="succ"` (successes now sit left of the skull, #103) | `buildDeath()` counting backwards: the click handler and `.on` toggling would have to change |
| Size on tap | A chooser | A breakdown like the other boxes: size is a choice, not a derived number |

## Open

- There is no box to type a base Speed: `character.speed` is only ever written by the ancestry seed,
  so a custom ancestry reads 0 plus effects. Swapping ancestry keeps the first one's speed and size
  ([Character building](character-building.md)).
- The level-1 resync stops at level 2 by design; from there Max is a total the app never computed.
- `removeClass()` un-seeds only a level-1 class. A first class added at level 3 and then removed
  keeps the Max its window added (seed plus levels 2–3), as a levelled-up class always has, so
  re-adding a different class does not seed over it. Recording what the app wrote per class would
  close this; not done.
- On a phone the AC shield overlaps the small portrait's bottom edge; whether that reads well on a
  device is Mike's pass.
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
- 2026-10-23 — the three Hit Dice looks (and their Settings row) retired for one bar; tapping it
  opens a spend box that rolls for you or takes a typed roll. → ledger L6580, #103
- 2026-10-23 — Vitals becomes the dark rail (portrait, AC shield, ✓○○○☠○○○✗, badges, HP and hit-dice
  bars); the rests, the star and the level with XP move to the header, with XP or milestone
  advancement; the Rest & Recovery card and its note key are gone. → ledger L6633, #103
- 2026-10-23 — Final review fixes: with no hit-dice pool the pill and the dice field sit under the
  hint, so a custom class can type its dice; an open spend box follows a dice edit or the mode
  switch; the XP bar fills within the level; the short rest offers Spend a hit die.
  → ledger L6729, #103
