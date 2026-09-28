# Abilities & skills

The six ability scores, their saving throws and the eighteen skills on the Sheet tab. The player
types the six scores; every modifier, save and skill bonus is computed. Proficiency comes from two
places — a dot the player taps, and grants that an ancestry, background, class or feat added — and
the higher of the two wins. A per-character setting lays the block out one of two ways, over one set
of element ids.

**Code:** `buildStats()`, `buildAbilities()`, `buildSkills()`, `statGroupsHTML()`,
`statGroupHTML()`, `statStyle()`, `placeLegend()`, `abilFinal()`, `modOf()`, `pbValue()`,
`effSaveProf()`, `effSkill()`, `grantedProf()` in `00-constants.js`; `recompute()` in
`10-compute.js`; `renderAll()` in `66-coins-hp.js`; `openStatBreakdown()` in `80-modal-forms.js`;
the dot handlers in `90-boot.js`; markup in `src/html/00-sheet.html` · **Tests:** `sheet.js`,
`rules-data.js` · **See also:** [Computed stats & effects](../architecture/computed-stats-and-effects.md),
[Grants & provenance](../architecture/grants-and-provenance.md),
[Sections & layout](../ui/sections-and-layout.md)

## How it works

**Scores.** Each score is a number input bound by `data-path="character.abilities.<k>"` with
`data-recompute`, so every keystroke writes the model and runs `recompute()`. A typed score is the
*base*: ability increases from an ancestry, a background or a level's ASI are effects on features,
and `abilFinal()` adds every `ability.<k>` effect from enabled features, equipped items, active
statuses and summoned familiars. The modifier is `modOf()` of that. Typing CON also re-syncs a
seeded level-1 Max HP — the input handler grabs the previous score before the write
([Vitals & rest](vitals-and-rest.md)).

**Proficiency bonus** is `pbValue()`: 2 + ⌊(level − 1) / 4⌋ with the level clamped to 1–20, plus any
`profBonus` effect. The level is the sum of class levels.

**Saves.** The dot toggles `character.saves[k]` (a boolean). `effSaveProf()` is that OR a `save`
grant; the value is modifier + (proficient ? PB : 0) + `save.<k>` effects.

**Skills.** The dot cycles `character.skills[k]` 0 → 1 → 2 → 0: none, proficient, expertise.
`effSkill()` is the higher of that and the best `skill` grant, and the value is modifier + PB (from
level 1) + PB again (at 2) + `skill.<k>` effects. Passive Perception in Vitals is 10 + WIS modifier
+ the same proficiency terms + `skill.perception` effects.

**What the sheet shows.** `recompute()` writes `data-lvl` (the effective level) onto each dot, and
`data-granted="1"` when the proficiency comes from a grant while the manual level is 0 — CSS draws
that as a ring. A value touched by an effect or a grant gets `fx-on`. Tapping a modifier, save or
skill value (`data-stat`) opens `openStatBreakdown()`: the base, which grant supplied the proficiency
(`grantSources()`), or "Proficiency (manual)", then each effect by source.

**Two layouts.** `character.statStyle` is `"classic"` or `"grouped"`, set under Settings → This
character → Skills display (Classic / By ability), which calls `renderAll()`.

- **Classic.** `#abilities` is a three-column grid of six boxes, each with its save underneath. The
  Skills card lists all eighteen A → Z in two columns that read **down** each column: `.skills` is
  `grid-auto-flow:column` over `grid-template-rows:repeat(var(--skill-rows,9),auto)`, and
  `buildSkills()` sets `--skill-rows` to half the list, rounded up. The DOM order is unchanged, so
  Tab still walks A → Z; under 600px it is one column.
- **Grouped.** `statGroupsHTML()` fills `#abilities` with `.agroups`: three across (two under 900px,
  one under 560px), each ability a compact header row — name, modifier, score — over its saving
  throw and the skills it governs ("No skills use CON" for CON). Expertise shows an "Expert" tag,
  drawn by CSS alone off `.dot[data-lvl="2"]`. The Skills card is hidden, not removed, and
  `placeLegend()` moves the one legend node into the Abilities card.

`buildStats()` rebuilds both halves and is the first statement of `renderAll()`.

## Rules that must hold

- **One set of ids, each exactly once.** `mod-<k>`, `save-<k>`, `skill-<k>` and the `.dot` data
  attributes exist in whichever layout is showing, and nowhere else. `recompute()`, the breakdowns
  and print all find them by id. In grouped mode `buildSkills()` must **clear** `#skills` and
  return, not merely rely on the hidden card: a second `#skill-perception` would leave
  `getElementById` updating one copy while the other rots. `sheet.js` asserts each skill id appears
  once in the grouped markup.
- **`buildStats()` is `renderAll()`'s first statement**, before the `[data-path]` loop. The layout is
  per character, and every swap path — `loadCharById()`, `newCharacter()`, import, settings import —
  ends in `renderAll()`. The rebuild blanks the six score inputs, which the loop then refills;
  `recompute()` at the end repaints every number.
- **`statStyle()` falls back to exactly `blankChar()`'s default** (`classic`), which is why the field
  needs no migration. A test asserts the two agree.
- **`.agroups` spans `grid-column:1/-1`.** `#abilities` is itself a three-column grid.
- **The Skills card keeps `data-note="skills"` before its `id`.** `rules-data.js` counts the literal
  `<div class="card" data-note="` prefix to assert the number of note-bearing cards.
- **The legend is moved, never duplicated**, and appended to the card — never into `#abilities`,
  which is cleared on every rebuild.
- **Expertise is display-only**, marked by CSS from the `data-lvl` that `recompute()` already writes.

## Traps

- **The builders used to run only at boot.** Loading a grouped sheet over a classic one kept the
  classic markup for good. The hook is `renderAll()`, not the settings toggle.
- **The grouped block rendered into one third of the card**, every label wrapped, until `.agroups`
  spanned the parent grid. Caught by a screenshot; the suite has no layout.
- **The first grouped cut was one vertical column** — each row full-width with a two-word label, the
  ability in a tall box beside a list that for STR is one row. The card was taller than the viewport;
  three-across with a header row brought it to 448px. None of it showed in the DOM assertions.
- **A two-column grid fills row by row**, so the Classic skills alphabet ran left-right-left-right
  until `grid-auto-flow:column`.
- **`buildSkills()` guards `style.setProperty`**, because the harness's stub element has none.

## Decisions

| Question | Decision | Rejected, and why |
|---|---|---|
| How the grouped layout is laid out | Three across, two down; each ability a header row over its save and skills | One vertical column: it read as mostly air and ran taller than the viewport |
| Where the layout is rebuilt | `renderAll()`, first statement | Only on the settings toggle: loading a grouped sheet over a classic one kept the classic markup |
| What grouped mode does to the Skills card | Hides it and empties `#skills` | Only hiding it: a duplicate `#skill-perception`, with one copy silently stale |
| How the setting avoids a migration | A resolver whose fallback equals the `blankChar()` default, as `hdStyle` does | — |
| How expertise is marked in grouped mode | CSS off the dot's `data-lvl` | — |
| The Skills note button, hidden in grouped mode | Shipped as a known gap | A second note button in the Abilities label: worse UI than the gap |

## Open

- In grouped mode the Skills card's note button is hidden, and the Notes tab lists only sections
  that already have a note, so a Skills note cannot be *started* there. Existing notes stay listed.
- Rules content never grants expertise: a grant carries a level, but nothing supplies 2, and
  expertise features stay prose by decision (see [Known issues](../roadmap/known-issues.md)).
- Player-choice ability increases on some feats (Sun Touched, Moonlit) are applied by hand.

## History

- 2026-09-01 — the ability/skill layout choice: Classic or By ability, per character.
  → ledger L106, #17
- 2026-09-24 — Classic skills read down each column rather than across. → ledger L3525, #56
