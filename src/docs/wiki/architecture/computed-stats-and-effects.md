# Computed stats & effects

Every number the sheet derives is recomputed from the character's base values plus a flat list of
numeric **effects** contributed by whatever is active right now. That covers ability modifiers,
saves, skills, AC, initiative, speed, passive Perception, the proficiency bonus, spell DC and
attack, attack to-hit and damage, and effective Max HP. An effect is `{target, value}`, such as
"AC +1" or "WIS save +2". `recompute()` is the one place that repaints them all. Anything that is
not a number (advantage, resistance, darkvision) is deliberately not an effect.

**Code:** `contributions()`, `sumFx()`, `abilFinal()`, `pbValue()`, `effMaxHP()`, `clampHP()`,
`effSkill()`, `effSaveProf()`, `fxTargets()`, `autoSlots()` in `00-constants.js`; `recompute()`,
`mark()` in `10-compute.js`; `usesMax()` in `20-lists.js`; `armorAC()`, `encState()`, `encSpeed()`
in `25-origins-items.js`; `attackNumbers()`, `spellDC()`, `spellAtkBonus()` in `60-attacks.js`;
`resolveResMax()`, `resolveResDie()`, `syncResources()` in `65-resources.js`;
`openStatBreakdown()`, `collectFx()` in `80-modal-forms.js` · **Tests:** `sheet.js`
(`contributions()`, `armorAC()`, encumbrance, HP bounds), `char-update.js` (`syncResources()`, die
size, `clampHP()`) · **See also:** [Armor & AC](../features/armor-and-ac.md),
[Attacks & damage](../features/attacks-and-damage.md),
[Class resources](../features/class-resources.md), [Grants & provenance](grants-and-provenance.md),
[Abilities & skills](../features/abilities-and-skills.md)

## How it works

**Where effects come from.** `contributions()` walks four lists and returns
`{source, target, value}` for every effect that is live:

| Source | Live when |
|---|---|
| `features[]` | `enabled !== false` (the On/Off toggle) |
| `inventory[]` | `equipped` |
| `statuses[]` | `active !== false` |
| `familiars[]` | `active` (named "(summoned)" in the breakdown) |

`value` goes through `num()`, so an effect is an integer. `sumFx(target, contribs)` adds up one
target. The targets are exactly those `fxTargets()` lists, which is also the effect editor's
dropdown:

| Target | Adds to |
|---|---|
| `ac`, `init`, `speed`, `hp.max`, `profBonus` | that number |
| `attack`, `attack.melee`, `attack.ranged` | to-hit: all attacks, or melee / ranged only |
| `damage`, `damage.melee`, `damage.ranged` | the damage bonus, likewise |
| `spell.attack`, `spell.dc` | the spell attack bonus and the spell save DC, through `spellAtkBonus()` / `spellDC()` |
| `ability.<abil>` | the ability *score* (so the modifier and everything using it follow) |
| `save.<abil>`, `skill.<skill>` | that save or skill |

`collectFx()` drops a zero-valued row when an effect is saved.

**`recompute()`** takes `contributions()` once and passes it down (`abilFinal(k, c)`,
`pbValue(c)`, `armorAC(c)`), then in order:

- sets `character.level` from the classes, and computes the proficiency bonus as
  `2 + floor((level−1)/4)` plus `profBonus` effects;
- for each ability: score + `ability.x` effects gives the modifier, and the save adds the
  proficiency bonus if proficient (the player's own dot or a grant) plus `save.x` effects;
- for each skill: modifier + proficiency bonus (level ≥ 1) + proficiency bonus again (expertise) +
  `skill.x` effects;
- AC is `armorAC(c).base` plus `ac` effects. Initiative is the typed value, or the DEX modifier when
  blank, plus `init` effects;
- speed is the typed speed plus `speed` effects, **then** encumbrance through `encSpeed()`, which is
  applied last and outside the engine;
- passive Perception is 10 + WIS + proficiency + `skill.perception` effects. The Max HP note shows
  typed Max + `hp.max` effects;
- spell save DC is `spellDC(c)`, 8 + proficiency + ability modifier + `spell.dc` effects, and spell
  attack is `spellAtkBonus(c)`, proficiency + modifier + `spell.attack` effects, each marked when an
  effect applies ("—" with no spellcasting ability);
- then it repaints death saves, runs `autoSlots()` and `syncResources()`, repaints slots, hit dice
  and resources, sets every spell attack row to the current spellcasting ability, and redraws
  Attacks and Active Spells.

A number an effect or a grant changed gets `.fx-on` through `mark()`. Tapping any `data-stat` number
opens `openStatBreakdown()`, which lists the base, the grant that supplied a proficiency, and each
contribution by source name.

**Elsewhere, the same pattern:** `attackNumbers(a)` (the better of STR/DEX for finesse, proficiency
if set, `atkMisc`, `attack` + `attack.<kind>` effects, and `spell.attack` on a spell attack row
only; damage adds the modifier if `addAbilityDamage`, `dmgMisc`, `damage` + `damage.<kind>`),
`spellDC()`/`spellAtkBonus()`, which the card, save rows, the cast window and the print sheet all
read, and `effMaxHP()`. Every HP change ends in `clampHP()`. AC's base is covered in
[Armor & AC](../features/armor-and-ac.md). Magic armor still needs an `ac` effect for its bonus.

**Use counts that scale.** `usesMax(f)` resolves a feature's `uses.max`:

| `uses.max` | Resolves to |
|---|---|
| a number | itself |
| `{byLevel:[…]}` | the entry at the character's **total** level |
| `{formula:"level"}` | total level |
| `{formula:"wis"}`, `"cha+1"`, … (or the bare string) | that ability's modifier, effects included, ± N, **minimum 1** |

It is re-resolved at every render, so it follows ability changes (Night Domain's Ward of Shadows is
`{formula:"wis"}`). Class resource pools use the same grammar through `resolveResMax()`, with two
differences. `level` there is **the owning class's level**, and anything unresolvable is 0, which
removes the pool. `resolveResDie()` sizes a pool's die the same way (`{byLevel:[sides…]}`, or a
fixed `8`/`"d8"`).

## Rules that must hold

- **Effects are numeric-only.** Advantage and disadvantage, resistances and immunities, Darkvision,
  climb/swim/burrow/fly speeds (only walking `speed` is a target), natural weapons, "you know X
  spell", the expertise cases (Gallus "Communal", Sun Touched "Intimidation") and player-choice
  ability boosts on feats (Sun Touched, Moonlit) all stay as prose or glossary. That is correct,
  not a gap, so do not "fix" it.
- **An effect is global to its target.** An equipped item's `attack` or `damage` effect reaches every
  attack row, spell rows included, so a bonus scoped to one weapon is not an effect: a weapon's own
  `+N` is its `atkMisc`/`dmgMisc`, and a bonus for bows or unarmed strikes stays prose (#74).
- **An effect is always on while its source is live.** Nothing can say "against one attack", "once
  per rest" or "while unarmored", so a bonus the book gives only in a moment is prose, not an effect:
  Quarterstaff of the Acrobat's Reaction, the Arrow-Catching Shield's +2 against ranged attacks, the
  Rod of Alertness's planted aura (#76). The packs read the book's sentence to decide; see
  [Converter](../data/converter.md).
- **Base values never have effects baked in.** A typed score, Max HP, AC or speed is the base, and
  effects layer on top at read time. That is what lets an effect come off again. It is also why the
  level-1 HP seed reads the bare CON score (see [Grants & provenance](grants-and-provenance.md)).
- **Encumbrance stays outside the engine,** applied after the effects: two of its outcomes
  *replace* speed (5 ft over capacity, 0 at the hard limit) and the third (disadvantage) is not a
  number.
- **Compute `contributions()` once and pass it down.** `effMaxHP()`, `spellDC()` and
  `spellAtkBonus()` take it optionally for exactly this reason. The HP expression used to be written
  out in three places, and the Spellcasting card had its own copy of the spell formulas, which is
  how it missed the item bonuses (#77).
- **`recompute()` writes to the model,** not just the DOM: `level`, slot totals, the auto resource
  pools, and the spell attack rows' ability. It does not call `renderHP()`, so callers that change
  HP render it themselves.
- **Both ability/skill layouts emit the same ids** (`#mod-x`, `#save-x`, `#skill-x`) and the same
  `.dot[data-save]`/`[data-skill]` attributes, because `recompute()` finds every number by id. See
  [Abilities & skills](../features/abilities-and-skills.md).

## Traps

- **A renamed id is a white screen.** Most lookups in `recompute()` are unguarded, and it is the
  hottest function in the app. The inspiration star's lookup is guarded for exactly this reason.
  Rename a Vitals id and every render path throws.
- **A duplicate id rots silently.** Leaving the classic skill rows in place under the grouped
  layout put two `#skill-perception` elements in the page. `getElementById` updates the first, and
  print reads by id too. `buildSkills()` now clears them.
- **Two resolvers, two level bases.** `usesMax()` indexes `byLevel` by total character level,
  while `resolveResMax()` uses the class's own level. A multiclass character's feature with a
  `byLevel` table would read the total-level row. No shipped pack uses `uses.max.byLevel` today.

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| What an effect can express | Numeric modifiers only (`{target, value}`) | Modelling advantage, resistance, senses and alternate speeds as effects: they stay prose or glossary, verified NOT gaps (L2581, CLAUDE.md) |
| How `uses.max` scales | A number, `byLevel`, or a `formula` re-resolved at render | — (L16) |
| Where encumbrance applies | After the effects, outside the engine | As a speed effect: two outcomes replace speed and one is not numeric (code comment, `10-compute.js`) |
| A bonus scoped to one weapon (#74) | The weapon's `atkMisc`/`dmgMisc`, or prose on an item with no weapon | An `attack`/`damage` effect: it reaches every row, and on a weapon it doubled the row's own `atkMisc` |
| A bonus that holds only in a moment (#76) | Prose, like advantage and resistance | An effect: it is on whenever the source is live, so a once-per-rest Reaction read as +5 AC all day |
| Where an item's spell attack and DC bonus goes (#77) | Two numeric targets, `spell.attack` and `spell.dc`, read by `spellAtkBonus()`/`spellDC()` | Reusing `attack`: it reaches every weapon row, so a Wand of the War Mage would make a sword more accurate. Prose: a flat bonus to one number is exactly what an effect is |
| A spell bonus the book limits to one class's spells (#77) | Applied to the character's one spellcasting; the class stays in the description | Prose: all 18 of Tasha's focuses and sickles would do nothing for the casters they were made for. Exact only for a single-class caster; a multiclass one's other class reads it too. Owner may revisit |

## Open

- `usesMax()` has no suite coverage. The ledger records it as unit-tested, but no test in
  `src/tests/` calls it now.
- `attackNumbers()` and `pbValue()` are likewise untested by any suite.
- A feat that lets the player choose an ability to boost is applied by hand. There is no
  feat-level ability-choice mechanism, though it could mirror the skill-choice path.

See [Known issues](../roadmap/known-issues.md).

## History

- 2026-08-07 — `usesMax()` accepts `byLevel` and `formula`, and Night Domain's Ward of Shadows is wired to `{formula:"wis"}`. → ledger L16
- 2026-08-07 — Recorded as verified NOT gaps: non-numeric effects stay prose. → ledger L2581
- 2026-08-11 — Encumbrance is applied to speed after the effects. → ledger L1361
- 2026-09-01 — Two stat layouts over one set of ids. → ledger L106, #17
- 2026-09-25 — Resource pools gain a die size resolved per level. → ledger L3676
- 2026-09-28 — A weapon's bonus is not an effect: the packs' `+N` weapons no longer add to every attack while equipped. → ledger L4392, #74
- 2026-09-28 — An effect is a standing bonus: the packs' conditional AC and saving-throw bonuses stay prose. → ledger L4502, #76
- 2026-09-28 — `spell.attack` and `spell.dc` targets; `spellDC()`/`spellAtkBonus()` add them and the card paints through them. → ledger L4568, #77
