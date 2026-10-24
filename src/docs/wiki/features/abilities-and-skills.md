# Abilities & skills

The six ability scores, their saving throws and the eighteen skills on the Sheet tab. The player
types the six scores; every modifier, save and skill bonus is computed. Proficiency comes from two
places — a dot the player taps, and grants that an ancestry, background, class or feat added — and
the higher of the two wins. The six abilities run as a strip across the top of the Sheet, each
with its save beneath; Skills is the card under it, beside Defences (#103).

**Code:** `buildStats()`, `buildAbilities()`, `buildSkills()`,
`placeLegend()`, `abilFinal()`, `modOf()`, `pbValue()`,
`effSaveProf()`, `effSkill()`, `grantedProf()` in `00-constants.js`; `recompute()` in
`10-compute.js`; `renderAll()` in `66-coins-hp.js`; `openStatBreakdown()` in `80-modal-forms.js`;
the dot handlers in `90-boot.js`; `syncStatLock()` in `87-combat.js`; markup in
`src/html/00-sheet.html` · **Tests:** `sheet.js`,
`rules-data.js` · **See also:** [Computed stats & effects](../architecture/computed-stats-and-effects.md),
[Grants & provenance](../architecture/grants-and-provenance.md),
[Sections & layout](../ui/sections-and-layout.md), [Combat view](combat-view.md)

## How it works

**Scores.** Each score is a number input bound by `data-path="character.abilities.<k>"` with
`data-recompute`, so every keystroke writes the model and runs `recompute()`. A typed score is the
*base*: ability increases from an ancestry, a background or a level's ASI are effects on features,
and `abilFinal()` adds every `ability.<k>` effect from enabled features, equipped items, active
statuses and summoned familiars. The modifier is `modOf()` of that. Typing CON also re-syncs a
seeded level-1 Max HP — the input handler grabs the previous score before the write
([Vitals & rest](vitals-and-rest.md)).

**Proficiency bonus** is `pbValue()`: 2 + ⌊(level − 1) / 4⌋ with the level clamped to 1–20, plus any
`profBonus` effect (an Ioun Stone of Mastery). The level is the sum of class levels. The box is
marked `fx-on` when an effect applies, and a tap opens its breakdown ("Level N: +2", then each
source).

**Saves.** The dot toggles `character.saves[k]` (a boolean). `effSaveProf()` is that OR a `save`
grant; the value is modifier + (proficient ? PB : 0) + `save.<k>` effects.

**Skills.** The dot cycles `character.skills[k]` 0 → 1 → 2 → 0: none, proficient, expertise.
`effSkill()` is the higher of that and the best `skill` grant, and the value is modifier + PB (from
level 1) + PB again (at 2) + `skill.<k>` effects + `check` effects, a bonus to every ability check
(a Stone of Good Luck). Passive Perception in Vitals is 10 + WIS modifier + the same proficiency
terms + `skill.perception` and `check` effects. Initiative takes `check` too: it is a Dexterity
check. The ability modifier does not: a plain ability check is the modifier plus the `check` lines
its breakdown lists apart from the score.

**What the sheet shows.** `recompute()` writes `data-lvl` (the effective level) onto each dot, and
`data-granted="1"` when the proficiency comes from a grant while the manual level is 0 — CSS draws
that as a ring. A value touched by an effect or a grant gets `fx-on`; one an effect lowers also gets
`fx-neg`, red with ▼, even when a bonus outweighs it (see
[Computed stats & effects](../architecture/computed-stats-and-effects.md)). Tapping a modifier, save or
skill value (`data-stat`) opens `openStatBreakdown()`: the base, which grant supplied the proficiency
(`grantSources()`), or "Proficiency (manual)", then each effect by source, a penalty in red.

**The ability strip** (`card strip`, the `abilities` section). `buildAbilities()` draws six
`.ability` boxes into `#abilities`: the name, the modifier large, the score small and editable, and
the save beneath with its proficiency dot. The strip is six across over the Sheet's middle and right
columns, and 3 × 2 at ≤1000px. There is no Saving Throws card: each save stays with its ability.

**The Skills card** (`#skillsCard`) lists all eighteen A → Z in two condensed columns that read
**down** each column: `.skills` is `grid-auto-flow:column` over
`grid-template-rows:repeat(var(--skill-rows,9),auto)`, and `buildSkills()` sets `--skill-rows` to
half the list, rounded up. The DOM order is unchanged, so Tab still walks A → Z; under 600px it is
one column. Each row is the dot, the bonus, the name and the ability; `placeLegend()` puts the one
legend (none · proficient · expertise) at the foot of the card.

`buildStats()` rebuilds both and is the first statement of `renderAll()`. **One layout** (#103):
the By ability ("grouped") layout and its Skills display setting are retired; a saved
`character.statStyle` stays in the sheet, unread.

**In the combat view.** Added to the [combat view](combat-view.md) with their own swords buttons,
the Ability Scores & Saves and Skills cards draw compact and read-only there; the Sheet tab is
unchanged. `syncStatLock()` disables the two cards' score boxes and proficiency dots exactly while
they sit in `#cvList` — after the view fills, after a card goes home, and after `buildStats()`
redraws, which matters because a redraw with the view open (a character switch) builds fresh
controls that must come out disabled. The look is CSS under
`#cvList [data-note="abilities"]` and `#cvList [data-note="skills"]`: six abilities in a row (three
on a phone), the score as a plain number, skills in three columns above 640px, two down to 381px,
one below, the legend hidden. The `#cvList` rules out-specify the Sheet's `.strip` and
`#skillsCard` rules, so the strip's own sizes do not leak in. Tapping a value still opens its
breakdown — that only reads.

**The compact Skills grid reads down each column at every width.** Each multi-column rule
(`#cvList [data-note="skills"] .skills`, at three columns and at two) sets its own
`grid-auto-flow:column` rather than depending on the Sheet tab's base `.skills` rule — the view's
narrower media query could win over that base rule and leave the grid reading across rows instead
(the #56 trap, reopened at phone width). The one-column rule below 381px keeps `grid-auto-flow:row`,
the only sane order with one column.

## Rules that must hold

- **One set of ids, each exactly once.** `mod-<k>`, `save-<k>`, `skill-<k>` and the `.dot` data
  attributes exist in the strip and the Skills card and nowhere else. `recompute()`, the breakdowns
  and print all find them by id; a second `#skill-perception` would leave `getElementById` updating
  one copy while the other rots.
- **`buildStats()` is `renderAll()`'s first statement**, before the `[data-path]` loop. The layout is
  per character, and every swap path — `loadCharById()`, `newCharacter()`, import, settings import —
  ends in `renderAll()`. The rebuild blanks the six score inputs, which the loop then refills;
  `recompute()` at the end repaints every number.
- **The retired `statStyle` field** stays in `blankChar()` (`classic`) and in old sheets, unread (#103).
- **The Skills card keeps `data-note="skills"` before its `id`.** `rules-data.js` counts the literal
  `<div class="card" data-note="` prefix to assert the number of note-bearing cards.
- **The legend is placed, never duplicated**, and appended to the Skills card — never into
  `#abilities`, which is cleared on every rebuild.
- **The strip's ≤1000px query comes after `.strip .abilities`** (asserted), or the strip stays six
  across on a tablet.
- **Expertise is display-only**, marked by CSS from the `data-lvl` that `recompute()` already writes.

## Traps

- **The builders used to run only at boot.** When the layout was a per-character choice, loading
  one sheet over another kept the first one's markup for good. The hook is `renderAll()`.
- **A two-column grid fills row by row**, so the Classic skills alphabet ran left-right-left-right
  until `grid-auto-flow:column`.
- **A multi-column rule that doesn't set its own `grid-auto-flow` inherits whichever rule wins the
  cascade at that width.** The combat view's compact Skills grid set `grid-template-columns` at both
  its three- and two-column breakpoints but relied on the Sheet tab's base `.skills` rule for the
  flow; the view's own ≤640px rule sat behind that base rule's own ≤600px switch to `row`, so at
  phone width the grid read across rows, not down columns — the #56 trap, reopened in a different
  rule.
- **`buildSkills()` guards `style.setProperty`**, because the harness's stub element has none.

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| The ability and skill layout (#103) | One: the strip with saves beneath, Skills as its own condensed card; no setting | Keeping By ability (the 2026-09-01 per-character choice): a second layout of the middle column to design and shoot, and its hidden Skills card cost a note button |
| Where the layout is rebuilt | `renderAll()`, first statement | Only at boot or on a settings toggle: loading one sheet over another kept the first one's markup |
| Where a bonus to plain ability checks shows (#79) | The ability's breakdown, apart from the score; the modifier box is unchanged and unmarked | Adding it to the modifier: attacks, saves and AC read that number. A "check" number in each ability box: new UI for one pack item. Owner may revisit |
| How the quick view reaches the combat view (#62) | The existing Abilities and Skills cards draw compact and read-only inside the view | A new Quick Stats card on the Sheet tab: duplicates the full cards there. A card that exists only in the view: needs a new way to add it, since cards are added from their own tab |
| The quick view's layout (#62) | The strip and Skills, compact (one layout since #103) | Following a per-character Skills display: retired with By ability |

## Open

- Rules content never grants expertise: a grant carries a level, but nothing supplies 2, and
  expertise features stay prose by decision (see [Known issues](../roadmap/known-issues.md)).
- Player-choice ability increases on some feats (Sun Touched, Moonlit) are applied by hand.

## History

- 2026-09-01 — the ability/skill layout choice: Classic or By ability, per character.
  → ledger L106, #17
- 2026-09-24 — Classic skills read down each column rather than across. → ledger L3525, #56
- 2026-09-29 — `check` effects reach every skill, initiative and passive Perception; the proficiency bonus is marked and tappable. → ledger L4689, #79
- 2026-10-06 — In the combat view the two cards draw compact and read-only. → ledger L5046, #62
- 2026-10-07 — The final review's fixes: the compact Skills grid sets its own `grid-auto-flow:column`
  at both multi-column breakpoints, so it reads down each column at every width. → ledger L5058, #55
- 2026-10-13 — A modifier, save or skill an effect lowers is red with ▼, even beside a bonus; its breakdown line is red. → ledger L5700, #89
- 2026-10-16 — In the combat view the By ability header keeps a full-size name, modifier and score. → ledger L5756, #92
- 2026-10-23 — One layout: the abilities as a strip with their saves, Skills its own condensed card beside Defences; By ability and the Skills display setting retired. → ledger L6633, #103
