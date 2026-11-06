# Flat AC, "Include spells", and scaling uses — design

**Status:** approved 2026-11-06 (Mike) · wave 1 of [1.9.1](../wiki/roadmap/1.9.1.md), the Armour & attack
numbers worktree
**Issues:** #130 (manual AC: no control, shields stack, "Base AC 0") → #129 (spell attack row and
cast dialog disagree), and #132 (editing a feature freezes its scaling use count). One branch.
Read [Armor & AC](../wiki/features/armor-and-ac.md),
[Attacks & damage](../wiki/features/attacks-and-damage.md), [Spells](../wiki/features/spells.md),
[Computed stats & effects](../wiki/architecture/computed-stats-and-effects.md) and
[Features & traits](../wiki/features/features-and-traits.md) first.

**Depends on the Vitals & HP branch** (its spec, `2026-11-06-vitals-hp-design.md`, on that branch until it merges): the AC window's
switch follows the Vitals lock through that branch's `vitalsLocked()`. Vitals & HP merges first in
wave 1; build this branch's lock step after rebasing on it (everything else can go first).

---

## 1. What it is

**#130.** Tapping the AC shield opens the Armor Class window, which gains a **Calculated / Flat**
switch. Calculated is today's arithmetic, minus two bugs: only the best shield counts, and the
hidden old manual value is no longer read (no more "Base AC 0"). Flat is a number the player types,
the AC from their paper sheet; only things that come and go add to it. The rail's shield shows when
AC is flat.

**#129.** Each to-hit or damage effect gets an **Include spells** tick. Unticked, it counts for
weapons only. Ticked, it counts for spells too, and the Spellcasting card, the cast window and the
spell's row in Attacks all show the same number.

**#132.** Editing a feature keeps a use count that scales (by level, or a formula like WIS) unless
the player changes the number.

## 2. Decisions

Settled with Mike on 2026-11-06 (this brainstorm, with mockups).

| # | Question | Decision | Rejected, and why |
|---|---|---|---|
| 1 | Can AC be typed by hand? | **Yes, "if needed"** (Mike) | Removing the hidden manual value: no escape hatch when the app gets it wrong |
| 2 | How | **A Calculated / Flat switch** in the Armor Class window (Mike: "calculated AC OR flat AC") | A typed base that armour and shields build on: the issue's confusion |
| 3 | What adds to Flat | **Only things that come and go: statuses and a summoned familiar.** Armour, shields, items and features do not, because the typed number already counts them. **Casting a spell adds no AC by itself**, today or after this: the Shield spell counts only through a status the player gives `ac +5` (casting Haste adds a Concentrating status with no effects). Corrected after the builder check; the brainstorm's playback had said "the Shield spell or Haste still add" | Nothing adds: a Shield status would not show. Everything adds: a Ring of Protection counted twice. Spells that carry effects: new scope, not this branch |
| 4 | Calculated and the old value | **Calculated never reads `character.ac`**; an old sheet with one opens Calculated, and the old number fills the Flat box | Opening such a sheet Flat: its shield would stop adding, silently |
| 5 | Shields | **Only the best equipped shield counts** (the rules allow one) | Stacking: a bug |
| 6 | Showing Flat | **"FLAT" in place of "AC" under the number** is the mark, in every skin; **plus a rim colour** from a new `--rail-flat` token in all four palettes, chosen to differ from that palette's `--rail-line` (my call: the mockup's gold rim can't differ everywhere, since the default skin's dark rail line is already `#d8a544` and the classic skin's `--rail-accent` is red) | No mark: putting on armour would seem to do nothing. `--rail-accent` for the rim: no change on default dark, a red rim on classic |
| 7 | Locking | **The switch and the number follow the Vitals pencil**, read-only while it is locked, like Max HP | Always editable: the one rail number left open |
| 8 | Spells and generic effects | **A per-effect "Include spells" tick** (Mike), in the item, feature and status editors | One switch per character: can't have one item count and another not. Always counting: no way to say "weapons only" |
| 9 | Which targets get it | **The six generic ones:** to-hit and damage, each all / melee / ranged | "Spell attack" and "Spell save DC" already count only for spells |
| 10 | Default | **Unticked**, and every existing effect opens unticked: an unticked effect is weapons only | Ticked by default: the card and cast window would move on every sheet with such an effect |
| 11 | Where a ticked to-hit counts | **All three places** agree. Melee/ranged-only ones count where the spell's range is known (its row and the cast window); the card's one number takes the "all attacks" ones | — |
| 12 | Where a ticked damage counts | **Every spell that deals damage**, attack or save (how a player would model Empowered Evocation). Melee/ranged-only ones need an attack spell of that kind | Attack spells only: a save spell's damage could never take one |
| 13 | Pack data | **Unchanged.** The one generic effect the packs ship is **Archery's `attack.ranged` +2** (SRD 5.2 `feats.json` and the three Fighting Style options in `classes.json` ≈ 1230, 1836, 2187; the same in the private 2024 pack). Archery is ranged *weapon* attacks, so unticked is right and no digest moves. **A character with Archery sees a ranged spell's row (Fire Bolt) drop by 2**: today's row adds it, which is a bug the rules don't allow | Ticking Archery in the packs: wrong by the rules, and every digest moves |
| 14 | An empty Flat box | **Not accepted:** clearing it puts the last number back; switching to Flat fills it (§4). `migrate()` turns `acMode:"flat"` with no number in `character.ac` into `"calc"` (my call) | Showing 0: an AC of 0 reads as a bug. Falling back silently: the mode and the number disagree |
| 15 | #132 and the item editor | **Fixed here too.** `openItemForm()` has the same freeze (fills from `itemUsesMax()`, saves `{max:um}`, ≈ 464 and 635–636), and CLAUDE.md says fix completely. Grants redraw (#128) also edits `openItemForm()` in wave 1, in another part (a new item's `equipped`); it merges first, so this step is built after rebasing on it (my call: the roadmap's "never the same function" rule bends here, by merge order) | A follow-up issue: a known freeze left in a function this branch is already in |

## 3. Data

All optional, all round-tripping through `migrate()`, which keeps every field.

- **`character.acMode`**: `"calc"` or `"flat"`. `blankChar()`: `"calc"`. `migrate()` normalises
  anything but `"flat"` to `"calc"`.
- **`character.ac`** (existing, `""` by default) is now **the Flat value only**: a whole number or
  `""`. Calculated ignores it. Flat always has a number (decision 14).
- **An effect's `spells: true`**: optional on `{target, value}`. Absent or anything but `true` =
  unticked. Written only for the six generic targets. Effects stay numeric-only (the invariant):
  this flag says where a number applies, not a new kind of effect.
- **A contribution's kind.** `contributions()` tags each entry with where it came from (`feature`,
  `item`, `status`, `familiar`) and carries `spells`, so Flat can keep statuses and familiars and
  the spell sums can keep the ticked ones.

## 4. Flat AC (#130)

- **One AC function.** A single `acTotal(c)` (name the builder's) replaces the four places that add
  `armorAC(c).base + sumFx("ac",c)` themselves: `recompute()` (`10-compute.js`), `youAC()`
  (`87-initiative.js`), the breakdown (`openStatBreakdown("ac")`, `80-modal-forms.js`), and the
  print sheet, which reads `#acDisp`'s text and follows for free.
  - Calculated: `armorAC(c)` (best body armour + capped Dex, else 10 + Dex; **plus the best
    shield**, `Math.max`, not a sum) + every `ac` effect. `armorAC()` no longer reads
    `character.ac`.
  - Flat: `num(character.ac)` + the `ac` effects whose kind is `status` or `familiar`.
- **The window** (`openStatBreakdown("ac")`, titled "Armor Class breakdown" today): a two-way
  switch, Calculated | Flat, at the top. Today it writes one text line and lists the effects, with
  no total: **the total line is new**, in both modes, and is what the tests compare.
  - Calculated lists today's lines ("Armor 12 + DEX +3", "Shield +2", each effect by source) and the
    total.
  - Flat shows "Your AC" with a box (`inputmode="numeric"`, whole numbers; committed on change), a
    struck line naming what no longer adds, each status or familiar effect that still does, and
    the total.
  - Switching to Flat with the box blank fills it with the AC the sheet shows at that moment, minus
    the status and familiar effects, so the number doesn't jump (my call).
  - While Vitals is locked, a line says "Vitals is locked — unlock it to change your AC", and the
    switch and box are disabled.
- **The rail's shield** (`.rail-ac`) gets a `flat` class: its label reads "FLAT" in place of "AC",
  and its rim takes `--rail-flat` (decision 6). The combat view's copy is the same element. Both
  skins, light and dark.
- **Words** are the mockup's: "Calculated", "Flat", "Your AC".

## 5. "Include spells" (#129)

- **The editor.** `fxRow()` (`80-modal-forms.js`) gains an "Include spells" checkbox, shown only
  while the row's target is one of the six (it hides and shows as the select changes; a hidden
  tick is not saved). `collectFx()` writes `spells:true` only when it is ticked and the target is
  one of the six. All four editors (item, feature, status, familiar, ≈ 870) share `fxRow()` but
  wire their rows separately, so the show/hide is **one delegated listener** on the modal, not
  wiring in each editor (which would put this branch in `openItemForm()` for #129 too).
- **The copy paths already keep the flag**: the feat grant (`50-classrace.js`), `updProject()`
  (`72-char-update.js`), the trade window's clone and the choices path (`58-choices.js`) copy
  effect objects whole. Only `collectFx()` and `contributions()` rebuild them field by field; both
  carry it. The update tool treating a player's tick as a player edit is correct.
- **The sums.** Weapons are unchanged: every generic effect counts, ticked or not. For spells:
  - **One effect sum for spells**, `spellAtkFx(c, kind)` (name the builder's) = `spell.attack` +
    ticked `attack` (+ ticked `attack.<kind>` when `kind` is given). `spellAtkBonus(c, kind)` = PB +
    the spellcasting ability's modifier + that sum. The Spellcasting card calls it with no kind; the
    cast window (`promptSpellAttack()`) with the spell's `atkKind`. A spell attack row in
    `attackNumbers()` **keeps its own ability part** and takes `spellAtkFx()` in place of today's
    generic sum, so a row with no spellcasting ability set still shows its own ability (the #74
    block's Fire Bolt check, `sheet.js` ≈ 3283–3287, stays true). The three agree whenever the row's
    ability is the spellcasting ability, the normal case. Unticked generic effects leave the spell
    row.
  - Spell damage = ticked `damage` (+ ticked `damage.<kind>` for an attack spell of that kind). The
    row and the cast window's Damage line (`attackDamageStr(…, 0)` today) both show it. A **save**
    spell's row passes 0 today (`attackDamageStr(a, save?0:n.dmgBonus)`, `60-attacks.js` ≈ 371,
    and the same expression in `printSheet()`, `71-char-io.js` ≈ 211), because it has no ability to
    add: both now pass the ticked damage sum alone, and the save row's damage mark (`dmgOn=!save&&…`,
    ≈ 375) lights for it.
  - `spellDC()` is unchanged (`spell.dc` only).
- **Breakdowns and marks follow the same sets**: the spell attack breakdown, the attack row's
  breakdown (`60-attacks.js` ≈ 485–488), the "effect applies" mark and the red penalty mark (#89)
  on the card and the row.

## 6. Scaling uses (#132)

`openFeatureForm()` fills "Limited uses" from `usesMax(f)` and saves that number, which replaces a
`{byLevel}` or formula maximum with today's value. `openItemForm()` does the same through
`itemUsesMax()` (decision 15). Now, in both:

- **If the box still holds what `usesMax(f)` gave when the form opened, the original `uses.max` is
  kept** as it was: byLevel, formula or number. Only a changed number replaces it.
- **A hint under the box** says when it scales ("Grows with your level: 3 now"; "From your WIS
  modifier: 3 now"), so a player knows that typing a number stops it scaling (my call).
- `used` is still clamped to the (new) maximum.
- `usesMax()` gets its first checks in the suite (the wiki notes it has none): a number, byLevel at
  several levels, `level`, an ability formula with and without a modifier, the floor of 1.

## 7. Tests

New checks in **a new block at the end of `sheet.js`**; existing checks that encode the old
behaviour are **rewritten in place**, not deleted. The builder finds them; expected:

- AC: best shield only (two shields → the higher); Calculated ignores `character.ac` (a `null` and
  a number both); Flat = the number + status and familiar `ac` effects only (an item's and a
  feature's excluded); `acMode` normalisation and the round trip; `blankChar().acMode==="calc"`;
  every AC reader gives the same number (`#acDisp`, `youAC()`, the new total line); the switch is
  refused while Vitals is locked; a blank Flat box is refused; `migrate()` turns a numberless Flat
  into Calculated. There is no existing manual-AC test to rewrite (`sheet.js` ≈ 637–651 covers
  light, medium, heavy, one shield and unequipped armour, and stays true). `char-update.js` ≈ 529,
  634 and 648 add `armorAC(c).base+sumFx('ac',c)` themselves: they go through the new AC function.
- Spells: an unticked "all attacks" +1 moves a weapon row and none of the three spell places; ticked,
  it moves all three by the same amount; ticked melee counts in a melee spell's row and cast window,
  not the card; ticked damage reaches a save spell's row and the cast window; `collectFx()` writes
  `spells` only for the six targets; the flag survives `contributions()` and each copy path the
  builder finds; **the shipped Archery** (`attack.ranged` +2) moves a longbow's row and not Fire
  Bolt's; a spell row with no spellcasting ability still shows its own ability (#74). No existing
  check asserts that a spell row adds generic effects; the #89 block's Fire Bolt penalty mark
  (≈ 6051–6066) comes from `spell.attack` and stays true.
- #132: saving unchanged keeps byLevel and a formula, in the feature form and the item form;
  changing the number makes it a number; the `usesMax()` checks above.

## 8. Docs, notes, screenshots

- **Wiki:** Armor & AC, Attacks & damage, Spells, Computed stats & effects (the `spells` flag; the
  contribution kinds), Features & traits (#132, and drop "usesMax has no check"), Character model
  (`acMode`), Combat view if it describes the AC shield, [Known issues](../wiki/roadmap/known-issues.md)
  (the #129, #130 and #132 entries go). A ledger entry; History lines.
- **`docs/rules-schema.md`** (ships): the item `effects` paragraph (≈ 559–561) says an `attack` or
  `damage` effect "adds to every attack the character makes, spells included". It is **rewritten**:
  weapons only, unless the effect carries `"spells": true`, which is documented there.
- **The Vitals pencil now locks AC too**, so this branch updates what the Vitals & HP branch wrote:
  that spec's decision 2 ("the badges work either way" stays true of Init, Speed and Prof), the
  pencil's aria-label ("…locks Max HP and a flat AC"), the Vitals wiki page and the proposed
  smoke-list line.
- **`UNRELEASED.md`** (drafts):
  - Armor Class can be set by hand: tap the AC shield and switch from Calculated to Flat, then type
    your AC. Flat ignores armour, shields and item bonuses; things that come and go, like the
    Shield spell as a status you've added, still add. The shield on the sheet reads FLAT while it's on.
  - Only your best shield counts toward Armor Class now; two equipped shields used to add together.
  - A to-hit or damage effect can count for spells: tick Include spells on the effect. The
    Spellcasting card, the cast window and the spell's attack row now always show the same number.
    An effect that isn't ticked counts for weapons only, so a spell's attack row no longer adds it:
    Archery's +2, for one, now goes only on ranged weapons, as the rules say, and no longer on a
    spell like Fire Bolt.
  - Editing a feature no longer stops its uses growing with your level.
- **Screenshots** to `.claude/qa/in-progress/130-armour-attack-numbers/`: the rail's shield
  Calculated and Flat (both skins, light and dark); the AC window in both modes and locked; an
  effect row with and without the tick; the Spellcasting card, the cast window and the spell's
  Attacks row agreeing; the feature form's hint. Driven: switch to Flat and type, equip armour in
  Flat (AC holds), tick and untick an effect.

## 9. Out of scope

- A typed base that armour builds on (decision 2), and Unarmored Defense or Mage Armor as formulas.
- Bless-style dice bonuses: effects stay numeric.
- Changing pack data.

## 10. Left to the builder

Names (`acTotal`, the contribution kind's field), the switch's markup (a segmented pair like the
hit-dice pill's, or two radio buttons), the struck line's wording, and the scaling hint's exact
words within §6's shape.
