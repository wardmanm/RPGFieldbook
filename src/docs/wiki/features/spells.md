# Spells

The Spells tab: the character's spellcasting numbers, spell slots, the spells they know grouped by
level, and a record of what is currently running. Casting a spell spends the right slot (offering to
upcast when that level is empty), handles a concentration clash, starts a timer for anything with a
duration, and pops the attack or save line for spells that have one. Spells are added from a rules
pack through a searchable browser, or typed in by hand.

**Code:** `renderSpells()`, `castSpell()`, `pickSlotLevel()`, `freeSlots()`, `promptSpellAttack()`,
`renderActiveSpells()`, `advanceRound()`, `bumpActive()`, `maybeExpire()`, `endActiveSpell()`,
`parseDurationSec()`, `spellDurationSec()`, `spellIsConc()`, `spellDC()`, `spellAtkBonus()` in
`60-attacks.js` · `autoSlots()`, `casterLevel()`, `classCasterKind()`, `warlockLevel()`,
`spellLevelTally()`, `spellAllotment()`, `cantripsKnown()`, `maxCastableLevel()` in `00-constants.js`
· `renderSlotBubbles()`, `longRest()`, `shortRest()` in `65-resources.js` · `browseSpells()` in
`85-browse.js` · `openSpellForm()`, `openSpellView()` in `80-modal-forms.js` · `grantedFromOrigin()`,
`spellOrigin()` in `25-origins-items.js` · `renderConcCard()` in `40-sheet.js` · markup
`src/html/20-spells.html` · **Data:** [rules-schema §6.7](../../../../docs/rules-schema.md) ·
**Tests:** `sheet.js` (casting, concentration, rounds, the tally), `rules-data.js`, `char-update.js`
· **See also:** [Attacks & damage](attacks-and-damage.md),
[Conditions & concentration](conditions-and-concentration.md), [Combat view](combat-view.md),
[Rules-update tool](rules-update-tool.md)

## How it works

**The tab**, top to bottom: Spellcasting (the ability select; save DC `8 + PB + mod` and spell attack
`PB + mod`, each plus its `spell.dc` / `spell.attack` effects from `spellDC()` / `spellAtkBonus()`,
marked when one applies; tapping either opens its breakdown, which names the item), Spell Slots, a Concentration card that mirrors the Concentrating condition
(`renderConcCard()`, hidden unless one is running), Active Spells (hidden when empty), then Spells &
Cantrips.

**The list.** `renderSpells()` groups by level, sorts by name, and heads each group with a `Prep`
caption over the tick column, the level, and a count from `spellLevelTally(lv)`: `added/allot`, with
granted spells shown as `+n` and the count painted `.over` when added exceeds the allotment. A row has
the prepared tick, the name (tap: `openSpellView()`), an origin badge, the meta line, Cast, Edit and
Delete. Deleting a spell also removes its attack row and any Active Spells entry, then reconciles the
Concentrating condition.

**What counts.** The allotment is `spellAllotment(lv)`: cantrips known (`CANTRIPS`, 2024
breakpoints at levels 1/4/10, summed over classes) for level 0, the slot total for 1–9. A spell counts
when its `granted` is empty. `grantedFromOrigin()` maps the Origin picker: Class or none counts; Feat,
Background, Ancestry and Item are named grants; every narrative origin (Purchased, Found…) is `Other`.
All of those are excluded. `allot === 0` means "no allotment known" and shows a bare count.

**Prepared is a marker only.** `castSpell()` and `pickSlotLevel()` never read `prepared`, and the
count is not about it. The tick has `aria-pressed`, a title saying what a tap does, and the `Prep`
caption, because a player on a phone never sees an `aria-label`. Print shows `◆`/`○` with no key.

**Adding.** With a spells pack loaded, Add opens `browseSpells()` (on the shared picker — see
[Shell](../ui/shell.md)): facets for Level, Class (defaulting to the character's own classes; a spell
with no class tag always passes), School (the first segment of `meta`) and Concentration; groups by
level, each heading carrying a live badge — the tally plus what is ticked now, not counting spells
already on the sheet, and nothing at all when the batch's Origin makes them granted. Duplicates are
skipped by name. Each added spell runs `detectSpellAttack()`, `stampSrc()` and `syncSpellAttack()`.
With no pack, Add opens `openSpellForm()`: Insert from rules pack (with "Only my class's castable
spells (up to level N)", from `maxCastableLevel()`), name, level, meta, text, Origin, attack/save
fields and extra damage types, Concentration, Duration, Prepared. Its save carries `s.src` across and
calls `syncSpellAttack()`.

**Slots.** `recompute()` calls `autoSlots()`. When any class is a caster (`classCasterKind()`: full,
half — Paladin, Ranger, Artificer — third for Eldritch Knight / Arcane Trickster, pact for Warlock, and
any class whose rules entry has `spellcasting` counts as full), the totals come from `SLOTS_FULL` at
`casterLevel()` (full levels + ⌊half/2⌋ + ⌊third/3⌋), then `PACT[warlockLevel()]` is **added** on top at
the pact level; the total boxes go read-only (`slotsAuto`) and `used` is clamped. With no caster class
and no spellcasting ability, slots are zeroed; with an ability but no caster class, the totals are
typed by hand. Bubbles toggle spent; ↻ Restore all clears them. A long rest restores every slot; a
short rest restores pact slots only.

**Casting.** `castSpell(id)`: a cantrip spends nothing; otherwise `pickSlotLevel()` takes the spell's
own level, or the lowest higher level with a free slot and asks before upcasting; none free is an
alert. A concentration spell (`spellIsConc()`: the explicit `conc`, else "concentration" in meta or
duration) asks before replacing the one already running. Only then is the slot spent. A spell that
concentrates or has a positive parsed duration is pushed to `activeSpells` as
`{id, spellId, name, level, conc, durationSec, elapsedSec:0, castAt}`, the Concentrating condition is
reconciled, a toast says what happened, and an attack or save spell opens `promptSpellAttack()`,
whose to-hit and DC come from `spellAtkBonus()` and `spellDC()`, effects included.

**Active Spells and the round.** Each entry shows its slot level, a C for concentration, elapsed /
duration and an "expired" flag; − rd / + rd move it 6 s, + sec… asks for seconds, ✕ ends it. The
card's Round ± is `advanceRound()`, the same function the [combat view](combat-view.md)'s tracker
calls: it moves `combatRound`, every active spell and every active timed condition by 6 s (see
[Conditions & concentration](conditions-and-concentration.md)), and in combat refuses to go below
round 1 (without touching the spells or conditions). `maybeExpire()` asks once, when elapsed reaches
duration, whether to end the spell, and re-arms if time is wound back. `parseDurationSec()` reads
rounds, minutes, hours, days, seconds and "instant"; anything else (Until dispelled) is untimed.

## Rules that must hold

- **One tally.** The tab heading and the browser badge both come from `spellLevelTally()`, so the
  number seen while picking is the number you get. A guard slices `renderSpells()`'s body and checks it
  calls the tally.
- **Prepared never gates anything** unless that is decided on purpose; today nothing reads it.
- **One formula per spell number.** The card, the cast window, save rows and the print sheet all
  read `spellDC()` and `spellAtkBonus()`; `recompute()` used to paint the card from its own copy of
  the formulas. A spell attack row gets the same `spell.attack` effects through `attackNumbers()`.
- **Explicit attack settings win** — see [Attacks & damage](attacks-and-damage.md).
- **Every rebuild-from-form save carries `src`.** Without it `updResolve()` falls back to the name,
  every edited spell reads as unknowably edited, and a same-named spell in another pack makes it
  ambiguous.
- **Pact slots are added on top.** `casterLevel()` deliberately excludes Warlock levels.
- **A step that cannot move the round must not move the spells**, or ◀ at round 1 quietly takes 6 s
  off everything.
- **Concentration is stored once**, on the active spell; the condition is a mirror. Every path that
  ends a spell reconciles it — see [Conditions & concentration](conditions-and-concentration.md).

## Traps

- **The browser's Add button was unreachable.** `#brOrigin` carried inline `flex:0 0 auto`, and the
  global `input,select,textarea{width:100%}` made that 100% of the footer; `.browse` is fixed with no
  scroll, so the button sat off-screen. Fixed with `width:auto` on `.br-origin` in the shared footer,
  and a guard that the global rule still exists — the fix is an override and means nothing without it.
  → L2429
- **A vacuous guard.** `/function renderSpells\(\)\{[\s\S]*?spellLevelTally\(lv\)/` ran past
  `renderSpells` into `browseSpells` and passed with the bug in place. Slice the function body first,
  then assert inside it. → L2429
- **The prepared tick sat low and right** because it is a `<button>`: UA padding left a 2px content
  box, and it inherited neither font nor line-height. `.equip .box` had the same defect. Only a zoomed
  screenshot showed it. → L2345
- **`openSpellForm()` dropped `s.src`** on save, the third member of the item/feature family. → L2927
- **Spell bonuses from items did nothing (#77).** Nothing read an item's spell attack or spell save
  DC bonus: the packs dropped 5e-tools' `bonusSpellAttack`/`bonusSpellSaveDc`, there was no target
  for them, and `spellDC()`/`spellAtkBonus()` summed no effects. An equipped Staff of Power or Moon
  Sickle changed no number on this tab. → L4568
- **"My Warlock lost its level-1 slots" is the rule**, not a bug: Pact Magic slots are all the highest
  unlocked level. Every row of the progression matched the PHB table. → L3169

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| Warlock slots replacing lower levels on level-up | Left alone — it is Pact Magic | "Fixing" it: measured against the PHB table, every row already matched |
| How the browser's level badges update | Repainted in place from `foot()` (`paintGroupBadges()`) | Re-rendering the list: loses scroll and redraws 400+ rows per tap |
| Carrying a count to a group heading | A `groupKey` / `groupBadge` hook on `openBrowse()` | Through `cfg.group`: its string is escaped, and would be stale |
| Fixing the off-screen Add button | `width:auto` on `.br-origin`, shared by both finders | `overflow-x:hidden` on `.browse`: hides a recurrence instead of preventing one; `flex-wrap` alone: a full-width select on every screen |
| Saying what the prepared tick means | A visible `Prep` caption, `aria-pressed` and a title | The `aria-label` alone: nobody on a phone ever sees it |
| An item's bonus to one class's spells, such as a Moon Sickle's (#77) | Applied to the one spellcasting the sheet has; the class stays in the description | Prose: the item would do nothing for the caster it was made for. See [Computed stats & effects](../architecture/computed-stats-and-effects.md) |

## Open

- **Half casters round down.** `casterLevel()` adds ⌊Paladin/Ranger/Artificer level ÷ 2⌋, so a level-1
  Paladin gets no slots; the 2024 Paladin and Ranger tables give 2 at level 1, which rounding up would
  match **(unverified against the book)**.
- **Multiclass pact slots share the pool** (Wizard 3 / Warlock 3 reads L1:4 L2:4); real 5e tracks them
  apart because they return on a short rest. A known simplification.
- No suite test names `pickSlotLevel()`, `parseDurationSec()` or `autoSlots()`; the `castSpell()` tests
  give every level free slots, so the upcast path is exercised only in the browser.
- Casting ignores `prepared` and ritual casting; the print sheet's `◆` has no key.
- A spell row's to-hit can disagree with the Spellcasting card when a weapon effect (`attack`,
  `attack.<kind>`) applies — see [Attacks & damage](attacks-and-damage.md). `spell.attack` reaches
  both.
- **One spellcasting per sheet.** A multiclass caster with two spellcasting abilities has one DC and
  one attack bonus here, so a bonus for one class's spells (a Moon Sickle's) reads on the other's
  too.
- More in [Known issues](../roadmap/known-issues.md).

## History

- 2026-08-07 — Spells as attacks or saves; Cast spends a slot with upcast; Active Spells and the round counter. → ledger L179
- 2026-08-07 — Tab order Sheet → Spells → Inventory; Active Spells moves to the Spells tab; cast toast; attack auto-detect. → ledger L212
- 2026-08-07 — Spell Origin replaces "Granted by"; allotment counting preserved. → ledger L153
- 2026-08-15 — The prepared tick centred, captioned `Prep`, and given `aria-pressed`. → ledger L2345
- 2026-08-15 — Spell browser: per-level count badges from `spellLevelTally()`; Add button back on screen. → ledger L2429
- 2026-08-17 — Editing a spell keeps its `src` stamp. → ledger L2927
- 2026-08-17 — Casting a concentration spell adds the Concentrating condition. → ledger L2893, #37
- 2026-08-18 — The Concentration mirror card above Active Spells. → ledger L3151
- 2026-08-18 — Slots on level-up investigated: Pact Magic, working as the rule says. → ledger L3169
- 2026-09-28 — Items' spell attack and spell save DC bonuses reach the card, rows, cast window and print; the card's numbers open a breakdown. → ledger L4568, #77
- 2026-10-06 — Timed conditions: a duration in rounds, minutes or hours, counted down by the round
  tracker, clearing itself with an Undo. → ledger L5031, #55
