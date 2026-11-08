# Vitals & rest

The Sheet's dark rail (the `vitals` section, #103) and the rest and level controls in the header
above it. The rail runs down the left: the portrait with the AC shield over its bottom edge, the
death saves `✓ ○○○ ☠ ○○○ ✗`, Init / Speed / Prof badges, the Hit Points bar (Current / Max centred
inside it, Temp at its right, − and + either side), the Hit Dice bar, and Size · Passive Perception in
small text. Its header carries the pencil every list card has, which locks Max HP and how AC is
set, and hides the portrait's buttons. The Sheet's header holds Short Rest, Long Rest, the Inspiration star and the level
ring with the XP. This page covers how hit points are typed and spent (typed into the bar with a
mouse, the Hit points window on a touchscreen), the Max HP lock, the level-1 seed, the colour bands,
the hit-dice bar and its spend box, the level badge, and what each rest gives back.

**Code:** `applyHPInput()`, `adjustHP()`, `renderHP()`, `hpBand()`, `signedEntry()`,
`signedDelta()`, `entryDigits()`, `hpBoxWidth()`, `hpFitBox()`, `hpTempFits()`, `hpPlaceTemp()`,
`HP_TMP_EDGE`, `HP_TMP_GAP`, and the Hit points window's
`hpTouch()`, `hpAmount()`, `hpQuick()`, `hpQuickText()`, `hpNowText()`, `hpBarLabel()`,
`hpQuickApply()`, `hpSetParse()`, `hpSetApply()`, `hpDialogHTML()`, `openHPDialog()` in
`66-coins-hp.js`; `vitalsLocked()`, `setVitalsLocked()`, `toggleEditCard()` in `87-notes.js`; `clampHP()`, `effMaxHP()`, `buildDeath()` in
`00-constants.js`; `longRest()`, `shortRest()`, `hitDicePool()`, `renderHitDice()`, `hdBarHTML()`,
`hdSpendHTML()`, `hdFootHTML()`, `hdBoxOpen()`, `hdRefresh()`, `hdDiceEdited()`, `toggleHdMode()`,
`openHdSpend()`, `hdConMod()`, `hdHeal()`, `hdSpendCheck()`, `spendHitDie()`,
`rollHitDie()`, `recoverHitDice()`, `renderDeath()` in `65-resources.js`; `level1HP()`, `seedLevel1HP()`,
`resyncLevel1HP()`, `hitDieMax()` in `56-class.js`; `charSize()`, `sizeByHand()`, `sizeOptionsHTML()`,
`capacityFor()`, `sizePickValue()` in `25-origins-items.js`; `openSizePicker()`, `openStatBreakdown()`, `statRowsHTML()`,
and the Speed window's `parseBaseSpeed()`, `speedBase()`, `speedWindowHTML()`, `commitBaseSpeed()`,
`openSpeedWindow()` in `80-modal-forms.js`; `setPlayerField()`, `playerOwns()` in `50-classrace.js`; `bumpHP()`,
the HP bar's tap, death-save and hit-dice handlers in `90-boot.js` · `xpProgress()`, `xpNumber()`,
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

**The badges.** AC (the shield), Initiative, Speed and the proficiency bonus tap through to their
windows (`data-stat`, `openStatBreakdown()`). Initiative and the proficiency bonus open their
breakdowns (`statRowsHTML()`, titled "… breakdown"). AC opens the Armor Class window instead, with
its Calculated / Flat switch, and its shield reads FLAT while it is Flat ([Armor & AC](armor-and-ac.md)).
Speed is its base plus `speed` effects, then encumbrance, and opens the **Speed window** (below).
**Size** is `charSize()`: the size the player chose, else the ancestry's (`raceDefSize()`), else
Medium. Tapping it (or Enter/Space) opens `openSizePicker()` — a chooser, not a breakdown, with
"From ancestry (…)" first and a carrying-capacity preview from `capacityFor()`. The same list,
`sizeOptionsHTML()`, is in Settings → Carrying. Both write through `setPlayerField()` (#131): a
picked size is the player's, marked by a `player` entry in `seeds`, so no species swap or remove
touches it, and "From ancestry" gives it back
([Grants & provenance](../architecture/grants-and-provenance.md)). Both lists show "From ancestry"
selected unless the size is the player's (`sizePickValue()`), and the Size window's Save writes
nothing when nothing changed, so opening it and pressing Save never makes the species' size the
player's. Size is marked as set by hand
only when it is the player's (`sizeByHand()`): a `player` entry, or, on a sheet from before the
record, a size that matches neither a source's record nor the species' own. A size the species
seeded is not marked. Size changes nothing but carrying capacity, and that only while Encumbrance
is on.

**The Speed window** (#131). Tapping Speed opens `openSpeedWindow()`, titled "Speed": a **Base
speed** box at the top, as the AC window puts its switch and Flat box above its lines, then the
breakdown it showed before. The box holds the player's own speed when there is one, else it is
empty with the species' speed as its placeholder ("30"). Under it a hint: "From Elf: 30 ft. Type a
number to set your own." when the base is a species' seed, "Your own. Clear it to use your
species' speed." when it is the player's, "No species speed. Type yours." when there is none, and
"Unlock Vitals to change it" while Vitals is locked, when the box is read-only and dimmed. It commits on
`change` and on the window's dismissal, since Escape doesn't blur it (`setDismissGuard()`, the AC
window's pattern): `parseBaseSpeed()` takes a whole number of feet 0–999, trimmed, gives `""` for
blank and refuses anything else ("30 ft", "-5", "3.5", "3 0"), and the box then shows what the
sheet holds again. `commitBaseSpeed()` writes it through `setPlayerField()`, so a typed speed is
the player's: no swap or remove touches it, a later species records `null` over it, and a custom
ancestry gets a speed. A blank removes it and seeds the current species' speed again, or leaves 0
with none. A typed 0 is a speed (a creature that can't walk), not an empty box. The rows below are
redrawn in place: the base line names whose it is (`speedBase()`: "Base 35 ft, yours", "Base 30 ft,
from Elf", "Base 0 ft"), then each `speed` effect, then encumbrance. The badge's own mark is
unchanged: it marks effects and encumbrance. Passive Perception is covered in
[Abilities & skills](abilities-and-skills.md). The ✦ star (`#starBtn`) is in the header;
`toggleInspiration()` flips `character.inspiration`, and `recompute()` paints `#starBtn` and the
combat view's own `[data-inspire]` star together.

**Typing hit points (with a mouse).** The three boxes are `type="text" inputmode="tel"` with
`data-hp`, **not** `data-path`, and commit on `change` (blur) or Enter, which reselects the box for
the next entry. On a touchscreen they take no typing at all; the Hit points window (below) is the
only way in. `applyHPInput()`:

1. Ignores anything but `cur`, `max` and `temp` (an old sheet still carries `hp.locked`).
2. Refuses Max while Vitals is locked, and repaints.
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

**The HP bar.** The three boxes sit inside `.hp-bar`, "26 / 38" in the middle with "+3" temp at its
right. `renderHP()` sets the fill (`#hpFill`) to Current ÷ `effMaxHP()`, clamped 0–100 and 0 with no
maximum, and gives it the band class, so the bar itself turns amber or red. **Centring (#113):** the
bar is a grid of three columns, `minmax(0,1fr) auto minmax(0,1fr)`: the outer two identical, so
Current, the slash and Max (`.hp-num`, the middle column) are exactly centred in every state. Temp's
`.hp-tmp` sits at the right of the third column only when it fits there: `hpTempFits(barW, numW,
tmpW)` asks whether half the space beside the numbers holds Temp's "+" (`.hp-tplus`) and box, its 6px
margin (`HP_TMP_EDGE`, `.hp-tmp`'s `margin-right`) and a 6px gap (`HP_TMP_GAP`). Otherwise
`hpPlaceTemp()` sets `.hp-out` on `.rail-hp`, and Temp is `position:absolute` at its top right, beside
the "Hit points" label, reading "+3 TEMP" (`.hp-tmpw` shows after a value). What has to fit is
measured, not guessed from the rail's width: digits, skins, the fonts and a blank Temp's "+temp"
placeholder (4.6ch, wider than most values, so a blank Temp is usually beside the label) all move it.
`hpPlaceTemp()` runs from `renderHP()` and `hpFitBox()`, and from `90-boot.js` on a `ResizeObserver`
over `.hp-bar` and `.hp-num` (a resize, the combat view, a skin, the digits), on
`document.fonts.ready`, and when Temp loses focus. A Temp box being typed in moves out the moment it
stops fitting, and comes back only once it loses focus, never under the caret. Temp keeps its sizes in
both places, so the measurement doesn't depend on where it is and the class can't flip back and
forth. `renderHP()` sizes each box to what it holds (`hpBoxWidth()`: its length in `ch` plus 0.2, a
blank one its placeholder's width) and `hpFitBox()` keeps it sized as it is typed (an `input` listener
in `90-boot.js`). The fill is a grid item spanning all three columns, not absolutely positioned, so the
bar itself is not positioned; `.hp-num` and `.hp-tmp` are, so they paint over the half-opaque fill.
The numbers stay 19px at every width. The − and + are SVG strokes in flex-centred buttons, since a
font's − and + sit high in their line.

**The Hit points window (touch, #112).** On a touchscreen — the device's primary pointer is coarse,
`hpTouch()`, read at tap time — a tap anywhere on `.hp-bar` (Temp in the label row included), or
Enter or Space on it, opens `openHPDialog()`, on the Sheet and in the combat view alike. `renderHP()`
makes the bar one button there (`role="button"`, `tabindex="0"`, `hpBarLabel()`'s "Hit points 26 of
38, temp 3 — change") and its boxes readOnly, `inputmode="none"`, out of the tab order, and CSS
(`@media (pointer:coarse)`) gives them `pointer-events:none`, so no keyboard comes up under the tap.
With a mouse the bar has none of that. A `(pointer:coarse)` change listener repaints. The window
(`hpDialogHTML()`), titled "Hit points":

- a header, `hpNowText()`: Current / `effMaxHP()` · temp ("26 / 38 · temp 3", "0 / —" with nothing
  set);
- an amount box, `inputmode="numeric"`, "How much?", focused on open (focusing it inside the tap
  brings up the digits-only keypad; `modalTakeFocus()` focuses the dialog box on touch). Enter (the
  keypad's Done) puts the keypad away and applies nothing. `hpAmount()` reads it: spaces and commas
  stripped, then a whole number from 1, else `null`;
- **Damage**, **Heal** and **Temp**, greyed until it reads, each with its line from `hpQuickText()`:
  "→ 22, no temp", or "temp 3 → 1" when Temp soaks it all and Current doesn't move; "→ 33"; "3 → 7",
  or "→ 7" with none. One tap runs `hpQuickApply()` — Damage `adjustHP(-n)`, Heal `adjustHP(n)`, Temp
  sets `hp.temp` to the amount, **replacing** what is there, then `clampHP()` — and `renderHP()`,
  `scheduleSave()`, closes. No toast and no Undo: the bar shows the result, and a mis-tap is fixed by
  reopening;
- **Set exactly**, a `<details>` folded by default and opened by hand in its summary's click (so
  focusing Current stays inside the tap): Current, Max (only while Vitals is unlocked; otherwise a line
  says how to unlock it) and Temp, filled with what is there, `inputmode="numeric"`. Max is the base;
  when an effect makes the effective maximum differ, the box reads "Base max" and a line gives the
  effective one, so the header's number isn't typed in and counted twice. `hpSetParse()`
  reads them: blank is "not set" (`""`), a whole number from 0 is itself, a Temp of 0 is none, and
  anything else names its box ("Not a whole number: Current") and greys Apply. Apply (or Enter in a
  box) runs `hpSetApply()`, which writes them, refuses a Max while Vitals is locked even if one is
  passed, `clampHP()`s and says whether Max moved; then `renderHP()`, `recompute()` if it did, save,
  close. Cancel closes.

`hpQuick()` is the pure preview of all three taps, mirroring `adjustHP()`'s temp-first rule and
`clampHP()`'s bounds; the suite holds it equal to what `hpQuickApply()` leaves. The window's
listeners bind to its own elements. None of its boxes carries `data-hp` or `data-path`.

**The Max HP lock: the Vitals pencil (#115).** The rail's header carries the pencil every list card
has ([Sections & layout](../ui/sections-and-layout.md)): `vitals` is in `EDIT_CARDS`, and the flag is
`character.editHide.vitals`, `true` when locked. Locked, the portrait's add and remove buttons
(`#btnPortrait`, `#btnPortraitDel`, which carry `ed`) are hidden, Max can't be changed, and the
Armor Class window's Calculated / Flat switch and Flat box are disabled, so a flat AC can't be
changed either ([Armor & AC](armor-and-ac.md), #130), and so is the Speed window's Base speed box (#131); Current, Temp, −/+, the death saves, the hit
dice, Size and the badges work either way, and AC still opens its window. Every sheet starts
unlocked. Its title is "Lock Vitals" or "Unlock Vitals" and its aria-label says what that does ("Lock
Vitals — hides the portrait buttons and locks Max HP and a flat AC"). **One reader:** `vitalsLocked(c)`, which is
`editHidden(c,"vitals")`, used by `renderHP()` (Max `readOnly`), `applyHPInput()` (which refuses Max
again, because `readOnly` does not stop a paste), the Hit points window's Max row and `hpSetApply()`,
`hpChoice()`, and the AC window's `setACMode()`, `setACFlat()` and `acWindowHTML()`. **One writer from code:** `setVitalsLocked(locked)`, which sets the flag through
`setEditHidden()`, toggles `ed-off` on the card, repaints the pencil (`paintEditToggle()`) and calls
`renderHP()`. A level-up unlocks Vitals; the level's hit-points step puts it back as it was
([Character building](character-building.md)). Adding a second class unlocks it too, and so does a
first class that starts above level 1. A player's tap goes through `toggleEditCard()`, which calls
`renderHP()` for `vitals`. The old `hp.locked` (locked by default, behind a padlock beside "Max") is
retired: an old save keeps the key through `migrate()` and nothing reads it, so every existing sheet
opened unlocked.

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

**The level-up card's HP step copies this box** (#101): the same controls, order and wording — Roll
for me, "I rolled" plus Apply (live-checked, the same shape of range message), or Take the average
— in `levelUpHPHTML()` and `luSetHP()`/`luHPCheck()`, `57-levelup.js`. It is a separate instance
(it is gaining hit points, not spending a die, so there is nothing to clamp against a pool), but the
wording and the live-checked "I rolled" field are deliberately the same box a player already knows
from here. Pressing its Done or Continue — not Apply — is what raises Max and Current
(`commitHPChoice()`) and puts the Vitals lock back as it was. This box's own spends never touch the
lock. See [Character building](character-building.md) for the flow.

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

**Rests.** The header's **Short rest** and **Long rest** buttons (`#btnShortRest`, `#btnLongRest`)
run them. Each holds its words (`.sh-rlbl`) and its icon (`.sh-rico`, ☕ / ☾): the words show by
default, the icon with Icon tabs on (`html[data-tabs="icons"]`) or at ≤860px, where the tab bar
turns to icons. `longRest()` sets Current to the effective maximum (if one is set), clears Temp and death
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
- **One reader and one writer for the lock.** Everything reads it through `vitalsLocked()` and code
  sets it through `setVitalsLocked()`, never `editHide.vitals` directly, so a new thing the pencil
  locks reads the same flag the same way.
- **The window's preview is its tap.** `hpQuick()` mirrors `adjustHP()` and `clampHP()`; a change to
  either changes what the window promises, and the `sheet.js` loop over its cases fails until the two
  agree again. The taps themselves still go through `adjustHP()`.
- **On a touchscreen the boxes take no typing.** `readOnly`, `inputmode="none"`, out of the tab order,
  and `pointer-events:none`: a tap that focused a box would bring up the keyboard over the window.
- **The bar is not positioned.** Temp leaves it for the label row by `position:absolute` against
  `.rail-hp`; a positioned `.hp-bar` would become its containing block and clip it.
- **The bar's outer columns are identical, and nothing in them is sized by content.** A floor on the
  third (`min-content`) is exactly what pushed the numbers off centre (L9501); Temp's fit is decided by
  `hpPlaceTemp()`, never by the grid.
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
- **`recompute()` does not call `renderHP()`**, so anything that changes the lock renders it itself;
  `setVitalsLocked()` and `toggleEditCard()` do.
- **The padlock's default couldn't be carried over (#115).** `hp.locked` defaulted to `true`, and an
  old sheet gained it by `migrate()`'s sub-key fill, so every sheet's Max read locked whether the
  player had chosen it or not. Moving the lock to `editHide.vitals` therefore opened every sheet
  unlocked, by decision; the checks that asserted "a missing flag means locked" were inverted.
- **Fixed-width boxes can't centre.** Three 3.1ch boxes (temp 4.6ch) with Temp at `margin-left:auto`
  put "26 / 38" at the bar's left, and a one-digit Current sat a digit off centre (#113). The boxes are
  sized to their content now.
- **A content floor on one column pushed the numbers left (#113, QA).** The first fix gave the third
  column a `min-content` floor "so a wide Temp shifts the numbers rather than overlapping them".
  A blank Temp's placeholder is wider than its half, so the floor always won: "126 / 138" sat 15.5px
  left on the Sheet at 1280 and 23px in the combat view at 375 on Classic. And Temp left the bar below
  a guessed 220px; the combat view at 375 is 221px. Both went for identical columns and a measured fit.
- **The layout guards once encoded nesting.** `rules-data.js` sliced "to the next card" and "to the
  first `</div>`"; moving a block broke them for reasons unrelated to what they guarded. They now
  use a `block` helper that counts divs, and each was mutation-tested.
- **Save with nothing changed made the species' size the player's** (review of #131): the Size
  window pre-selected the seeded size and Save always wrote it, so the next species swap kept it.
  It pre-selects From ancestry now, and writes only a change.

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| Where HP's upper bound lives | `clampHP()`, run by every HP-changing path | A `max` argument on the parser: coins have no max, and the bound must also hold for ±, hit dice, rests and lowering Max |
| How HP boxes commit | On `change`, outside `data-path` | `data-path`: commits every keystroke, storing a bare sign |
| Where the lock lives (#115) | The Vitals pencil, `editHide.vitals`, read by `vitalsLocked()` | `hp.locked` behind a padlock beside "Max" (the 2026-08-14 answer): small, cluttered, and the one lock on the sheet that wasn't the cards' pencil |
| Does Vitals start locked? (#115, Mike) | Unlocked, like every card's pencil | Locked, reusing `hp.locked`: keeps "Max locked by default" but hides Add portrait on a new character and makes Vitals the one card whose pencil works backwards |
| What the pencil covers (#115) | The portrait's add and remove buttons, and Max HP; and since #130, how AC is set (the AC window's switch and Flat box); since #131, the Base speed box | Hiding more: Current, Temp, −/+, death saves, hit dice, Size and the badges are play controls. AC always editable: the one rail number left open (#130) |
| Existing sheets (#115) | All open unlocked; `hp.locked` is kept, unread | Carrying `hp.locked` over: every sheet would open locked, since that was the default |
| Whether the lock confirms | No confirm | Confirming like the manual Hit Dice switch: that is a mode change with consequences, this is undone by a second tap |
| How HP is typed on a touchscreen (#112, Mike) | Tapping the bar opens Hit points | Typing into the bar: three small boxes under a finger are the issue |
| And on desktop (#112, Mike) | The bar keeps its type-in numbers, −7 and +4 included | The window everywhere: slower with a keyboard |
| What "touchscreen" means (#112, Mike) | The primary pointer is coarse; a touchscreen laptop is desktop | The window's width: a landscape tablet is as wide as a laptop, and a narrowed laptop window has a mouse |
| The − and + buttons (#112, Mike) | Stay, on every device | Dropping them for the window: ±1 is the quickest tap there is |
| What the window holds (#112, Mike) | One amount, then Damage, Heal or Temp, with Set exactly in a fold | The bar's three boxes, bigger, signed: damage needs a minus, which phone keypads hide. Adjust coins' shape: also a minus, and setting an exact number means working out the difference |
| What Temp does in the window (#112) | Replaces what you have | Adding: temp HP don't stack, and you choose which to keep |
| Undo in the window (#112) | None; a mis-tap is fixed by reopening (a toast with Undo is #175) | — |
| How the numbers centre (#113) | Three grid columns, the outer two identical (both `0` to `1fr`), boxes sized to their content | Fixed-width boxes with Temp pushed right: the issue. A `min-content` floor on the third column: a blank Temp pushed three digits up to 23px left (QA) |
| A Temp that doesn't fit (#113) | It moves beside the "Hit points" label wherever a measured fit says it can't sit beside the centred numbers with a 6px gap, on touch and desktop | A width threshold (220px): fit depends on digits, skin, fonts and a blank placeholder, and the combat view at 375 missed it by 1px. Shrinking the numbers (the 17px step went too): unreadable at the table. Relaxing the centring while Temp shows: the issue |
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
| Speed on tap (#131) | A window with a Base speed box above the breakdown; a speed typed there is the player's and is never reverted or overwritten (Mike) | Keeping the outgoing speed when the incoming species sets none: a removed species' speed stays behind, #131's leftover. Accepting Speed 0 after a remove or with a custom ancestry: looks broken, with no way to fix it |
| The Base speed box while Vitals is locked (#131) | Read-only, as the AC window's Flat box is; the breakdown still shows | Always editable: Base speed would be the one rail number the pencil doesn't lock |
| Size marked "set by hand" (#131, #146) | Only when it is the player's | Whenever `character.size` is set: the species' own seed read as set by hand |

## Open

- The level-1 resync stops at level 2 by design; from there Max is a total the app never computed.
- `removeClass()` un-seeds only a level-1 class. A first class added at level 3 and then removed
  keeps the Max its window added (seed plus levels 2–3), as a levelled-up class always has, so
  re-adding a different class does not seed over it. Recording what the app wrote per class would
  close this; not done.
- On a phone the AC shield overlaps the small portrait's bottom edge; whether that reads well on a
  device is Mike's pass.
- A real-phone pass of the Hit points window, keypad included, is Mike's.
- The window has no Undo; a toast with Undo is #175. Coins could take the same "amount, then Gain or
  Spend" shape (a 1.9.2 issue).
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
- 2026-10-23 — The rest buttons read "Short rest" / "Long rest", icons with Icon tabs or on a narrow page. → ledger L6776, #103
- 2026-10-24 — The level-up card's hit-points step copies this box's controls, order and wording. → ledger L6840, #101
- 2026-10-24 — The sentence on what the card's Done does to the lock now parses. → ledger L6928, #101
- 2026-11-06 — The Vitals pencil replaces the Max padlock (every sheet opens unlocked); on a
  touchscreen the HP bar opens a Hit points window (an amount, then Damage, Heal or Temp; Set exactly);
  the numbers and the − and + sit centred, Temp moving beside the label on a narrow rail.
  → ledger L9441, #115, #112, #113
- 2026-11-06 — Centring held for a blank Temp: the bar's outer columns are identical, and Temp leaves
  the bar wherever a measured fit says it can't sit beside the numbers, not below a fixed width; the
  17px step went. → ledger L9501, #113
- 2026-11-06 — Tapping AC opens the Armor Class window (Calculated / Flat); the shield reads FLAT for a Flat AC. → ledger L9537, #130
- 2026-11-06 — The Vitals pencil locks how AC is set too: the AC window's switch and Flat box; its label says so. → ledger L9597, #130
- 2026-11-07 — Tapping Speed opens the Speed window, a Base speed box above the breakdown, the player's own speed through `setPlayerField()`; Size picks are the player's too, and Size is marked only when it is theirs; a swap or remove takes back the species' speed and size. → ledger L9760, #131
- 2026-11-08 — A Base speed box the Vitals pencil locks is dimmed, so it looks locked. → ledger L9760, #131
